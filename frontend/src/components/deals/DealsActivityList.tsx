import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface DealsActivityListProps {
  entityType: 'client' | 'decision_maker' | 'opportunity';
  entityId: string;
  refreshToken?: number;
}

export default function DealsActivityList({ entityType, entityId, refreshToken }: DealsActivityListProps) {
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
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/deals/activity?entityType=${entityType}&entityId=${entityId}&_=${Date.now()}`, {
          headers: token ? { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-store' } : { 'Cache-Control': 'no-store' },
          cache: 'no-store'
        });
        if (!res.ok) throw new Error('failed');
        const js = await res.json();
        if (!cancelled) setRows(js.rows || []);
      } catch (e) {
        if (!cancelled) setError('Failed to load activity');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entityType, entityId, refreshToken]);

  if (loading) return <div className="text-sm text-gray-500">Loading activity…</div>;
  if (error) return <div className="text-sm text-red-500">{error}</div>;

  if (!rows.length) return <div className="text-sm text-gray-500">No activity yet</div>;

  return (
    <div className="space-y-2">
      {rows.map((a: any) => (
        <div key={a.id} className="bg-white border rounded p-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="capitalize text-gray-900">{a.type}</div>
            <div className="text-xs text-gray-400">{a.occurred_at ? new Date(a.occurred_at).toLocaleString() : ''}</div>
          </div>
          {(a.title || a.body) && (
            <div className="text-gray-700">{a.title || a.body}</div>
          )}
        </div>
      ))}
    </div>
  );
}


