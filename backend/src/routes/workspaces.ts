import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import activeWorkspace, { getUserWorkspaces } from '../middleware/activeWorkspace';
import { supabase } from '../lib/supabase';

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

    // Best-effort: sync team members into workspace for team admins
    const roleLc = String(role || '').toLowerCase();
    if (roleLc === 'team_admin' || roleLc === 'teamadmin') {
      try {
        await supabase.rpc('sync_team_workspace_members', { p_user_id: userId });
      } catch {}
    }

    const memberships = await getUserWorkspaces(userId);
    const rows = memberships.map((m) => ({
      workspace_id: String(m.workspace_id),
      name: (m.workspaces as any)?.name ?? null,
      plan: (m.workspaces as any)?.plan ?? null,
      seat_count: (m.workspaces as any)?.seat_count ?? null,
      role: m.role ?? null,
      status: m.status ?? null
    }));
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
