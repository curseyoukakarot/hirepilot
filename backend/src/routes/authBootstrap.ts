import { Router } from 'express';
import requireAuthUnified from '../../middleware/requireAuthUnified';
import { supabase } from '../lib/supabase';

const router = Router();

router.post('/', requireAuthUnified, async (req, res) => {
  try {
    const bodyApp = (req.body?.app || '').toString();
    const host = (req.headers.host || '').toLowerCase();
    const ref = (req.headers.referer || '').toLowerCase();
    const origin = (req.headers.origin || '').toLowerCase();
    const hostAppGuess = host.includes('jobs.') || ref.includes('jobs.') || origin.includes('jobs.')
      ? 'job_seeker'
      : 'recruiter';

    const app = ['job_seeker', 'recruiter'].includes(bodyApp) ? bodyApp : hostAppGuess;

    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const defaultRole = app === 'job_seeker' ? 'job_seeker_free' : 'free';
    const defaultPlan = defaultRole;
    const defaultAccountType = defaultRole;
    const defaultPrimaryApp = app;

    // Hard guard: never downgrade privileged/admin users, even if they hit the jobs app.
    const privilegedRoles = new Set([
      'super_admin',
      'superadmin',
      'admin',
      'team_admin',
      'teamadmin',
      'team_admins',
    ]);

    // Read current state for debugging and reuse
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, role, plan, primary_app, account_type')
      .eq('id', userId)
      .maybeSingle();

    const existingRole = String(existingUser?.role || '').toLowerCase();
    const existingAccountType = String(existingUser?.account_type || '').toLowerCase();
    const isJobSeekerRole = existingRole.startsWith('job_seeker_');
    const isRecruiterRole = ['free', 'member', 'admin', 'team_admin', 'recruitpro', 'super_admin'].includes(existingRole);

    // If auth metadata still indicates super_admin (even if DB drifted), treat as privileged and repair.
    let authIsSuperAdmin = false;
    try {
      const { data: authRes } = await (supabase as any).auth.admin.getUserById(userId);
      const u = (authRes as any)?.user || {};
      const appMeta = (u.app_metadata || {}) as any;
      const userMeta = (u.user_metadata || {}) as any;
      const metaRole = String(appMeta.role || userMeta.role || userMeta.account_type || '').toLowerCase();
      const allowed = new Set([].concat(appMeta.allowed_roles || []));
      authIsSuperAdmin = metaRole === 'super_admin' || allowed.has('super_admin');
    } catch {}

    const isPrivileged = authIsSuperAdmin || privilegedRoles.has(existingRole) || privilegedRoles.has(existingAccountType);

    // If the request is clearly from jobs app, but DB has recruiter defaults or legacy "job_seeker" account_type,
    // force canonical job seeker role fields.
    const shouldForceJobSeeker =
      app === 'job_seeker' &&
      !isPrivileged &&
      (!isJobSeekerRole || existingAccountType === 'job_seeker' || existingUser?.primary_app === null) &&
      (isRecruiterRole || existingRole === '' || existingAccountType === 'job_seeker');

    const nextRole = authIsSuperAdmin
      ? 'super_admin'
      : shouldForceJobSeeker
        ? 'job_seeker_free'
        : (existingUser?.role || defaultRole);
    const nextPlan = authIsSuperAdmin
      ? (existingUser?.plan || 'admin')
      : shouldForceJobSeeker
        ? 'job_seeker_free'
        : (existingUser?.plan || defaultPlan);
    const nextPrimaryApp = authIsSuperAdmin
      ? 'recruiter'
      : shouldForceJobSeeker
        ? 'job_seeker'
        : (existingUser?.primary_app || defaultPrimaryApp);
    const nextAccountType = authIsSuperAdmin
      ? (existingUser?.account_type || 'super_admin')
      : shouldForceJobSeeker
        ? 'job_seeker_free'
        : (existingUser?.account_type || defaultAccountType);

    // Upsert canonical user row with defaults if missing
    await supabase
      .from('users')
      .upsert(
        {
          id: userId,
          role: nextRole,
          plan: nextPlan,
          primary_app: nextPrimaryApp,
          account_type: nextAccountType,
        } as any,
        { onConflict: 'id' }
      );

    const { data: updatedUser } = await supabase
      .from('users')
      .select('id, role, plan, primary_app, account_type')
      .eq('id', userId)
      .maybeSingle();

    console.log('[auth bootstrap] done', {
      userId,
      app,
      host: req.headers.host,
      origin: req.headers.origin,
      updatedUser,
    });

    res.json({
      ok: true,
      app,
      role: updatedUser?.role || nextRole,
      plan: updatedUser?.plan || nextPlan,
      primary_app: updatedUser?.primary_app || nextPrimaryApp,
      account_type: updatedUser?.account_type || nextAccountType,
      updatedUser,
      existingUser,
    });
  } catch (e: any) {
    console.error('[auth bootstrap] error', e);
    res.status(500).json({ error: e?.message || 'Failed to bootstrap user' });
  }
});

export default router;
