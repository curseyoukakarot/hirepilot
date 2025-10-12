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
        // Fetch contacts and filter by client
        const r = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/contacts`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const contacts = r.ok ? await r.json() : [];
        const leads = (contacts || []).filter((c: any) => c.client_id === clientId).slice(0, 5);
        // Fetch activities for each lead
        const acts: any[] = [];
        for (const dm of leads) {
          const aRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/activities?entity_type=lead&entity_id=${dm.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (aRes.ok) {
            const js = await aRes.json();
            (js.activities || []).forEach((row: any) => acts.push({ ...row, _lead: dm }));
          }
        }
        acts.sort((a, b) => new Date(b.activity_timestamp || b.occurred_at || b.created_at).getTime() - new Date(a.activity_timestamp || a.occurred_at || a.created_at).getTime());
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
        <div key={`${a.id}-${a._lead?.id || ''}`} className="bg-white border rounded p-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="capitalize text-gray-900">{a.activity_type || a.type}</div>
              {a._lead?.name && <span className="text-xs text-gray-500">• {a._lead.name}</span>}
            </div>
            <div className="text-xs text-gray-400">{a.activity_timestamp || a.occurred_at ? new Date(a.activity_timestamp || a.occurred_at).toLocaleString() : ''}</div>
          </div>
          {(a.title || a.notes || a.body) && (
            <div className="text-gray-700">{a.title || a.notes || a.body}</div>
          )}
        </div>
      ))}
    </div>
  );
}


