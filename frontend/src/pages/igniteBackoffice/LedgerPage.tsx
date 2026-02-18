import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import IgniteBackofficeLayout from './components/IgniteBackofficeLayout';
import './igniteBackoffice.css';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';

type AccountRow = {
  id: string;
  name: string;
  type: 'operating' | 'savings' | 'credit';
};

type AllocationRow = {
  id: string;
  event_name: string;
};

type LedgerRow = {
  id: string;
  date: string;
  description: string;
  type: string;
  account_id: string;
  inbound_cents: number;
  outbound_cents: number;
  status: string;
  event_allocation_id: string | null;
  running_balance_cents: number;
};

const DEFAULT_LEDGER_STATUSES = ['paid', 'sent', 'past_due', 'hold', 'na'];

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function formatDay(dateValue: string) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return dateValue;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function balanceClass(balanceCents: number) {
  if (balanceCents >= 5000000) return 'text-green-400 balance-safe';
  if (balanceCents >= 1000000) return 'text-amber-400 balance-warning';
  return 'text-red-400 balance-danger';
}

function statusBadgeClass(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'paid') return 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-900/50 text-green-300';
  if (normalized === 'past_due') return 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/50 text-yellow-300';
  if (normalized === 'hold') return 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-red-900/50 text-red-300';
  if (normalized === 'sent') return 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300';
  return 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-300';
}

function statusLabel(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'na') return 'N/A';
  return normalized
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function typeBadgeClass(type: string) {
  const normalized = String(type || '').toLowerCase();
  if (normalized === 'invoice') return 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700/50';
  if (normalized === 'payment') return 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-900/50 text-green-300 border border-green-700/50';
  if (normalized === 'expense') return 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-red-900/50 text-red-300 border border-red-700/50';
  if (normalized === 'transfer') return 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-purple-900/50 text-purple-300 border border-purple-700/50';
  return 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-300 border border-slate-600';
}

export default function LedgerPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [rowActionMenuId, setRowActionMenuId] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState('');
  const [status, setStatus] = useState('all');
  const [accountId, setAccountId] = useState('all');
  const [type, setType] = useState('all');
  const [eventTag, setEventTag] = useState('all');
  const [search, setSearch] = useState('');

  const [formDate, setFormDate] = useState('');
  const [formType, setFormType] = useState('invoice');
  const [formDescription, setFormDescription] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formDirection, setFormDirection] = useState<'in' | 'out'>('in');
  const [formAmount, setFormAmount] = useState('');
  const [formStatus, setFormStatus] = useState('paid');
  const [formEventId, setFormEventId] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const accountMap = useMemo(() => {
    return new Map(accounts.map((row) => [row.id, row]));
  }, [accounts]);

  const allocationMap = useMemo(() => {
    return new Map(allocations.map((row) => [row.id, row]));
  }, [allocations]);

  const statusOptions = useMemo(() => {
    const values = new Set<string>(DEFAULT_LEDGER_STATUSES);
    rows.forEach((row) => {
      const normalized = String(row.status || '').trim().toLowerCase();
      if (normalized) values.add(normalized);
    });
    const fromFilter = String(status || '').trim().toLowerCase();
    if (fromFilter && fromFilter !== 'all') values.add(fromFilter);
    const fromForm = String(formStatus || '').trim().toLowerCase();
    if (fromForm) values.add(fromForm);
    return Array.from(values);
  }, [rows, status, formStatus]);

  const loadReferenceData = async () => {
    const [accountsRes, allocationsRes] = await Promise.all([
      apiGet('/api/ignite/backoffice/accounts'),
      apiGet('/api/ignite/backoffice/allocations'),
    ]);
    const accountRows = ((accountsRes as any)?.accounts || []) as AccountRow[];
    const allocationRows = ((allocationsRes as any)?.allocations || []) as AllocationRow[];
    setAccounts(accountRows);
    setAllocations(allocationRows);
    if (!formAccountId && accountRows.length > 0) setFormAccountId(accountRows[0].id);
  };

  const loadLedger = async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (status && status !== 'all') params.set('status', status);
    if (accountId && accountId !== 'all') params.set('account_id', accountId);
    if (type && type !== 'all') params.set('type', type);
    if (eventTag && eventTag !== 'all') params.set('event_tag', eventTag);
    if (search) params.set('search', search);
    const query = params.toString();
    const response = await apiGet(`/api/ignite/backoffice/ledger${query ? `?${query}` : ''}`);
    setRows(((response as any)?.ledger || []) as LedgerRow[]);
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);
      await loadReferenceData();
      await loadLedger();
    } catch (e: any) {
      setError(e?.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    void loadLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, status, accountId, type, eventTag, search]);

  const submitAddTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formDate || !formAccountId || !formDescription) return;
    const cents = Math.round(Number(formAmount || 0) * 100);
    const payload = {
      date: formDate,
      description: formDescription,
      type: formType,
      status: formStatus,
      account_id: formAccountId,
      inbound_cents: formDirection === 'in' ? cents : 0,
      outbound_cents: formDirection === 'out' ? cents : 0,
      event_allocation_id: formEventId || null,
      notes: formNotes || null,
    };
    try {
      if (editingRowId) {
        await apiPatch(`/api/ignite/backoffice/ledger/${editingRowId}`, payload);
      } else {
        await apiPost('/api/ignite/backoffice/ledger', payload);
      }
      setIsModalOpen(false);
      setEditingRowId(null);
      setFormAmount('');
      setFormDescription('');
      setFormEventId('');
      setFormNotes('');
      await loadLedger();
    } catch (e: any) {
      setError(e?.message || (editingRowId ? 'Failed to update transaction' : 'Failed to create transaction'));
    }
  };

  const openAddModal = () => {
    setEditingRowId(null);
    setFormDate('');
    setFormType('invoice');
    setFormDescription('');
    setFormDirection('in');
    setFormAmount('');
    setFormStatus('paid');
    setFormEventId('');
    setFormNotes('');
    if (!formAccountId && accounts.length > 0) setFormAccountId(accounts[0].id);
    setIsModalOpen(true);
  };

  const openEditModal = (row: LedgerRow) => {
    setEditingRowId(row.id);
    setFormDate(row.date);
    setFormType(row.type || 'adjustment');
    setFormDescription(row.description || '');
    setFormAccountId(row.account_id || (accounts[0]?.id || ''));
    const inbound = Number(row.inbound_cents || 0);
    const outbound = Number(row.outbound_cents || 0);
    const useOutbound = outbound > 0 && inbound === 0;
    setFormDirection(useOutbound ? 'out' : 'in');
    setFormAmount(String(((useOutbound ? outbound : inbound) || 0) / 100));
    setFormStatus(row.status || 'na');
    setFormEventId(row.event_allocation_id || '');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const duplicateRow = async (row: LedgerRow) => {
    try {
      setError(null);
      await apiPost('/api/ignite/backoffice/ledger', {
        date: row.date,
        description: `${row.description} (Copy)`,
        type: row.type,
        status: row.status,
        account_id: row.account_id,
        inbound_cents: Number(row.inbound_cents || 0),
        outbound_cents: Number(row.outbound_cents || 0),
        event_allocation_id: row.event_allocation_id || null,
      });
      await loadLedger();
    } catch (e: any) {
      setError(e?.message || 'Failed to duplicate transaction');
    }
  };

  const deleteRow = async (rowId: string) => {
    try {
      setError(null);
      await apiDelete(`/api/ignite/backoffice/ledger/${rowId}`);
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
      await loadLedger();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete transaction');
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowIds(new Set(rows.map((row) => row.id)));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const toggleRowSelection = (rowId: string, checked: boolean) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  };

  const bulkDeleteSelected = async () => {
    const ids = Array.from(selectedRowIds);
    if (!ids.length) return;
    try {
      setError(null);
      await Promise.all(ids.map((id) => apiDelete(`/api/ignite/backoffice/ledger/${id}`)));
      setSelectedRowIds(new Set());
      setBulkMenuOpen(false);
      await loadLedger();
    } catch (e: any) {
      setError(e?.message || 'Failed to bulk delete transactions');
    }
  };

  const normalizeStatusValue = (value: string) =>
    String(value || '')
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/^_+|_+$/g, '') || 'na';

  const updateRowStatus = async (rowId: string, nextStatus: string) => {
    const normalized = normalizeStatusValue(nextStatus);
    try {
      setError(null);
      await apiPatch(`/api/ignite/backoffice/ledger/${rowId}`, { status: normalized });
      await loadLedger();
    } catch (e: any) {
      setError(e?.message || 'Failed to update status');
    }
  };

  const promptCustomStatus = (initialValue = '') => {
    const value = window.prompt('Enter custom status', initialValue);
    if (value === null) return '';
    return value;
  };

  const handleTableStatusChange = async (rowId: string, value: string) => {
    if (value === '__custom__') {
      const custom = promptCustomStatus();
      if (!custom) return;
      await updateRowStatus(rowId, custom);
      return;
    }
    await updateRowStatus(rowId, value);
  };

  const handleFormStatusChange = (value: string) => {
    if (value === '__custom__') {
      const custom = promptCustomStatus(formStatus);
      if (!custom) return;
      setFormStatus(normalizeStatusValue(custom));
      return;
    }
    setFormStatus(normalizeStatusValue(value));
  };

  const allSelected = rows.length > 0 && selectedRowIds.size === rows.length;

  useEffect(() => {
    setSelectedRowIds((prev) => {
      const validIds = new Set(rows.map((row) => row.id));
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return next;
    });
  }, [rows]);

  if (loading) {
    return (
      <IgniteBackofficeLayout>
        <div className="p-8 text-sm text-gray-400">Loading ledger...</div>
      </IgniteBackofficeLayout>
    );
  }

  return (
    <IgniteBackofficeLayout>
      <div className="ignite-backoffice-scrollbar-hide bg-slate-900 font-inter min-h-screen">
        <div id="header" className="bg-slate-800/50 border-b border-slate-700/50 px-8 py-6">
          <div className="flex items-center justify-between">
            <div id="page-title">
              <h1 className="text-2xl font-semibold text-white">Ledger</h1>
              <p className="text-slate-400 text-sm mt-1">All cash movements across operating, savings, and credit.</p>
            </div>

            <div id="header-actions" className="flex items-center gap-4">
              <button
                type="button"
                onClick={openAddModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-plus text-sm" />
                Add Transaction
              </button>
              <button
                type="button"
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-download text-sm" />
                Export CSV
              </button>
              <Link to="/ignite/backoffice/imports" className="text-slate-400 hover:text-white transition-colors text-sm">
                Import
              </Link>
              <div className="text-xs text-slate-500">Last synced: 2 min ago</div>
            </div>
          </div>
          {error ? <p className="text-xs text-red-400 mt-3">{error}</p> : null}
        </div>

        <div id="filters-bar" className="glass-card mx-8 mt-6 rounded-xl p-4 sticky top-0 z-10">
          <div className="grid grid-cols-8 gap-4 items-center">
            <div id="date-filter" className="col-span-1">
              <label className="text-xs text-slate-400 block mb-1">Date Range</label>
              <input
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                type="date"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>

            <div id="status-filter" className="col-span-1">
              <label className="text-xs text-slate-400 block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">All</option>
                {statusOptions.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusLabel(statusOption)}
                  </option>
                ))}
              </select>
            </div>

            <div id="account-filter" className="col-span-1">
              <label className="text-xs text-slate-400 block mb-1">Account</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">All</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div id="type-filter" className="col-span-1">
              <label className="text-xs text-slate-400 block mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">All</option>
                <option value="invoice">Invoice</option>
                <option value="payment">Payment</option>
                <option value="expense">Expense</option>
                <option value="transfer">Transfer</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>

            <div id="event-filter" className="col-span-1">
              <label className="text-xs text-slate-400 block mb-1">Event</label>
              <select
                value={eventTag}
                onChange={(e) => setEventTag(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">All</option>
                {allocations.map((allocation) => (
                  <option key={allocation.id} value={allocation.id}>
                    {allocation.event_name}
                  </option>
                ))}
              </select>
            </div>

            <div id="search-filter" className="col-span-2">
              <label className="text-xs text-slate-400 block mb-1">Search</label>
              <div className="relative">
                <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  type="text"
                  placeholder="Description, vendor, client..."
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-10 pr-3 py-2 text-white text-sm"
                />
              </div>
            </div>

            <div id="toggle-filters" className="col-span-1 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" className="rounded border-slate-600 bg-slate-800" />
                Show Holds Only
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" className="rounded border-slate-600 bg-slate-800" />
                Negative Risk Only
              </label>
            </div>
          </div>
        </div>

        <div id="main-ledger" className="mx-8 mt-6 mb-8">
          <div className="glass-card rounded-xl overflow-hidden">
            {selectedRowIds.size > 0 ? (
              <div id="bulk-actions" className="border-b border-slate-700/50 px-6 py-3 bg-slate-800/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{selectedRowIds.size} item(s) selected</span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setBulkMenuOpen((prev) => !prev)}
                      className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1 rounded text-sm flex items-center gap-2"
                    >
                      Bulk Actions
                      <i className="fa-solid fa-chevron-down text-xs" />
                    </button>
                    {bulkMenuOpen ? (
                      <div className="absolute right-0 mt-2 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-20">
                        <button
                          type="button"
                          onClick={() => void bulkDeleteSelected()}
                          className="w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-slate-700 rounded-lg"
                        >
                          Delete Selected
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div id="table-container" className="overflow-x-auto">
              <table className="w-full">
                <thead id="table-header" className="bg-slate-800/50 sticky top-0">
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        className="rounded border-slate-600"
                      />
                    </th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Date</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Description</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Type</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Account</th>
                    <th className="text-right p-4 text-xs font-medium text-slate-400 uppercase tracking-wide">In</th>
                    <th className="text-right p-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Out</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Event</th>
                    <th className="text-right p-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Balance</th>
                    <th className="text-center p-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody id="ledger-rows">
                  {rows.length === 0 ? (
                    <tr className="border-b border-slate-700/30">
                      <td colSpan={11} className="p-6 text-center text-sm text-slate-400">
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const account = accountMap.get(row.account_id);
                      const event = row.event_allocation_id ? allocationMap.get(row.event_allocation_id) : null;
                      const accountBadge =
                        account?.type === 'savings'
                          ? 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700/50'
                          : account?.type === 'credit'
                          ? 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-orange-900/50 text-orange-300 border border-orange-700/50'
                          : 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-900/50 text-green-300 border border-green-700/50';
                      return (
                        <tr key={row.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={selectedRowIds.has(row.id)}
                              onChange={(e) => toggleRowSelection(row.id, e.target.checked)}
                              className="rounded border-slate-600"
                            />
                          </td>
                          <td className="p-4 text-sm text-slate-300">{formatDay(row.date)}</td>
                          <td className="p-4 text-sm text-white">{row.description}</td>
                          <td className="p-4">
                            <span className={typeBadgeClass(row.type)}>{String(row.type || '').replace('_', ' ')}</span>
                          </td>
                          <td className="p-4">
                            <span className={accountBadge}>{account?.name || 'Account'}</span>
                          </td>
                          <td className="p-4 text-right text-green-400 font-medium">{row.inbound_cents ? formatMoney(row.inbound_cents) : '-'}</td>
                          <td className="p-4 text-right text-red-400 font-medium">{row.outbound_cents ? formatMoney(row.outbound_cents) : '-'}</td>
                          <td className="p-4">
                            <div className={`${statusBadgeClass(row.status)} pr-1`}>
                              <select
                                value={String(row.status || 'na').toLowerCase()}
                                onChange={(e) => void handleTableStatusChange(row.id, e.target.value)}
                                className="bg-transparent text-inherit text-xs font-medium outline-none cursor-pointer"
                              >
                                {statusOptions.map((statusOption) => (
                                  <option key={statusOption} value={statusOption} className="bg-slate-800 text-white">
                                    {statusLabel(statusOption)}
                                  </option>
                                ))}
                                <option value="__custom__" className="bg-slate-800 text-white">
                                  + Custom...
                                </option>
                              </select>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-slate-400">{event?.event_name || '-'}</td>
                          <td className={`p-4 text-right font-semibold ${balanceClass(row.running_balance_cents)}`}>
                            {formatMoney(row.running_balance_cents)}
                          </td>
                          <td className="p-4 text-center">
                            <div className="relative inline-block">
                              <button
                                type="button"
                                onClick={() => setRowActionMenuId((prev) => (prev === row.id ? null : row.id))}
                                className="text-slate-400 hover:text-white"
                              >
                                <i className="fa-solid fa-ellipsis-vertical" />
                              </button>
                              {rowActionMenuId === row.id ? (
                                <div className="absolute right-0 mt-1 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-20">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRowActionMenuId(null);
                                      openEditModal(row);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-t-lg"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRowActionMenuId(null);
                                      void duplicateRow(row);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                                  >
                                    Duplicate
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRowActionMenuId(null);
                                      void deleteRow(row.id);
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {isModalOpen && (
          <div
            id="add-transaction-modal"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setIsModalOpen(false)}
          >
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="glass-card rounded-xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">{editingRowId ? 'Edit Transaction' : 'Add Transaction'}</h2>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                    <i className="fa-solid fa-times" />
                  </button>
                </div>

                <form className="space-y-4" onSubmit={submitAddTransaction}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                      <input
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        type="date"
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
                      <select
                        value={formType}
                        onChange={(e) => setFormType(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      >
                        <option value="invoice">Invoice</option>
                        <option value="payment">Payment</option>
                        <option value="expense">Expense</option>
                        <option value="transfer">Transfer</option>
                        <option value="adjustment">Adjustment</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                    <input
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      type="text"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="Transaction description"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Account</label>
                      <select
                        value={formAccountId}
                        onChange={(e) => setFormAccountId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      >
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Amount</label>
                      <div className="flex">
                        <select
                          value={formDirection}
                          onChange={(e) => setFormDirection(e.target.value as 'in' | 'out')}
                          className="bg-slate-800 border border-slate-600 rounded-l-lg px-3 py-2 text-white border-r-0"
                        >
                          <option value="in">In</option>
                          <option value="out">Out</option>
                        </select>
                        <input
                          value={formAmount}
                          onChange={(e) => setFormAmount(e.target.value)}
                          type="number"
                          className="flex-1 bg-slate-800 border border-slate-600 rounded-r-lg px-3 py-2 text-white"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                      <select
                        value={formStatus}
                        onChange={(e) => handleFormStatusChange(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      >
                        {statusOptions.map((statusOption) => (
                          <option key={statusOption} value={statusOption}>
                            {statusLabel(statusOption)}
                          </option>
                        ))}
                        <option value="__custom__">+ Custom...</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Event Tag</label>
                      <select
                        value={formEventId}
                        onChange={(e) => setFormEventId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      >
                        <option value="">Select event...</option>
                        {allocations.map((allocation) => (
                          <option key={allocation.id} value={allocation.id}>
                            {allocation.event_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                    <textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white h-20"
                      placeholder="Additional notes..."
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      {editingRowId ? 'Save Changes' : 'Add Transaction'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setEditingRowId(null);
                      }}
                      className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </IgniteBackofficeLayout>
  );
}
