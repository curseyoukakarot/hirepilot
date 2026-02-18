import React, { useMemo, useState } from 'react';
import IgniteBackofficeLayout from './components/IgniteBackofficeLayout';
import './igniteBackoffice.css';
import { apiGet, apiPatch, apiPost } from '../../lib/api';

type AccountState = {
  id: string | null;
  name: string;
  balance: number;
  notes: string;
  lastUpdated: string;
  source: string;
};

type AccountKey = 'operating' | 'savings' | 'credit';

type SettingsState = {
  safeThresholdDollars: number;
  warningThresholdDollars: number;
  dangerThresholdDollars: number;
  useNetCash: boolean;
  dangerIncludesNegative: boolean;
};

const initialAccounts: Record<AccountKey, AccountState> = {
  operating: {
    id: null,
    name: 'Operating Account',
    balance: 0,
    notes: '',
    lastUpdated: '-',
    source: 'Manual',
  },
  savings: {
    id: null,
    name: 'Savings Account',
    balance: 0,
    notes: '',
    lastUpdated: '-',
    source: 'Manual',
  },
  credit: {
    id: null,
    name: 'Credit Card Float',
    balance: 0,
    notes: '',
    lastUpdated: '-',
    source: 'Manual',
  },
};

function formatMoney(amount: number) {
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(
    Math.abs(amount)
  );
  return amount < 0 ? `-${formatted}` : formatted;
}

function balanceToStoredCents(type: AccountKey, balance: number): number {
  const cents = Math.round(balance * 100);
  if (type === 'credit') return Math.abs(cents);
  return cents;
}

function storedCentsToBalance(type: AccountKey, cents: number): number {
  if (type === 'credit') return -Math.abs(cents) / 100;
  return cents / 100;
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return (
    parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' +
    parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  );
}

function syncSourceLabel(source?: string) {
  const normalized = String(source || 'manual').toLowerCase();
  if (normalized === 'zapier') return 'Synced via Zapier';
  if (normalized === 'quickbooks') return 'Synced via QuickBooks';
  return 'Manual';
}

function centsToDollars(value: number): number {
  return Math.round(Number(value || 0)) / 100;
}

function dollarsToCents(value: number): number {
  return Math.round(Number(value || 0) * 100);
}

function riskTag(valueCents: number, settings: SettingsState): 'safe' | 'warning' | 'danger' {
  const safe = dollarsToCents(settings.safeThresholdDollars);
  const warning = dollarsToCents(settings.warningThresholdDollars);
  if (valueCents >= safe) return 'safe';
  if (valueCents >= warning) return 'warning';
  return 'danger';
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Record<AccountKey, AccountState>>(initialAccounts);
  const [editingKey, setEditingKey] = useState<AccountKey | null>(null);
  const [modalBalance, setModalBalance] = useState('');
  const [modalDatetime, setModalDatetime] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsState>({
    safeThresholdDollars: 50000,
    warningThresholdDollars: 10000,
    dangerThresholdDollars: 9000,
    useNetCash: true,
    dangerIncludesNegative: true,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const loadAccounts = async () => {
    try {
      setError(null);
      setLoading(true);
      const [accountsResponse, settingsResponse] = await Promise.all([
        apiGet('/api/ignite/backoffice/accounts'),
        apiGet('/api/ignite/backoffice/settings'),
      ]);
      const list = ((accountsResponse as any)?.accounts || []) as Array<{
        id: string;
        name: string;
        type: AccountKey;
        current_balance_cents: number;
        sync_source?: string;
        last_synced_at?: string | null;
        notes?: string | null;
      }>;

      const next = { ...initialAccounts };
      for (const row of list) {
        const key = row.type as AccountKey;
        if (!next[key]) continue;
        next[key] = {
          ...next[key],
          id: row.id,
          name: row.name || next[key].name,
          balance: storedCentsToBalance(key, Number(row.current_balance_cents || 0)),
          notes: row.notes ? String(row.notes) : next[key].notes,
          source: syncSourceLabel(row.sync_source),
          lastUpdated: row.last_synced_at ? formatDateTime(row.last_synced_at) : next[key].lastUpdated,
        };
      }
      setAccounts(next);

      const loadedSettings = (settingsResponse as any)?.settings as
        | {
            safe_threshold_cents?: number;
            warning_threshold_cents?: number;
            danger_threshold_cents?: number;
            use_net_cash?: boolean;
          }
        | undefined;
      if (loadedSettings) {
        setSettings({
          safeThresholdDollars: centsToDollars(Number(loadedSettings.safe_threshold_cents ?? 5000000)),
          warningThresholdDollars: centsToDollars(Number(loadedSettings.warning_threshold_cents ?? 1000000)),
          dangerThresholdDollars: centsToDollars(Number(loadedSettings.danger_threshold_cents ?? 900000)),
          useNetCash: Boolean(loadedSettings.use_net_cash ?? true),
          dangerIncludesNegative: true,
        });
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadAccounts();
  }, []);

  const modalTitle = useMemo(() => {
    if (!editingKey) return 'Edit Account';
    return `Edit ${accounts[editingKey].name}`;
  }, [editingKey, accounts]);

  const openEditModal = (key: AccountKey) => {
    const now = new Date().toISOString().slice(0, 16);
    setEditingKey(key);
    setModalBalance(String(accounts[key].balance));
    setModalDatetime(now);
    setModalNotes(accounts[key].notes);
  };

  const closeEditModal = () => {
    setEditingKey(null);
    setModalBalance('');
    setModalDatetime('');
    setModalNotes('');
  };

  const saveAccount = () => {
    if (!editingKey) return;
    const updatedBalance = Number(modalBalance || 0);
    const accountId = accounts[editingKey].id;

    const persist = async () => {
      try {
        setError(null);
        if (accountId) {
          await apiPatch(`/api/ignite/backoffice/accounts/${accountId}`, {
            current_balance_cents: balanceToStoredCents(editingKey, updatedBalance),
            notes: modalNotes,
            last_synced_at: modalDatetime ? new Date(modalDatetime).toISOString() : new Date().toISOString(),
          });
        } else {
          await apiPost('/api/ignite/backoffice/accounts/sync', {
            accounts: [
              {
                type: editingKey,
                name: accounts[editingKey].name,
                current_balance_cents: balanceToStoredCents(editingKey, updatedBalance),
                currency: 'USD',
                sync_source: 'manual',
                last_synced_at: modalDatetime ? new Date(modalDatetime).toISOString() : new Date().toISOString(),
                notes: modalNotes,
              },
            ],
          });
        }
        setAccounts((prev) => ({
          ...prev,
          [editingKey]: {
            ...prev[editingKey],
            balance: updatedBalance,
            notes: modalNotes,
            lastUpdated: formatDateTime(modalDatetime),
            source: syncSourceLabel('manual'),
          },
        }));
        await loadAccounts();
        closeEditModal();
      } catch (e: any) {
        setError(e?.message || 'Failed to update account');
      }
    };
    void persist();
  };

  const saveSettings = async () => {
    try {
      setSettingsSaving(true);
      setSettingsSaved(false);
      setError(null);
      await apiPatch('/api/ignite/backoffice/settings', {
        safe_threshold_cents: dollarsToCents(settings.safeThresholdDollars),
        warning_threshold_cents: dollarsToCents(settings.warningThresholdDollars),
        danger_threshold_cents: dollarsToCents(settings.dangerThresholdDollars),
        use_net_cash: settings.useNetCash,
      });
      setSettingsSaved(true);
      window.setTimeout(() => setSettingsSaved(false), 2000);
    } catch (e: any) {
      setError(e?.message || 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const operatingCents = Math.round(accounts.operating.balance * 100);
  const savingsCents = Math.round(accounts.savings.balance * 100);
  const creditCents = Math.round(accounts.credit.balance * 100);
  const currentMetricCents = settings.useNetCash ? operatingCents + savingsCents + creditCents : operatingCents;
  const currentRisk = riskTag(currentMetricCents, settings);
  const previewRowClass =
    currentRisk === 'safe'
      ? 'flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg'
      : currentRisk === 'warning'
        ? 'flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg'
        : 'flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-lg';

  if (loading) {
    return (
      <IgniteBackofficeLayout>
        <div className="p-8 text-sm text-gray-400">Loading accounts...</div>
      </IgniteBackofficeLayout>
    );
  }

  return (
    <IgniteBackofficeLayout>
      <div className="ignite-backoffice-scrollbar-hide bg-gray-950 font-inter min-h-screen">
        <div id="main-container" className="w-full max-w-[1440px] mx-auto min-h-[1024px]">
          <header id="header" className="bg-gray-900 border-b border-gray-800 px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-white">Accounts</h1>
                <p className="text-gray-400 mt-1">Manage balances and risk thresholds.</p>
              </div>
              <button
                type="button"
                onClick={() => void loadAccounts()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors"
              >
                <i className="fa-solid fa-sync mr-2" />
                Sync All
              </button>
            </div>
            {error ? <p className="text-xs text-red-400 mt-3">{error}</p> : null}
          </header>

          <main id="main-content" className="px-8 py-6">
            <section id="account-cards-section" className="mb-8">
              <div className="grid grid-cols-3 gap-6">
                <div
                  id="operating-account-card"
                  className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:shadow-xl hover:shadow-blue-500/10 transition-all hover:border-gray-700"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mr-3">
                        <i className="fa-solid fa-building-columns text-blue-400 text-lg" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{accounts.operating.name}</h3>
                        <p className="text-sm text-gray-500">{accounts.operating.source}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => openEditModal('operating')} className="text-gray-500 hover:text-gray-300">
                      <i className="fa-solid fa-pen text-sm" />
                    </button>
                  </div>
                  <div className="mb-3">
                    <div className="text-3xl font-bold text-white mb-1">{formatMoney(accounts.operating.balance)}</div>
                    <p className="text-sm text-gray-500">Last updated: {accounts.operating.lastUpdated}</p>
                  </div>
                  <div className="text-sm text-gray-400">
                    <p>Notes: {accounts.operating.notes}</p>
                  </div>
                </div>

                <div
                  id="savings-account-card"
                  className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:shadow-xl hover:shadow-green-500/10 transition-all hover:border-gray-700"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mr-3">
                        <i className="fa-solid fa-piggy-bank text-green-400 text-lg" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{accounts.savings.name}</h3>
                        <p className="text-sm text-gray-500">{accounts.savings.source}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => openEditModal('savings')} className="text-gray-500 hover:text-gray-300">
                      <i className="fa-solid fa-pen text-sm" />
                    </button>
                  </div>
                  <div className="mb-3">
                    <div className="text-3xl font-bold text-white mb-1">{formatMoney(accounts.savings.balance)}</div>
                    <p className="text-sm text-gray-500">Last updated: {accounts.savings.lastUpdated}</p>
                  </div>
                  <div className="text-sm text-gray-400">
                    <p>Notes: {accounts.savings.notes}</p>
                  </div>
                </div>

                <div
                  id="credit-card-card"
                  className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:shadow-xl hover:shadow-orange-500/10 transition-all hover:border-gray-700"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center mr-3">
                        <i className="fa-solid fa-credit-card text-orange-400 text-lg" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{accounts.credit.name}</h3>
                        <p className="text-sm text-gray-500">{accounts.credit.source}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => openEditModal('credit')} className="text-gray-500 hover:text-gray-300">
                      <i className="fa-solid fa-pen text-sm" />
                    </button>
                  </div>
                  <div className="mb-3">
                    <div className={`text-3xl font-bold mb-1 ${accounts.credit.balance < 0 ? 'text-red-400' : 'text-white'}`}>
                      {formatMoney(accounts.credit.balance)}
                    </div>
                    <p className="text-sm text-gray-500">Last updated: {accounts.credit.lastUpdated}</p>
                  </div>
                  <div className="text-sm text-gray-400">
                    <p>Notes: {accounts.credit.notes}</p>
                  </div>
                </div>
              </div>
            </section>

            <section id="risk-threshold-section" className="mb-8">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-xl font-semibold text-white mb-6">Risk Threshold Settings</h2>

                <div className="grid grid-cols-2 gap-8">
                  <div id="threshold-config">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Safe Threshold (Green)</label>
                        <div className="flex items-center">
                          <span className="text-gray-500 mr-2">Above $</span>
                          <input
                            type="number"
                            value={settings.safeThresholdDollars}
                            onChange={(e) =>
                              setSettings((prev) => ({ ...prev, safeThresholdDollars: Number(e.target.value || 0) }))
                            }
                            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 w-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Warning Threshold (Amber)</label>
                        <div className="flex items-center">
                          <span className="text-gray-500 mr-2">$</span>
                          <input
                            type="number"
                            value={settings.warningThresholdDollars}
                            onChange={(e) =>
                              setSettings((prev) => ({ ...prev, warningThresholdDollars: Number(e.target.value || 0) }))
                            }
                            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 w-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="text-gray-500 mx-2">to $</span>
                          <input
                            type="number"
                            value={settings.safeThresholdDollars}
                            onChange={(e) =>
                              setSettings((prev) => ({ ...prev, safeThresholdDollars: Number(e.target.value || 0) }))
                            }
                            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 w-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Danger Threshold (Red)</label>
                        <div className="flex items-center">
                          <span className="text-gray-500 mr-2">Below $</span>
                          <input
                            type="number"
                            value={settings.dangerThresholdDollars}
                            onChange={(e) =>
                              setSettings((prev) => ({ ...prev, dangerThresholdDollars: Number(e.target.value || 0) }))
                            }
                            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 w-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="border-t border-gray-800 pt-4 space-y-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings.dangerIncludesNegative}
                            onChange={(e) =>
                              setSettings((prev) => ({ ...prev, dangerIncludesNegative: e.target.checked }))
                            }
                            className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-300">Danger includes negative balances</span>
                        </label>

                        <div>
                          <p className="text-sm font-medium text-gray-300 mb-2">Calculation Method</p>
                          <label className="flex items-center mb-2">
                            <input
                              type="radio"
                              name="calculation"
                              value="operating"
                              checked={!settings.useNetCash}
                              onChange={() => setSettings((prev) => ({ ...prev, useNetCash: false }))}
                              className="text-blue-600 bg-gray-800 border-gray-700 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-300">Use Operating Account only</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="calculation"
                              value="net"
                              checked={settings.useNetCash}
                              onChange={() => setSettings((prev) => ({ ...prev, useNetCash: true }))}
                              className="text-blue-600 bg-gray-800 border-gray-700 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-300">Net Cash (Operating + Savings - Credit Card)</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div id="threshold-preview">
                    <h3 className="font-medium text-white mb-4">Preview</h3>
                    <div className="space-y-3">
                      <div className={previewRowClass}>
                        <span className="text-sm text-gray-300">
                          {formatMoney(currentMetricCents / 100)} {settings.useNetCash ? 'Net Cash' : 'Operating Cash'}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            currentRisk === 'safe'
                              ? 'bg-green-500/20 text-green-400'
                              : currentRisk === 'warning'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {currentRisk.charAt(0).toUpperCase() + currentRisk.slice(1)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <span className="text-sm text-gray-300">
                          Warning range starts at {formatMoney(settings.warningThresholdDollars)}
                        </span>
                        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-medium rounded">Warning</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <span className="text-sm text-gray-300">Danger below {formatMoney(settings.dangerThresholdDollars)}</span>
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-medium rounded">Danger</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void saveSettings()}
                    disabled={settingsSaving}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-60"
                  >
                    {settingsSaving ? 'Saving...' : settingsSaved ? 'Saved' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </section>

            <section id="quickbooks-integration-section">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 opacity-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center mr-4">
                      <i className="fa-solid fa-link text-gray-600 text-lg" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">Connect QuickBooks</h3>
                      <p className="text-sm text-gray-500">Will sync balances automatically (coming soon)</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="bg-gray-800 text-gray-600 px-4 py-2 rounded-lg cursor-not-allowed"
                  >
                    <i className="fa-solid fa-lock mr-2" />
                    Coming Soon
                  </button>
                </div>
              </div>
            </section>
          </main>
        </div>

        {editingKey && (
          <div
            id="edit-modal"
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
            onClick={closeEditModal}
          >
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-96 max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 id="modal-title" className="text-lg font-semibold text-white">
                  {modalTitle}
                </h3>
                <button type="button" onClick={closeEditModal} className="text-gray-500 hover:text-gray-300">
                  <i className="fa-solid fa-times" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Balance</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      id="modal-balance"
                      type="number"
                      value={modalBalance}
                      onChange={(e) => setModalBalance(e.target.value)}
                      className="bg-gray-800 border border-gray-700 text-white rounded-lg pl-8 pr-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Effective Date/Time</label>
                  <input
                    id="modal-datetime"
                    type="datetime-local"
                    value={modalDatetime}
                    onChange={(e) => setModalDatetime(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                  <textarea
                    id="modal-notes"
                    rows={3}
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Bank nickname or additional notes"
                  />
                </div>
              </div>

              <div className="flex justify-end mt-6 space-x-3">
                <button type="button" onClick={closeEditModal} className="px-4 py-2 text-gray-600 hover:text-gray-300 transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={saveAccount} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </IgniteBackofficeLayout>
  );
}
