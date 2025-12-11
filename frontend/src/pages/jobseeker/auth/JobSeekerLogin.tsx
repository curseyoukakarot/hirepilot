import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { FaGoogle, FaMicrosoft } from 'react-icons/fa6';

export default function JobSeekerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get('email');
    if (e) setEmail(e);
  }, []);

  const resolveRedirect = () => '/dashboard';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        // fallback to guest-upsert path (matches recruiter behavior)
        try {
          const base = (import.meta.env.VITE_BACKEND_URL || (window.location.host.endsWith('thehirepilot.com') ? 'https://api.thehirepilot.com' : 'http://localhost:8080')).replace(/\/$/, '');
          await fetch(`${base}/api/guest-upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include',
          });
          const retry = await supabase.auth.signInWithPassword({ email, password });
          if (retry.error) throw retry.error;
        } catch (fallbackErr: any) {
          throw fallbackErr;
        }
      }
      navigate(resolveRedirect(), { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in.');
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
      <div className="w-full max-w-md bg-slate-900/70 border border-slate-800 rounded-2xl p-8 shadow-xl">
        <div className="mb-8 text-center space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Job Seeker</p>
          <h1 className="text-3xl font-semibold text-white">Sign in to your Job Seeker workspace</h1>
          <p className="text-slate-400 text-sm">Access your dashboard, prep tools, and applications.</p>
        </div>

        <div className="space-y-3 mb-6">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={oauthLoading}
            className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 hover:bg-slate-750 transition"
          >
            <FaGoogle /> {oauthLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>
          <button
            type="button"
            onClick={handleMicrosoft}
            disabled={oauthLoading}
            className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 hover:bg-slate-750 transition"
          >
            <FaMicrosoft className="text-blue-400" /> {oauthLoading ? 'Redirecting…' : 'Continue with Outlook/365'}
          </button>
        </div>

        <div className="flex items-center gap-3 text-slate-500 text-xs mb-6">
          <div className="flex-1 h-px bg-slate-800" />
          <span>Email</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          New here? <a href="/signup" className="text-indigo-300 hover:text-indigo-200">Create a Job Seeker account</a>
        </p>
      </div>
    </div>
  );
}
