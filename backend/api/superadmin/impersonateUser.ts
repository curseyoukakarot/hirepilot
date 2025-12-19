import { ApiRequest, ApiHandler, ErrorResponse } from '../../types/api';
import { Response } from 'express';
import { supabaseDb } from '../../lib/supabase';

function normalizeRole(val: unknown): string {
  return String(val || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function isJobSeekerRole(role: unknown): boolean {
  const r = normalizeRole(role);
  if (!r) return false;
  if (r === 'job_seeker' || r.startsWith('job_seeker_')) return true;
  // Some flows store plan/account_type in metadata with job seeker tiers
  if (r.startsWith('jobseeker_') || r.startsWith('jobseeker')) return true;
  return false;
}

function resolveAppBase(): string {
  const explicit =
    (process.env.APP_FRONTEND_URL || process.env.FRONTEND_APP_URL || '').trim();
  if (explicit) return explicit;

  const fe = (process.env.FRONTEND_URL || '').trim();
  if (!fe) return 'https://app.thehirepilot.com';

  // If FRONTEND_URL points to the marketing/root domain, prefer app subdomain for the SPA.
  try {
    const u = new URL(fe);
    const host = u.hostname.toLowerCase();
    if (host === 'thehirepilot.com' || host === 'www.thehirepilot.com') {
      return 'https://app.thehirepilot.com';
    }
  } catch {}
  return fe;
}

function resolveAuthCallbackBase(appBase: string): string {
  // Prefer FRONTEND_URL for auth redirects because Supabase redirect allow-lists
  // often only include the "site url" (marketing/root) and not app/jobs subdomains.
  const fe = (process.env.FRONTEND_URL || '').trim();
  if (fe) return fe;
  return appBase;
}

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    console.log('=== IMPERSONATE USER DEBUG ===');
    console.log('Request user:', req.user);
    console.log('Request body:', req.body);
    
    if (!req.user?.id) {
      console.log('No user ID in request');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { userId } = req.body;

    if (!userId) {
      console.log('No userId in request body');
      res.status(400).json({ error: 'Missing userId' });
      return;
    }

    console.log('Looking up current user role for ID:', req.user.id);
    
    // Check if current user is super_admin
    const { data: currentUser, error: currentUserError } = await supabaseDb
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (currentUserError || !currentUser) {
      console.log('Current user error:', currentUserError);
      res.status(404).json({ error: 'Current user not found' });
      return;
    }

    console.log('Current user role:', currentUser.role);
    console.log('User ID:', req.user.id);

    if (currentUser.role !== 'super_admin') {
      res.status(403).json({ 
        error: 'Insufficient permissions. Super admin access required.',
        debug: {
          actualRole: currentUser.role,
          expectedRole: 'super_admin',
          userId: req.user.id
        }
      });
      return;
    }

    // Get target user details.
    // NOTE: Some "job seeker" accounts may not have a row in `public.users`
    // or may have a non-job-seeker role there, while Supabase Auth metadata has the truth.
    let targetUser: { id: string; email: string; role?: string | null } | null = null;
    const { data: targetRow, error: targetUserError } = await supabaseDb
      .from('users')
      .select('id, email, role')
      .eq('id', userId)
      .maybeSingle();
    if (!targetUserError && targetRow?.id && targetRow?.email) {
      targetUser = { id: targetRow.id, email: targetRow.email, role: (targetRow as any).role || null };
    }

    let authUser: any = null;
    try {
      const { data: authData, error: authErr } = await supabaseDb.auth.admin.getUserById(userId);
      if (authErr) {
        console.warn('[impersonate] auth.admin.getUserById error', authErr);
      } else {
        authUser = authData?.user || null;
      }
    } catch (e) {
      console.warn('[impersonate] auth.admin.getUserById threw', e);
    }

    // If DB row missing, fall back to auth user.
    if (!targetUser) {
      const emailFromAuth = authUser?.email;
      if (!emailFromAuth) {
        res.status(404).json({ error: 'Target user not found' });
        return;
      }
      const metaRole =
        authUser?.user_metadata?.role ||
        authUser?.user_metadata?.account_type ||
        authUser?.user_metadata?.plan ||
        authUser?.app_metadata?.role ||
        null;
      targetUser = { id: userId, email: emailFromAuth, role: metaRole ? String(metaRole) : null };
    }

    // Generate magic link for session impersonation.
    //
    // IMPORTANT: Frontend is configured for PKCE and expects auth links to land on
    // `/auth/callback` to reliably exchange the code + run bootstrap. Redirecting
    // straight to `/dashboard` can race app auth gating and result in a "blank" session.
    //
    // ALSO: Job seeker users authenticate on the `jobs.` subdomain (separate origin + storage key),
    // so we must redirect them to the jobs host or the session won't exist there.
    // Determine job seeker vs recruiter using both DB role AND Auth metadata.
    const dbRole = targetUser?.role;
    const authRole =
      authUser?.user_metadata?.role ||
      authUser?.user_metadata?.account_type ||
      authUser?.user_metadata?.plan ||
      authUser?.app_metadata?.role ||
      null;
    const isJobSeeker = isJobSeekerRole(dbRole) || isJobSeekerRole(authRole);

    const appBase = resolveAppBase();
    const authCallbackBase = resolveAuthCallbackBase(appBase);
    const jobsBase =
      (process.env.JOBS_FRONTEND_URL || process.env.JOBSEEKER_FRONTEND_URL || '').trim() ||
      (appBase.includes('app.') ? appBase.replace('app.', 'jobs.') : 'https://jobs.thehirepilot.com');

    // IMPORTANT:
    // Supabase may ignore `redirectTo` unless it's allow-listed. In many setups, only
    // the main site URL (often `https://thehirepilot.com`) is allow-listed.
    // So we always redirect the magic link to `authCallbackBase` and then the frontend
    // performs a cross-subdomain session handoff to `app.*` or `jobs.*`.
    const redirectBase = authCallbackBase;
    const redirectTo =
      `${redirectBase.replace(/\/$/, '')}/auth/callback` +
      `?from=${encodeURIComponent('/dashboard')}` +
      (isJobSeeker ? `&app=job_seeker&forceBootstrap=1&handoff=jobs` : `&handoff=app`);

    const { data, error } = await supabaseDb.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email,
      options: {
        redirectTo
      }
    });

    if (error) {
      console.error('Error generating impersonation link:', error);
      res.status(500).json({ error: 'Failed to generate impersonation link' });
      return;
    }

    // Log the impersonation action for audit purposes
    console.log(`[SUPER ADMIN IMPERSONATION] ${req.user.id} is impersonating ${targetUser.email} (${targetUser.id})`);
    console.log('[SUPER ADMIN IMPERSONATION] redirect', {
      isJobSeeker,
      redirectBase,
      redirectTo,
      authCallbackBase,
      targetDbRole: dbRole || null,
      targetAuthRole: authRole ? String(authRole) : null
    });

    res.status(200).json({
      success: true,
      action_link: data.properties?.action_link,
      target_user: {
        id: targetUser.id,
        email: targetUser.email,
        role: (targetUser.role || authRole || null) as any
      }
    });
  } catch (error) {
    console.error('Error impersonating user:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to impersonate user',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
};

export default handler;
