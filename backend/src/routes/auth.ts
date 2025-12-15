import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { queueDripOnSignup } from '../lib/queueDripOnSignup';
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

    console.log('[auth/signup] Starting signup', { email });

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

    let created: any = null;
    let error: any = null;

    // Primary path: service-role admin createUser (explicit service client for safety)
    try {
      const result = await supabaseAdmin.auth.admin.createUser(payload as any);
      created = result.data;
      error = result.error;
    } catch (e: any) {
      error = e;
    }

    // Fallback to anon signUp if admin call failed (handles environments where service key is blocked/missing)
    if (error) {
      console.error('[auth/signup] Admin createUser failed', error?.message || error);
      try {
        const anonKey =
          process.env.SUPABASE_ANON_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!anonKey) {
          throw new Error('Missing SUPABASE_ANON_KEY for fallback signup');
        }
        const appUrl =
          process.env.APP_URL ||
          (process.env.FRONTEND_URL || 'https://app.thehirepilot.com');
        const anonClient = createClient(
          process.env.SUPABASE_URL as string,
          anonKey
        );
        const { data, error: signUpErr } = await anonClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${appUrl.replace(/\/$/, '')}/auth/callback`,
            data: payload.user_metadata,
          },
        });
        if (signUpErr) {
          throw signUpErr;
        }
        created = { user: data.user };
        error = null;
      } catch (fallbackErr: any) {
        console.error('[auth/signup] Anon fallback failed', fallbackErr?.message || fallbackErr);
        error = fallbackErr;
      }
    }

    if (error) {
      console.error('[auth/signup] error', error);
      res.status(401).json({ error: error.message || 'Signup failed' });
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

      // Queue new drip cadence (free plan)
      try {
        await queueDripOnSignup({ id: userId, email: userEmail, first_name: first_name || (metadata && metadata.first_name) }, 'free');
      } catch {}
    }

    res.json({ user: created?.user });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

export default router;


