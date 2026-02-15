import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';

function normalizeRole(value: any): string {
  return String(value || '').toLowerCase().replace(/[\s-]+/g, '_');
}

export default function IgniteClientLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { error: signInError, data } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const meta = data?.user?.user_metadata || {};
      const appMeta = data?.user?.app_metadata || {};
      const role = normalizeRole(meta.account_type || meta.role || appMeta.role);
      if (role === 'ignite_client') navigate('/ignite/client', { replace: true });
      else navigate('/ignite/proposals', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-2">
          <img
            src="https://images.squarespace-cdn.com/content/v1/63e9b6d2e579fc1e26b444a1/b21b0d24-3b10-49a6-8df0-4d13b9ab3e3c/Scratchpad+2025.png?format=1500w"
            alt="Ignite logo"
            className="h-8 w-8 rounded-lg object-cover"
          />
          <span className="text-xl font-bold text-slate-900">Ignite Client Portal</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Client Login</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to view your proposals and exports.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Need access?{' '}
          <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-700">
            Create client account
          </Link>
        </p>
      </div>
    </div>
  );
}
