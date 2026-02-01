import express, { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
// import { logger } from '../lib/logger';
const logger = console;
import { requireAuth } from '../../middleware/authMiddleware';
import requireAuthUnified from '../../middleware/requireAuthUnified';
import { ApiRequest } from '../../types/api';
import { supabaseAdmin } from '../services/supabase';
import { queueDripOnSignup } from '../lib/queueDripOnSignup';
import { notifySlack } from '../../lib/slack';

const router = express.Router();
// GET /api/user/plan
const requireAuthPlan = String(process.env.ENABLE_SESSION_COOKIE_AUTH || 'false').toLowerCase() === 'true'
  ? (requireAuthUnified as any)
  : (requireAuth as any);
// Read-only routes can also use unified auth under flag
const requireAuthReadOnly = requireAuthPlan;

router.get('/plan', requireAuthPlan, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    let { data, error } = await supabase
      .from('users')
      .select('plan, remaining_credits, monthly_credits, plan_updated_at, role')
      .eq('id', userId)
      .maybeSingle();

    // If no public.users row exists, create a default FREE row and seed credits (idempotent)
    if (!data) {
      try {
        const email = (req as any).user?.email || null;
        // Insert minimal columns to avoid schema mismatches across environments
        await supabase
          .from('users')
          .upsert({ id: userId, email, role: 'free', plan: 'free' } as any, { onConflict: 'id' });
        // Seed credits row (idempotent)
        try {
          await supabase
            .from('user_credits')
            .upsert({
              user_id: userId,
              total_credits: 50,
              used_credits: 0,
              remaining_credits: 50,
              last_updated: new Date().toISOString()
            }, { onConflict: 'user_id' });
        } catch {}

        const reread = await supabase
          .from('users')
          .select('plan, remaining_credits, monthly_credits, plan_updated_at')
          .eq('id', userId)
          .maybeSingle();
        data = reread.data || { plan: 'free', remaining_credits: 50, monthly_credits: 50, plan_updated_at: new Date().toISOString(), role: 'free' } as any;
      } catch (ensureErr) {
        // If ensure fails, still respond with a sane default so the UI can proceed
        data = { plan: 'free', remaining_credits: 50, monthly_credits: 50, plan_updated_at: new Date().toISOString(), role: 'free' } as any;
      }
    }

    if (error && data) error = null; // ignore not-found after ensure
    if (error) return res.status(500).json({ error: error.message });
    const rawRole =
      data?.role ||
      (req as any)?.user?.role ||
      (req as any)?.user?.account_type ||
      null;
    const normalizedRole = String(rawRole || '').toLowerCase().replace(/\s|-/g, '_');
    let derivedPlan = data?.plan || null;
    const privilegedRoles = new Set(['super_admin', 'admin', 'team_admin', 'team_admins', 'member', 'recruitpro']);
    if ((!derivedPlan || derivedPlan === 'free') && privilegedRoles.has(normalizedRole)) {
      if (normalizedRole === 'recruitpro') derivedPlan = 'RecruitPro';
      else if (normalizedRole === 'super_admin' || normalizedRole === 'admin') derivedPlan = 'admin';
      else derivedPlan = 'member';
    }
    let effectiveRole = rawRole || null;
    if ((!rawRole || normalizedRole === 'free' || normalizedRole === 'guest') && derivedPlan && derivedPlan !== 'free') {
      if (derivedPlan === 'admin') effectiveRole = 'admin';
      else if (derivedPlan === 'RecruitPro') effectiveRole = 'RecruitPro';
      else effectiveRole = 'member';
    }
    res.json({
      plan: derivedPlan || data?.plan || 'free',
      remaining_credits: data?.remaining_credits ?? 0,
      monthly_credits: data?.monthly_credits ?? null,
      plan_updated_at: data?.plan_updated_at || null,
      role: effectiveRole
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get plan' });
  }
});

// GET /api/user/me  → canonical user profile for gating: { id, email, role, plan, credits }
router.get('/me', requireAuthReadOnly, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email || null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // 1) Prefer DB users.role for gating
    let role: string | null = null;
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      role = (userRow as any)?.role || null;
    } catch {}

    // 2) Fallback to auth metadata (user_metadata / app_metadata)
    if (!role) {
      try {
        const { data: authUserRes } = await supabaseAdmin.auth.admin.getUserById(userId);
        const authUser: any = authUserRes?.user || {};
        const meta = (authUser?.user_metadata || {}) as any;
        const appMeta = (authUser?.app_metadata || {}) as any;
        // Prefer app_metadata.role first to avoid guest overriding admin
        role = appMeta.role || meta.role || meta.account_type || null;
      } catch {}
    }

    // 3) Load plan + credits (idempotently ensure defaults)
    let plan: string | null = null;
    let remaining: number | null = null;
    let monthly: number | null = null;
    try {
      let { data } = await supabase
        .from('users')
        .select('plan, remaining_credits, monthly_credits')
        .eq('id', userId)
        .maybeSingle();
      if (!data) {
        // Seed minimal row + starter credits if missing
        await supabase.from('users').upsert({ id: userId, email: userEmail } as any, { onConflict: 'id' });
        await supabase
          .from('user_credits')
          .upsert({ user_id: userId, total_credits: 50, used_credits: 0, remaining_credits: 50, last_updated: new Date().toISOString() } as any, { onConflict: 'user_id' });
        const reread = await supabase
          .from('users')
          .select('plan, remaining_credits, monthly_credits')
          .eq('id', userId)
          .maybeSingle();
        data = reread.data as any;
      }
      plan = (data as any)?.plan || null;
      remaining = (data as any)?.remaining_credits ?? null;
      monthly = (data as any)?.monthly_credits ?? null;
    } catch {}

    // Guest heuristic (optional): check guest collaborator rows
    let isGuest = false;
    try {
      const { data: guestRow } = await supabase
        .from('job_guest_collaborators')
        .select('id')
        .eq('email', userEmail)
        .limit(1)
        .maybeSingle();
      isGuest = !!guestRow;
    } catch {}

    // If admin-like role, never return a free plan label to the client
    const roleLc = String(role || '').toLowerCase();
    const isAdminRole = ['super_admin','admin','team_admin','team_admins'].includes(roleLc);
    const planOut = (isAdminRole && (!plan || plan === 'free')) ? 'admin' : plan;

    res.json({ id: userId, email: userEmail, role, plan: planOut, remaining_credits: remaining, monthly_credits: monthly, is_guest: isGuest });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load current user' });
  }
});

// PATCH /api/user/credits  { delta: number }
router.patch('/credits', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { delta = 0 } = (req.body || {});
    const { data: current, error: readErr } = await supabase
      .from('users')
      .select('remaining_credits')
      .eq('id', userId)
      .single();
    if (readErr) return res.status(500).json({ error: readErr.message });
    const next = Math.max(0, (current?.remaining_credits || 0) + Number(delta));
    const { data, error } = await supabase
      .from('users')
      .update({ remaining_credits: next })
      .eq('id', userId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update credits' });
  }
});

// POST /api/user/onboarding-complete
router.post('/onboarding-complete', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    // Get user email to check for pending team invites
    const userEmail = req.user?.email;
    
    // Try update; if no row exists, upsert minimal row
    let { data, error } = await supabase
      .from('users')
      .update({ onboarding_complete: true })
      .eq('id', userId)
      .select('id, onboarding_complete')
      .maybeSingle();

    if (!data) {
      await supabase
        .from('users')
        .upsert({ id: userId, email: userEmail, onboarding_complete: true } as any, { onConflict: 'id' });
      const reread = await supabase
        .from('users')
        .select('id, onboarding_complete')
        .eq('id', userId)
        .maybeSingle();
      data = reread.data as any;
    }

    if (error && data) error = null;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Update any pending team invites for this user to 'accepted' status
    if (userEmail) {
      try {
        // Some envs don't have team_invites.updated_at; retry without it if missing.
        const firstTry = await supabase
          .from('team_invites')
          .update({ status: 'accepted', updated_at: new Date().toISOString() } as any)
          .eq('email', userEmail)
          .eq('status', 'pending');
        if (firstTry.error && (firstTry.error as any).code === '42703') {
          await supabase
            .from('team_invites')
            .update({ status: 'accepted' } as any)
            .eq('email', userEmail)
            .eq('status', 'pending');
        } else if (firstTry.error) {
          throw firstTry.error;
        }
        
        console.log(`[ONBOARDING] Updated team invite status to 'accepted' for user: ${userEmail}`);

        // If this user was invited to a team, best-effort link them to that team for
        // both legacy (`users.team_id`) and RLS-backed (`team_members`) membership.
        try {
          const { data: latestInvite } = await supabase
            .from('team_invites')
            .select('team_id, invited_by')
            .eq('email', userEmail)
            .in('status', ['accepted', 'pending', 'expired'] as any)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          const invitedTeamId = (latestInvite as any)?.team_id || null;
          if (invitedTeamId) {
            // Ensure users.team_id is set
            try {
              const { data: meRow } = await supabase.from('users').select('team_id').eq('id', userId).maybeSingle();
              const currentTeamId = (meRow as any)?.team_id || null;
              if (!currentTeamId) {
                await supabase.from('users').update({ team_id: invitedTeamId, updated_at: new Date().toISOString() }).eq('id', userId);
              }
            } catch {}

            // Ensure team_members row exists (if table exists in this env)
            try {
              await supabase
                .from('team_members')
                .upsert([{ team_id: invitedTeamId, user_id: userId }], { onConflict: 'team_id,user_id' } as any);
            } catch (memberErr) {
              const code = (memberErr as any)?.code;
              if (code !== '42P01') console.warn('[ONBOARDING] Failed to upsert team_members', memberErr);
            }
          }
        } catch {}

        // Accept any pending workspace invites for this email
        try {
          const { data: wsInvites, error: wsInviteErr } = await supabase
            .from('workspace_invites')
            .select('id,workspace_id,role')
            .eq('email', userEmail)
            .eq('status', 'pending');
          if (!wsInviteErr) {
            for (const inv of (wsInvites || [])) {
              const workspaceId = String((inv as any).workspace_id || '');
              if (!workspaceId) continue;
              const role = String((inv as any).role || 'member').toLowerCase();
              const memberRole = role === 'admin' ? 'admin' : 'member';
              await supabase
                .from('workspace_members')
                .upsert(
                  [{ workspace_id: workspaceId, user_id: userId, role: memberRole, status: 'active' }],
                  { onConflict: 'workspace_id,user_id' } as any
                );
              await supabase
                .from('workspace_invites')
                .update({ status: 'accepted', accepted_at: new Date().toISOString(), user_id: userId, updated_at: new Date().toISOString() })
                .eq('id', (inv as any).id);
            }
          } else if ((wsInviteErr as any)?.code !== '42P01') {
            console.warn('[ONBOARDING] Failed to accept workspace invites', wsInviteErr);
          }
        } catch (wsInviteErr) {
          const code = (wsInviteErr as any)?.code;
          if (code !== '42P01') console.warn('[ONBOARDING] Failed to accept workspace invites', wsInviteErr);
        }

        // Accept any pending job guest invites for this email
        await supabase
          .from('job_guest_collaborators')
          .update({ status: 'accepted', user_id: userId, updated_at: new Date().toISOString() })
          .eq('email', userEmail)
          .eq('status', 'pending');

        // Accept any pending kanban board invites for this email
        try {
          const { data: pendingKanbanInvites } = await supabase
            .from('kanban_board_invites')
            .select('id,board_id,role')
            .eq('email', userEmail)
            .eq('status', 'pending');
          for (const inv of (pendingKanbanInvites || [])) {
            const boardId = String((inv as any).board_id || '');
            if (!boardId) continue;
            const role = String((inv as any).role || 'viewer');
            await supabase
              .from('kanban_board_members')
              .upsert(
                { board_id: boardId, member_type: 'user', member_id: userId, role },
                { onConflict: 'board_id,member_type,member_id' } as any
              );
            await supabase
              .from('kanban_board_invites')
              .update({ status: 'accepted', accepted_at: new Date().toISOString() })
              .eq('id', (inv as any).id);
          }
        } catch (kanbanInviteErr: any) {
          if (String(kanbanInviteErr?.code || '') !== '42P01') {
            console.warn('[ONBOARDING] Failed to accept kanban invites', kanbanInviteErr);
          }
        }

        // Accept any pending table guest invites for this email:
        // - mark invite accepted
        // - add user_id to custom_tables.collaborators so the table appears in /tables
        try {
          // Skip accepting if this user is a job seeker
          const { data: meRow } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
          const meRole = String((meRow as any)?.role || '').toLowerCase();
          const isJobSeeker = meRole.startsWith('job_seeker');
          if (!isJobSeeker) {
            const { data: pendingInvites } = await supabase
              .from('table_guest_collaborators')
              .select('id,table_id,role')
              .eq('email', userEmail)
              .eq('status', 'pending');
            for (const inv of (pendingInvites || [])) {
              const tableId = String((inv as any).table_id || '');
              if (!tableId) continue;
              const role = String((inv as any).role || 'view') === 'edit' ? 'edit' : 'view';
              try {
                // Merge into collaborators json array
                const { data: tableRow } = await supabase
                  .from('custom_tables')
                  .select('id,collaborators')
                  .eq('id', tableId)
                  .maybeSingle();
                if (!tableRow?.id) continue;
                const existing = Array.isArray((tableRow as any).collaborators) ? (tableRow as any).collaborators : [];
                const map = new Map<string, any>();
                for (const c of existing) {
                  const uid = String((c as any)?.user_id || '').trim();
                  if (!uid) continue;
                  map.set(uid, { user_id: uid, role: (String((c as any)?.role || '').toLowerCase() === 'edit' ? 'edit' : 'view') });
                }
                map.set(String(userId), { user_id: String(userId), role });
                const merged = Array.from(map.values());
                await supabase
                  .from('custom_tables')
                  .update({ collaborators: merged, updated_at: new Date().toISOString() })
                  .eq('id', tableId);
              } catch {}
            }
            // Mark invites accepted (best-effort)
            await supabase
              .from('table_guest_collaborators')
              .update({ status: 'accepted', user_id: userId, updated_at: new Date().toISOString() })
              .eq('email', userEmail)
              .eq('status', 'pending');
          }
        } catch {}

        // Accept any pending dashboard guest invites for this email:
        // - mark invite accepted
        // - add user_id to user_dashboards.collaborators so the dashboard appears in /dashboards
        try {
          const { data: meRow2 } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
          const meRole2 = String((meRow2 as any)?.role || '').toLowerCase();
          const isJobSeeker2 = meRole2.startsWith('job_seeker');
          if (!isJobSeeker2) {
            const { data: pendingDashInvites } = await supabase
              .from('dashboard_guest_collaborators')
              .select('id,dashboard_id,role')
              .eq('email', userEmail)
              .eq('status', 'pending');
            for (const inv of (pendingDashInvites || [])) {
              const dashId = String((inv as any).dashboard_id || '');
              if (!dashId) continue;
              const role = String((inv as any).role || 'view') === 'edit' ? 'edit' : 'view';
              try {
                const { data: dashRow, error: dashErr } = await supabase
                  .from('user_dashboards')
                  .select('id,collaborators')
                  .eq('id', dashId)
                  .maybeSingle();
                // Handle environments where collaborators column isn't deployed yet
                if (dashErr && String((dashErr as any).code || '') === '42703') continue;
                if (!dashRow?.id) continue;
                const existing = Array.isArray((dashRow as any).collaborators) ? (dashRow as any).collaborators : [];
                const map = new Map<string, any>();
                for (const c of existing) {
                  const uid = String((c as any)?.user_id || '').trim();
                  if (!uid) continue;
                  map.set(uid, { user_id: uid, role: (String((c as any)?.role || '').toLowerCase() === 'edit' ? 'edit' : 'view') });
                }
                map.set(String(userId), { user_id: String(userId), role });
                const merged = Array.from(map.values());
                await supabase
                  .from('user_dashboards')
                  .update({ collaborators: merged, updated_at: new Date().toISOString() })
                  .eq('id', dashId);
              } catch {}
            }
            await supabase
              .from('dashboard_guest_collaborators')
              .update({ status: 'accepted', user_id: userId, updated_at: new Date().toISOString() })
              .eq('email', userEmail)
              .eq('status', 'pending');
          }
        } catch {}
      } catch (inviteError) {
        console.warn('[ONBOARDING] Failed to update team invite status:', inviteError);
        // Don't fail the onboarding completion if invite update fails
      }
    }

    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: 'Failed to set onboarding complete' });
  }
});


// GET /api/user/settings
router.get('/settings', requireAuthReadOnly, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get user role to check for RecruitPro privileges
    const { data: userRecord, error: userErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    // Also get auth user metadata as fallback
    let authMetadata = null;
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      authMetadata = authUser?.user?.user_metadata;
    } catch (authError) {
      console.error('Error fetching auth metadata:', authError);
    }

    // Debug logging
    console.log('[User Settings] Debug info:', {
      userId,
      userRecord,
      userErr,
      authMetadata,
      env_has_super_admin_key: !!process.env.SUPER_ADMIN_APOLLO_API_KEY
    });

    // Check if user is RecruitPro or other privileged type (includes admin for REX access)
    const privilegedTypes = ['RecruitPro', 'TeamAdmin', 'admin', 'member'];
    const userRole = userRecord?.role || authMetadata?.role || authMetadata?.account_type;
    const isRecruitPro = privilegedTypes.includes(userRole);

    console.log('[User Settings] RecruitPro check:', {
      userRole,
      isRecruitPro,
      privilegedTypes
    });

    // Get user settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .single();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
    }

    // Check for active Apollo OAuth connection
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'apollo')
      .eq('status', 'connected')
      .single();

    // Determine Apollo API key and connection status with universal fallback
    const personalKey = settings?.apollo_api_key || null;
    const superAdminKey = process.env.SUPER_ADMIN_APOLLO_API_KEY || null;
    const platformKey = process.env.HIREPILOT_APOLLO_API_KEY || null;

    // Prefer user's own key; otherwise fall back to super admin; then platform
    let apolloApiKey = personalKey || superAdminKey || platformKey || null;
    // Connected if we have any key available or an OAuth integration
    let apolloConnected = !!apolloApiKey || !!integration;

    // Fetch guest jobs for visibility
    let guestJobs: any[] = [];
    try {
      const { data: j } = await supabase
        .from('job_guest_collaborators')
        .select('job_id,status')
        .eq('email', (req as any).user?.email || '')
        .in('status', ['pending','accepted']);
      guestJobs = j || [];
    } catch {}

    // Return both OAuth status and API key
    res.json({
      apollo_connected: apolloConnected,
      apollo_api_key: apolloApiKey,
      guest_jobs: guestJobs
    });
  } catch (err) {
    logger.error('Error in /api/user/settings:', err);
    res.status(500).json({ error: 'Failed to fetch user settings' });
  }
});

// POST /api/user/settings
router.post('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { apollo_api_key } = req.body;
    if (!apollo_api_key) {
      res.status(400).json({ error: 'Missing apollo_api_key' });
      return;
    }
    const { data, error } = await supabase
      .from('user_settings')
      .upsert([{ user_id: userId, apollo_api_key }], { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    res.status(500).json({ error: error.message });
  }
});

export const getCurrentUser = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    return res.json(data);
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
};

export const updateUser = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .update(req.body)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    return res.json(data);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// POST /api/user/upgrade  { plan: 'starter' | 'pro' | ... , baseCredits: number }
router.post('/upgrade', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { plan, baseCredits = 0 } = req.body || {};
    if (!plan) return res.status(400).json({ error: 'Missing plan' });

    const { data: current, error: readErr } = await supabase
      .from('users')
      .select('remaining_credits')
      .eq('id', userId)
      .single();
    if (readErr) return res.status(500).json({ error: readErr.message });

    const currentRemaining = Number(current?.remaining_credits || 0);
    const newBalance = currentRemaining + Number(baseCredits || 0);

    const { data, error } = await supabase
      .from('users')
      .update({ plan, plan_updated_at: new Date().toISOString(), remaining_credits: newBalance })
      .eq('id', userId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    // If upgraded to a paid plan (anything not 'free'), queue paid drip cadence
    try {
      if (String(plan || '').toLowerCase() !== 'free') {
        // Load email + first name for tokens
        const { data: u } = await supabase
          .from('users')
          .select('email, first_name, firstName')
          .eq('id', userId)
          .maybeSingle();
        const email = (u as any)?.email || (req.user as any)?.email;
        const firstName = (u as any)?.first_name || (u as any)?.firstName || '';
        if (email) await queueDripOnSignup({ id: userId, email, first_name: firstName }, 'paid');
      }
    } catch {}
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: 'Failed to upgrade plan' });
  }
});

export default router; 

// -----------------------------------------------------------------------------
// Email change endpoint (canonical update at auth.users with cascades)
// POST /api/user/change-email  { userId, newEmail }
// Requires auth; only the same user or an admin may change.
router.post('/change-email', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ error: 'Unauthorized' });

    const { userId, newEmail } = (req.body || {}) as { userId?: string; newEmail?: string };
    if (!userId || !newEmail) return res.status(400).json({ error: 'userId and newEmail are required' });

    // Optional: allow admins to change others' emails. For now, restrict to self.
    if (userId !== requesterId) {
      return res.status(403).json({ error: 'You can only change your own email' });
    }

    // 1) Validate newEmail does not already exist in auth.users
    const { data: usersList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) return res.status(500).json({ error: listErr.message });
    const existsInAuth = (usersList?.users || []).some(u => (u.email || '').toLowerCase() === String(newEmail).toLowerCase());
    if (existsInAuth) return res.status(409).json({ error: 'Email already in use' });

    // 2) Update at auth.users (canonical)
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: newEmail });
    if (authErr) return res.status(400).json({ error: authErr.message || 'Failed to update auth email' });

    // 3) Cascade into app tables
    const updates = [
      supabaseAdmin.from('users').update({ email: newEmail }).eq('id', userId),
      supabaseAdmin.from('profiles').update({ email: newEmail }).eq('user_id', userId),
      supabaseAdmin.from('user_settings').update({ email: newEmail }).eq('user_id', userId)
    ];
    const results = await Promise.all(updates);
    const appErr = results.find(r => (r as any)?.error)?.error;
    if (appErr) return res.status(500).json({ error: appErr.message || 'Failed to cascade email' });

    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Internal server error' });
  }
});

// -----------------------------------------------------------------------------
// POST /api/user/announce-signup
// Idempotent Slack notification for new users who arrived via social OAuth
// Uses a lightweight per-user flag in local storage on the client; server side
// is best-effort and safe to call multiple times.
router.post('/announce-signup', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email || null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      // Ensure minimal users row exists (idempotent)
      if (userEmail) {
        await supabase
          .from('users')
          .upsert({ id: userId, email: userEmail } as any, { onConflict: 'id' });
      }
    } catch {}

    // Post a generic signup notice; downstream Slack routing uses webhook URL
    try {
      await notifySlack(`🆕 New signup (oauth): ${userEmail || userId}`);
    } catch (e) {
      // Do not fail the request if Slack is unavailable
      console.warn('[announce-signup] slack notify failed', (e as any)?.message || e);
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'announce_failed' });
  }
});