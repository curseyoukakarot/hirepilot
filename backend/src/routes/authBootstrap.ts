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

    // Read current state for debugging
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, role, plan, primary_app, account_type')
      .eq('id', userId)
      .maybeSingle();

    console.log('[auth bootstrap] start', {
      userId,
      app,
      host: req.headers.host,
      origin: req.headers.origin,
      existingUser,
    });

    // Determine existing state
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, role, plan, primary_app, account_type')
      .eq('id', userId)
      .maybeSingle();

    const nextRole = existingUser?.role || defaultRole;
    const nextPlan = existingUser?.plan || defaultPlan;
    const nextPrimaryApp = existingUser?.primary_app || defaultPrimaryApp;
    const nextAccountType = existingUser?.account_type || defaultAccountType;

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

    // Ensure auth metadata mirrors the app-side role
    await supabase.auth.admin.updateUser({
      id: userId,
      user_metadata: {
        role: nextRole,
        account_type: nextAccountType,
        primary_app: nextPrimaryApp,
      },
    });

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
