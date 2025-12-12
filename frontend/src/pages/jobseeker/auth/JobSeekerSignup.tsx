import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { apiPost } from '../../../lib/api';
import { toast } from 'react-hot-toast';
import { FaGoogle, FaMicrosoft } from 'react-icons/fa6';

export default function JobSeekerSignup() {
  const navigate = useNavigate();
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

  const onChange = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const resolveRedirect = () => '/dashboard';

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
    setError('');
    setLoading(true);
    try {
      // Primary path: backend admin signup (sets email_confirm)
      await apiPost(
        '/api/auth/signup',
        {
          email: form.email,
          password: form.password,
          first_name: form.firstName,
          last_name: form.lastName,
          metadata: {
            company: form.company,
            linkedin_url: form.linkedin,
            account_type: 'job_seeker',
          },
        },
        { requireAuth: false }
      );
    } catch (primaryErr: any) {
      // Fallback: client-side Supabase signUp (avoids backend 401)
      const { error: signUpErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            first_name: form.firstName,
            last_name: form.lastName,
            company: form.company,
            linkedin_url: form.linkedin,
            account_type: 'job_seeker',
          },
        },
      });
      if (signUpErr) {
        setError(primaryErr?.message || signUpErr?.message || 'Signup failed.');
        return;
      }
    }

    // create profile row
    let userId: string | undefined;
    try {
      const { data: authUser } = await supabase.auth.getUser();
      userId = authUser?.user?.id;
    } catch {}

    // Ensure session (sign in if needed)
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (!userId) userId = data?.user?.id;
      if (signInErr) console.warn('Sign-in after signup failed (non-blocking):', signInErr);
    } catch {}

    // Provision user row with plan + account_type
    try {
      await apiPost(
        '/api/createUser',
        {
          id: userId,
          email: form.email,
          first_name: form.firstName,
          last_name: form.lastName,
          company: form.company,
          linkedin_url: form.linkedin,
          plan: 'free',
          account_type: 'job_seeker',
        },
        { requireAuth: false }
      );
    } catch (createErr: any) {
      console.warn('Job seeker createUser non-blocking error', createErr);
    }

    if (userId) await updateAccountType(userId);

    toast.success('Welcome to HirePilot for Job Seekers!');
    navigate(resolveRedirect(), { replace: true });
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
        options: { redirectTo: window.location.origin + resolveRedirect() },
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
        options: { redirectTo: window.location.origin + resolveRedirect() },
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
            disabled={oauthLoading}
            className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 hover:bg-slate-750 transition"
          >
            <FaGoogle /> {oauthLoading ? 'Redirecting…' : 'Sign up with Google'}
          </button>
          <button
            type="button"
            onClick={handleMicrosoft}
            disabled={oauthLoading}
            className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 hover:bg-slate-750 transition"
          >
            <FaMicrosoft className="text-blue-400" /> {oauthLoading ? 'Redirecting…' : 'Sign up with Outlook/365'}
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
