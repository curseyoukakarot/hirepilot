import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../../../lib/api';

type CostItem = { id: string; label: string; amount_cents: number };
type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Event & Vendor',
  2: 'Cost Breakdown',
  3: 'Margin & Split',
  4: 'Review & Send',
};

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function toCents(dollars: string): number {
  const n = parseFloat(dollars);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export default function VendorPayoutWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [createdPayoutId, setCreatedPayoutId] = useState<string | null>(null);

  // Step 1: Event & vendor info
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorCompany, setVendorCompany] = useState('');

  // Step 2: Costs
  const [clientChargedDollars, setClientChargedDollars] = useState('');
  const [costItems, setCostItems] = useState<CostItem[]>([
    { id: uid(), label: '', amount_cents: 0 },
  ]);

  // Step 3: Split
  const [vendorSplitPercent, setVendorSplitPercent] = useState('50');
  const [notes, setNotes] = useState('');

  // Load clients
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet('/api/ignite/clients');
        if (cancelled) return;
        const rows = Array.isArray(res?.clients) ? res.clients : [];
        setClients(rows.filter((r: any) => r?.id && r?.name).map((r: any) => ({ id: String(r.id), name: String(r.name) })));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const found = clients.find((c) => c.id === clientId);
    setClientName(found?.name || '');
  }, [clientId, clients]);

  // Computed financials
  const clientChargedCents = toCents(clientChargedDollars);
  const totalCostsCents = costItems.reduce((s, i) => s + i.amount_cents, 0);
  const marginCents = clientChargedCents - totalCostsCents;
  const splitPct = Math.min(100, Math.max(0, parseFloat(vendorSplitPercent) || 0));
  const igniteSplitPct = Math.max(0, 100 - splitPct);
  const vendorPayoutCents = Math.round((marginCents * splitPct) / 100);
  const ignitePayoutCents = marginCents - vendorPayoutCents;

  const step1Valid = !!eventName.trim() && !!vendorName.trim() && !!vendorEmail.trim();
  const step2Valid = clientChargedCents > 0 && costItems.some((i) => i.label.trim() && i.amount_cents > 0);
  const step3Valid = splitPct > 0 && splitPct <= 100;

  const addCostItem = () => setCostItems((prev) => [...prev, { id: uid(), label: '', amount_cents: 0 }]);
  const removeCostItem = (id: string) => setCostItems((prev) => prev.filter((i) => i.id !== id));
  const updateCostItem = (id: string, field: 'label' | 'amount_cents', value: any) => {
    setCostItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, [field]: field === 'amount_cents' ? toCents(String(value)) : value }
          : item
      )
    );
  };

  const handleCreate = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await apiPost('/api/ignite/vendor-payouts', {
        event_name: eventName,
        event_date: eventDate || null,
        client_id: clientId || null,
        client_name: clientName || null,
        vendor_name: vendorName,
        vendor_email: vendorEmail,
        vendor_company: vendorCompany || null,
        client_charged_cents: clientChargedCents,
        cost_items: costItems.filter((i) => i.label.trim()).map((i) => ({ label: i.label, amount_cents: i.amount_cents })),
        vendor_split_percent: splitPct,
        notes: notes || null,
      });
      setCreatedPayoutId(res?.vendor_payout?.id || null);
      return res?.vendor_payout?.id;
    } catch (e: any) {
      setError(e?.message || 'Failed to create payout');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSendEmail = async (payoutId?: string | null) => {
    const id = payoutId || createdPayoutId;
    if (!id) return;
    try {
      setSaving(true);
      setError(null);
      await apiPost(`/api/ignite/vendor-payouts/${id}/send-email`, {});
      setEmailSent(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to send email');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndSend = async () => {
    const id = await handleCreate();
    if (id) await handleSendEmail(id);
  };

  const handleCreateOnly = async () => {
    const id = await handleCreate();
    if (id) navigate('/ignite/vendor-payouts');
  };

  return (
    <div>
      <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Create Vendor Payout</h1>
            <p className="mt-1 text-sm text-gray-600">
              Build a cost breakdown and send a payout statement to your vendor
            </p>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </header>

      {/* Step indicator */}
      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex items-center gap-4 overflow-x-auto pb-1 sm:gap-8">
          {([1, 2, 3, 4] as WizardStep[]).map((s, idx) => {
            const active = s === step;
            const done = s < step;
            return (
              <React.Fragment key={s}>
                <button type="button" onClick={() => setStep(s)} className="flex shrink-0 items-center space-x-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                      active ? 'bg-blue-600 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {done ? <i className="fa-solid fa-check text-xs" /> : s}
                  </div>
                  <span className={`${active ? 'font-medium text-blue-600' : 'text-gray-600'} hidden sm:inline`}>
                    {STEP_LABELS[s]}
                  </span>
                </button>
                {idx < 3 && <div className="h-px w-4 bg-gray-300 sm:w-8" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="p-4 sm:p-6 md:p-8">
        {/* Step 1: Event & Vendor */}
        {step === 1 && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Event Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Client</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select client (optional)</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Event Name *</label>
                  <input
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g. Supermicro Q3 Summit"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Event Date</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Vendor Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Vendor Name *</label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Vendor Email *</label>
                  <input
                    type="email"
                    value={vendorEmail}
                    onChange={(e) => setVendorEmail(e.target.value)}
                    placeholder="vendor@company.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Vendor Company</label>
                  <input
                    type="text"
                    value={vendorCompany}
                    onChange={(e) => setVendorCompany(e.target.value)}
                    placeholder="Company name (optional)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!step1Valid}
                onClick={() => setStep(2)}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Next: Cost Breakdown <i className="fa-solid fa-arrow-right ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Cost Breakdown */}
        {step === 2 && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Amount Charged to Client</h2>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Total Client Charge ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={clientChargedDollars}
                  onChange={(e) => setClientChargedDollars(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Event Costs</h2>
                <button
                  type="button"
                  onClick={addCostItem}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <i className="fa-solid fa-plus mr-1" /> Add Line
                </button>
              </div>
              <div className="space-y-3">
                {costItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => updateCostItem(item.id, 'label', e.target.value)}
                      placeholder="e.g. Venue rental, Catering, AV..."
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="relative w-36">
                      <span className="absolute left-3 top-2 text-sm text-gray-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.amount_cents ? (item.amount_cents / 100).toString() : ''}
                        onChange={(e) => updateCostItem(item.id, 'amount_cents', e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    {costItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCostItem(item.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <i className="fa-solid fa-xmark" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
                <span className="text-sm font-medium text-gray-700">Total Costs</span>
                <span className="text-sm font-semibold text-gray-900">{formatDollars(totalCostsCents)}</span>
              </div>
            </div>

            {clientChargedCents > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">Calculated Margin</span>
                  <span className={`text-lg font-bold ${marginCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatDollars(marginCents)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <i className="fa-solid fa-arrow-left mr-2" /> Back
              </button>
              <button
                type="button"
                disabled={!step2Valid}
                onClick={() => setStep(3)}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Next: Margin Split <i className="fa-solid fa-arrow-right ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Margin & Split */}
        {step === 3 && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Margin Split</h2>
              <p className="mb-6 text-sm text-gray-500">
                Define how the margin of {formatDollars(marginCents)} is split between the vendor and Ignite.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Vendor Split (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={vendorSplitPercent}
                    onChange={(e) => setVendorSplitPercent(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="rounded-xl bg-gray-50 p-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Vendor ({splitPct}%)</p>
                      <p className="mt-1 text-2xl font-bold text-green-600">{formatDollars(vendorPayoutCents)}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{vendorName || 'Vendor'}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Ignite ({igniteSplitPct}%)</p>
                      <p className="mt-1 text-2xl font-bold text-blue-600">{formatDollars(ignitePayoutCents)}</p>
                      <p className="mt-0.5 text-xs text-gray-400">IgniteGTM</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Notes (optional)</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes for the vendor..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <i className="fa-solid fa-arrow-left mr-2" /> Back
              </button>
              <button
                type="button"
                disabled={!step3Valid}
                onClick={() => setStep(4)}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Next: Review <i className="fa-solid fa-arrow-right ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Send */}
        {step === 4 && !emailSent && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-6 text-lg font-semibold text-gray-900">Review Payout Statement</h2>

              {/* Event & Vendor summary */}
              <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-500">Event</p>
                  <p className="text-gray-900">{eventName}</p>
                </div>
                {clientName && (
                  <div>
                    <p className="font-medium text-gray-500">Client</p>
                    <p className="text-gray-900">{clientName}</p>
                  </div>
                )}
                {eventDate && (
                  <div>
                    <p className="font-medium text-gray-500">Date</p>
                    <p className="text-gray-900">{eventDate}</p>
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-500">Vendor</p>
                  <p className="text-gray-900">{vendorName} ({vendorEmail})</p>
                </div>
              </div>

              {/* Financial breakdown */}
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Client Charged</span>
                  <span className="font-semibold text-gray-900">{formatDollars(clientChargedCents)}</span>
                </div>

                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">Event Costs</p>
                  {costItems.filter((i) => i.label.trim()).map((item) => (
                    <div key={item.id} className="flex justify-between py-1 text-sm">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="text-gray-900">{formatDollars(item.amount_cents)}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-sm font-medium">
                    <span className="text-gray-700">Total Costs</span>
                    <span className="text-gray-900">{formatDollars(totalCostsCents)}</span>
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Margin</span>
                  <span className={`font-bold ${marginCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatDollars(marginCents)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Split</span>
                  <span className="text-gray-900">
                    {vendorName} {splitPct}% / Ignite {igniteSplitPct}%
                  </span>
                </div>

                <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
                  <div className="flex justify-between">
                    <span className="font-semibold text-green-800">Vendor Payout</span>
                    <span className="text-xl font-bold text-green-700">{formatDollars(vendorPayoutCents)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-sm">
                    <span className="text-green-600">Ignite Retains</span>
                    <span className="font-medium text-green-700">{formatDollars(ignitePayoutCents)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <i className="fa-solid fa-arrow-left mr-2" /> Back
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleCreateOnly}
                  className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <i className="fa-solid fa-save mr-2" />
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleCreateAndSend}
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
                >
                  <i className="fa-solid fa-paper-plane mr-2" />
                  {saving ? 'Sending...' : 'Create & Send Email'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email sent confirmation */}
        {step === 4 && emailSent && (
          <div className="mx-auto max-w-lg text-center">
            <div className="rounded-xl border border-green-200 bg-green-50 p-10">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <i className="fa-solid fa-check text-2xl text-green-600" />
              </div>
              <h2 className="mb-2 text-xl font-bold text-green-800">Payout Statement Sent!</h2>
              <p className="mb-1 text-sm text-green-700">
                An email has been sent to <strong>{vendorEmail}</strong> from <strong>events@ignitegtm.com</strong>.
              </p>
              <p className="mb-6 text-sm text-green-600">
                They can view their full payout breakdown via the link in the email.
              </p>
              <button
                type="button"
                onClick={() => navigate('/ignite/vendor-payouts')}
                className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700"
              >
                Back to Vendor Payouts
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
