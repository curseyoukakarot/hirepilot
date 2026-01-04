import React, { useEffect, useMemo, useState } from 'react';
import AffiliateHeader from './AffiliateHeader';
import { partnersSupabase } from '../../lib/partnersSupabase';

const Badge = ({ children, color = 'gray' }) => (
  <span className={`px-2 py-1 text-xs rounded-full bg-${color}-100 text-${color}-700`}>{children}</span>
);

export default function AffiliatePayouts() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    let mounted = true;
    let timer;
    (async () => {
      try {
        const { data: { session } } = await partnersSupabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const fetchAll = async () => {
          setLoading(true);
          try {
            const [payoutsRes, overviewRes] = await Promise.all([
              fetch(`${import.meta.env.VITE_BACKEND_URL}/api/affiliates/payouts`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }),
              fetch(`${import.meta.env.VITE_BACKEND_URL}/api/affiliates/overview`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
            ]);
            if (!mounted) return;
            if (payoutsRes.ok) setRows(await payoutsRes.json());
            if (overviewRes.ok) setOverview(await overviewRes.json());
          } finally {
            if (mounted) setLoading(false);
          }
        };
        await fetchAll();
        timer = window.setInterval(fetchAll, 20000);
      } catch (e) {
        setError(e.message || 'Failed to load payouts');
      }
    })();
    return () => { mounted = false; if (timer) window.clearInterval(timer); };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter(r => r.status === filter);
  }, [rows, filter]);

  const money = (c) => `$${(c / 100).toFixed(2)}`;

  const Signpost = ({ title, value, icon, sub }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">{title}</div>
        <i className={`fa-solid ${icon} text-blue-500`} />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );

  const requestConnect = async () => {
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

  return (
    <div className="bg-gray-50 min-h-screen">
      <AffiliateHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top summary */}
        <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Signpost title="Lifetime Paid" value={money((rows||[]).filter(r=>r.status==='paid').reduce((s,r)=>s+r.total_cents,0))} icon="fa-sack-dollar" />
            <Signpost title="Pending Payouts" value={money((rows||[]).filter(r=>r.status!=='paid').reduce((s,r)=>s+r.total_cents,0))} icon="fa-hourglass-half" />
            <Signpost title="Next Payout (est.)" value={money(overview?.next_payout_cents||0)} icon="fa-calendar-check" />
          </div>
        </section>

        {/* Connect Stripe */}
        <section className="mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">Set up Stripe Connect to receive your payouts.</div>
            <button onClick={requestConnect} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Connect Stripe</button>
          </div>
        </section>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4">
          {[{k:'all',l:'All'},{k:'paid',l:'Paid'},{k:'pending',l:'Pending'},{k:'failed',l:'Failed'}].map(t=>
            <button key={t.k} onClick={()=>setFilter(t.k)} className={`px-3 py-1 rounded-md text-sm ${filter===t.k?'bg-blue-500 text-white':'bg-gray-100 text-gray-700'}`}>{t.l}</button>
          )}
          {loading && <span className="text-xs text-gray-500 ml-2">Refreshing…</span>}
          {error && <span className="text-xs text-red-600 ml-2">{error}</span>}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2">Date</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Method</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Transfer</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-t">
                    <td className="py-3">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="py-3 font-medium">{money(p.total_cents)}</td>
                    <td className="py-3">{p.method}</td>
                    <td className="py-3">{p.status==='paid'?<Badge color="emerald">Paid</Badge>:p.status==='pending'?<Badge color="amber">Pending</Badge>:<Badge color="red">{p.status}</Badge>}</td>
                    <td className="py-3">{p.transfer_id ? <code className="bg-gray-100 px-2 py-1 rounded">{p.transfer_id}</code> : '-'}</td>
                    <td className="py-3 text-right">
                      {p.transfer_id && (
                        <button className="text-blue-500 text-sm" onClick={()=>navigator.clipboard.writeText(p.transfer_id)}>Copy ID</button>
                      )}
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-500">No payouts yet</td>
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


