import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { sendSignupWelcomeEmail } from '../../services/sendUserHtmlEmail';
import { freeForeverQueue } from '../../jobs/freeForeverCadence';

const router = Router();

// POST /api/auth/signup
// Creates a user with email_confirm=true and optional password
router.post('/signup', async (req, res) => {
  try {
    const { email, password, first_name, last_name, metadata } = req.body || {};
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const payload: any = {
      email,
      email_confirm: true,
      user_metadata: {
        first_name: first_name || undefined,
        last_name: last_name || undefined,
        onboarding_complete: false,
        role: 'free',
        ...(metadata || {})
      }
    };
    if (password) payload.password = password;

    const { data: created, error } = await supabase.auth.admin.createUser(payload as any);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    const userId = created?.user?.id;
    const userEmail = created?.user?.email;
    if (userId && userEmail) {
      // Ensure public.users row exists immediately
      try {
        await supabase
          .from('users')
          .upsert({ id: userId, email: userEmail, role: 'free', plan: 'free' } as any, { onConflict: 'id' });
      } catch {}
      // Seed free credits
      try {
        await supabase
          .from('user_credits')
          .upsert({ user_id: userId, total_credits: 50, used_credits: 0, remaining_credits: 50, last_updated: new Date().toISOString() }, { onConflict: 'user_id' });
      } catch {}

      // Fire welcome email (best-effort) and seed trial_emails row to track drip
      try {
        await sendSignupWelcomeEmail(userId);
      } catch {}
      try {
        await supabase
          .from('trial_emails')
          .upsert({ user_id: userId }, { onConflict: 'user_id' });
      } catch {}

      // Queue Free Forever email cadence (best-effort)
      try {
        const firstName = (first_name || (metadata && metadata.first_name)) || '';
        await freeForeverQueue.add('step-0', { email: userEmail, first_name: firstName, step: 0 });
      } catch {}
    }

    res.json({ user: created?.user });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

export default router;


