import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../../lib/api';

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
  share_token: string;
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

function ActionMenu({
  payout,
  onSendEmail,
  onCopyLink,
  onDelete,
  onView,
}: {
  payout: VendorPayout;
  onSendEmail: (id: string) => void;
  onCopyLink: (token: string) => void;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((prev) => !prev); }}
        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      >
        <i className="fa-solid fa-ellipsis-vertical" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onView(payout.id); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <i className="fa-solid fa-eye w-4 text-center text-gray-400" />
            View / Edit
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onSendEmail(payout.id); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <i className="fa-solid fa-paper-plane w-4 text-center text-gray-400" />
            {payout.status === 'draft' ? 'Send Email' : 'Resend Email'}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onCopyLink(payout.share_token); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <i className="fa-solid fa-link w-4 text-center text-gray-400" />
            Copy Public Link
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(payout.id); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <i className="fa-solid fa-trash w-4 text-center" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function IgniteVendorPayoutsPage() {
  const navigate = useNavigate();
  const [payouts, setPayouts] = useState<VendorPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

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

  const showMsg = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this vendor payout?')) return;
    try {
      await apiDelete(`/api/ignite/vendor-payouts/${id}`);
      setPayouts((prev) => prev.filter((p) => p.id !== id));
      showMsg('Payout deleted');
    } catch (e: any) {
      window.alert(e?.message || 'Failed to delete');
    }
  };

  const handleSendEmail = async (id: string) => {
    try {
      await apiPost(`/api/ignite/vendor-payouts/${id}/send-email`, {});
      showMsg('Email sent successfully!');
      void load();
    } catch (e: any) {
      window.alert(e?.message || 'Failed to send email');
    }
  };

  const handleCopyLink = (token: string) => {
    const host = window.location.hostname.includes('localhost')
      ? `http://${window.location.host}`
      : 'https://clients.ignitegtm.com';
    const url = `${host}/vendor-payout/${token}`;
    navigator.clipboard.writeText(url).then(() => showMsg('Public link copied!')).catch(() => {
      window.prompt('Copy this link:', url);
    });
  };

  const handleView = (id: string) => {
    navigate(`/ignite/vendor-payouts/${id}`);
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

      {actionMsg && (
        <div className="mx-4 mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 sm:mx-6">
          <i className="fa-solid fa-check-circle mr-2" />
          {actionMsg}
        </div>
      )}

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
          <div className="rounded-xl border border-gray-200 bg-white" style={{ overflow: 'visible' }}>
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
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => handleView(p.id)}
                    className="cursor-pointer border-b border-gray-100 hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-blue-600 hover:text-blue-700">{p.event_name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.vendor_name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.client_name || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatDollars(p.client_charged_cents)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatDollars(p.margin_cents)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{formatDollars(p.vendor_payout_cents)}</td>
                    <td className="px-4 py-3 text-center">{statusBadge(p.status)}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <ActionMenu
                        payout={p}
                        onView={handleView}
                        onSendEmail={handleSendEmail}
                        onCopyLink={handleCopyLink}
                        onDelete={handleDelete}
                      />
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
