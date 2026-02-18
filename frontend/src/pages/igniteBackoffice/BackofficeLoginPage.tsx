import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

function normalizeRole(value: any): string {
  return String(value || '').toLowerCase().replace(/[\s-]+/g, '_');
}

const ALLOWED_BACKOFFICE_ROLES = new Set(['ignite_backoffice', 'ignite_admin', 'ignite_team']);

export default function BackofficeLoginPage() {
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
      if (!ALLOWED_BACKOFFICE_ROLES.has(role)) {
        await supabase.auth.signOut();
        throw new Error('Your account does not have Ignite Backoffice access.');
      }

      navigate('/ignite/backoffice', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-2">
          <img
            src="https://images.squarespace-cdn.com/content/v1/63e9b6d2e579fc1e26b444a1/b21b0d24-3b10-49a6-8df0-4d13b9ab3e3c/Scratchpad+2025.png?format=1500w"
            alt="Ignite logo"
            className="h-8 w-8 rounded-lg object-cover"
          />
          <span className="text-xl font-bold text-white">Ignite Backoffice</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Login</h1>
        <p className="mt-1 text-sm text-slate-400">Sign in to access cashflow operations.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </div>
          {error && <div className="rounded-lg border border-rose-900 bg-rose-950 px-3 py-2 text-sm text-rose-300">{error}</div>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
