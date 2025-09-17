import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canReset, setCanReset] = useState(false);

  useEffect(() => {
    let active = true;
    // Only allow reset if there's a recovery session (from the magic link)
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      // Supabase sets a session on recovery links as well, so allow the form when a session exists
      setCanReset(!!data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') {
        setCanReset(true);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (updateError) {
      setError(updateError.message || 'Failed to update password.');
      return;
    }
    setSuccess(true);
    setTimeout(() => navigate('/login'), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #f0f7ff 100%)' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <img src="/logo.png" className="w-8 h-8" alt="HirePilot" />
          <h1 className="text-2xl font-bold text-gray-900">HirePilot</h1>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Set a new password</h2>
        <p className="text-sm text-gray-600 mt-1">Choose a strong password you don't use elsewhere.</p>

        {!canReset ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
              This reset link is invalid or has expired. Request a new password reset from the login page.
            </div>
            <div className="text-center">
              <button type="button" className="text-sm text-gray-600 hover:text-gray-800 underline" onClick={() => navigate('/login')}>Back to login</button>
            </div>
          </div>
        ) : (
        <form className="mt-6 space-y-4" onSubmit={handleUpdatePassword}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition text-sm bg-gray-50"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="confirm-password">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition text-sm bg-gray-50"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">Password updated. Redirecting…</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
          <div className="text-center">
            <button type="button" className="text-sm text-gray-600 hover:text-gray-800 underline" onClick={() => navigate('/login')}>Back to login</button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}


