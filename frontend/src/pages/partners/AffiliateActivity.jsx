import React, { useEffect, useMemo, useState } from 'react';
import AffiliateHeader from './AffiliateHeader';
import { partnersSupabase } from '../../lib/partnersSupabase';

export default function AffiliateActivity() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true; let t;
    (async () => {
      const { data: { session } } = await partnersSupabase.auth.getSession();
      const token = session?.access_token; if (!token) return;
      const fetchRows = async () => {
        setLoading(true);
        const r = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/affiliates/referrals`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
        if (mounted && r.ok) setRows(await r.json());
        if (mounted) setLoading(false);
      };
      await fetchRows(); t = window.setInterval(fetchRows, 15000);
    })();
    return () => { mounted = false; if (t) window.clearInterval(t); };
  }, []);

  const filtered = useMemo(() => rows.filter(r => {
    const matchQ = !q || [r.lead_email, r.stripe_customer_id, r.plan_type, r.status].join(' ').toLowerCase().includes(q.toLowerCase());
    const matchS = status === 'all' || r.status === status;
    return matchQ && matchS;
  }), [rows, q, status]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <AffiliateHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl p-4 border border-gray-200 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search referrals…" className="px-3 py-2 border rounded-lg bg-gray-50 w-72" />
            <select value={status} onChange={e=>setStatus(e.target.value)} className="px-3 py-2 border rounded-lg bg-gray-50">
              <option value="all">All statuses</option>
              <option value="lead">Lead</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {loading && <span className="text-xs text-gray-500 ml-2">Refreshing…</span>}
          </div>
          <div className="text-sm text-gray-600">{filtered.length} results</div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2">Email / Customer</th>
                  <th className="py-2">Plan</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Attributed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="py-3">
                      <div className="font-medium text-gray-900">{r.lead_email || r.stripe_customer_id}</div>
                      <div className="text-xs text-gray-500">{r.stripe_customer_id || '—'}</div>
                    </td>
                    <td className="py-3 capitalize">{r.plan_type || '—'}</td>
                    <td className="py-3 capitalize">{r.status}</td>
                    <td className="py-3">{new Date(r.first_attributed_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-500">No activity yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}


