/**
 * v2 — /api/v2/decisions
 * REX-held approvals queue. Each row is a proposed action waiting for a human.
 *
 * GET    /api/v2/decisions                    list (filter ?status=pending&assigned_to=me)
 * GET    /api/v2/decisions/:id                one decision
 * POST   /api/v2/decisions                    create (REX or backend service)
 * POST   /api/v2/decisions/:id/approve        approve as-is
 * POST   /api/v2/decisions/:id/edit           approve with edited payload
 * POST   /api/v2/decisions/:id/reject         reject with reason
 * POST   /api/v2/decisions/:id/snooze         snooze until a timestamp
 * POST   /api/v2/decisions/:id/graduate       approve AND store auto-handle rule
 *
 * Assignee or workspace admin can mutate.
 */

import express, { Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { requireAuth } from '../../../middleware/authMiddleware';
import activeWorkspace from '../../middleware/activeWorkspace';

const router = express.Router();
router.use(requireAuth as any, activeWorkspace as any);

const VALID_STATUS = new Set(['pending', 'approved', 'edited', 'rejected', 'snoozed', 'graduated']);
const VALID_TYPE = new Set([
  'reply_draft',
  'scale_recommendation',
  'guardrail_override',
  'offer_send',
  'pipeline_move',
  'submittal_send',
  'custom'
]);
const ADMIN_ROLES = new Set(['owner', 'admin']);

function canResolve(req: Request, assignedTo: string | null): boolean {
  const userId = (req as any)?.user?.id;
  const role = String((req as any).workspaceRole || '').toLowerCase();
  if (!userId) return false;
  if (assignedTo && userId === assignedTo) return true;
  return ADMIN_ROLES.has(role);
}

const SELECT = 'id, workspace_id, goal_id, agent_id, type, context, payload, reason, status, assigned_to, resolution, resolved_by, resolved_at, graduated_rule, snoozed_until, created_at';

async function loadDecision(id: string, workspaceId: string) {
  const { data, error } = await supabase
    .from('decisions')
    .select(SELECT)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return { decision: data, error };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as any).workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'no_active_workspace' });

    const status = String(req.query.status || '').trim();
    const goalId = String(req.query.goal_id || '').trim();
    const assignedToParam = String(req.query.assigned_to || '').trim();
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    let query = supabase
      .from('decisions')
      .select(SELECT)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      if (!VALID_STATUS.has(status)) return res.status(400).json({ error: 'invalid_status' });
      query = query.eq('status', status);
    }
    if (goalId) query = query.eq('goal_id', goalId);
    if (assignedToParam) {
      if (assignedToParam === 'me') {
        const userId = (req as any)?.user?.id;
        if (userId) query = query.eq('assigned_to', userId);
      } else {
        query = query.eq('assigned_to', assignedToParam);
      }
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ decisions: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'list_decisions_failed' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as any).workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'no_active_workspace' });
    const { decision, error } = await loadDecision(req.params.id, workspaceId);
    if (error) return res.status(500).json({ error: error.message });
    if (!decision) return res.status(404).json({ error: 'decision_not_found' });
    return res.json({ decision });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'get_decision_failed' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as any).workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'no_active_workspace' });

    const { type, context, payload, reason, goal_id, agent_id, assigned_to } = req.body || {};
    if (!type || !VALID_TYPE.has(type)) return res.status(400).json({ error: 'invalid_type' });
    if (!context) return res.status(400).json({ error: 'context_required' });
    if (!payload) return res.status(400).json({ error: 'payload_required' });

    const { data, error } = await supabase
      .from('decisions')
      .insert({
        workspace_id: workspaceId,
        goal_id: goal_id || null,
        agent_id: agent_id || null,
        type,
        context,
        payload,
        reason: reason || null,
        assigned_to: assigned_to || (req as any)?.user?.id || null
      })
      .select(SELECT)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ decision: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'create_decision_failed' });
  }
});

async function resolveDecision(
  req: Request,
  res: Response,
  newStatus: 'approved' | 'edited' | 'rejected' | 'snoozed' | 'graduated',
  extraUpdates: Record<string, any> = {}
) {
  try {
    const workspaceId = (req as any).workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'no_active_workspace' });
    const { decision } = await loadDecision(req.params.id, workspaceId);
    if (!decision) return res.status(404).json({ error: 'decision_not_found' });
    if (!canResolve(req, (decision as any).assigned_to)) return res.status(403).json({ error: 'forbidden' });

    if ((decision as any).status !== 'pending' && (decision as any).status !== 'snoozed') {
      return res.status(409).json({ error: 'already_resolved', current_status: (decision as any).status });
    }

    const userId = (req as any)?.user?.id;
    const updates: Record<string, any> = {
      status: newStatus,
      resolved_by: userId || null,
      resolved_at: new Date().toISOString(),
      ...extraUpdates
    };

    const { data, error } = await supabase
      .from('decisions')
      .update(updates)
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .select(SELECT)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ decision: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'resolve_decision_failed' });
  }
}

router.post('/:id/approve', (req, res) =>
  resolveDecision(req, res, 'approved', { resolution: { kind: 'approved' } })
);

router.post('/:id/edit', (req, res) => {
  const { payload, note } = req.body || {};
  if (!payload) return res.status(400).json({ error: 'payload_required' });
  return resolveDecision(req, res, 'edited', {
    payload,
    resolution: { kind: 'edited', note: note || null }
  });
});

router.post('/:id/reject', (req, res) => {
  const { reason } = req.body || {};
  return resolveDecision(req, res, 'rejected', {
    resolution: { kind: 'rejected', reason: reason || null }
  });
});

router.post('/:id/snooze', (req, res) => {
  const { snoozed_until } = req.body || {};
  if (!snoozed_until) return res.status(400).json({ error: 'snoozed_until_required' });
  const ts = new Date(snoozed_until);
  if (isNaN(ts.getTime())) return res.status(400).json({ error: 'invalid_timestamp' });
  return resolveDecision(req, res, 'snoozed', { snoozed_until: ts.toISOString() });
});

router.post('/:id/graduate', (req, res) => {
  const { rule } = req.body || {};
  if (!rule) return res.status(400).json({ error: 'rule_required' });
  return resolveDecision(req, res, 'graduated', {
    graduated_rule: rule,
    resolution: { kind: 'graduated', rule }
  });
});

export default router;
