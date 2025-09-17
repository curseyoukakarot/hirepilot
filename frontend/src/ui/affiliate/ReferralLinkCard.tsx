import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export function ReferralLinkCard() {
  const [link, setLink] = useState<string>('');
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const r = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/affiliates/link`, { 
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include' 
      });
      if (r.ok) {
        const { url } = await r.json();
        setLink(url);
      }
    })();
  }, []);
  return (
    <div className="card p-5 flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold">Your Referral Link</h3>
        <p className="text-sm text-gray-500 break-all">{link}</p>
      </div>
      <button className="btn" onClick={() => navigator.clipboard.writeText(link)}>Copy</button>
    </div>
  );
}


