import { Router } from 'express';
import requireAuthUnified from '../../middleware/requireAuthUnified';
import { supabase } from '../lib/supabase';

const router = Router();

router.post('/', requireAuthUnified, async (req, res) => {
  try {
    const app = (req.body?.app || '').toString();
    if (!app || !['job_seeker', 'recruiter'].includes(app)) {
      res.status(400).json({ error: 'Invalid app. Use job_seeker or recruiter' });
      return;
    }

    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const role = app === 'job_seeker' ? 'job_seeker_free' : 'free';
    const plan = role;

    // Upsert canonical user row
    await supabase
      .from('users')
      .upsert(
        {
          id: userId,
          role,
          plan,
          primary_app: app,
          account_type: role,
        } as any,
        { onConflict: 'id' }
      );

    // Ensure auth metadata mirrors the app-side role
    await supabase.auth.admin.updateUser({
      id: userId,
      user_metadata: {
        role,
        account_type: role,
        primary_app: app,
      },
    });

    res.json({ ok: true, app, role });
  } catch (e: any) {
    console.error('[auth bootstrap] error', e);
    res.status(500).json({ error: e?.message || 'Failed to bootstrap user' });
  }
});

export default router;
