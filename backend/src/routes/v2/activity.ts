/**
 * v2 — /api/v2/activity
 * Read-only feed of REX/specialist events for Today timeline + Team strip.
 *
 * GET /api/v2/activity                     workspace-scoped, default limit 50
 *   ?limit=50
 *   ?agent_id=<uuid>           filter to one specialist
 *   ?role=sourcer              filter by role
 *   ?since=<iso timestamp>     only events after this
 */

import express, { Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { requireAuth } from '../../../middleware/authMiddleware';
import activeWorkspace from '../../middleware/activeWorkspace';

const router = express.Router();
router.use(requireAuth as any, activeWorkspace as any);

router.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as any).workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'no_active_workspace' });

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const agentId = String(req.query.agent_id || '').trim();
    const role = String(req.query.role || '').trim();
    const since = String(req.query.since || '').trim();

    let q = supabase
      .from('rex_activity_log')
      .select('id, workspace_id, user_id, agent_id, agent_role, event_type, goal_id, decision_id, skill_id, summary, detail, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (agentId) q = q.eq('agent_id', agentId);
    if (role) q = q.eq('agent_role', role);
    if (since) q = q.gte('created_at', since);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ activity: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'list_activity_failed' });
  }
});

export default router;
