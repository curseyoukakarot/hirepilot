import React, { useEffect, useState } from 'react';
import AffiliateHeader from './AffiliateHeader';
import { partnersSupabase } from '../../lib/partnersSupabase';

export default function AffiliateSettings() {
  const [profile, setProfile] = useState({ referral_link: '', tier: 'starter', joined_at: '' });
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [connectId, setConnectId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session, user } } = await partnersSupabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const [linkRes, overviewRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/affiliates/link`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/affiliates/overview`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      ]);
      const linkData = linkRes.ok ? await linkRes.json() : {};
      const overview = overviewRes.ok ? await overviewRes.json() : {};
      const marketingBase = import.meta.env.VITE_MARKETING_BASE_URL || 'https://thehirepilot.com';
      const code = linkData.code || linkData.referral_code || '';
      const built = code ? `${marketingBase}/?ref=${code}` : '';
      setProfile({ referral_link: built, tier: overview?.tier || 'starter', joined_at: '' });
      setAvatarUrl(user?.user_metadata?.avatar_url || '');
    })();
  }, []);

  const connectStripe = async () => {
    const { data: { session } } = await partnersSupabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/stripe/oauth/init`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include'
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

  const onUploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const ext = file.name.split('.').pop();
      const fileName = `avatars/${Date.now()}.${ext}`;
      const { data, error } = await partnersSupabase.storage.from('public').upload(fileName, file, { upsert: true, cacheControl: '3600' });
      if (error) throw error;
      const publicUrl = partnersSupabase.storage.from('public').getPublicUrl(fileName).data.publicUrl;
      setAvatarUrl(publicUrl);
      // persist to user metadata so dashboard sees it
      const { data: userData } = await partnersSupabase.auth.getUser();
      if (userData?.user) {
        await partnersSupabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <AffiliateHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Photo</h2>
          <div className="flex items-center gap-4">
            <img src={avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent('P')}
                 alt="Avatar"
                 className="h-16 w-16 rounded-full object-cover border"/>
            <label className="px-3 py-2 bg-gray-100 rounded-lg cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={onUploadAvatar} disabled={uploading} />
              {uploading ? 'Uploading…' : 'Upload new'}
            </label>
          </div>
        </div>

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


