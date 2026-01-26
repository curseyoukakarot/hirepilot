import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../../middleware/authMiddleware';
import activeWorkspace, { getUserWorkspaces } from '../middleware/activeWorkspace';
import { supabase } from '../lib/supabase';
import { getUserTeamContextDb } from '../lib/userTeamContext';
import { stripe } from '../services/stripe';
import { PRICING_CONFIG } from '../../config/pricing';

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
    res.set('Cache-Control', 'no-store');
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    if (isJobSeekerRole(role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const normalizeRole = (value: any) => String(value || '').toLowerCase().replace(/[\s-]/g, '_');
    const isPlaceholderRole = (value: string) =>
      !value || value === 'guest' || value === 'free' || value === 'authenticated';
    let resolvedAuthRole = normalizeRole(role);
    if (isPlaceholderRole(resolvedAuthRole)) {
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('role, account_type')
          .eq('id', userId)
          .maybeSingle();
        const candidate = (userRow as any)?.role || (userRow as any)?.account_type || null;
        if (candidate) resolvedAuthRole = normalizeRole(candidate);
      } catch {}
    }
    if (isPlaceholderRole(resolvedAuthRole)) {
      try {
        const { data } = await supabase.auth.admin.getUserById(userId);
        const authUser: any = data?.user || {};
        const meta = (authUser?.user_metadata || {}) as any;
        const app = (authUser?.app_metadata || {}) as any;
        const candidate = meta?.account_type || meta?.user_type || meta?.role || app?.role || null;
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
    if (!teamId) {
      const reqTeamId = (req as any)?.user?.team_id || null;
      teamId = reqTeamId ? String(reqTeamId) : null;
    }
    const normalizedAuthRole = resolvedAuthRole || normalizeRole(role);
    const normalizedTeamRole = normalizeRole(teamRole || resolvedAuthRole || role);
    const isTeamAdmin = normalizedTeamRole === 'team_admin' || normalizedTeamRole === 'teamadmin';

    let teamWorkspaceId: string | null = null;
    if (isTeamAdmin && memberships.length) {
      teamWorkspaceId = String(memberships[0].workspace_id);
    }

    let teamSeatCount: number | null = null;
    let teamPlanTier: string | null = null;
    if (isTeamAdmin && teamId) {
      try {
        // Prefer teams table for plan + seat counts
        try {
          const { data: teamRow } = await supabase
            .from('teams')
            .select('plan_tier, seat_count, included_seats')
            .eq('id', teamId)
            .maybeSingle();
          teamPlanTier = (teamRow as any)?.plan_tier ? String((teamRow as any).plan_tier) : null;
          const teamSeats =
            Number((teamRow as any)?.seat_count ?? 0) ||
            Number((teamRow as any)?.included_seats ?? 0) ||
            0;
          if (teamSeats > 0) teamSeatCount = teamSeats;
        } catch {}

        // Prefer team_members if available; fallback to users.team_id
        let memberIds: string[] = [];
        const { data: teamMembers, error: tmErr } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', teamId);
        if (!tmErr && Array.isArray(teamMembers)) {
          memberIds = teamMembers.map((m: any) => String(m.user_id));
        }
        if (tmErr && (tmErr as any)?.code !== '42P01') {
          // unexpected error; ignore and fallback
        }
        if (!memberIds.length) {
          const { data: teamUsers } = await supabase
            .from('users')
            .select('id, role')
            .eq('team_id', teamId);
          const members = (teamUsers || []).filter(
            (u: any) => !String(u?.role || '').toLowerCase().startsWith('job_seeker')
          );
          memberIds = members.map((m: any) => String(m.id));
        }

        if (!teamSeatCount) {
          teamSeatCount = Math.max(5, memberIds.length || 0);
        } else if (teamSeatCount && memberIds.length) {
          teamSeatCount = Math.max(teamSeatCount, memberIds.length);
        }

        if (teamWorkspaceId) {
          const rows = memberIds
            .filter((id) => String(id) !== String(userId))
            .map((id) => ({
              workspace_id: teamWorkspaceId,
              user_id: id,
              role: 'member',
              status: 'active',
              invited_by: userId
            }));
          if (rows.length) {
            await supabase.from('workspace_members').upsert(rows as any, { onConflict: 'workspace_id,user_id' } as any);
          }
          await supabase
            .from('workspaces')
            .update({ plan: teamPlanTier || 'team', seat_count: teamSeatCount })
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
      const displayRole = isTeamWorkspace
        ? 'team_admin'
        : (normalizedAuthRole === 'super_admin' || normalizedAuthRole === 'admin')
          ? normalizedAuthRole
          : memberRole || normalizedAuthRole || null;
      const displayPlan = isTeamWorkspace ? (teamPlanTier || 'team') : basePlan;
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

// POST /api/workspaces/checkout { name, plan, interval, success_url, cancel_url }
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    const role = (req as any)?.user?.role;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    if (isJobSeekerRole(role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const nameRaw = String((req.body as any)?.name || '').trim();
    const planRaw = String((req.body as any)?.plan || '').trim().toLowerCase();
    const intervalRaw = String((req.body as any)?.interval || 'monthly').trim().toLowerCase();
    if (!nameRaw || nameRaw.length < 2) return res.status(400).json({ error: 'invalid_name' });
    if (!['starter', 'team'].includes(planRaw)) return res.status(400).json({ error: 'invalid_plan' });
    if (!['monthly', 'annual'].includes(intervalRaw)) return res.status(400).json({ error: 'invalid_interval' });

    const priceId = (PRICING_CONFIG as any)?.[planRaw]?.priceIds?.[intervalRaw] || '';
    if (!priceId) return res.status(400).json({ error: 'missing_price_id' });

    const successUrl = String((req.body as any)?.success_url || '').trim() ||
      `${process.env.APP_BASE_URL || 'https://app.thehirepilot.com'}/workspaces`;
    const cancelUrl = String((req.body as any)?.cancel_url || '').trim() ||
      `${process.env.APP_BASE_URL || 'https://app.thehirepilot.com'}/workspaces`;

    const workspaceId = crypto.randomUUID();
    const metadata: Record<string, string> = {
      workspace_id: workspaceId,
      workspace_name: nameRaw,
      workspace_plan: planRaw,
      workspace_owner: userId
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata,
      subscription_data: { metadata },
      client_reference_id: userId,
    });

    return res.json({ id: session.id, url: session.url, workspace_id: workspaceId });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

// POST /api/workspaces  { name, plan }
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    const role = (req as any)?.user?.role;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    if (isJobSeekerRole(role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const nameRaw = String((req.body as any)?.name || '').trim();
    const planRaw = String((req.body as any)?.plan || 'free').trim().toLowerCase();
    if (!nameRaw || nameRaw.length < 2) return res.status(400).json({ error: 'invalid_name' });
    if (!['free'].includes(planRaw)) return res.status(400).json({ error: 'plan_not_supported' });

    const seatCount = planRaw === 'team' ? 5 : 1;
    const { data: workspace, error: wsErr } = await supabase
      .from('workspaces')
      .insert({
        name: nameRaw,
        type: 'recruiter',
        plan: planRaw,
        seat_count: seatCount,
        created_by: userId
      })
      .select('*')
      .maybeSingle();
    if (wsErr) return res.status(500).json({ error: wsErr.message });
    if (!workspace?.id) return res.status(500).json({ error: 'workspace_create_failed' });

    await supabase.from('workspace_members').upsert(
      [{ workspace_id: workspace.id, user_id: userId, role: 'owner', status: 'active' }],
      { onConflict: 'workspace_id,user_id' } as any
    );

    return res.json({ workspace });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

export default router;
