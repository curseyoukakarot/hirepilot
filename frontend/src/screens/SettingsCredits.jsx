import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadStripe } from '@stripe/stripe-js';

export default function SettingsCredits() {
  const [status, setStatus] = useState({ total_credits: 0, used_credits: 0, remaining_credits: 0, last_updated: null });
  const [overview, setOverview] = useState({ nextInvoice: null, subscription: null });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [selectedLargePack, setSelectedLargePack] = useState('1000');

  const stripePromise = useMemo(() => {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    return key ? loadStripe(key) : null;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        const token = session.access_token;

        const [statusRes, overviewRes, historyRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/credits/status`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/billing/overview`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/billing/credits/history?limit=50`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (statusRes.ok) setStatus(await statusRes.json());
        if (overviewRes.ok) setOverview(await overviewRes.json());
        if (historyRes.ok) setHistory(await historyRes.json());

        // Realtime toast for credit updates
        const channel = supabase.channel('user_credits_changes')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_credits' }, (payload) => {
            setStatus((prev) => ({ ...prev, remaining_credits: payload.new.remaining_credits, total_credits: payload.new.total_credits, used_credits: payload.new.used_credits }));
            try { window?.toast?.success?.('Credits updated!'); } catch {}
          })
          .subscribe();

        return () => { supabase.removeChannel(channel); };
      } catch (e) {
        setError(e.message || 'Failed to load credits');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleBuyCredits = async (packageId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/credits/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ packageId })
      });
      if (!res.ok) throw new Error('Failed to start checkout');
      const { sessionId, livemode } = await res.json();
      // Ensure publishable key mode matches the Checkout Session mode, otherwise Stripe returns 401
      const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
      const keyIsLive = pk.startsWith('pk_live_');
      if (typeof livemode === 'boolean' && keyIsLive !== livemode) {
        throw new Error('Stripe configuration mismatch (publishable key mode vs. checkout session mode). Please update your environment keys.');
      }
      const stripe = await stripePromise;
      await stripe.redirectToCheckout({ sessionId });
    } catch (e) {
      setError(e.message || 'Checkout failed');
    }
  };

  if (loading) return <div className="p-6">Loading credits…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  const nextRenewal = overview?.nextInvoice || overview?.subscription?.currentPeriodEnd || null;
  const monthlyAllocation = overview?.subscription?.planDetails?.credits || 0;
  const rollover = Math.max(0, (status.total_credits - monthlyAllocation));

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow border p-4">
            <div className="text-sm text-gray-500">Current Credits</div>
            <div className="text-2xl font-semibold text-gray-900">{status.remaining_credits}</div>
          </div>
          <div className="bg-white rounded-2xl shadow border p-4">
            <div className="text-sm text-gray-500">Monthly Allocation</div>
            <div className="text-2xl font-semibold text-gray-900">{monthlyAllocation}</div>
          </div>
          <div className="bg-white rounded-2xl shadow border p-4">
            <div className="text-sm text-gray-500">Rollover Balance</div>
            <div className="text-2xl font-semibold text-gray-900">{rollover}</div>
          </div>
          <div className="bg-white rounded-2xl shadow border p-4">
            <div className="text-sm text-gray-500">Next Renewal</div>
            <div className="text-base text-gray-900">{nextRenewal ? new Date(nextRenewal).toLocaleDateString() : '—'}</div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl shadow border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xl font-semibold text-gray-900">Buy More Credits</div>
            <div className="flex gap-2">
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2" onClick={() => handleBuyCredits('light-boost')}>100 Credits – $25</button>
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2" onClick={() => handleBuyCredits('power-pack')}>300 Credits – $75</button>
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2" onClick={() => handleBuyCredits('growth-bundle')}>600 Credits – $150</button>
            </div>
          </div>
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <span>Checkout opens in Stripe. Credits are applied automatically on success.</span>
            <button className="text-indigo-600 underline" onClick={() => setShowMoreModal(true)}>Need More?</button>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl shadow border p-4">
          <div className="text-xl font-semibold text-gray-900 mb-3">Credit History</div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Balance</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-700">
                {history.map((h, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="py-2 pr-4">{new Date(h.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-4">{h.type}</td>
                    <td className="py-2 pr-4">{h.amount}</td>
                    <td className="py-2 pr-4">—</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td className="py-3 text-gray-500" colSpan={4}>No history yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showMoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg p-6">
            <div className="mb-2">
              <div className="text-xl font-semibold text-gray-900">Purchase Additional Credits</div>
              <div className="text-sm text-gray-600">Choose a larger credit package for high-volume sourcing and outreach.</div>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { id: '1000', label: '1000 Credits – $220' },
                { id: '2500', label: '2500 Credits – $500' },
                { id: '5000', label: '5000 Credits – $900' },
              ].map(opt => (
                <label key={opt.id} className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer">
                  <input type="radio" name="largePack" checked={selectedLargePack===opt.id} onChange={()=>setSelectedLargePack(opt.id)} />
                  <span className="text-gray-800">{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700">Selected: {selectedLargePack} Credits</div>
              <div className="flex gap-2">
                <button className="border border-gray-300 rounded-xl px-5 py-2" onClick={()=>setShowMoreModal(false)}>Cancel</button>
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2" onClick={() => handleBuyCredits(selectedLargePack)}>Confirm & Checkout</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

