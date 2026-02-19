import React, { useMemo, useState } from 'react';
import IgniteBackofficeLayout from './components/IgniteBackofficeLayout';
import './igniteBackoffice.css';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';

type AllocationRow = {
  id: string;
  client_name: string;
  event_name: string;
  event_date: string | null;
  status: 'planned' | 'active' | 'completed' | 'archived';
  funding_received_cents: number;
  forecast_costs_remaining_cents: number;
  costs_paid_to_date_cents: number;
  expected_margin_cents: number;
  held_amount_cents: number;
  free_cash_contribution_cents: number;
  risk_level: 'safe' | 'warning' | 'danger';
  auto_hold_mode: boolean;
  linked_proposal_id?: string | null;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((cents || 0) / 100);
}

function centsToDollars(cents: number) {
  return Number(((cents || 0) / 100).toFixed(2));
}

function dollarsToCents(value: string) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function riskClass(risk: string) {
  if (risk === 'safe') return 'px-3 py-1 text-xs font-medium bg-green-900/50 text-green-300 rounded-full';
  if (risk === 'warning') return 'px-3 py-1 text-xs font-medium bg-yellow-900/50 text-yellow-300 rounded-full';
  return 'px-3 py-1 text-xs font-medium bg-red-900/50 text-red-300 rounded-full';
}

export default function AllocationsPage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkLedgerIds, setLinkLedgerIds] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [editEventName, setEditEventName] = useState('');
  const [editAmountPaid, setEditAmountPaid] = useState('');
  const [editAmountOwed, setEditAmountOwed] = useState('');
  const [editExpectedMargin, setEditExpectedMargin] = useState('');

  const selected = useMemo(
    () => allocations.find((row) => row.id === selectedId) || null,
    [allocations, selectedId]
  );

  const updateSelectedDraft = (patch: Partial<AllocationRow>) => {
    if (!selectedId) return;
    setAllocations((prev) => prev.map((row) => (row.id === selectedId ? { ...row, ...patch } : row)));
  };

  const loadAllocations = async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await apiGet('/api/ignite/backoffice/allocations');
      setAllocations(((response as any)?.allocations || []) as AllocationRow[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load allocations');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadAllocations();
  }, []);

  const openDrawerFor = (id: string) => {
    setSelectedId(id);
    setIsDrawerOpen(true);
  };

  const openEditModal = (row: AllocationRow) => {
    setEditingAllocationId(row.id);
    setEditClientName(row.client_name || '');
    setEditEventName(row.event_name || '');
    setEditAmountPaid(String(centsToDollars(row.costs_paid_to_date_cents)));
    setEditAmountOwed(String(centsToDollars(row.forecast_costs_remaining_cents)));
    setEditExpectedMargin(String(centsToDollars(row.expected_margin_cents)));
    setIsEditModalOpen(true);
    setActionMenuId(null);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingAllocationId(null);
  };

  const createAllocation = async () => {
    const eventName = window.prompt('Event name');
    if (!eventName) return;
    const clientName = window.prompt('Client name') || '';
    try {
      await apiPost('/api/ignite/backoffice/allocations', {
        event_name: eventName,
        client_name: clientName,
        status: 'planned',
      });
      await loadAllocations();
    } catch (e: any) {
      setError(e?.message || 'Failed to create allocation');
    }
  };

  const saveSelectedAllocation = async (patch: Partial<AllocationRow>) => {
    if (!selected) return;
    try {
      setError(null);
      await apiPatch(`/api/ignite/backoffice/allocations/${selected.id}`, patch);
      await loadAllocations();
    } catch (e: any) {
      setError(e?.message || 'Failed to update allocation');
    }
  };

  const saveEditedAllocation = async () => {
    if (!editingAllocationId) return;
    try {
      setError(null);
      await apiPatch(`/api/ignite/backoffice/allocations/${editingAllocationId}`, {
        client_name: editClientName,
        event_name: editEventName,
        costs_paid_to_date_cents: dollarsToCents(editAmountPaid),
        forecast_costs_remaining_cents: dollarsToCents(editAmountOwed),
        expected_margin_cents: dollarsToCents(editExpectedMargin),
      });
      await loadAllocations();
      closeEditModal();
    } catch (e: any) {
      setError(e?.message || 'Failed to update allocation');
    }
  };

  const duplicateAllocation = async (row: AllocationRow) => {
    try {
      setError(null);
      await apiPost('/api/ignite/backoffice/allocations', {
        client_name: row.client_name,
        event_name: `${row.event_name} (Copy)`,
        event_date: row.event_date,
        status: row.status,
        funding_received_cents: row.funding_received_cents,
        costs_paid_to_date_cents: row.costs_paid_to_date_cents,
        forecast_costs_remaining_cents: row.forecast_costs_remaining_cents,
        expected_margin_cents: row.expected_margin_cents,
        held_amount_cents: row.held_amount_cents,
        auto_hold_mode: row.auto_hold_mode,
      });
      setActionMenuId(null);
      await loadAllocations();
    } catch (e: any) {
      setError(e?.message || 'Failed to duplicate allocation');
    }
  };

  const deleteAllocation = async (id: string) => {
    try {
      setError(null);
      await apiDelete(`/api/ignite/backoffice/allocations/${id}`);
      if (selectedId === id) {
        setSelectedId(null);
        setIsDrawerOpen(false);
      }
      setActionMenuId(null);
      await loadAllocations();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete allocation');
    }
  };

  const linkLedgerRows = async () => {
    if (!selected) return;
    const ids = linkLedgerIds
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!ids.length) return;
    try {
      await apiPost(`/api/ignite/backoffice/allocations/${selected.id}/link-ledger`, {
        ledger_transaction_ids: ids,
      });
      setLinkLedgerIds('');
    } catch (e: any) {
      setError(e?.message || 'Failed to link ledger rows');
    }
  };

  if (loading) {
    return (
      <IgniteBackofficeLayout>
        <div className="p-8 text-sm text-gray-400">Loading allocations...</div>
      </IgniteBackofficeLayout>
    );
  }

  return (
    <IgniteBackofficeLayout>
      <div className="ignite-backoffice-scrollbar-hide font-inter bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 min-h-screen">
        <main id="main-content" className="px-8 py-6">
          <div id="top-bar" className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Allocations</h1>
              <p className="text-gray-400">Reserve cash per event and forecast availability.</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                className="px-4 py-2 text-gray-300 hover:text-white border border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-800"
              >
                <i className="fas fa-download mr-2" />
                Export
              </button>
              <button
                type="button"
                disabled
                title="Coming soon"
                className="px-4 py-2 text-blue-400 hover:text-blue-300 border border-blue-800 rounded-lg text-sm font-medium hover:bg-blue-900/50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <i className="fas fa-file-import mr-2" />
                Import from Proposal
              </button>
              <button
                type="button"
                onClick={() => void createAllocation()}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-purple-700"
              >
                <i className="fas fa-plus mr-2" />
                New Allocation
              </button>
            </div>
          </div>
          {error ? <p className="text-xs text-red-400 mb-4">{error}</p> : null}

          <div id="tabs-section" className="mb-6">
            <div className="border-b border-slate-700">
              <nav className="-mb-px flex space-x-8">
                <button type="button" className="py-2 px-1 border-b-2 border-blue-500 font-medium text-sm text-blue-400">
                  Active Allocations
                </button>
                <button
                  type="button"
                  className="py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-300 hover:border-slate-600"
                >
                  Completed / Archived
                </button>
              </nav>
            </div>
          </div>

          <div
            id="allocations-table"
            className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-lg overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Event Name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Event Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Funding</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Forecast Costs</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Paid to Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Margin</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Held Amount</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Free Cash</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Risk</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {allocations.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-6 py-8 text-center text-sm text-gray-400">
                        No allocations yet.
                      </td>
                    </tr>
                  ) : (
                    allocations.map((row) => (
                      <tr key={row.id} className="hover:bg-blue-900/20 cursor-pointer" onClick={() => openDrawerFor(row.id)}>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white">{row.event_name || 'Untitled Event'}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-400">{row.client_name}</td>
                        <td className="px-6 py-4 text-gray-300">{formatDate(row.event_date)}</td>
                        <td className="px-6 py-4">
                          <span className={riskClass(row.status === 'active' ? 'safe' : row.status === 'planned' ? 'warning' : 'danger')}>
                            {String(row.status).charAt(0).toUpperCase() + String(row.status).slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-green-400 font-semibold">{formatMoney(row.funding_received_cents)}</td>
                        <td className="px-6 py-4 text-amber-400 font-medium">{formatMoney(row.forecast_costs_remaining_cents)}</td>
                        <td className="px-6 py-4 text-gray-400">{formatMoney(row.costs_paid_to_date_cents)}</td>
                        <td className="px-6 py-4 text-purple-400 font-semibold">{formatMoney(row.expected_margin_cents)}</td>
                        <td className="px-6 py-4 text-gray-300 font-medium">{formatMoney(row.held_amount_cents)}</td>
                        <td className={`px-6 py-4 font-semibold ${row.free_cash_contribution_cents >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {row.free_cash_contribution_cents >= 0 ? '+' : '-'}
                          {formatMoney(Math.abs(row.free_cash_contribution_cents))}
                        </td>
                        <td className="px-6 py-4">
                          <span className={riskClass(row.risk_level)}>
                            {String(row.risk_level).charAt(0).toUpperCase() + String(row.risk_level).slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="relative inline-block">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionMenuId((prev) => (prev === row.id ? null : row.id));
                              }}
                              className="text-gray-500 hover:text-gray-300"
                            >
                              <i className="fas fa-ellipsis-h" />
                            </button>
                            {actionMenuId === row.id ? (
                              <div className="absolute right-0 mt-2 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-30">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditModal(row);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-t-lg"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void duplicateAllocation(row);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                                >
                                  Duplicate
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!window.confirm('Delete this allocation?')) return;
                                    void deleteAllocation(row.id);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-slate-700 rounded-b-lg"
                                >
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {isDrawerOpen && (
          <div id="allocation-drawer" className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
            <div className="absolute right-0 top-0 h-full w-1/2 bg-slate-900 shadow-2xl">
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Allocation Details</h2>
                  <button type="button" onClick={() => setIsDrawerOpen(false)} className="text-gray-500 hover:text-gray-300">
                    <i className="fas fa-times" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Event Name</label>
                    <input
                      value={selected?.event_name || ''}
                      onChange={(e) => updateSelectedDraft({ event_name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                      placeholder="Event name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Client Name</label>
                    <input
                      value={selected?.client_name || ''}
                      onChange={(e) => updateSelectedDraft({ client_name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                      placeholder="Client name"
                    />
                  </div>
                </div>
                <p className="text-gray-400 mt-2 text-sm">Event date: {formatDate(selected?.event_date)}</p>
              </div>

              <div className="p-6 overflow-y-auto h-full pb-20">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-green-900/30 p-4 rounded-lg border border-green-800/50">
                    <div className="text-sm text-green-400 font-medium">Funding Received</div>
                  <div className="text-2xl font-bold text-green-300">{formatMoney(selected?.funding_received_cents || 0)}</div>
                  </div>
                  <div className="bg-amber-900/30 p-4 rounded-lg border border-amber-800/50">
                    <div className="text-sm text-amber-400 font-medium">Remaining Costs</div>
                  <div className="text-2xl font-bold text-amber-300">{formatMoney(selected?.forecast_costs_remaining_cents || 0)}</div>
                  </div>
                  <div className="bg-blue-900/30 p-4 rounded-lg border border-blue-800/50">
                    <div className="text-sm text-blue-400 font-medium">Held Amount</div>
                  <div className="text-2xl font-bold text-blue-300">{formatMoney(selected?.held_amount_cents || 0)}</div>
                  </div>
                  <div className="bg-purple-900/30 p-4 rounded-lg border border-purple-800/50">
                    <div className="text-sm text-purple-400 font-medium">Expected Margin</div>
                  <div className="text-2xl font-bold text-purple-300">{formatMoney(selected?.expected_margin_cents || 0)}</div>
                  </div>
                </div>

                <div className="bg-gray-800/50 p-4 rounded-lg mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-200">Linked Proposal</div>
                    <div className="text-sm text-gray-500">
                      {selected?.linked_proposal_id ? `Proposal ${selected.linked_proposal_id}` : 'No proposal linked'}
                    </div>
                    </div>
                    <button type="button" className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                      View
                    </button>
                  </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={linkLedgerIds}
                    onChange={(e) => setLinkLedgerIds(e.target.value)}
                    placeholder="Ledger IDs comma-separated"
                    className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void linkLedgerRows()}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    Link
                  </button>
                </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-200 mb-4">Holds Control</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Held Amount</label>
                      <input
                        type="range"
                        min="0"
                        max={Math.max(50000, Math.round((selected?.funding_received_cents || 0) / 100))}
                        value={Math.round((selected?.held_amount_cents || 0) / 100)}
                        onChange={(e) =>
                          setAllocations((prev) =>
                            prev.map((row) =>
                              row.id === selected?.id ? { ...row, held_amount_cents: Math.round(Number(e.target.value) * 100) } : row
                            )
                          )
                        }
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>$0</span>
                        <span className="font-medium text-gray-300">
                          {formatMoney(
                            allocations.find((row) => row.id === selected?.id)?.held_amount_cents || selected?.held_amount_cents || 0
                          )}
                        </span>
                        <span>$50,000</span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={Boolean(selected?.auto_hold_mode)}
                        onChange={(e) =>
                          setAllocations((prev) =>
                            prev.map((row) => (row.id === selected?.id ? { ...row, auto_hold_mode: e.target.checked } : row))
                          )
                        }
                        className="h-4 w-4 text-blue-400 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-400">Auto-hold = remaining costs (recommended)</label>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selected) return;
                        const changed = allocations.find((row) => row.id === selected.id);
                        if (!changed) return;
                        void saveSelectedAllocation({
                          event_name: changed.event_name,
                          client_name: changed.client_name,
                          held_amount_cents: changed.held_amount_cents,
                          auto_hold_mode: changed.auto_hold_mode,
                        });
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      Save Allocation
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-200 mb-4">Forecast</h3>
                  <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
                    <p className="text-sm text-gray-300">
                      Remaining forecast costs: <span className="font-semibold text-amber-300">{formatMoney(selected?.forecast_costs_remaining_cents || 0)}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">No mocked forecast line items are shown. Link real ledger items to track details.</p>
                  </div>
                </div>

                <div
                  className={`p-4 rounded-lg ${
                    selected?.risk_level === 'safe'
                      ? 'bg-green-900/20 border border-green-800/50'
                      : selected?.risk_level === 'warning'
                        ? 'bg-yellow-900/20 border border-yellow-800/50'
                        : 'bg-red-900/20 border border-red-800/50'
                  }`}
                >
                  <div className="flex items-center">
                    <i className="fas fa-check-circle text-green-400 mr-2" />
                    <span className="text-green-300 font-medium">{String(selected?.risk_level || 'safe').toUpperCase()} RISK</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    Free cash contribution: {formatMoney(selected?.free_cash_contribution_cents || 0)}.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {isEditModalOpen ? (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={closeEditModal}>
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="glass-card rounded-xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">Edit Allocation</h2>
                  <button type="button" onClick={closeEditModal} className="text-slate-400 hover:text-white">
                    <i className="fa-solid fa-times" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Client Name</label>
                      <input
                        value={editClientName}
                        onChange={(e) => setEditClientName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                        placeholder="Client name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Event Name</label>
                      <input
                        value={editEventName}
                        onChange={(e) => setEditEventName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                        placeholder="Event name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Amount Paid</label>
                      <input
                        value={editAmountPaid}
                        onChange={(e) => setEditAmountPaid(e.target.value)}
                        type="number"
                        step="0.01"
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Amount Owed</label>
                      <input
                        value={editAmountOwed}
                        onChange={(e) => setEditAmountOwed(e.target.value)}
                        type="number"
                        step="0.01"
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Expected Margin</label>
                      <input
                        value={editExpectedMargin}
                        onChange={(e) => setEditExpectedMargin(e.target.value)}
                        type="number"
                        step="0.01"
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => void saveEditedAllocation()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </IgniteBackofficeLayout>
  );
}
