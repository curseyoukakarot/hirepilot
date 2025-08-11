import React, { useEffect, useState } from 'react';
import AffiliateHeader from './AffiliateHeader';
import { supabase } from '../../lib/supabase';

export default function AffiliateSettings() {
  const [profile, setProfile] = useState({ referral_link: '', tier: '', joined_at: '' });
  const [connectId, setConnectId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const [linkRes, overviewRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/affiliates/link`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/affiliates/overview`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      ]);
      const linkData = linkRes.ok ? await linkRes.json() : {};
      const overview = overviewRes.ok ? await overviewRes.json() : {};
      setProfile({ referral_link: linkData.url || '', tier: overview?.tier || 'starter', joined_at: '' });
    })();
  }, []);

  const connectStripe = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/affiliates/connect/onboarding`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      window.location.href = data.url;
    }
  };

  const copyLink = async () => {
    if (!profile.referral_link) return;
    await navigator.clipboard.writeText(profile.referral_link);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <AffiliateHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payout Method</h2>
          <p className="text-sm text-gray-600 mb-3">Connect your Stripe account to receive payouts.</p>
          <button onClick={connectStripe} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Connect Stripe</button>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Referral Link</h2>
          <div className="flex items-center gap-2">
            <input value={profile.referral_link} readOnly className="flex-1 px-3 py-2 border rounded-lg bg-gray-50" />
            <button className="px-3 py-2 bg-gray-100 rounded-lg" onClick={copyLink}>Copy</button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Tier</div>
              <div className="font-medium text-gray-900 capitalize">{profile.tier}</div>
            </div>
            <div>
              <div className="text-gray-500">Joined</div>
              <div className="font-medium text-gray-900">{profile.joined_at || '—'}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


