import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiGet, apiDelete } from '../../lib/api';

type VendorPayout = {
  id: string;
  event_name: string;
  vendor_name: string;
  vendor_email: string;
  client_name: string | null;
  client_charged_cents: number;
  margin_cents: number;
  vendor_payout_cents: number;
  vendor_split_percent: number;
  status: string;
  email_sent_at: string | null;
  created_at: string;
};

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-amber-100 text-amber-700',
    accepted: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.draft}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function IgniteVendorPayoutsPage() {
  const navigate = useNavigate();
  const [payouts, setPayouts] = useState<VendorPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiGet('/api/ignite/vendor-payouts');
      setPayouts(Array.isArray(res?.vendor_payouts) ? res.vendor_payouts : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load vendor payouts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this vendor payout?')) return;
    try {
      await apiDelete(`/api/ignite/vendor-payouts/${id}`);
      setPayouts((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      window.alert(e?.message || 'Failed to delete');
    }
  };

  return (
    <div>
      <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Vendor Payouts</h1>
            <p className="mt-1 text-sm text-gray-600">Manage event cost breakdowns and vendor payment splits</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/ignite/vendor-payouts/new')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <i className="fa-solid fa-plus mr-2" />
            New Payout
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6">
        {loading && <p className="text-sm text-gray-500">Loading...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !payouts.length && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <i className="fa-solid fa-hand-holding-dollar mb-3 text-3xl text-gray-300" />
            <p className="text-sm text-gray-500">No vendor payouts yet. Create one to get started.</p>
          </div>
        )}
        {!loading && payouts.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3 text-right">Charged</th>
                  <th className="px-4 py-3 text-right">Margin</th>
                  <th className="px-4 py-3 text-right">Vendor Payout</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.event_name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.vendor_name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.client_name || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatDollars(p.client_charged_cents)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatDollars(p.margin_cents)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{formatDollars(p.vendor_payout_cents)}</td>
                    <td className="px-4 py-3 text-center">{statusBadge(p.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="text-gray-400 hover:text-red-500"
                        title="Delete"
                      >
                        <i className="fa-solid fa-trash text-xs" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
