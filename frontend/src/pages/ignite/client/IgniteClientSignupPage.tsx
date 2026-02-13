import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiPost } from '../../../lib/api';

export default function IgniteClientSignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    clientId: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await apiPost(
        '/api/ignite/client-signup',
        {
          first_name: form.firstName,
          last_name: form.lastName,
          email: form.email,
          password: form.password,
          client_id: form.clientId || null,
        },
        { requireAuth: false }
      );
      navigate('/login', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Signup failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <img
            src="https://images.squarespace-cdn.com/content/v1/63e9b6d2e579fc1e26b444a1/b21b0d24-3b10-49a6-8df0-4d13b9ab3e3c/Scratchpad+2025.png?format=1500w"
            alt="Ignite logo"
            className="h-8 w-8 rounded-lg object-cover"
          />
          <span className="text-xl font-bold text-slate-900">Ignite Client Portal</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Client Signup</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create a basic username/password account for client access.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">First Name</label>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => onChange('firstName', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Last Name</label>
              <input
                type="text"
                required
                value={form.lastName}
                onChange={(e) => onChange('lastName', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => onChange('email', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              minLength={8}
              required
              value={form.password}
              onChange={(e) => onChange('password', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Client Org ID (optional)</label>
            <input
              type="text"
              value={form.clientId}
              onChange={(e) => onChange('clientId', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="UUID from Ignite admin"
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
            {busy ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
