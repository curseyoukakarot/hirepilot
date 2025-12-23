import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SettingsGuest() {
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Be defensive: some environments may not have users.full_name yet (migration drift).
        const { data } = await supabase
          .from('users')
          .select('first_name,last_name,full_name,avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        const derived =
          data?.full_name
          || [data?.first_name, data?.last_name].filter(Boolean).join(' ')
          || user.user_metadata?.full_name
          || user.user_metadata?.name
          || '';
        setFullName(derived);
        setAvatarUrl(data?.avatar_url || '');
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('users').update({ full_name: fullName, avatar_url: avatarUrl }).eq('id', user.id);
      alert('Saved');
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-lg mx-auto bg-white border rounded p-6">
      <h1 className="text-xl font-semibold mb-4">Settings</h1>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Full name</label>
          <input className="w-full border rounded px-3 py-2" value={fullName} onChange={(e)=>setFullName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Avatar URL</label>
          <input className="w-full border rounded px-3 py-2" value={avatarUrl} onChange={(e)=>setAvatarUrl(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button disabled={saving} onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
          <a href="/signout" className="px-4 py-2 border rounded">Sign Out</a>
        </div>
      </div>
    </div>
  );
}
