import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AcceptGuest() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const jobId = params.get('job_id') || '';
  const inviteEmail = params.get('email') || '';

  const [email, setEmail] = useState(inviteEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && jobId) {
        sessionStorage.setItem('guest_mode', '1');
        navigate(`/job/${jobId}`);
      }
    })();
  }, [jobId, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const base = (import.meta.env.VITE_BACKEND_URL || (window.location.host.endsWith('thehirepilot.com') ? 'https://api.thehirepilot.com' : 'http://localhost:8080')).replace(/\/$/, '');
      const cleanEmail = String(email || inviteEmail).trim().toLowerCase();
      const cleanPassword = String(password);
      // Ensure an Auth user exists (idempotent upsert) before sign-in
      const upsert = await fetch(`${base}/api/guest-upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
      });
      if (!upsert.ok) {
        let msg = 'Failed to prepare guest account';
        try { const j = await upsert.json(); msg = j.error || msg; } catch {}
        throw new Error(msg);
      }
      // Now sign in; if invalid, force-reset password via admin endpoint then retry
      let { error: signErr } = await supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword });
      if (signErr && String(signErr.message || '').toLowerCase().includes('invalid')) {
        await fetch(`${base}/api/admin/reset-guest-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, newPassword: cleanPassword })
        });
        const retry = await supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword });
        signErr = retry.error;
      }
      if (signErr) throw signErr;
      sessionStorage.setItem('guest_mode', '1');
      navigate(jobId ? `/job/${jobId}` : '/jobs');
    } catch (e) {
      setError(e?.message || 'Failed to complete invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white border rounded-lg p-6 w-full max-w-md">
        <h1 className="text-xl font-semibold mb-4">Accept Invite</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full border rounded px-3 py-2" autoComplete="email" required />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full border rounded px-3 py-2" autoComplete="new-password" required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={loading} className="w-full bg-purple-600 text-white rounded px-4 py-2 disabled:opacity-50">
            {loading ? 'Working…' : 'Create Account & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}