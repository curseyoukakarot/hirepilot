import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { FaGoogle, FaMicrosoft } from 'react-icons/fa6';
import { BILLING_CONFIG } from '../../../config/billingConfig';

export default function JobSeekerSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    linkedin: '',
    company: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const onChange = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const resolveRedirect = () => '/dashboard';
  const backendBase = useMemo(() => {
    const base = (import.meta.env.VITE_BACKEND_URL || 'https://api.thehirepilot.com').trim();
    return base.replace(/\/$/, '');
  }, []);

  const requestedPlan = (() => {
    const val = (searchParams.get('plan') || '').toLowerCase();
    return val === 'pro' || val === 'elite' ? (val as 'pro' | 'elite') : null;
  })();
  const requestedInterval = (() => {
    const val = (searchParams.get('interval') || '').toLowerCase();
    return val === 'monthly' || val === 'annual' ? (val as 'monthly' | 'annual') : 'monthly';
  })();

  const startCheckout = async (planId: 'pro' | 'elite', interval: 'monthly' | 'annual') => {
    try {
      setCheckoutLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) {
        navigate(`/login?plan=${planId}&interval=${interval}`);
        return;
      }
      const priceId = BILLING_CONFIG.job_seeker[planId].priceIds[interval];
      if (!priceId) throw new Error('Missing Stripe price');
      const resp = await fetch(`${backendBase}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ planId, interval, priceId }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || 'Checkout failed');
      }
      const { url } = await resp.json();
      if (url) {
        window.location.href = url;
        return;
      }
      navigate('/billing');
    } catch (e: any) {
      console.error('checkout after signup failed', e);
      toast.error(e?.message || 'Unable to start checkout');
      navigate('/billing');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const updateAccountType = async (userId: string) => {
    try {
      await supabase
        .from('users')
        .update({ account_type: 'job_seeker' } as any)
        .eq('id', userId);
    } catch {
      // non-blocking
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    const { firstName, lastName, email, password, company, linkedin } = form;
    let userId: string | undefined;

    try {
      // 1) Backend-first signup (admin createUser)
      const backendRes = await fetch(`${backendBase}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          metadata: {
            company,
            linkedin_url: linkedin,
            account_type: 'job_seeker',
          },
        }),
      });

      if (backendRes.ok) {
        const data = await backendRes.json().catch(() => ({}));
        userId = data?.user?.id || userId;
      } else if (backendRes.status === 401 || backendRes.status === 403) {
        // 2) Fallback: client-side Supabase signUp
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              company,
              linkedin_url: linkedin,
              account_type: 'job_seeker',
            },
          },
        });
        if (error) throw error;
        userId = data?.user?.id || userId;
      } else {
        const errData = await backendRes.json().catch(() => ({}));
        throw new Error(errData?.error || `Signup failed (${backendRes.status})`);
      }

      // 3) Ensure session (sign in if needed)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
          const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) throw signInErr;
          if (!userId) userId = data?.user?.id;
        }
      } catch (signinErr) {
        console.warn('Sign-in after signup failed (non-blocking):', signinErr);
      }

      // 4) Provision user row with plan + account_type
      try {
        await fetch(`${backendBase}/api/createUser`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: userId,
            email,
            first_name: firstName,
            last_name: lastName,
            company,
            linkedin_url: linkedin,
            plan: 'free',
            account_type: 'job_seeker',
          }),
        });
      } catch (createErr: any) {
        console.warn('Job seeker createUser non-blocking error', createErr);
      }

      if (userId) await updateAccountType(userId);

      toast.success('Welcome to HirePilot for Job Seekers!');
      if (requestedPlan) {
        await startCheckout(requestedPlan, requestedInterval);
      } else {
        navigate(resolveRedirect(), { replace: true });
      }
    } catch (err: any) {
      setError(err?.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setOauthLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'https://jobs.thehirepilot.com/auth/callback' },
      });
    } finally {
      setOauthLoading(false);
    }
  };

  const handleMicrosoft = async () => {
    setOauthLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: { redirectTo: 'https://jobs.thehirepilot.com/auth/callback' },
      });
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-2xl bg-slate-900/70 border border-slate-800 rounded-2xl p-8 shadow-xl">
        <div className="mb-8 text-center space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Job Seeker</p>
          <h1 className="text-3xl font-semibold text-white">Create your Job Seeker account</h1>
          <p className="text-slate-400 text-sm">Build resumes, prep for interviews, and track applications.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={oauthLoading || checkoutLoading}
            className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 hover:bg-slate-750 transition"
          >
            <FaGoogle /> {(oauthLoading || checkoutLoading) ? 'Redirecting…' : 'Sign up with Google'}
          </button>
          <button
            type="button"
            onClick={handleMicrosoft}
            disabled={oauthLoading || checkoutLoading}
            className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 hover:bg-slate-750 transition"
          >
            <FaMicrosoft className="text-blue-400" /> {(oauthLoading || checkoutLoading) ? 'Redirecting…' : 'Sign up with Outlook/365'}
          </button>
        </div>

        <div className="flex items-center gap-3 text-slate-500 text-xs mb-6">
          <div className="flex-1 h-px bg-slate-800" />
          <span>Email</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">First name</label>
              <input
                required
                value={form.firstName}
                onChange={onChange('firstName')}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Alex"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Last name</label>
              <input
                required
                value={form.lastName}
                onChange={onChange('lastName')}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={onChange('email')}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={onChange('password')}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="At least 8 characters"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">LinkedIn URL (optional)</label>
              <input
                value={form.linkedin}
                onChange={onChange('linkedin')}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="https://www.linkedin.com/in/username"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Current company (optional)</label>
              <input
                value={form.company}
                onChange={onChange('company')}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Company"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create Job Seeker account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account? <a href="/login" className="text-indigo-300 hover:text-indigo-200">Sign in</a>
        </p>
      </div>
    </div>
  );
}
