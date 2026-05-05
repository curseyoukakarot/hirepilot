/**
 * v2 — /api/v2/workspace-settings
 * Workspace identity + trust ladder defaults + sharing flags.
 *
 * GET   /api/v2/workspace-settings
 * PATCH /api/v2/workspace-settings
 *
 * team_settings table is keyed off team_id. We resolve workspace -> team_id
 * via the workspaces table (workspaces.team_id).
 */

import express, { Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { requireAuth } from '../../../middleware/authMiddleware';
import activeWorkspace from '../../middleware/activeWorkspace';

const router = express.Router();
router.use(requireAuth as any, activeWorkspace as any);

const VALID_COLORS = new Set(['indigo', 'emerald', 'amber', 'rose', 'teal', 'slate', 'violet', 'sky']);
const VALID_TRUST = new Set(['manual', 'suggest', 'autopilot']);
const ADMIN_ROLES = new Set(['owner', 'admin']);

const SELECT_COLS = [
  'team_id',
  'workspace_name',
  'team_color',
  'default_trust_level',
  'autopilot_score_threshold',
  'autopilot_max_spend_per_run_cents',
  'share_leads',
  'share_candidates',
  'share_deals',
  'share_analytics',
  'allow_team_editing'
].join(', ');

/**
 * team_id lives on users.team_id (legacy team concept). Resolve via the
 * caller's user → user.team_id → fall back to the workspace owner's team_id.
 */
async function resolveTeamIdForWorkspace(workspaceId: string, userId?: string): Promise<string | null> {
  if (userId) {
    const { data } = await supabase
      .from('users')
      .select('team_id')
      .eq('id', userId)
      .maybeSingle();
    if ((data as any)?.team_id) return String((data as any).team_id);
  }
  const { data: ownerRow } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .maybeSingle();
  const ownerId = (ownerRow as any)?.user_id;
  if (!ownerId) return null;
  const { data: ownerUser } = await supabase
    .from('users')
    .select('team_id')
    .eq('id', ownerId)
    .maybeSingle();
  return (ownerUser as any)?.team_id ? String((ownerUser as any).team_id) : null;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as any).workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'no_active_workspace' });

    const teamId = await resolveTeamIdForWorkspace(workspaceId, (req as any)?.user?.id);
    if (!teamId) {
      // Workspace exists but has no team_id linkage yet — return defaults.
      return res.json({
        settings: {
          workspace_name: null,
          team_color: 'indigo',
          default_trust_level: 'suggest',
          autopilot_score_threshold: 90,
          autopilot_max_spend_per_run_cents: 5000,
          share_leads: false,
          share_candidates: false,
          share_deals: false,
          share_analytics: false,
          allow_team_editing: false
        }
      });
    }

    const { data, error } = await supabase
      .from('team_settings')
      .select(SELECT_COLS)
      .eq('team_id', teamId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      settings: data || {
        team_id: teamId,
        workspace_name: null,
        team_color: 'indigo',
        default_trust_level: 'suggest',
        autopilot_score_threshold: 90,
        autopilot_max_spend_per_run_cents: 5000,
        share_leads: false,
        share_candidates: false,
        share_deals: false,
        share_analytics: false,
        allow_team_editing: false
      }
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'get_settings_failed' });
  }
});

router.patch('/', async (req: Request, res: Response) => {
  try {
    const role = String((req as any).workspaceRole || '').toLowerCase();
    if (!ADMIN_ROLES.has(role)) {
      return res.status(403).json({ error: 'workspace_admin_required' });
    }

    const workspaceId = (req as any).workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'no_active_workspace' });

    const teamId = await resolveTeamIdForWorkspace(workspaceId, (req as any)?.user?.id);
    if (!teamId) return res.status(400).json({ error: 'workspace_has_no_team' });

    const {
      workspace_name,
      team_color,
      default_trust_level,
      autopilot_score_threshold,
      autopilot_max_spend_per_run_cents,
      share_leads,
      share_candidates,
      share_deals,
      share_analytics,
      allow_team_editing
    } = req.body || {};

    const updates: Record<string, any> = {};

    if (workspace_name !== undefined) {
      const v = String(workspace_name || '').trim();
      if (v.length > 80) return res.status(400).json({ error: 'workspace_name_too_long' });
      updates.workspace_name = v || null;
    }
    if (team_color !== undefined) {
      if (!VALID_COLORS.has(team_color)) return res.status(400).json({ error: 'invalid_team_color' });
      updates.team_color = team_color;
    }
    if (default_trust_level !== undefined) {
      if (!VALID_TRUST.has(default_trust_level)) return res.status(400).json({ error: 'invalid_trust_level' });
      updates.default_trust_level = default_trust_level;
    }
    if (autopilot_score_threshold !== undefined) {
      const n = Number(autopilot_score_threshold);
      if (!Number.isInteger(n) || n < 0 || n > 100) return res.status(400).json({ error: 'invalid_score_threshold' });
      updates.autopilot_score_threshold = n;
    }
    if (autopilot_max_spend_per_run_cents !== undefined) {
      const n = Number(autopilot_max_spend_per_run_cents);
      if (!Number.isInteger(n) || n < 0) return res.status(400).json({ error: 'invalid_max_spend' });
      updates.autopilot_max_spend_per_run_cents = n;
    }
    if (share_leads !== undefined) updates.share_leads = !!share_leads;
    if (share_candidates !== undefined) updates.share_candidates = !!share_candidates;
    if (share_deals !== undefined) updates.share_deals = !!share_deals;
    if (share_analytics !== undefined) updates.share_analytics = !!share_analytics;
    if (allow_team_editing !== undefined) updates.allow_team_editing = !!allow_team_editing;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'no_updates_provided' });
    }

    const { data, error } = await supabase
      .from('team_settings')
      .upsert({ team_id: teamId, ...updates }, { onConflict: 'team_id' })
      .select(SELECT_COLS)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ settings: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'update_settings_failed' });
  }
});

export default router;
