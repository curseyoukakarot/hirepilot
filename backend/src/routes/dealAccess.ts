import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';

const router = express.Router();

async function getPlanTier(userId: string): Promise<string> {
  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan_tier')
      .eq('user_id', userId)
      .maybeSingle();
    const tier = String((sub as any)?.plan_tier || '').toLowerCase();
    if (tier) return tier;
  } catch {}
  try {
    const { data: usr } = await supabase
      .from('users')
      .select('plan')
      .eq('id', userId)
      .maybeSingle();
    const plan = String((usr as any)?.plan || '').toLowerCase();
    if (plan) return plan;
  } catch {}
  // If nothing found, return empty so we don't accidentally treat a paid user as free.
  // Explicit "free" is still enforced via plan/role checks below.
  return '';
}

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

    // Fetch target user
    const { data: target } = await supabase
      .from('users')
      .select('id, role, team_id')
      .eq('id', userId)
      .maybeSingle();
    const targetRole = String((target as any)?.role || '').toLowerCase();
    const targetTeamId = (target as any)?.team_id || null;
    const planTier = await getPlanTier(userId);

    // Paid recruiter roles should never be treated as free, even if `users.plan` is stale/missing.
    // This fixes cases where a member is blocked from /deals because their `plan` column still says "free".
    const paidRecruiterRoles = new Set([
      'member',
      'admin',
      'team_admin',
      'team_admins',
      'recruitpro',
      'recruit_pro',
      'recruiter_pro',
    ]);

    // Super admin => full access
    if (['super_admin','superadmin'].includes(targetRole)) {
      res.json({
        user_id: userId,
        can_view_clients: true,
        can_view_opportunities: true,
        can_view_billing: true,
        can_view_revenue: true
      });
      return;
    }

    // Free or guest plan => no access
    if ((planTier === 'free' && !paidRecruiterRoles.has(targetRole)) || targetRole === 'guest' || targetRole === 'free') {
      res.json({ user_id: userId, can_view_clients: false, can_view_opportunities: false, can_view_billing: false, can_view_revenue: false, reason: 'free_plan' });
      return;
    }

    // Team members controlled by Team Admin permissions (only for Team plan)
    if (planTier === 'team' && targetTeamId && !['team_admin'].includes(targetRole)) {
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
        can_view_revenue: Boolean((perms as any)?.can_view_revenue),
        reason: 'team_restricted'
      });
      return;
    }

    // All other paid roles/plans (starter/member, pro/admin, team/team_admin, recruitpro, etc.) => full access
    res.json({
      user_id: userId,
      can_view_clients: true,
      can_view_opportunities: true,
      can_view_billing: true,
      can_view_revenue: true,
      reason: null
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

export default router;

// Team Admin can set permissions for users on their team
router.patch('/deal-access/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const callerId = (req as any).user?.id as string | undefined;
    const { userId } = req.params;
    if (!callerId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const [{ data: caller }, { data: target }] = await Promise.all([
      supabase.from('users').select('id, role, team_id').eq('id', callerId).maybeSingle(),
      supabase.from('users').select('id, team_id').eq('id', userId).maybeSingle()
    ] as any);

    const callerRole = String((caller as any)?.role || '').toLowerCase();
    const callerTeam = (caller as any)?.team_id || null;
    const targetTeam = (target as any)?.team_id || null;
    if (callerRole !== 'team_admin' || !callerTeam || callerTeam !== targetTeam) {
      res.status(403).json({ error: 'forbidden' }); return;
    }

    const body = req.body || {};
    const row = {
      user_id: userId,
      can_view_clients: !!body.can_view_clients,
      can_view_opportunities: !!body.can_view_opportunities,
      can_view_billing: !!body.can_view_billing,
      can_view_revenue: !!body.can_view_revenue,
    } as any;
    const { error } = await supabase.from('deal_permissions').upsert(row, { onConflict: 'user_id' });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true, ...row });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});


