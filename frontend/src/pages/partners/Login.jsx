import React, { useState } from 'react';
import { partnersSupabase } from '../../lib/partnersSupabase';
import { useNavigate } from 'react-router-dom';

export default function PartnersLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const signIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, error } = await partnersSupabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/partners/dashboard');
    } catch (e) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-xl font-semibold mb-1">Partners Login</h1>
        <p className="text-sm text-gray-600 mb-6">Sign in to your affiliate account</p>
        <form onSubmit={signIn} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input type="email" className="w-full px-3 py-2 border rounded-lg bg-gray-50" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Password</label>
            <input type="password" className="w-full px-3 py-2 border rounded-lg bg-gray-50" value={password} onChange={e=>setPassword(e.target.value)} required />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button disabled={loading} className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">{loading?'Signing in…':'Sign In'}</button>
        </form>
        <div className="text-xs text-gray-500 mt-4">This login is separate from your HirePilot app login.</div>
      </div>
    </div>
  );
}


