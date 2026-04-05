import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPatch, apiPost, apiDelete } from '../../lib/api';

type CostItem = { label: string; amount_cents: number };

type VendorPayoutFull = {
  id: string;
  event_name: string;
  event_date: string | null;
  client_name: string | null;
  client_id: string | null;
  vendor_name: string;
  vendor_email: string;
  vendor_company: string | null;
  client_charged_cents: number;
  cost_items_json: CostItem[];
  total_costs_cents: number;
  margin_cents: number;
  vendor_split_percent: number;
  ignite_split_percent: number;
  vendor_payout_cents: number;
  ignite_payout_cents: number;
  notes: string | null;
  share_token: string;
  status: string;
  email_sent_at: string | null;
  created_at: string;
};

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-amber-100 text-amber-700',
    accepted: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${styles[status] || styles.draft}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function toCents(dollars: string): number {
  const n = parseFloat(dollars);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export default function IgniteVendorPayoutDetailPage() {
  const { payoutId = '' } = useParams();
  const navigate = useNavigate();
  const [payout, setPayout] = useState<VendorPayoutFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Editable fields
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [clientName, setClientName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorCompany, setVendorCompany] = useState('');
  const [clientChargedDollars, setClientChargedDollars] = useState('');
  const [costItems, setCostItems] = useState<Array<CostItem & { _id: string }>>([]);
  const [vendorSplitPercent, setVendorSplitPercent] = useState('');
  const [notes, setNotes] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiGet(`/api/ignite/vendor-payouts/${payoutId}`);
      const p = res?.vendor_payout as VendorPayoutFull;
      if (!p) throw new Error('Not found');
      setPayout(p);
      hydrateForm(p);
    } catch (e: any) {
      setError(e?.message || 'Failed to load payout');
    } finally {
      setLoading(false);
    }
  };

  const hydrateForm = (p: VendorPayoutFull) => {
    setEventName(p.event_name || '');
    setEventDate(p.event_date || '');
    setClientName(p.client_name || '');
    setVendorName(p.vendor_name || '');
    setVendorEmail(p.vendor_email || '');
    setVendorCompany(p.vendor_company || '');
    setClientChargedDollars((p.client_charged_cents / 100).toString());
    setCostItems(
      (Array.isArray(p.cost_items_json) ? p.cost_items_json : []).map((item, i) => ({
        ...item,
        _id: `${i}_${Date.now()}`,
      }))
    );
    setVendorSplitPercent(String(p.vendor_split_percent));
    setNotes(p.notes || '');
  };

  useEffect(() => { void load(); }, [payoutId]);

  const showMsg = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 3000);
  };

  // Computed values for edit mode
  const clientChargedCents = toCents(clientChargedDollars);
  const totalCostsCents = costItems.reduce((s, i) => s + (i.amount_cents || 0), 0);
  const marginCents = clientChargedCents - totalCostsCents;
  const splitPct = Math.min(100, Math.max(0, parseFloat(vendorSplitPercent) || 0));
  const igniteSplitPct = Math.max(0, 100 - splitPct);
  const vendorPayoutCents = Math.round((marginCents * splitPct) / 100);
  const ignitePayoutCents = marginCents - vendorPayoutCents;

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await apiPatch(`/api/ignite/vendor-payouts/${payoutId}`, {
        event_name: eventName,
        event_date: eventDate || null,
        client_name: clientName || null,
        vendor_name: vendorName,
        vendor_email: vendorEmail,
        vendor_company: vendorCompany || null,
        client_charged_cents: clientChargedCents,
        cost_items: costItems.map((i) => ({ label: i.label, amount_cents: i.amount_cents })),
        vendor_split_percent: splitPct,
        notes: notes || null,
      });
      setEditing(false);
      showMsg('Payout updated!');
      void load();
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSendEmail = async () => {
    try {
      setSaving(true);
      await apiPost(`/api/ignite/vendor-payouts/${payoutId}/send-email`, {});
      showMsg('Email sent successfully!');
      void load();
    } catch (e: any) {
      window.alert(e?.message || 'Failed to send email');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!payout) return;
    const host = window.location.hostname.includes('localhost')
      ? `http://${window.location.host}`
      : 'https://clients.ignitegtm.com';
    const url = `${host}/vendor-payout/${payout.share_token}`;
    navigator.clipboard.writeText(url).then(() => showMsg('Public link copied!')).catch(() => {
      window.prompt('Copy this link:', url);
    });
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this vendor payout permanently?')) return;
    try {
      await apiDelete(`/api/ignite/vendor-payouts/${payoutId}`);
      navigate('/ignite/vendor-payouts');
    } catch (e: any) {
      window.alert(e?.message || 'Failed to delete');
    }
  };

  const addCostItem = () =>
    setCostItems((prev) => [...prev, { label: '', amount_cents: 0, _id: `new_${Date.now()}` }]);
  const removeCostItem = (id: string) =>
    setCostItems((prev) => prev.filter((i) => i._id !== id));
  const updateCostItem = (id: string, field: 'label' | 'amount_cents', value: any) =>
    setCostItems((prev) =>
      prev.map((item) =>
        item._id === id
          ? { ...item, [field]: field === 'amount_cents' ? toCents(String(value)) : value }
          : item
      )
    );

  if (loading) {
    return (
      <div className="p-8 text-sm text-gray-500">Loading...</div>
    );
  }
  if (error && !payout) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600">{error}</p>
        <button type="button" onClick={() => navigate('/ignite/vendor-payouts')} className="mt-4 text-sm text-blue-600 hover:underline">
          Back to Vendor Payouts
        </button>
      </div>
    );
  }
  if (!payout) return null;

  const p = payout;

  return (
    <div>
      <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/ignite/vendor-payouts')}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <i className="fa-solid fa-arrow-left" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{p.event_name}</h1>
              <p className="mt-0.5 text-sm text-gray-500">
                {p.vendor_name} &middot; {statusBadge(p.status)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <i className="fa-solid fa-pen mr-2" />
                Edit
              </button>
            )}
            {editing && (
              <>
                <button
                  type="button"
                  onClick={() => { setEditing(false); hydrateForm(p); }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <i className="fa-solid fa-save mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
            {!editing && (
              <>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  <i className="fa-solid fa-link mr-2" />
                  Copy Link
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSendEmail}
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
                >
                  <i className="fa-solid fa-paper-plane mr-2" />
                  {p.status === 'draft' ? 'Send Email' : 'Resend Email'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {actionMsg && (
        <div className="mx-4 mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 sm:mx-6">
          <i className="fa-solid fa-check-circle mr-2" />
          {actionMsg}
        </div>
      )}
      {error && (
        <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 sm:mx-6">
          {error}
        </div>
      )}

      <div className="p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Event & Vendor info */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Event & Vendor</h2>
            {!editing ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div><p className="font-medium text-gray-500">Event</p><p className="text-gray-900">{p.event_name}</p></div>
                <div><p className="font-medium text-gray-500">Client</p><p className="text-gray-900">{p.client_name || '—'}</p></div>
                {p.event_date && <div><p className="font-medium text-gray-500">Date</p><p className="text-gray-900">{formatDate(p.event_date)}</p></div>}
                <div><p className="font-medium text-gray-500">Vendor</p><p className="text-gray-900">{p.vendor_name}</p></div>
                <div><p className="font-medium text-gray-500">Vendor Email</p><p className="text-gray-900">{p.vendor_email}</p></div>
                {p.vendor_company && <div><p className="font-medium text-gray-500">Company</p><p className="text-gray-900">{p.vendor_company}</p></div>}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Event Name</label>
                  <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Client Name</label>
                  <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Event Date</label>
                  <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Vendor Name</label>
                  <input type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Vendor Email</label>
                  <input type="email" value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Vendor Company</label>
                  <input type="text" value={vendorCompany} onChange={(e) => setVendorCompany(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
            )}
          </div>

          {/* Financial breakdown */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Financial Breakdown</h2>

            {!editing ? (
              <>
                <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-4">
                  <span className="text-sm text-gray-600">Client Charged</span>
                  <span className="text-lg font-semibold text-gray-900">{formatDollars(p.client_charged_cents)}</span>
                </div>
                <div className="mb-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Event Costs</p>
                  {(Array.isArray(p.cost_items_json) ? p.cost_items_json : []).map((item, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2 mb-1.5">
                      <span className="text-sm text-gray-700">{item.label}</span>
                      <span className="text-sm font-medium text-gray-900">{formatDollars(item.amount_cents)}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                    <span className="text-sm font-medium text-gray-600">Total Costs</span>
                    <span className="text-sm font-semibold text-gray-900">{formatDollars(p.total_costs_cents)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <span className="text-sm font-medium text-gray-600">Margin</span>
                  <span className={`text-lg font-bold ${p.margin_cents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatDollars(p.margin_cents)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-medium text-gray-500">Client Charged ($)</label>
                  <input type="number" step="0.01" min="0" value={clientChargedDollars}
                    onChange={(e) => setClientChargedDollars(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Event Costs</p>
                    <button type="button" onClick={addCostItem}
                      className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50">
                      <i className="fa-solid fa-plus mr-1" />Add
                    </button>
                  </div>
                  {costItems.map((item) => (
                    <div key={item._id} className="mb-2 flex items-center gap-2">
                      <input type="text" value={item.label} onChange={(e) => updateCostItem(item._id, 'label', e.target.value)}
                        placeholder="Cost label" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                      <div className="relative w-32">
                        <span className="absolute left-3 top-2 text-sm text-gray-400">$</span>
                        <input type="number" step="0.01" min="0"
                          value={item.amount_cents ? (item.amount_cents / 100).toString() : ''}
                          onChange={(e) => updateCostItem(item._id, 'amount_cents', e.target.value)}
                          className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm focus:border-blue-500 focus:outline-none" />
                      </div>
                      {costItems.length > 1 && (
                        <button type="button" onClick={() => removeCostItem(item._id)} className="text-gray-400 hover:text-red-500">
                          <i className="fa-solid fa-xmark" />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-sm">
                    <span className="font-medium text-gray-600">Total Costs</span>
                    <span className="font-semibold text-gray-900">{formatDollars(totalCostsCents)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3">
                  <span className="text-sm font-medium text-blue-800">Margin</span>
                  <span className={`text-lg font-bold ${marginCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatDollars(marginCents)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Split */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Margin Split
            </h2>
            {!editing ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-green-600">
                    {p.vendor_name} ({p.vendor_split_percent}%)
                  </p>
                  <p className="mt-2 text-2xl font-bold text-green-700">{formatDollars(p.vendor_payout_cents)}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    IgniteGTM ({p.ignite_split_percent}%)
                  </p>
                  <p className="mt-2 text-2xl font-bold text-blue-700">{formatDollars(p.ignite_payout_cents)}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-medium text-gray-500">Vendor Split (%)</label>
                  <input type="number" min="0" max="100" step="1" value={vendorSplitPercent}
                    onChange={(e) => setVendorSplitPercent(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-green-600">Vendor ({splitPct}%)</p>
                    <p className="mt-1 text-xl font-bold text-green-700">{formatDollars(vendorPayoutCents)}</p>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Ignite ({igniteSplitPct}%)</p>
                    <p className="mt-1 text-xl font-bold text-blue-700">{formatDollars(ignitePayoutCents)}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Notes</h2>
            {!editing ? (
              <p className="whitespace-pre-wrap text-sm text-gray-700">{p.notes || 'No notes added.'}</p>
            ) : (
              <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes for the vendor..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            )}
          </div>

          {/* Meta & danger zone */}
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6">
            <div className="text-xs text-gray-400">
              Created {formatDate(p.created_at)}
              {p.email_sent_at && <span> &middot; Email sent {formatDate(p.email_sent_at)}</span>}
            </div>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
            >
              <i className="fa-solid fa-trash mr-1" />
              Delete Payout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
