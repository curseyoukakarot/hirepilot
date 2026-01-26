import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import activeWorkspace, { getUserWorkspaces } from '../middleware/activeWorkspace';

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

export default router;
