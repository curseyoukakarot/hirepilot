import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import activeWorkspace, { getUserWorkspaces } from '../middleware/activeWorkspace';
import { supabase } from '../lib/supabase';
import { getUserTeamContextDb } from '../lib/userTeamContext';

const router = express.Router();

function isJobSeekerRole(role: any): boolean {
  const r = String(role || '').toLowerCase();
  return r.startsWith('job_seeker');
}

router.use(requireAuth as any, activeWorkspace as any);

// GET /api/workspaces/mine
router.get('/mine', async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    const role = (req as any)?.user?.role;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    if (isJobSeekerRole(role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const normalizeRole = (value: any) => String(value || '').toLowerCase().replace(/[\s-]/g, '_');
    let resolvedAuthRole = normalizeRole(role);
    if (!resolvedAuthRole || resolvedAuthRole === 'guest' || resolvedAuthRole === 'free') {
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('role, account_type')
          .eq('id', userId)
          .maybeSingle();
        const candidate = (userRow as any)?.account_type || (userRow as any)?.role || null;
        if (candidate) resolvedAuthRole = normalizeRole(candidate);
      } catch {}
    }
    if (!resolvedAuthRole || resolvedAuthRole === 'guest' || resolvedAuthRole === 'free') {
      try {
        const { data } = await supabase.auth.admin.getUserById(userId);
        const authUser: any = data?.user || {};
        const meta = (authUser?.user_metadata || {}) as any;
        const app = (authUser?.app_metadata || {}) as any;
        const candidate = meta?.account_type || meta?.user_type || app?.role || null;
        if (candidate) resolvedAuthRole = normalizeRole(candidate);
      } catch {}
    }

    // Best-effort: sync team members into workspace for team admins
    if (resolvedAuthRole === 'team_admin' || resolvedAuthRole === 'teamadmin') {
      try {
        await supabase.rpc('sync_team_workspace_members', { p_user_id: userId });
      } catch {}
    }

    const memberships = await getUserWorkspaces(userId);

    // Resolve team context for display overrides + backfill safety
    let teamId: string | null = null;
    let teamRole: string | null = null;
    try {
      const ctx = await getUserTeamContextDb(userId);
      teamId = ctx.teamId ? String(ctx.teamId) : null;
      teamRole = ctx.role ? String(ctx.role) : null;
    } catch {}
    const normalizedAuthRole = resolvedAuthRole || normalizeRole(role);
    const normalizedTeamRole = normalizeRole(teamRole || resolvedAuthRole || role);
    const isTeamAdmin = normalizedTeamRole === 'team_admin' || normalizedTeamRole === 'teamadmin';

    let teamWorkspaceId: string | null = null;
    if (isTeamAdmin && memberships.length) {
      teamWorkspaceId = String(memberships[0].workspace_id);
    }

    let teamSeatCount: number | null = null;
    if (isTeamAdmin && teamId) {
      try {
        const { data: teamUsers } = await supabase
          .from('users')
          .select('id, role')
          .eq('team_id', teamId);
        const members = (teamUsers || []).filter(
          (u: any) => !String(u?.role || '').toLowerCase().startsWith('job_seeker')
        );
        teamSeatCount = Math.max(5, members.length || 0);

        if (teamWorkspaceId) {
          const rows = members
            .filter((u: any) => String(u.id) !== String(userId))
            .map((u: any) => ({
              workspace_id: teamWorkspaceId,
              user_id: u.id,
              role: 'member',
              status: 'active',
              invited_by: userId
            }));
          if (rows.length) {
            await supabase.from('workspace_members').upsert(rows as any, { onConflict: 'workspace_id,user_id' } as any);
          }
          await supabase
            .from('workspaces')
            .update({ plan: 'team', seat_count: teamSeatCount })
            .eq('id', teamWorkspaceId);
        }
      } catch {}
    }

    const rows = memberships.map((m) => {
      const workspaceId = String(m.workspace_id);
      const basePlan = (m.workspaces as any)?.plan ?? null;
      const baseSeat = (m.workspaces as any)?.seat_count ?? null;
      const memberRole = m.role ?? null;
      const isTeamWorkspace = !!teamWorkspaceId && workspaceId === teamWorkspaceId && isTeamAdmin;
      const displayRole = isTeamWorkspace ? 'team_admin' : memberRole;
      const displayPlan = isTeamWorkspace ? 'team' : basePlan;
      const displaySeat = isTeamWorkspace && teamSeatCount ? teamSeatCount : baseSeat;
      return {
        workspace_id: workspaceId,
        name: (m.workspaces as any)?.name ?? null,
        plan: basePlan,
        seat_count: baseSeat,
        role: memberRole,
        status: m.status ?? null,
        auth_role: normalizedAuthRole || null,
        display_role: displayRole,
        display_plan: displayPlan,
        display_seat_count: displaySeat
      };
    });
    return res.json({ workspaces: rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

// PATCH /api/workspaces/:id  { name }
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const role = (req as any)?.user?.role;
    if (isJobSeekerRole(role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const workspaceId = String(req.params.id || '');
    const nameRaw = String((req.body as any)?.name || '').trim();
    if (!workspaceId) return res.status(400).json({ error: 'workspace_id_required' });
    if (!nameRaw || nameRaw.length < 2) return res.status(400).json({ error: 'invalid_name' });

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role,status')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();
    const memberRole = String((membership as any)?.role || '').toLowerCase();
    const memberStatus = String((membership as any)?.status || '').toLowerCase();
    if (memberStatus !== 'active' || !['owner','admin'].includes(memberRole)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const { data, error } = await supabase
      .from('workspaces')
      .update({ name: nameRaw })
      .eq('id', workspaceId)
      .select('id,name,plan,seat_count,created_by')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ workspace: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

export default router;
