import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AcceptGuest() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const jobId = params.get('job_id') || '';
  const email = params.get('email') || '';

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        sessionStorage.setItem('guest_mode','1');
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
      // Create or upsert confirmed user via backend to avoid email confirmation
      await fetch(`${base}/api/guest-signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
      });
      // Sign in
      await supabase.auth.signInWithPassword({ email, password });
      sessionStorage.setItem('guest_mode','1');
      navigate(`/job/${jobId}`);
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('already registered')) {
        navigate(`/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent('/job/'+jobId)}`);
        return;
      }
      setError(e.message || 'Failed to create guest account');
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
            <input value={email} readOnly className="w-full border rounded px-3 py-2 bg-gray-50" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full border rounded px-3 py-2" required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={loading} className="w-full bg-purple-600 text-white rounded px-4 py-2 disabled:opacity-50">
            {loading ? 'Creating…' : 'Create Guest Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
