console.log('=== ADMIN USERS ROUTE LOADED ===');
import express, { Request, Response } from 'express';
import { supabase as dbClient, supabaseDb } from '../../lib/supabase';
console.log('[DEBUG] supabaseLib:', dbClient);
import { requireAuth } from '../../middleware/authMiddleware';
import { sendTeamInviteEmail } from '../../services/emailService';
import { randomUUID } from 'crypto';
import { ApiRequest } from '../../types/api';
import { CreditService } from '../../services/creditService';
import { sendEmail } from '../../lib/sendEmail';
import { sendLifecycleEmail } from '../lib/sendLifecycleEmail';
import { queueDripOnSignup } from '../lib/queueDripOnSignup';
import { dripCadence } from '../lib/dripSchedule';
import { dripQueue } from '../queues/dripQueue';
// reuse the same instance name to avoid conflict
const supabaseClient = dbClient;

const router = express.Router();

// POST /api/admin/send-free-welcome
// Body: { recipients: [{ email: string, first_name: string }] }
router.post('/send-free-welcome', async (req, res) => {
  try {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'missing_auth' });

    // Validate JWT via Supabase and enforce super_admin
    const { data: { user }, error } = await supabaseClient.auth.getUser(token as any);
    if (error || !user) return res.status(401).json({ error: 'invalid_token' });
    const role = (user.user_metadata as any)?.role || (user.app_metadata as any)?.role;
    const roles = new Set([].concat(((user.app_metadata as any)?.allowed_roles || [])));
    const isSuper = role === 'super_admin' || roles.has('super_admin');
    if (!isSuper) return res.status(403).json({ error: 'forbidden' });

    const mode = String(req.body?.mode || '').toLowerCase();
    let recipients = Array.isArray(req.body?.recipients) ? req.body.recipients : [];

    // Backfill mode: compute recipients server-side
    if ((!recipients || recipients.length === 0) && mode === 'backfill') {
      const { data: usersToEmail, error: qErr } = await supabaseDb
        .from('users')
        .select('id,email,first_name,last_name,role,plan,free_welcome_sent_at')
        .is('free_welcome_sent_at', null)
        .or('role.eq.free,plan.eq.free');
      if (qErr) return res.status(500).json({ error: qErr.message });
      recipients = (usersToEmail || [])
        .filter((u: any) => !!u.email)
        .map((u: any) => ({ id: u.id, email: u.email, first_name: u.first_name || 'there' }));
    }

    if (!recipients || recipients.length === 0) return res.status(400).json({ error: 'no_recipients' });

    const results: any[] = [];
    for (const r of recipients) {
      const email = String((r as any)?.email || '').trim();
      const first_name = String((r as any)?.first_name || 'there');
      if (!email) continue;
      try {
        await sendEmail(email, '🎉 Your Free HirePilot Account is Live!', 'welcome.html', { first_name });
        // Mark as sent if we can resolve the user
        let userId = (r as any)?.id as string | undefined;
        if (!userId) {
          try {
            const { data: byEmail } = await supabaseDb.from('users').select('id').eq('email', email).maybeSingle();
            userId = byEmail?.id;
          } catch {}
        }
        if (userId) {
          await supabaseDb.from('users').update({ free_welcome_sent_at: new Date().toISOString() }).eq('id', userId);
          // Store email event for unified status view
          try {
            await supabaseDb.from('email_events').insert({
              user_id: userId,
              event_type: 'welcome.free',
              provider: 'sendgrid',
              metadata: { template: 'welcome' }
            } as any);
          } catch {}
        } else {
          // Fallback: update by email if unique
          await supabaseDb.from('users').update({ free_welcome_sent_at: new Date().toISOString() }).eq('email', email);
        }
        results.push({ email, sent: true });
      } catch (e: any) {
        results.push({ email, sent: false, error: e?.message || 'send_failed' });
      }
    }
    return res.json({ ok: true, results });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'server_error' });
  }
});

// POST /api/admin/send-jobseeker-welcome
// Body: { mode?: 'backfill', recipients?: [{ id?: string, email: string, first_name?: string }], user_ids?: string[] }
// Sends the Job Seeker welcome email to job_seeker_* users (free/pro/elite). Backfill mode computes recipients server-side.
router.post('/send-jobseeker-welcome', async (req, res) => {
  try {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'missing_auth' });

    // Validate JWT via Supabase and enforce super_admin
    const { data: { user }, error } = await supabaseClient.auth.getUser(token as any);
    if (error || !user) return res.status(401).json({ error: 'invalid_token' });
    const role = (user.user_metadata as any)?.role || (user.app_metadata as any)?.role;
    const roles = new Set([].concat(((user.app_metadata as any)?.allowed_roles || [])));
    const isSuper = role === 'super_admin' || roles.has('super_admin');
    if (!isSuper) return res.status(403).json({ error: 'forbidden' });

    const mode = String(req.body?.mode || '').toLowerCase();
    let recipients = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
    const userIds: string[] | undefined = Array.isArray(req.body?.user_ids) ? req.body.user_ids : undefined;

    const jobsBase = (process.env.JOBS_FRONTEND_URL || process.env.JOBSEEKER_FRONTEND_URL || 'https://jobs.thehirepilot.com').replace(/\/$/, '');
    const unsubscribeUrl =
      (process.env.JOBSEEKER_UNSUBSCRIBE_URL || process.env.SENDGRID_DEFAULT_UNSUBSCRIBE_URL || 'https://thehirepilot.com/unsubscribe').trim();
    const year = String(new Date().getFullYear());

    // Backfill mode: compute recipients server-side (all job seeker tiers)
    if ((!recipients || recipients.length === 0) && mode === 'backfill') {
      let q = supabaseDb
        .from('users')
        .select('id,email,first_name,firstName,role,plan,account_type,job_seeker_welcome_sent_at')
        .is('job_seeker_welcome_sent_at', null)
        .or('role.ilike.job_seeker_%,account_type.ilike.job_seeker_%,plan.ilike.job_seeker_%');
      const { data: usersToEmail, error: qErr } = await q;
      if (qErr) return res.status(500).json({ error: qErr.message });
      recipients = (usersToEmail || [])
        .filter((u: any) => !!u.email)
        .filter((u: any) => !userIds || userIds.includes(u.id))
        .map((u: any) => ({ id: u.id, email: u.email, first_name: u.first_name || u.firstName || 'there' }));
    }

    if (!recipients || recipients.length === 0) return res.status(400).json({ error: 'no_recipients' });

    const results: any[] = [];
    for (const r of recipients) {
      const email = String((r as any)?.email || '').trim();
      const first_name = String((r as any)?.first_name || 'there');
      const id = (r as any)?.id as string | undefined;
      if (!email) continue;
      try {
        await sendLifecycleEmail({
          to: email,
          template: 'jobseeker-welcome',
          tokens: {
            first_name,
            app_url: jobsBase,
            onboarding_url: `${jobsBase}/onboarding`,
            resume_builder_url: `${jobsBase}/prep`,
            landing_page_url: `${jobsBase}/prep`,
            year,
            unsubscribe_url: unsubscribeUrl,
          }
        });

        if (id) {
          await supabaseDb.from('users').update({ job_seeker_welcome_sent_at: new Date().toISOString() }).eq('id', id);
          try {
            await supabaseDb.from('email_events').insert({
              user_id: id,
              event_type: 'welcome.job_seeker',
              provider: 'sendgrid',
              template: 'jobseeker-welcome',
              metadata: { template: 'jobseeker-welcome' }
            } as any);
          } catch {}
        } else {
          await supabaseDb.from('users').update({ job_seeker_welcome_sent_at: new Date().toISOString() }).eq('email', email);
        }

        results.push({ email, sent: true });
      } catch (e: any) {
        results.push({ email, sent: false, error: e?.message || 'send_failed' });
      }
    }

    return res.json({ ok: true, results });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'server_error' });
  }
});

const supabase = supabaseDb; // Use service role client for admin operations

// Helper: Check if user is super admin
async function isSuperAdmin(userId: string) {
  const { data, error } = await supabaseDb
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role === 'super_admin';
}

// Middleware: Restrict to super admins
async function requireSuperAdmin(req: Request, res: Response, next: Function) {
  const userData = (req as any).user;
  if (!userData?.id) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (userData.role !== 'super_admin' && !(await isSuperAdmin(userData.id))) {
    res.status(403).json({ error: 'Forbidden: Super admin only' });
    return;
  }
  next();
}

type MinimalUserRow = {
  id: string;
  email?: string | null;
  role?: string | null;
  team_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
};

async function ensureTeamForTeamAdmin(
  userId: string,
  context: {
    teamId?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    company?: string | null;
  }
): Promise<string | null> {
  if (context.teamId) return context.teamId;
  try {
    const displayNameCandidate = [context.firstName, context.lastName].filter(Boolean).join(' ').trim();
    const emailHandle = context.email?.split('@')?.[0];
    const teamName =
      context.company?.trim() ||
      (displayNameCandidate ? `${displayNameCandidate}'s Team` : null) ||
      (emailHandle ? `${emailHandle}'s Team` : null) ||
      `Team ${userId.slice(0, 8)}`;

    const { data, error } = await supabaseDb
      .from('teams')
      .insert({ name: teamName })
      .select('id')
      .single();

    if (error) {
      console.error('[ADMIN USERS] Failed to create team for user', userId, error);
      return null;
    }

    const newTeamId = data?.id || null;
    if (newTeamId) {
      await supabaseDb.from('users').update({ team_id: newTeamId }).eq('id', userId);
    }
    return newTeamId;
  } catch (err) {
    console.error('[ADMIN USERS] ensureTeamForTeamAdmin error', err);
    return context.teamId || null;
  }
}

async function syncAuthRoleMetadata(userId: string, role?: string, teamId?: string): Promise<void> {
  if (!role && !teamId) return;
  try {
    const { data } = await supabaseDb.auth.admin.getUserById(userId);
    const authUser = data?.user;
    if (!authUser) return;

    const nextAppMeta: Record<string, any> = { ...(authUser.app_metadata || {}) };
    const nextUserMeta: Record<string, any> = { ...(authUser.user_metadata || {}) };

    if (role) {
      nextAppMeta.role = role;
      const allowed = new Set<string>(
        Array.isArray(nextAppMeta.allowed_roles) ? nextAppMeta.allowed_roles : []
      );
      allowed.add('authenticated');
      allowed.add(role);
      nextAppMeta.allowed_roles = Array.from(allowed);

      nextUserMeta.role = role;
      nextUserMeta.account_type = role;
      nextUserMeta.user_type = role;
    }

    if (teamId) {
      nextUserMeta.team_id = teamId;
    }

    const payload: Record<string, any> = {};
    if (role) payload.app_metadata = nextAppMeta;
    if (role || teamId) payload.user_metadata = nextUserMeta;

    if (Object.keys(payload).length > 0) {
      await supabaseDb.auth.admin.updateUserById(userId, payload);
    }
  } catch (err) {
    console.error(`[ADMIN USERS] Failed to sync auth metadata for ${userId}`, err);
  }
}

async function applyUserPatchAndSync(userId: string, updates: Record<string, any>) {
  const { data: before, error: loadErr } = await supabaseDb
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (loadErr) throw loadErr;

  const { data, error } = await supabaseDb
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .maybeSingle();

  if (error) throw error;

  const resolved: MinimalUserRow | null = (data as MinimalUserRow) || (before as MinimalUserRow) || null;
  if (!resolved) throw new Error('User not found');

  const resolvedRole = (updates.role ?? resolved.role ?? before?.role) as string | undefined;
  const normalizedRole =
    typeof resolvedRole === 'string'
      ? resolvedRole.toLowerCase().replace(/[\s-]+/g, '_')
      : '';
  let resolvedTeamId = resolved.team_id ?? before?.team_id ?? null;

  if (normalizedRole === 'team_admin') {
    resolvedTeamId =
      (await ensureTeamForTeamAdmin(userId, {
        teamId: resolvedTeamId,
        email: resolved.email || before?.email || null,
        firstName:
          resolved.first_name ||
          resolved.firstName ||
          before?.first_name ||
          before?.firstName ||
          null,
        lastName:
          resolved.last_name ||
          resolved.lastName ||
          before?.last_name ||
          before?.lastName ||
          null,
        company: (resolved as any)?.company || (before as any)?.company || null,
      })) ?? resolvedTeamId;
  }

  await syncAuthRoleMetadata(
    userId,
    updates.role !== undefined ? resolvedRole : undefined,
    resolvedTeamId || undefined
  );

  if (resolvedTeamId && !resolved.team_id) {
    resolved.team_id = resolvedTeamId;
  }

  return resolved;
}

// GET /api/admin/users - List all users
router.get('/users', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  console.log('[ADMIN USERS] Fetching all users from Supabase...');
  const { data: users, error: userErr } = await supabaseDb.from('users').select('*');
  if (userErr) {
    console.error('[ADMIN USERS] Error fetching users:', userErr);
    return res.status(500).json({ error: userErr.message });
  }

  // fetch credits for these users
  const ids = users.map(u => u.id);
  const { data: credits } = await supabaseDb.from('user_credits').select('user_id,remaining_credits').in('user_id', ids);
  const creditMap: Record<string, number> = {};
  (credits || []).forEach(c => { creditMap[c.user_id] = c.remaining_credits; });

  const enriched = users.map(u => ({ ...u, balance: creditMap[u.id] || 0 }));
  res.json(enriched);
});

// GET /api/admin/users/:id  – fetch a single user record
router.get('/users/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await supabaseDb.from('users').select('*').eq('id', id).single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// GET /api/admin/users/:id/features - Get feature flags (rex, zapier)
router.get('/users/:id/features', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Use integrations table as source of truth
    const { data: integ, error: integErr } = await supabaseDb
      .from('integrations')
      .select('provider,status')
      .eq('user_id', id);
    if (integErr) return res.status(500).json({ error: integErr.message });

    const rexRow = (integ || []).find((r: any) => r.provider === 'rex');
    const zapRow = (integ || []).find((r: any) => r.provider === 'zapier');
    const enabledStatuses = new Set(['enabled','connected','on','true']);
    res.json({
      rex_enabled: enabledStatuses.has((rexRow?.status || '').toLowerCase()),
      zapier_enabled: enabledStatuses.has((zapRow?.status || '').toLowerCase())
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load feature flags' });
  }
});

// PATCH /api/admin/users/:id/features - Update feature flags (rex, zapier)
router.patch('/users/:id/features', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rex_enabled, zapier_enabled } = req.body || {};
  try {
    // Store feature flags in integrations table
    const rows: any[] = [];
    if (typeof rex_enabled === 'boolean') rows.push({ user_id: id, provider: 'rex', status: rex_enabled ? 'enabled' : 'disabled' });
    if (typeof zapier_enabled === 'boolean') rows.push({ user_id: id, provider: 'zapier', status: zapier_enabled ? 'enabled' : 'disabled' });
    if (rows.length > 0) {
      const { error: upErr } = await supabaseDb.from('integrations').upsert(rows, { onConflict: 'user_id,provider' });
      if (upErr) return res.status(500).json({ error: upErr.message });
    }

    res.json({ success: true, user_id: id, rex_enabled, zapier_enabled });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update feature flags' });
  }
});

// POST /api/admin/users - Create/invite a user
router.post('/users', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { email, firstName, lastName, role } = req.body;
    if (!email || !firstName || !lastName || !role) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    const normalizedRole = String(role);
    // 1. Create user in Supabase Auth (prefer setting both user_metadata and app_metadata)
    let userId: string | undefined;
    let creationError: any | null = null;
    try {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { firstName, lastName, role: normalizedRole },
        app_metadata: { role: normalizedRole } as any
      } as any);
      console.log('[ADMIN USERS] Auth user creation result:', { authUser, authError });
      userId = authUser?.user?.id;
      creationError = authError || null;
    } catch (e: any) {
      creationError = e;
      console.error('[ADMIN USERS] createUser threw exception:', e);
    }

    // Fallbacks when creation failed or user missing
    if (creationError || !userId) {
      // If DB already has user with this email, reuse
      const { data: existingDbUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();
      if (existingDbUser?.id) {
        userId = existingDbUser.id;
      }

      // If still unknown, try to find in Auth via listUsers (best-effort)
      if (!userId) {
        try {
          const pageSize = 200;
          let page = 1;
          while (page <= 5 && !userId) { // scan up to 1000 users to avoid heavy calls
            const { data: pageData, error: listErr } = await (supabase as any).auth.admin.listUsers({ page, perPage: pageSize });
            if (listErr) break;
            const match = (pageData?.users || []).find((u: any) => (u.email || '').toLowerCase() === email.toLowerCase());
            if (match) userId = match.id;
            if (!pageData || (pageData.users || []).length < pageSize) break;
            page += 1;
          }
        } catch {}
      }

      // As a last resort, attempt invite which also ensures an auth user exists
      if (!userId) {
        try {
          const { data: inviteData, error: inviteError } = await (supabase as any).auth.admin.inviteUserByEmail(email, {
            data: { firstName, lastName, role: normalizedRole },
          });
          if (!inviteError) userId = inviteData?.user?.id;
        } catch {}
      }

      if (!userId) {
        const message = (creationError && creationError.message) || 'Database error creating new user';
        res.status(500).json({ error: message });
        return;
      }
    }

    // Ensure app_metadata.role is set for JWT consumption
    try {
      await supabase.auth.admin.updateUserById(userId, { app_metadata: { role: normalizedRole } as any });
    } catch (e) {
      console.warn('[ADMIN USERS] Failed to set app_metadata.role (non-fatal):', e);
    }

    // 2. Insert into users table
    console.log('[ADMIN USERS] Attempting to insert user into users table:', {
      id: userId,
      email,
      firstName,
      lastName,
      role,
      onboardingComplete: false,
    });
    const { data: dbUser, error: dbError } = await supabase.from('users').upsert({
      id: userId,
      email,
      firstName,
      lastName,
      role: normalizedRole,
      onboardingComplete: false,
    }, { onConflict: 'id' }).select('*').single();
    console.log('[ADMIN USERS] Insert result:', { dbUser, dbError });
    if (dbError) {
      console.error('[ADMIN USERS] DB insert error (full object):', dbError);
      res.status(500).json({ error: dbError.message || 'Database error creating new user' });
      return;
    }
    // 3. Initialize credits based on role
    try {
      await CreditService.allocateCreditsBasedOnRole(userId, role, 'admin_grant');
      console.log(`[ADMIN USERS] Credits allocated for ${role} role`);
    } catch (creditError) {
      console.error('[ADMIN USERS] Error allocating credits:', creditError);
      // Continue execution even if credit allocation fails
    }
    // 4. Send invite email using the same template as team invite
    // Get inviter info
    const inviterId = (req as any).user?.id;
    const { data: inviter, error: inviterError } = await supabase.from('users').select('*').eq('id', inviterId).single();
    const inviterInfo = inviter || { firstName: 'Super', lastName: 'Admin', email: 'admin@hirepilot.com' };
    // Generate invite link (use user id as token)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || 'https://app.thehirepilot.com';
    const inviteLink = `${appUrl}/join?token=${userId}`;
    try {
      await sendTeamInviteEmail({
        to: email,
        firstName,
        lastName,
        inviteLink,
        tempPassword: undefined, // No temp password for admin-created users
        invitedBy: {
          firstName: inviterInfo.firstName || 'Super Admin',
          lastName: inviterInfo.lastName || '',
          email: inviterInfo.email
        },
        company: undefined, // No company specified for admin users
        role
      });
    } catch (emailError) {
      res.status(500).json({ error: 'Failed to send invite email', details: emailError });
      return;
    }
    res.json({ success: true, user: dbUser });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH /api/admin/users/:id/credits - Assign credits
router.patch('/users/:id/credits', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const userId = req.params.id;
  const { total_credits } = req.body;
  if (!total_credits) {
    res.status(400).json({ error: 'Missing total_credits' });
    return;
  }
  const { error } = await supabaseDb.from('user_credits').upsert({
    user_id: userId,
    total_credits: total_credits,
    used_credits: 0,
    remaining_credits: total_credits,
  }, { onConflict: 'user_id' });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true, user_id: userId, total_credits });
});

// PATCH /api/admin/users  – update user when body contains id (fallback for UI)
router.patch('/users', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { id, firstName, lastName, role } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'id required' });
  }

  const updatePayload: Record<string, any> = {};
  if (role !== undefined) updatePayload.role = role;
  if (firstName !== undefined) updatePayload.firstName = firstName;
  if (lastName !== undefined) updatePayload.lastName = lastName;

  if (Object.keys(updatePayload).length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  try {
    const updatedUser = await applyUserPatchAndSync(id, updatePayload);
    return res.json(updatedUser);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update user' });
  }
});

// ---------------------------------------------
// PATCH /api/admin/users/:id  – edit user by URL param (original front-end call)
// ---------------------------------------------
router.patch('/users/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { firstName, lastName, role } = req.body;

  const updatePayload: Record<string, any> = {};
  if (role !== undefined) updatePayload.role = role;
  if (firstName !== undefined) updatePayload.firstName = firstName;
  if (lastName !== undefined) updatePayload.lastName = lastName;

  if (Object.keys(updatePayload).length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  try {
    const updatedUser = await applyUserPatchAndSync(id, updatePayload);
    return res.json(updatedUser);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update user' });
  }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const userId = req.params.id;
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  // Optionally, delete from Auth as well
  res.json({ success: true });
});

// PATCH /api/admin/users/:id/plan – set plan and optional credit fields
router.patch('/users/:id/plan', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const userId = req.params.id;
  const { plan, remaining_credits, monthly_credits } = req.body || {};
  if (!plan) return res.status(400).json({ error: 'plan required' });
  try {
    const updates: any = { plan, plan_updated_at: new Date().toISOString() };
    if (typeof remaining_credits === 'number') updates.remaining_credits = remaining_credits;
    if (typeof monthly_credits === 'number') updates.monthly_credits = monthly_credits;
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    // Queue paid drip on upgrade (best-effort)
    try {
      if (String(plan || '').toLowerCase() !== 'free') {
        const email = (data as any)?.email;
        const firstName = (data as any)?.first_name || (data as any)?.firstName || '';
        if (email) await queueDripOnSignup({ id: userId, email, first_name: firstName }, 'paid');
      }
    } catch {}
    return res.json({ success: true, user: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to set plan' });
  }
});

// POST /api/admin/users/:id/cancel-subscription – clear local subscription link
router.post('/users/:id/cancel-subscription', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const userId = req.params.id;
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'canceled', plan_tier: null, stripe_subscription_id: null, current_period_end: null, seat_count: null, included_seats: null })
      .eq('user_id', userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to cancel subscription' });
  }
});

// POST /api/admin/users/force-free — idempotently force plan=free, role=free, credits=50; delete subscriptions
router.post('/users/force-free', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { user_ids } = req.body as { user_ids: string[] };
  if (!Array.isArray(user_ids) || user_ids.length === 0) return res.status(400).json({ error: 'user_ids[] required' });
  try {
    // Upsert users to free
    const upserts = user_ids.map((id) => ({ id, plan: 'free', role: 'free' }));
    await supabaseDb.from('users').upsert(upserts as any, { onConflict: 'id' });

    // Seed credits to 50 (idempotent)
    for (const id of user_ids) {
      await supabaseDb
        .from('user_credits')
        .upsert({ user_id: id, total_credits: 50, used_credits: 0, remaining_credits: 50, last_updated: new Date().toISOString() } as any, { onConflict: 'user_id' });
    }

    // Delete lingering subscriptions
    try { await supabaseDb.from('subscriptions').delete().in('user_id', user_ids); } catch {}

    return res.json({ success: true });
  } catch (e: any) {
    console.error('[admin] users/force-free error', e);
    return res.status(500).json({ error: e?.message || 'force_free_failed' });
  }
});

// GET /api/admin/latest-users - List the most recently created users
router.get('/latest-users', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/admin/stats/overview - basic admin stats for dashboard
router.get('/stats/overview', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    // Total users (exact count via head query)
    const { count: totalUsers, error: countErr } = await supabaseDb
      .from('users')
      .select('id', { count: 'exact', head: true });
    if (countErr) {
      res.status(500).json({ error: countErr.message });
      return;
    }

    // Total credit consumption (sum used_credits across user_credits)
    const { data: creditRows, error: creditErr } = await supabaseDb
      .from('user_credits')
      .select('used_credits');
    if (creditErr) {
      res.status(500).json({ error: creditErr.message });
      return;
    }
    const totalCreditsUsed = (creditRows || []).reduce((sum: number, r: any) => sum + (Number(r.used_credits) || 0), 0);

    res.json({ total_users: totalUsers || 0, total_credits_used: totalCreditsUsed });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH /api/admin/users/:id/password - Set password (Super Admin)
router.patch('/users/:id/password', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const userId = req.params.id;
  const { password } = req.body;

  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  try {
    // Use service role client for admin operations
    const adminClient = supabaseDb;

    const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
      password
    });

    if (error) {
      console.error('[ADMIN USERS] Password update error:', error);
      res.status(500).json({ error: error.message || 'Failed to update password' });
      return;
    }

    res.json({ success: true, user: data?.user });
  } catch (err) {
    console.error('[ADMIN USERS] Unexpected error updating password:', err);
    res.status(500).json({ error: (err as Error).message || 'Internal server error' });
  }
});

// POST /api/admin/users/backfill-credits - Backfill credits for existing users
router.post('/users/backfill-credits', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    console.log('[ADMIN] Starting credit backfill...');
    
    // Get all users from the public.users table
    const { data: users, error: usersError } = await supabaseDb
      .from('users')
      .select('id, email, role, firstName, lastName');

    if (usersError) {
      console.error('[ADMIN] Error fetching users:', usersError);
      res.status(500).json({ error: usersError.message });
      return;
    }

    if (!users || users.length === 0) {
      res.json({ message: 'No users found in the database.', processed: 0, errors: 0 });
      return;
    }

    // Get existing credit records to avoid duplicates
    const { data: existingCredits, error: creditsError } = await supabaseDb
      .from('user_credits')
      .select('user_id');

    if (creditsError) {
      console.error('[ADMIN] Error fetching existing credits:', creditsError);
      res.status(500).json({ error: creditsError.message });
      return;
    }

    const existingCreditUserIds = new Set(
      (existingCredits || []).map(c => c.user_id)
    );

    // Filter users who don't have credits yet
    const usersWithoutCredits = users.filter(user => !existingCreditUserIds.has(user.id));

    console.log(`[ADMIN] Found ${usersWithoutCredits.length} users without credits`);

    if (usersWithoutCredits.length === 0) {
      res.json({ 
        message: 'All users already have credits assigned.', 
        totalUsers: users.length,
        processed: 0, 
        errors: 0 
      });
      return;
    }

    // Process each user
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const user of usersWithoutCredits) {
      try {
        const role = user.role || 'member'; // Default to member if no role
        
        await CreditService.allocateCreditsBasedOnRole(user.id, role, 'admin_grant');
        
        successCount++;
        console.log(`[ADMIN] Assigned credits to ${user.email} (${role})`);
        
      } catch (error) {
        errorCount++;
        const errorMsg = `Failed to assign credits to ${user.email}: ${error}`;
        console.error(`[ADMIN] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Return results
    res.json({
      message: 'Credit backfill completed',
      totalUsers: users.length,
      usersProcessed: usersWithoutCredits.length,
      successful: successCount,
      errors: errorCount,
      errorDetails: errors.length > 0 ? errors : undefined
    });
    
  } catch (err) {
    console.error('[ADMIN] Fatal error during backfill:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export const getAdminUsers = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'admin');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    return res.json(data);
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch admin users' });
    return;
  }
};

export const createAdminUser = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { email, password, firstName, lastName } = req.body;

    const { data: userData, error: userError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          firstName,
          lastName,
          role: 'admin'
        }
      }
    });

    if (userError) {
      res.status(500).json({ error: userError.message });
      return;
    }

    res.status(201).json(userData);
    return;
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
    return;
  }
};

export const inviteTeamMember = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { email, firstName, lastName, role, company } = req.body;

    const inviteData = {
      to: email,
      firstName,
      lastName,
      inviteLink: `${process.env.FRONTEND_URL}/invite?token=${Math.random().toString(36).substring(7)}`,
      invitedBy: {
        firstName: req.user.first_name || '',
        lastName: req.user.last_name || '',
        email: req.user.email
      },
      company,
      role
    };

    await sendTeamInviteEmail(inviteData);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error inviting team member:', error);
    res.status(500).json({ error: 'Failed to invite team member' });
    return;
  }
};

export default router; 

// POST /api/admin/users/backfill-drips  { plan?: 'free' | 'paid' }
router.post('/users/backfill-drips', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const planFilter = String((req.body?.plan || '')).toLowerCase();
    const templates: string[] | undefined = Array.isArray(req.body?.templates) ? req.body.templates : undefined;
    const userIds: string[] | undefined = Array.isArray(req.body?.user_ids) ? req.body.user_ids : undefined;
    const { data: users, error } = await supabaseDb
      .from('users')
      .select('id, email, plan, firstName')
      .then((r: any) => r);
    if (error) return res.status(500).json({ error: error.message });

    const list = (users || [])
      .filter((u: any) => u.email)
      .filter((u: any) => !planFilter || String(u.plan || '').toLowerCase() === planFilter)
      .filter((u: any) => !userIds || userIds.includes(u.id));
    let enqueued = 0;
    for (const u of list) {
      const plan = String(u.plan || '').toLowerCase() === 'free' ? 'free' : 'paid';
      try {
        const firstName = u.first_name || u.firstName || '';
        if (!templates || templates.length === 0) {
          await queueDripOnSignup({ id: u.id, email: u.email, first_name: firstName }, (planFilter || plan) as any);
          enqueued++;
        } else {
          // Enqueue only selected templates (respect plan when filtering available templates)
          const available = plan === 'free' ? dripCadence.free : dripCadence.paid;
          const subset = available.filter(s => templates.includes(s.template));
          for (const s of subset) {
            await dripQueue.add('send', {
              user_id: u.id,
              to: u.email,
              template: s.template,
              tokens: { first_name: firstName, app_url: process.env.APP_URL || 'https://thehirepilot.com' },
              event_key: s.key,
            }, { delay: 0 });
            enqueued++;
          }
        }
      } catch {}
    }
    res.json({ success: true, plan: planFilter || 'all', enqueued, total_candidates: list.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'backfill_failed' });
  }
});

// NEW: GET /api/admin/users/:id/drip-status – show queued and sent drip info for a user
router.get('/users/:id/drip-status', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    // Inspect BullMQ queue for this user's jobs
    const jobs = await dripQueue.getJobs(['waiting','delayed','active','completed','failed'], 0, 200);
    const mine = jobs.filter((j: any) => (j?.data?.user_id || '') === userId);
    const now = Date.now();
    const stateOf = (j: any) => (j.state || (typeof j.getState === 'function' ? j.getState() : '')) || 'unknown';

    const queued = mine
      .filter((j: any) => ['waiting','delayed','active'].includes(stateOf(j)))
      .map((j: any) => ({
        id: j.id,
        template: j.data?.template,
        event_key: j.data?.event_key,
        state: stateOf(j),
        scheduled_at: j.timestamp ? new Date(j.timestamp).toISOString() : null,
        delay_ms: j.delay ?? 0,
        next_run_at: j.timestamp ? new Date(j.timestamp + (j.delay || 0)).toISOString() : null,
        eta_ms: j.timestamp ? Math.max(0, (j.timestamp + (j.delay || 0)) - now) : null,
      }));

    const failed = mine
      .filter((j: any) => (j as any).failedReason || stateOf(j) === 'failed')
      .map((j: any) => ({
        id: j.id,
        template: j.data?.template,
        event_key: j.data?.event_key,
        failed_reason: (j as any).failedReason || 'failed',
      }));

    const completed = mine
      .filter((j: any) => stateOf(j) === 'completed')
      .map((j: any) => ({
        id: j.id,
        template: j.data?.template,
        event_key: j.data?.event_key,
        finished_on: (j as any).finishedOn ? new Date((j as any).finishedOn).toISOString() : null,
      }));

    // Query email_events for sent drips
    const dripKeys = [
      'drip.free.campaign','drip.free.rex','drip.free.csv','drip.free.extension','drip.free.requests','drip.free.leads',
      'drip.paid.agent','drip.paid.rex','drip.paid.deals','drip.paid.leads','drip.paid.candidates','drip.paid.reqs'
    ];
    const { data: sentRows } = await supabaseDb
      .from('email_events')
      .select('id,event_key,template,event_timestamp,created_at')
      .eq('user_id', userId)
      .in('event_key', dripKeys as any)
      .order('created_at', { ascending: false })
      .limit(50);

    res.json({ user_id: userId, queued, failed, completed, sent: sentRows || [] });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'status_failed' });
  }
});

// Admin Email Status – unified view across drips & lifecycle
// GET /api/admin/email/status?user=<email-or-id>&plan=free|paid&limit=<N>
router.get('/email/status', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const q = String(req.query.user || '').trim();
    const plan = String(req.query.plan || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));

    // 1) Users
    let usersQ = supabaseDb
      .from('users')
      .select('id,email,plan,firstName,lastName')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (plan && (plan === 'free' || plan === 'paid')) {
      usersQ = usersQ.eq('plan', plan);
    }
    let usersRes;
    if (q) {
      usersRes = await supabaseDb
        .from('users')
        .select('id,email,plan,firstName,lastName')
        .or(`id.eq.${q},email.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(limit);
    } else {
      usersRes = await usersQ;
    }
    const { data: users, error: usersErr } = usersRes as any;
    if (usersErr) return res.status(500).json({ error: usersErr.message });
    if (!users || users.length === 0) return res.json({ users: [] });

    const userIds = users.map((u: any) => u.id);

    // 2) Sent events (all types)
    const { data: sentRows, error: sentErr } = await supabaseDb
      .from('email_events')
      .select('user_id,event_type,provider,created_at,metadata')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (sentErr) return res.status(500).json({ error: sentErr.message });

    // 3) Queued jobs – Drips (BullMQ)
    const jobStates = ['waiting','delayed','active','completed','failed'] as any;
    const dripJobs = await dripQueue.getJobs(jobStates, 0, 2000);

    const mapQueued = (jobs: any[]) => jobs.map((j: any) => {
      const state = j.state || (typeof j.getState === 'function' ? j.getState() : 'unknown');
      const data = (j as any).data || {};
      const uid = data.user_id || data.userId || '';
      const ts = (j as any).timestamp || null;
      const delay = (j as any).delay || 0;
      const next = ts ? new Date(ts + delay).toISOString() : null;
      return {
        kind: 'drip',
        job_id: j.id,
        user_id: uid,
        state,
        event_key: data.event_key || data.eventKey || null,
        template: data.template || null,
        scheduled_at: ts ? new Date(ts).toISOString() : null,
        next_run_at: next,
        failed_reason: (j as any).failedReason || null,
        finished_on: (j as any).finishedOn ? new Date((j as any).finishedOn).toISOString() : null,
      };
    });

    const allJobs = mapQueued(dripJobs as any);
    const jobsByUser: Record<string, any[]> = {};
    for (const j of allJobs) {
      if (!j.user_id) continue;
      if (!jobsByUser[j.user_id]) jobsByUser[j.user_id] = [];
      jobsByUser[j.user_id].push(j);
    }

    // 4) Build response per user
    const sentByUser: Record<string, any[]> = {};
    for (const row of (sentRows || [])) {
      const uid = row.user_id;
      if (!sentByUser[uid]) sentByUser[uid] = [];
      sentByUser[uid].push({
        event_type: row.event_type,
        provider: row.provider,
        template: (row.metadata && (row.metadata as any).template) || undefined,
        created_at: row.created_at,
      });
    }

    const results = (users || []).map((u: any) => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
      const jobs = jobsByUser[u.id] || [];
      const queued = jobs.filter(j => ['waiting','delayed','active'].includes(j.state));
      const failed = jobs.filter(j => j.failed_reason);
      const completed = jobs.filter(j => j.state === 'completed');
      return {
        id: u.id,
        email: u.email,
        plan: u.plan,
        name,
        sent: (sentByUser[u.id] || []).slice(0, 100),
        queued,
        completed,
        failed
      };
    });

    res.json({ users: results });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'email_status_failed' });
  }
});