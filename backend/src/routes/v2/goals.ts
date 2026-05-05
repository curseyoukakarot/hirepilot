/**
 * v2 — /api/v2/goals
 * REX-driven outcomes (a goal has a plan, status, execution trail).
 *
 * GET    /api/v2/goals                       list goals (filter ?status=running)
 * GET    /api/v2/goals/:id                   one goal
 * POST   /api/v2/goals                       create a goal (status defaults to 'planning')
 * PATCH  /api/v2/goals/:id                   update title/plan/trust_level/metadata
 * DELETE /api/v2/goals/:id                   hard delete (rare)
 *
 * POST   /api/v2/goals/:id/approve           planning|awaiting_approval -> running
 * POST   /api/v2/goals/:id/pause             running -> paused
 * POST   /api/v2/goals/:id/resume            paused -> running
 * POST   /api/v2/goals/:id/cancel            * -> cancelled
 * POST   /api/v2/goals/:id/complete          running -> completed
 *
 * Owner of the goal or workspace admin/owner can mutate.
 */

import express, { Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { requireAuth } from '../../../middleware/authMiddleware';
import activeWorkspace from '../../middleware/activeWorkspace';

const router = express.Router();
router.use(requireAuth as any, activeWorkspace as any);

const VALID_STATUS = new Set([
  'planning',
  'awaiting_approval',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled'
]);

const VALID_TRUST = new Set(['manual', 'suggest', 'autopilot']);
const ADMIN_ROLES = new Set(['owner', 'admin']);

function canMutate(req: Request, ownerId: string | null): boolean {
  const userId = (req as any)?.user?.id;
  const role = String((req as any).workspaceRole || '').toLowerCase();
  return userId && (userId === ownerId || ADMIN_ROLES.has(role));
}

async function loadGoal(id: string, workspaceId: string) {
  const { data, error } = await supabase
    .from('goals')
    .select('id, workspace_id, owner_id, title, prompt, plan, status, trust_level, recurring, schedule_cron, parent_goal_id, metadata, created_at, started_at, completed_at, updated_at')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) return { error };
  return { goal: data };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as any).workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'no_active_workspace' });

    const status = String(req.query.status || '').trim();
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    let query = supabase
      .from('goals')
      .select('id, workspace_id, owner_id, title, prompt, plan, status, trust_level, recurring, schedule_cron, parent_goal_id, metadata, created_at, started_at, completed_at, updated_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      if (!VALID_STATUS.has(status)) return res.status(400).json({ error: 'invalid_status' });
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ goals: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'list_goals_failed' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as any).workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'no_active_workspace' });
    const { goal, error } = await loadGoal(req.params.id, workspaceId);
    if (error) return res.status(500).json({ error: error.message });
    if (!goal) return res.status(404).json({ error: 'goal_not_found' });
    return res.json({ goal });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'get_goal_failed' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as any).workspaceId;
    const userId = (req as any)?.user?.id;
    if (!workspaceId) return res.status(400).json({ error: 'no_active_workspace' });
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });

    const { title, prompt, plan, status, trust_level, recurring, schedule_cron, parent_goal_id, metadata } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'title_required' });
    }
    if (status && !VALID_STATUS.has(status)) return res.status(400).json({ error: 'invalid_status' });
    if (trust_level && !VALID_TRUST.has(trust_level)) return res.status(400).json({ error: 'invalid_trust_level' });

    const { data, error } = await supabase
      .from('goals')
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        title: String(title).trim(),
        prompt: prompt || null,
        plan: plan || null,
        status: status || 'planning',
        trust_level: trust_level || 'suggest',
        recurring: !!recurring,
        schedule_cron: schedule_cron || null,
        parent_goal_id: parent_goal_id || null,
        metadata: metadata || {}
      })
      .select('id, workspace_id, owner_id, title, prompt, plan, status, trust_level, recurring, schedule_cron, parent_goal_id, metadata, created_at, started_at, completed_at, updated_at')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ goal: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'create_goal_failed' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as any).workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'no_active_workspace' });
    const { goal } = await loadGoal(req.params.id, workspaceId);
    if (!goal) return res.status(404).json({ error: 'goal_not_found' });
    if (!canMutate(req, (goal as any).owner_id)) return res.status(403).json({ error: 'forbidden' });

    const { title, prompt, plan, trust_level, recurring, schedule_cron, metadata } = req.body || {};
    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = String(title || '').trim() || null;
    if (prompt !== undefined) updates.prompt = prompt || null;
    if (plan !== undefined) updates.plan = plan;
    if (trust_level !== undefined) {
      if (!VALID_TRUST.has(trust_level)) return res.status(400).json({ error: 'invalid_trust_level' });
      updates.trust_level = trust_level;
    }
    if (recurring !== undefined) updates.recurring = !!recurring;
    if (schedule_cron !== undefined) updates.schedule_cron = schedule_cron || null;
    if (metadata !== undefined) updates.metadata = metadata;

    if (!Object.keys(updates).length) return res.status(400).json({ error: 'no_updates_provided' });

    const { data, error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .select('id, workspace_id, owner_id, title, prompt, plan, status, trust_level, recurring, schedule_cron, parent_goal_id, metadata, created_at, started_at, completed_at, updated_at')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ goal: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'update_goal_failed' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as any).workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'no_active_workspace' });
    const { goal } = await loadGoal(req.params.id, workspaceId);
    if (!goal) return res.status(404).json({ error: 'goal_not_found' });
    if (!canMutate(req, (goal as any).owner_id)) return res.status(403).json({ error: 'forbidden' });

    const { error } = await supabase.from('goals').delete().eq('id', req.params.id).eq('workspace_id', workspaceId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'delete_goal_failed' });
  }
});

// ====================================================================
// Status transitions
// ====================================================================
async function transitionStatus(
  req: Request,
  res: Response,
  fromStatuses: string[],
  toStatus: string,
  extraUpdates: Record<string, any> = {}
) {
  try {
    const workspaceId = (req as any).workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'no_active_workspace' });
    const { goal } = await loadGoal(req.params.id, workspaceId);
    if (!goal) return res.status(404).json({ error: 'goal_not_found' });
    if (!canMutate(req, (goal as any).owner_id)) return res.status(403).json({ error: 'forbidden' });

    if (fromStatuses.length && !fromStatuses.includes((goal as any).status)) {
      return res.status(409).json({
        error: 'invalid_transition',
        from: (goal as any).status,
        to: toStatus,
        allowed_from: fromStatuses
      });
    }

    const updates: Record<string, any> = { status: toStatus, ...extraUpdates };
    if (toStatus === 'running' && !(goal as any).started_at) updates.started_at = new Date().toISOString();
    if (toStatus === 'completed' || toStatus === 'failed' || toStatus === 'cancelled') {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .select('id, workspace_id, owner_id, title, prompt, plan, status, trust_level, recurring, schedule_cron, parent_goal_id, metadata, created_at, started_at, completed_at, updated_at')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ goal: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'transition_failed' });
  }
}

router.post('/:id/approve', (req, res) =>
  transitionStatus(req, res, ['planning', 'awaiting_approval'], 'running')
);
router.post('/:id/pause', (req, res) => transitionStatus(req, res, ['running'], 'paused'));
router.post('/:id/resume', (req, res) => transitionStatus(req, res, ['paused'], 'running'));
router.post('/:id/cancel', (req, res) => transitionStatus(req, res, [], 'cancelled'));
router.post('/:id/complete', (req, res) => transitionStatus(req, res, ['running'], 'completed'));

export default router;
