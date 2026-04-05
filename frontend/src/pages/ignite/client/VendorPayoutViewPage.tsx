import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet } from '../../../lib/api';

type VendorPayoutData = {
  event_name: string;
  event_date: string | null;
  client_name: string | null;
  vendor_name: string;
  vendor_company: string | null;
  client_charged_cents: number;
  cost_items_json: Array<{ label: string; amount_cents: number }>;
  total_costs_cents: number;
  margin_cents: number;
  vendor_split_percent: number;
  ignite_split_percent: number;
  vendor_payout_cents: number;
  ignite_payout_cents: number;
  notes: string | null;
  status: string;
};

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function VendorPayoutViewPage() {
  const { token = '' } = useParams();
  const [payout, setPayout] = useState<VendorPayoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiGet(`/api/ignite/vendor-payout/${token}`, { requireAuth: false });
        if (!mounted) return;
        setPayout(res?.vendor_payout || null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load payout statement');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-sm text-slate-400">Loading payout statement...</div>
      </div>
    );
  }

  if (error || !payout) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <div className="max-w-md rounded-xl border border-red-300/30 bg-red-500/10 p-6 text-center text-sm text-red-200">
          {error || 'Payout statement not found or has expired.'}
        </div>
      </div>
    );
  }

  const costItems = Array.isArray(payout.cost_items_json) ? payout.cost_items_json : [];

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2">
            <img
              src="https://images.squarespace-cdn.com/content/v1/63e9b6d2e579fc1e26b444a1/b21b0d24-3b10-49a6-8df0-4d13b9ab3e3c/Scratchpad+2025.png?format=1500w"
              alt="Ignite logo"
              className="h-8 w-8 rounded-lg object-cover"
            />
            <span className="text-lg font-bold text-white">IgniteGTM</span>
          </div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Vendor Payout Statement</h1>
          <p className="mt-2 text-sm text-slate-400">
            Prepared for <span className="font-medium text-slate-200">{payout.vendor_name}</span>
            {payout.vendor_company && (
              <span className="text-slate-500"> at {payout.vendor_company}</span>
            )}
          </p>
        </div>

        {/* Event info */}
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Event Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Event</p>
              <p className="font-medium text-white">{payout.event_name}</p>
            </div>
            {payout.client_name && (
              <div>
                <p className="text-slate-500">Client</p>
                <p className="font-medium text-white">{payout.client_name}</p>
              </div>
            )}
            {payout.event_date && (
              <div>
                <p className="text-slate-500">Date</p>
                <p className="font-medium text-white">{formatDate(payout.event_date)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Financial breakdown */}
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Financial Breakdown</h2>

          {/* Client charged */}
          <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-4">
            <span className="text-sm text-slate-400">Amount Charged to Client</span>
            <span className="text-lg font-semibold text-white">{formatDollars(payout.client_charged_cents)}</span>
          </div>

          {/* Cost items */}
          <div className="mb-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Event Costs</p>
            <div className="space-y-2">
              {costItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-4 py-2.5">
                  <span className="text-sm text-slate-300">{item.label}</span>
                  <span className="text-sm font-medium text-slate-200">{formatDollars(item.amount_cents)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
              <span className="text-sm font-medium text-slate-400">Total Costs</span>
              <span className="text-sm font-semibold text-white">{formatDollars(payout.total_costs_cents)}</span>
            </div>
          </div>

          {/* Margin */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <span className="text-sm font-medium text-slate-400">Event Margin</span>
            <span className={`text-lg font-bold ${payout.margin_cents >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatDollars(payout.margin_cents)}
            </span>
          </div>
        </div>

        {/* Split */}
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Agreed Split ({payout.vendor_split_percent}% / {payout.ignite_split_percent}%)
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
                {payout.vendor_name} ({payout.vendor_split_percent}%)
              </p>
              <p className="mt-2 text-3xl font-bold text-emerald-400">{formatDollars(payout.vendor_payout_cents)}</p>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-400/80">
                IgniteGTM ({payout.ignite_split_percent}%)
              </p>
              <p className="mt-2 text-3xl font-bold text-blue-400">{formatDollars(payout.ignite_payout_cents)}</p>
            </div>
          </div>
        </div>

        {/* Total payment owed */}
        <div className="mb-6 overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)' }}>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-white/70">Total Payment Owed to You</p>
            <p className="mt-2 text-4xl font-bold text-white sm:text-5xl">{formatDollars(payout.vendor_payout_cents)}</p>
            <p className="mt-2 text-sm text-white/60">
              Based on {payout.vendor_split_percent}% of {formatDollars(payout.margin_cents)} margin
            </p>
          </div>
        </div>

        {/* Notes */}
        {payout.notes && (
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Notes</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{payout.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-slate-600">
            This payout statement was generated by IgniteGTM. For questions, contact{' '}
            <a href="mailto:events@ignitegtm.com" className="text-blue-500 hover:text-blue-400">
              events@ignitegtm.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
