import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface Props {
  clientId: string;
  refreshToken?: number;
}

export default function ClientActivities({ clientId, refreshToken }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/deals/activity?entityType=client&entityId=${clientId}&includeLinked=true`, {
          headers: token ? { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-store' } : { 'Cache-Control': 'no-store' },
          cache: 'no-store'
        });
        if (!res.ok) throw new Error('failed');
        const js = await res.json();
        const acts = (js.rows || []).slice().sort((a: any, b: any) => new Date(b.occurred_at || b.activity_timestamp || b.created_at).getTime() - new Date(a.occurred_at || a.activity_timestamp || a.created_at).getTime());
        if (!cancelled) setRows(acts);
      } catch (e) {
        if (!cancelled) setError('Failed to load activity');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [clientId, refreshToken]);

  if (loading) return <div className="text-sm text-gray-500">Loading activity…</div>;
  if (error) return <div className="text-sm text-red-500">{error}</div>;
  if (!rows.length) return <div className="text-sm text-gray-500">No activity yet</div>;

  return (
    <div className="space-y-2">
      {rows.map((a: any) => (
        <div key={a.id} className="bg-white border rounded p-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="capitalize text-gray-900">{a.type || a.activity_type}</div>
            <div className="text-xs text-gray-400">{a.occurred_at || a.activity_timestamp ? new Date(a.occurred_at || a.activity_timestamp).toLocaleString() : ''}</div>
          </div>
          {(a.title || a.body || a.notes) && (
            <div className="text-gray-700">{a.title || a.body || a.notes}</div>
          )}
        </div>
      ))}
    </div>
  );
}


