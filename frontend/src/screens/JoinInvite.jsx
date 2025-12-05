import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { usePlan } from '../context/PlanContext';

const backendBase = (import.meta.env?.VITE_BACKEND_URL || '').replace(/\/$/, '');

export default function JoinInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = usePlan();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [fetchError, setFetchError] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });
  const [submitState, setSubmitState] = useState({ loading: false, error: '' });

  useEffect(() => {
    if (!token) {
      setFetchError('Invite token missing. Please use the link from your email.');
      setLoading(false);
      return;
    }
    const loadInvite = async () => {
      try {
        setLoading(true);
        const resp = await fetch(`${backendBase}/api/team/invite/${token}`, {
          method: 'GET',
          credentials: 'include',
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.message || 'Failed to load invite');
        }
        const data = await resp.json();
        setInvite(data);
        setForm(prev => ({
          ...prev,
          firstName: data.firstName || prev.firstName,
          lastName: data.lastName || prev.lastName,
        }));
        setFetchError('');
      } catch (err) {
        setFetchError(err?.message || 'Failed to load invite');
      } finally {
        setLoading(false);
      }
    };
    loadInvite();
  }, [token]);

  const handleChange = field => e => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!invite || invite.status !== 'pending' || invite.isExpired) return;
    if (form.password.length < 8) {
      setSubmitState({ loading: false, error: 'Password must be at least 8 characters.' });
      return;
    }
    if (form.password !== form.confirmPassword) {
      setSubmitState({ loading: false, error: 'Passwords do not match.' });
      return;
    }
    try {
      setSubmitState({ loading: true, error: '' });
      const resp = await fetch(`${backendBase}/api/team/invite/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to accept invite');
      }
      // Sign the user in automatically
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password: form.password,
      });
      if (signInError) {
        throw new Error(signInError.message || 'Invite accepted, but automatic sign-in failed. Please sign in manually.');
      }
      try {
        await refresh();
      } catch {}
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setSubmitState({ loading: false, error: err?.message || 'Failed to accept invite' });
    }
  };

  const disabled = !invite || invite.status !== 'pending' || invite.isExpired;

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0b0f17] via-[#0e1420] to-[#0b0f17]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center items-center space-x-2">
          <img src="/logo.png" className="w-10 h-10" alt="HirePilot" />
          <h1 className="text-3xl font-bold text-white">HirePilot</h1>
        </div>
        <h2 className="mt-6 text-2xl font-bold text-gray-100">Accept your invitation</h2>
        <p className="mt-2 text-sm text-gray-400">
          Join your team with the same paid access they selected for you.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-gray-900/80 border border-gray-800 px-8 py-10 shadow-2xl sm:rounded-2xl sm:px-10">
          {loading ? (
            <div className="text-center text-gray-300">Loading invite…</div>
          ) : fetchError ? (
            <div className="text-center text-red-300">{fetchError}</div>
          ) : (
            <>
              <div className="mb-6 text-sm text-gray-300 space-y-1">
                <p><span className="text-gray-400">Email:</span> {invite.email}</p>
                <p>
                  <span className="text-gray-400">Role:</span> {invite.role}
                </p>
                {invite.invitedBy?.email && (
                  <p>
                    <span className="text-gray-400">Invited by:</span>{' '}
                    {[invite.invitedBy.firstName, invite.invitedBy.lastName].filter(Boolean).join(' ') || invite.invitedBy.email}
                  </p>
                )}
                {invite.isExpired && (
                  <p className="text-red-300">This invitation has expired. Please contact your admin for a new link.</p>
                )}
                {invite.status !== 'pending' && invite.status !== 'expired' && (
                  <p className="text-amber-300">This invitation is already {invite.status}.</p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">First name</label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={handleChange('firstName')}
                      required
                      className="w-full px-4 py-2 border border-gray-700 rounded-lg bg-gray-800 text-gray-100 focus:ring-2 focus:ring-blue-400"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Last name</label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={handleChange('lastName')}
                      required
                      className="w-full px-4 py-2 border border-gray-700 rounded-lg bg-gray-800 text-gray-100 focus:ring-2 focus:ring-blue-400"
                      disabled={disabled}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Create password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={handleChange('password')}
                    required
                    minLength={8}
                    className="w-full px-4 py-2 border border-gray-700 rounded-lg bg-gray-800 text-gray-100 focus:ring-2 focus:ring-blue-400"
                    disabled={disabled}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Confirm password</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={handleChange('confirmPassword')}
                    required
                    minLength={8}
                    className="w-full px-4 py-2 border border-gray-700 rounded-lg bg-gray-800 text-gray-100 focus:ring-2 focus:ring-blue-400"
                    disabled={disabled}
                  />
                </div>
                {submitState.error && (
                  <div className="text-sm text-red-300">{submitState.error}</div>
                )}
                <button
                  type="submit"
                  disabled={disabled || submitState.loading}
                  className={`w-full flex justify-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm ${
                    disabled
                      ? 'bg-gray-700 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500'
                  }`}
                >
                  {submitState.loading ? 'Activating...' : 'Accept invitation'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

