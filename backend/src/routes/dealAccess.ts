import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';

const router = express.Router();

router.get('/deal-access/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const callerId = (req as any).user?.id as string | undefined;
    const { userId } = req.params;
    if (!callerId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    // Caller can fetch only for self unless super_admin or team_admin
    const { data: caller } = await supabase
      .from('users')
      .select('id, role, team_id')
      .eq('id', callerId)
      .maybeSingle();
    const callerRole = String((caller as any)?.role || '').toLowerCase();
    const isPrivileged = ['super_admin','superadmin','team_admin'].includes(callerRole);
    if (callerId !== userId && !isPrivileged) { res.status(403).json({ error: 'forbidden' }); return; }

    // Super admin => full access
    if (callerId === userId && ['super_admin','superadmin'].includes(callerRole)) {
      res.json({
        user_id: userId,
        can_view_clients: true,
        can_view_opportunities: true,
        can_view_billing: true,
        can_view_revenue: true
      });
      return;
    }

    const { data: perms } = await supabase
      .from('deal_permissions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    res.json({
      user_id: userId,
      can_view_clients: Boolean((perms as any)?.can_view_clients),
      can_view_opportunities: Boolean((perms as any)?.can_view_opportunities),
      can_view_billing: Boolean((perms as any)?.can_view_billing),
      can_view_revenue: Boolean((perms as any)?.can_view_revenue)
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

export default router;


