import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../lib/api';

type IgniteVendorRateCard = {
  id: string;
  name: string;
  vendor_name: string | null;
  category: string | null;
  currency: string;
  is_active: boolean;
  updated_at: string;
  rates_json: Record<string, any> | null;
};

export default function IgniteVendorRateCardsPage() {
  const [cards, setCards] = useState<IgniteVendorRateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet('/api/ignite/vendor-rate-cards');
      setCards(Array.isArray(response?.vendor_rate_cards) ? response.vendor_rate_cards : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load vendor rate cards');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function onCreateVendor() {
    const name = window.prompt('Rate card name');
    if (!name || !name.trim()) return;
    const vendorName = window.prompt('Vendor name (optional)') || null;
    const category = window.prompt('Category (optional, e.g. AV, Venue, Travel)') || null;
    setSaving(true);
    setError(null);
    try {
      await apiPost('/api/ignite/vendor-rate-cards', {
        name: name.trim(),
        vendor_name: vendorName,
        category,
        rates_json: {},
      });
      await loadData();
    } catch (e: any) {
      setError(e?.message || 'Failed to create rate card');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Vendors and Rate Cards</h1>
            <p className="mt-1 text-sm text-slate-600">
              Centralized supplier pricing, contracts, and service details.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateVendor}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className="fa-solid fa-plus mr-2" />
            {saving ? 'Creating...' : 'Add Vendor'}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active Vendors</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {cards.filter((card) => card.is_active).length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Rate Cards</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{cards.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Categories</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {new Set(cards.map((card) => (card.category || '').trim()).filter(Boolean)).size}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Vendor</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Rate Card</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {!loading && cards.length === 0 && (
              <tr>
                <td className="px-4 py-5 text-slate-600" colSpan={5}>
                  No vendor rate cards yet.
                </td>
              </tr>
            )}
            {cards.map((card) => (
              <tr key={card.id}>
                <td className="px-4 py-4">
                  <p className="font-semibold text-slate-900">{card.vendor_name || card.name}</p>
                  <p className="text-xs text-slate-500">{card.currency || 'USD'}</p>
                </td>
                <td className="px-4 py-4">{card.category || 'Uncategorized'}</td>
                <td className="px-4 py-4">{card.name}</td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      card.is_active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {card.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-4">{new Date(card.updated_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
