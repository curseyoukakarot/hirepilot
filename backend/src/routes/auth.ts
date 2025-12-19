import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { queueDripOnSignup } from '../lib/queueDripOnSignup';
import { sendSignupWelcomeEmail } from '../../services/sendUserHtmlEmail';
import { freeForeverQueue } from '../../jobs/freeForeverCadence';
import { sendLifecycleEmail } from '../lib/sendLifecycleEmail';
import { sendEmail as sendSimpleEmail } from '../../services/emailService';

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

    const metaIn = (metadata || {}) as any;
    const metaAccountType = String(metaIn.account_type || metaIn.plan || metaIn.role || '').toLowerCase();
    const isJobSeeker =
      String(metaIn.signup_app || '').toLowerCase() === 'job_seeker' ||
      String(metaIn.intended_user_type || '').toLowerCase().startsWith('job_seeker') ||
      metaAccountType.startsWith('job_seeker_') ||
      metaAccountType === 'job_seeker';

    const canonicalRole = isJobSeeker ? (metaAccountType && metaAccountType.startsWith('job_seeker_') ? metaAccountType : 'job_seeker_free') : 'free';

    const payload: any = {
      email,
      email_confirm: true,
      user_metadata: {
        first_name: first_name || undefined,
        last_name: last_name || undefined,
        onboarding_complete: false,
        role: canonicalRole,
        ...(metadata || {})
      }
    };
    if (password) payload.password = password;

    let created: any = null;
    let error: any = null;
    let adminError: any = null;
    let fallbackError: any = null;

    // Primary path: service-role admin createUser (explicit service client for safety)
    try {
      const result = await supabaseAdmin.auth.admin.createUser(payload as any);
      created = result.data;
      error = result.error;
    } catch (e: any) {
      error = e;
      adminError = e;
    }

    // Fallback to anon signUp if admin call failed (handles environments where service key is blocked/missing)
    if (error) {
      console.error('[auth/signup] Admin createUser failed', {
        message: error?.message || error,
        status: error?.status,
        name: error?.name,
      });
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
        console.error('[auth/signup] Anon fallback failed', {
          message: fallbackErr?.message || fallbackErr,
          status: fallbackErr?.status,
          name: fallbackErr?.name,
        });
        error = fallbackErr;
        fallbackError = fallbackErr;
      }
    }

    if (error) {
      console.error('[auth/signup] final error', {
        message: error?.message || error,
        status: error?.status,
        name: error?.name,
      });
      const status = error?.status === 401 ? 401 : 500;
      res.status(status).json({
        error: error?.message || 'Signup failed',
        adminError: adminError ? { message: adminError?.message, status: adminError?.status, name: adminError?.name } : undefined,
        fallbackError: fallbackError ? { message: fallbackError?.message, status: fallbackError?.status, name: fallbackError?.name } : undefined,
      });
      return;
    }

    const userId = created?.user?.id;
    const userEmail = created?.user?.email;
    if (userId && userEmail) {
      // Ensure public.users row exists immediately
      try {
        if (isJobSeeker) {
          await supabase
            .from('users')
            .upsert(
              { id: userId, email: userEmail, role: canonicalRole, plan: canonicalRole, account_type: canonicalRole, primary_app: 'job_seeker' } as any,
              { onConflict: 'id' }
            );
        } else {
          await supabase
            .from('users')
            .upsert({ id: userId, email: userEmail, role: 'free', plan: 'free' } as any, { onConflict: 'id' });
        }
      } catch {}
      // Seed free credits
      try {
        await supabase
          .from('user_credits')
          .upsert({ user_id: userId, total_credits: 50, used_credits: 0, remaining_credits: 50, last_updated: new Date().toISOString() }, { onConflict: 'user_id' });
      } catch {}

      // Fire welcome email (best-effort)
      try {
        if (isJobSeeker) {
          const jobsBase = (process.env.JOBS_FRONTEND_URL || process.env.JOBSEEKER_FRONTEND_URL || 'https://jobs.thehirepilot.com').replace(/\/$/, '');
          const unsubscribeUrl =
            (process.env.JOBSEEKER_UNSUBSCRIBE_URL || process.env.SENDGRID_DEFAULT_UNSUBSCRIBE_URL || 'https://thehirepilot.com/unsubscribe').trim();
          const firstName = (first_name || (metadata && (metadata as any).first_name) || (metadata && (metadata as any).firstName) || '') as string;
          await sendLifecycleEmail({
            to: userEmail,
            template: 'jobseeker-welcome',
            subject: 'Welcome to HirePilot Jobs',
            tokens: {
              first_name: firstName || 'there',
              app_url: jobsBase,
              onboarding_url: `${jobsBase}/onboarding`,
              resume_builder_url: `${jobsBase}/prep`,
              landing_page_url: `${jobsBase}/prep`,
              year: String(new Date().getFullYear()),
              unsubscribe_url: unsubscribeUrl,
            }
          });
          try {
            await supabase.from('users').update({ job_seeker_welcome_sent_at: new Date().toISOString() }).eq('id', userId);
            await supabase.from('email_events').insert({
              user_id: userId,
              event_type: 'welcome.job_seeker',
              provider: 'sendgrid',
              template: 'jobseeker-welcome',
              metadata: { template: 'jobseeker-welcome', signup_app: 'job_seeker' }
            } as any);
          } catch {}

          // Admin notification (best-effort)
          try {
            const notifyTo =
              (process.env.JOBSEEKER_SIGNUP_NOTIFY_EMAIL || process.env.ADMIN_SIGNUP_NOTIFY_EMAIL || 'brandon@thehirepilot.com').trim();
            const subject = `New Job Seeker signup: ${userEmail}`;
            const html = `
              <div style="font-family: Arial, sans-serif; max-width: 640px;">
                <h2 style="margin:0 0 8px;">New Job Seeker signup</h2>
                <p style="margin:0 0 6px;"><strong>Email:</strong> ${userEmail}</p>
                <p style="margin:0 0 6px;"><strong>User ID:</strong> ${userId}</p>
                <p style="margin:0 0 6px;"><strong>Name:</strong> ${(first_name || '')} ${(last_name || '')}</p>
                <p style="margin:0 0 6px;"><strong>Host/App:</strong> jobs.thehirepilot.com</p>
              </div>
            `;
            await sendSimpleEmail(notifyTo, subject, subject, html);
          } catch {}
        } else {
          await sendSignupWelcomeEmail(userId);
        }
      } catch {}
      try {
        await supabase
          .from('trial_emails')
          .upsert({ user_id: userId }, { onConflict: 'user_id' });
      } catch {}

      if (!isJobSeeker) {
        // Queue Free Forever email cadence (best-effort)
        try {
          const firstName = (first_name || (metadata && (metadata as any).first_name)) || '';
          await freeForeverQueue.add('step-0', { email: userEmail, first_name: firstName, step: 0 });
        } catch {}

        // Queue new drip cadence (free plan)
        try {
          await queueDripOnSignup({ id: userId, email: userEmail, first_name: first_name || (metadata && (metadata as any).first_name) }, 'free');
        } catch {}
      }
    }

    res.json({ user: created?.user });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

export default router;


