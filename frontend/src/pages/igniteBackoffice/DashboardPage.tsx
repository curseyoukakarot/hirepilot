import React, { useEffect, useMemo, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import IgniteBackofficeLayout from './components/IgniteBackofficeLayout';
import { apiGet } from '../../lib/api';

type DashboardResponse = {
  operating_available_cents: number;
  total_held_cents: number;
  net_cash_cents: number;
  forecast_low_30d_cents: number;
  cash_timeline: Array<{ date: string; balance_cents: number; risk_level: 'safe' | 'warning' | 'danger' }>;
  upcoming_holds: Array<{ id: string; date: string; description: string; outbound_cents: number; status: string }>;
  active_allocations_summary: Array<{
    id: string;
    client_name: string;
    event_name: string;
    status: string;
    funding_received_cents: number;
    held_amount_cents: number;
    expected_margin_cents: number;
  }>;
};

type AccountRow = {
  id: string;
  name: string;
  type: 'operating' | 'savings' | 'credit';
  current_balance_cents: number;
  last_synced_at?: string | null;
};

function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((value || 0) / 100);
}

function formatDateLabel(dateString: string) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function riskBadge(valueCents: number) {
  if (valueCents >= 5000000) return { label: 'SAFE', className: 'px-3 py-1 bg-green-500/10 text-green-400 text-xs font-semibold rounded-full' };
  if (valueCents >= 1000000)
    return { label: 'WARNING', className: 'px-3 py-1 bg-yellow-500/10 text-yellow-400 text-xs font-semibold rounded-full' };
  return { label: 'DANGER', className: 'px-3 py-1 bg-red-500/10 text-red-400 text-xs font-semibold rounded-full' };
}

export default function DashboardPage() {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setError(null);
      setLoading(true);
      const [dashboardRes, accountsRes] = await Promise.all([
        apiGet('/api/ignite/backoffice/dashboard'),
        apiGet('/api/ignite/backoffice/accounts'),
      ]);
      setDashboard(dashboardRes as DashboardResponse);
      setAccounts((accountsRes as any)?.accounts || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const accountByType = useMemo(() => {
    const firstByType = (type: AccountRow['type']) => accounts.find((row) => row.type === type) || null;
    return {
      operating: firstByType('operating'),
      savings: firstByType('savings'),
      credit: firstByType('credit'),
    };
  }, [accounts]);

  useEffect(() => {
    if (!chartRef.current || !dashboard) return;

    const dates = dashboard.cash_timeline.map((row) => row.date);
    const balances = dashboard.cash_timeline.map((row) => (row.balance_cents || 0) / 100);
    const safeThreshold = dates.map(() => 50000);
    const warningThreshold = dates.map(() => 10000);

    Plotly.newPlot(
      chartRef.current,
      [
        {
          x: dates,
          y: balances,
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Balance',
          line: { color: '#3b82f6', width: 3 },
          marker: { color: '#60a5fa', size: 6 },
        },
        {
          x: dates,
          y: safeThreshold,
          type: 'scatter',
          mode: 'lines',
          name: 'Safe Threshold',
          line: { color: '#22c55e', width: 2, dash: 'dot' },
        },
        {
          x: dates,
          y: warningThreshold,
          type: 'scatter',
          mode: 'lines',
          name: 'Danger Threshold',
          line: { color: '#ef4444', width: 2, dash: 'dot' },
        },
      ],
      {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 50, r: 20, t: 12, b: 40 },
        font: { color: '#9ca3af', family: 'Inter, sans-serif' },
        xaxis: { gridcolor: '#1f2937', linecolor: '#374151' },
        yaxis: { gridcolor: '#1f2937', linecolor: '#374151', tickprefix: '$' },
        legend: { orientation: 'h', y: 1.14 },
      },
      { displayModeBar: false, responsive: true }
    );

    return () => {
      if (chartRef.current) Plotly.purge(chartRef.current);
    };
  }, [dashboard]);

  const operatingBadge = riskBadge(dashboard?.operating_available_cents || 0);
  const netBadge = riskBadge(dashboard?.net_cash_cents || 0);
  const forecastBadge = riskBadge(dashboard?.forecast_low_30d_cents || 0);

  if (loading) {
    return (
      <IgniteBackofficeLayout>
        <div className="p-8 text-sm text-gray-400">Loading dashboard...</div>
      </IgniteBackofficeLayout>
    );
  }

  if (error || !dashboard) {
    return (
      <IgniteBackofficeLayout>
        <div className="p-8">
          <p className="text-sm text-red-400">{error || 'Unable to load dashboard'}</p>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Retry
          </button>
        </div>
      </IgniteBackofficeLayout>
    );
  }

  return (
    <IgniteBackofficeLayout>
      <header
        id="header"
        className="bg-dark-800 border-b border-gray-800 px-8 py-5 flex items-center justify-between sticky top-0 z-10"
      >
        <div>
          <h2 className="text-2xl font-bold text-white">Cashflow Control Center</h2>
          <p className="text-sm text-gray-400 mt-1">Real-time financial overview and risk monitoring</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="px-4 py-2 bg-dark-700 text-gray-300 rounded-lg hover:bg-dark-600 transition flex items-center gap-2"
          >
            <i className="fa-solid fa-download" />
            <span className="text-sm font-medium">Export</span>
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <i className="fa-solid fa-plus" />
            <span className="text-sm font-medium">Add Transaction</span>
          </button>
        </div>
      </header>

      <div id="dashboard-content" className="p-8">
        <section id="kpi-cards" className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-dark-800 border border-green-500/30 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -mr-16 -mt-16" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-dollar-sign text-green-500 text-xl" />
                </div>
                <span className={operatingBadge.className}>{operatingBadge.label}</span>
              </div>
              <h3 className="text-gray-400 text-sm font-medium mb-2">Operating Cash Available</h3>
              <p className="text-3xl font-bold text-white mb-1">{formatCurrencyFromCents(dashboard.operating_available_cents)}</p>
              <p className="text-xs text-green-400 flex items-center gap-1">
                <i className="fa-solid fa-arrow-up" />
                <span>Live from ledger + accounts</span>
              </p>
            </div>
          </div>

          <div className="bg-dark-800 border border-blue-500/30 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-lock text-blue-500 text-xl" />
                </div>
                <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-semibold rounded-full">HELD</span>
              </div>
              <h3 className="text-gray-400 text-sm font-medium mb-2">Total Held for Events</h3>
              <p className="text-3xl font-bold text-white mb-1">{formatCurrencyFromCents(dashboard.total_held_cents)}</p>
              <p className="text-xs text-gray-400">Across active allocations</p>
            </div>
          </div>

          <div className="bg-dark-800 border border-yellow-500/30 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full -mr-16 -mt-16" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-chart-pie text-yellow-500 text-xl" />
                </div>
                <span className={netBadge.className}>{netBadge.label}</span>
              </div>
              <h3 className="text-gray-400 text-sm font-medium mb-2">Net Cash Position</h3>
              <p className="text-3xl font-bold text-white mb-1">{formatCurrencyFromCents(dashboard.net_cash_cents)}</p>
              <p className="text-xs text-yellow-400">Operating + Savings - CC</p>
            </div>
          </div>

          <div className="bg-dark-800 border border-red-500/30 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full -mr-16 -mt-16" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-exclamation-triangle text-red-500 text-xl" />
                </div>
                <span className={forecastBadge.className}>{forecastBadge.label}</span>
              </div>
              <h3 className="text-gray-400 text-sm font-medium mb-2">30-Day Forecast Low</h3>
              <p className="text-3xl font-bold text-white mb-1">{formatCurrencyFromCents(dashboard.forecast_low_30d_cents)}</p>
              <p className="text-xs text-red-400">Projected from timeline window</p>
            </div>
          </div>
        </section>

        <section id="risk-timeline" className="bg-dark-800 border border-gray-800 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white">Cash Risk Timeline</h3>
              <p className="text-sm text-gray-400 mt-1">90-day rolling balance forecast with risk thresholds</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="text-xs text-gray-400">Safe (&gt;$50k)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <span className="text-xs text-gray-400">Warning ($10k-$50k)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span className="text-xs text-gray-400">Danger (&lt;$10k)</span>
              </div>
            </div>
          </div>
          <div ref={chartRef} id="riskChart" style={{ height: '320px' }} />
        </section>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <section id="upcoming-holds" className="bg-dark-800 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Upcoming Holds &amp; Large Payments</h3>
              <button type="button" className="text-blue-400 text-sm hover:text-blue-300">
                View All
              </button>
            </div>
            <div className="space-y-3">
              {(dashboard.upcoming_holds || []).length === 0 ? (
                <div className="p-4 bg-dark-700 rounded-lg border border-gray-700">
                  <p className="text-sm text-gray-400">No upcoming holds yet.</p>
                </div>
              ) : (
                dashboard.upcoming_holds.slice(0, 5).map((row) => (
                  <div key={row.id} className="flex items-center gap-4 p-4 bg-dark-700 rounded-lg border border-red-500/20">
                    <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-circle-exclamation text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{row.description}</p>
                      <p className="text-xs text-gray-400 mt-1">Due: {formatDateLabel(row.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-400">-{formatCurrencyFromCents(row.outbound_cents)}</p>
                      <span className="inline-block px-2 py-1 bg-red-500/10 text-red-400 text-xs font-semibold rounded mt-1">
                        {String(row.status || 'hold').toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section id="event-allocations" className="bg-dark-800 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Active Event Allocations</h3>
              <button type="button" className="text-blue-400 text-sm hover:text-blue-300">
                Manage
              </button>
            </div>
            <div className="space-y-4">
              {(dashboard.active_allocations_summary || []).length === 0 ? (
                <div className="p-4 bg-dark-700 rounded-lg border border-gray-700">
                  <p className="text-sm text-gray-400">No active allocations yet.</p>
                </div>
              ) : (
                dashboard.active_allocations_summary.slice(0, 4).map((row) => {
                  const freeCash = (row.funding_received_cents || 0) - (row.held_amount_cents || 0);
                  const allocationRisk = riskBadge(freeCash);
                  return (
                    <div key={row.id} className="p-4 bg-dark-700 rounded-lg border border-gray-700">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-semibold text-white">{row.event_name || 'Event'}</h4>
                          <p className="text-xs text-gray-400 mt-1">{row.client_name || 'Client'}</p>
                        </div>
                        <span className={allocationRisk.className}>{allocationRisk.label}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-500">Received</p>
                          <p className="text-sm font-bold text-white mt-1">{formatCurrencyFromCents(row.funding_received_cents || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Held</p>
                          <p className="text-sm font-bold text-yellow-400 mt-1">{formatCurrencyFromCents(row.held_amount_cents || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Expected Margin</p>
                          <p className="text-sm font-bold text-blue-400 mt-1">{formatCurrencyFromCents(row.expected_margin_cents || 0)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                        <span className="text-xs text-gray-400">Free Cash Contribution</span>
                        <span className="text-sm font-bold text-white">{formatCurrencyFromCents(freeCash)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <section id="account-balances" className="bg-dark-800 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">Account Balances</h3>
            <button
              type="button"
              className="px-4 py-2 bg-dark-700 text-gray-300 rounded-lg hover:bg-dark-600 transition text-sm flex items-center gap-2"
            >
              <i className="fa-solid fa-sync-alt" />
              <span>Refresh Balances</span>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="p-6 bg-dark-700 rounded-lg border border-green-500/20">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-building-columns text-green-500 text-xl" />
                </div>
                <i className="fa-solid fa-arrow-up text-green-400 text-sm" />
              </div>
              <h4 className="text-sm text-gray-400 mb-2">Operating Account</h4>
              <p className="text-3xl font-bold text-white mb-2">
                {formatCurrencyFromCents(accountByType.operating?.current_balance_cents || 0)}
              </p>
              <p className="text-xs text-green-400">{accountByType.operating?.name || 'Operating'}</p>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-500">
                  Last updated: {accountByType.operating?.last_synced_at ? formatDateLabel(accountByType.operating.last_synced_at) : 'N/A'}
                </p>
              </div>
            </div>

            <div className="p-6 bg-dark-700 rounded-lg border border-blue-500/20">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-piggy-bank text-blue-500 text-xl" />
                </div>
                <i className="fa-solid fa-arrow-up text-blue-400 text-sm" />
              </div>
              <h4 className="text-sm text-gray-400 mb-2">Savings Account</h4>
              <p className="text-3xl font-bold text-white mb-2">{formatCurrencyFromCents(accountByType.savings?.current_balance_cents || 0)}</p>
              <p className="text-xs text-blue-400">{accountByType.savings?.name || 'Savings'}</p>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-500">
                  Last updated: {accountByType.savings?.last_synced_at ? formatDateLabel(accountByType.savings.last_synced_at) : 'N/A'}
                </p>
              </div>
            </div>

            <div className="p-6 bg-dark-700 rounded-lg border border-red-500/20">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-credit-card text-red-500 text-xl" />
                </div>
                <i className="fa-solid fa-arrow-down text-red-400 text-sm" />
              </div>
              <h4 className="text-sm text-gray-400 mb-2">Credit Card Balance</h4>
              <p className="text-3xl font-bold text-white mb-2">
                -{formatCurrencyFromCents(Math.abs(accountByType.credit?.current_balance_cents || 0))}
              </p>
              <p className="text-xs text-red-400">{accountByType.credit?.name || 'Credit Card'}</p>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-500">
                  Last updated: {accountByType.credit?.last_synced_at ? formatDateLabel(accountByType.credit.last_synced_at) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </IgniteBackofficeLayout>
  );
}
