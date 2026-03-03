import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ConnectLinkedInModal from './ConnectLinkedInModal';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SniperSettings = {
  cloud_engine_enabled: boolean;
  provider: 'airtop' | 'extension_only' | 'agentic_browser';
  max_actions_per_day: number;
  max_actions_per_hour: number;
  min_delay_seconds: number;
  max_delay_seconds: number;
  active_hours_start: string;
  active_hours_end: string;
  run_on_weekends: boolean;
  timezone: string;
  safety_mode: boolean;
};

type AuthStatus = {
  connected: boolean;
  provider?: string | null;
  profile_id?: string | null;
  browserbase_context_id?: string | null;
};

type Props = {
  conn: { connected: boolean; profileId?: string };
  onStatusChange: () => void;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/*  API helpers                                                        */
/* ------------------------------------------------------------------ */

const API_BASE = (import.meta.env.VITE_BACKEND_URL ? `${import.meta.env.VITE_BACKEND_URL}` : '').replace(/\/$/, '');
const API_ROOT = API_BASE ? `${API_BASE}/api` : '/api';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGet<T>(path: string): Promise<T> {
  const url = `${API_ROOT}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, { credentials: 'include', headers: await authHeaders() });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Request failed: ${res.status}`);
  try { return JSON.parse(text) as T; } catch { return {} as T; }
}

async function apiPut<T>(path: string, body: any): Promise<T> {
  const url = `${API_ROOT}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Request failed: ${res.status}`);
  try { return JSON.parse(text) as T; } catch { return {} as T; }
}

async function apiPost<T>(path: string, body: any): Promise<T> {
  const url = `${API_ROOT}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Request failed: ${res.status}`);
  try { return JSON.parse(text) as T; } catch { return {} as T; }
}

/* ------------------------------------------------------------------ */
/*  Toast                                                              */
/* ------------------------------------------------------------------ */

function Toast({ show, message, type }: { show: boolean; message: string; type: string }) {
  if (!show) return null;
  return (
    <div className="fixed top-5 right-5 z-[9999]">
      <div className={cx(
        'rounded-xl border px-4 py-3 shadow-lg backdrop-blur text-sm font-semibold',
        'bg-white/90 dark:bg-slate-900/90',
        type === 'success' && 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300',
        type === 'error' && 'border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300',
        type === 'info' && 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300',
      )}>
        {message}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SettingsPanel                                                      */
/* ------------------------------------------------------------------ */

export default function SettingsPanel({ conn, onStatusChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SniperSettings | null>(null);
  const [airtop, setAirtop] = useState<AuthStatus | null>(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  // Auth modal state
  const [authOpen, setAuthOpen] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authSessionId, setAuthSessionId] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);

  const showToast = (message: string, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 2500);
  };

  const cloudEnabled = !!settings?.cloud_engine_enabled;
  const isBrowserbase = settings?.provider === 'agentic_browser';

  /* ---- Load ---- */
  const load = async () => {
    setLoading(true);
    try {
      const s = await apiGet<SniperSettings>('/sniper/settings');
      setSettings(s);
      if (s.cloud_engine_enabled) {
        const a = await apiGet<AuthStatus>('/sniper/linkedin/auth/status');
        setAirtop(a);
      } else {
        setAirtop({ connected: false, profile_id: null });
      }
    } catch (e: any) {
      showToast(`Failed to load: ${e?.message || 'Unknown'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /* ---- Toggle cloud engine ---- */
  const handleToggleCloud = async () => {
    if (!settings) return;
    const nextEnabled = !settings.cloud_engine_enabled;
    const next: SniperSettings = {
      ...settings,
      cloud_engine_enabled: nextEnabled,
      provider: nextEnabled ? 'agentic_browser' : 'extension_only',
    };
    setSettings(next);
    setSaving(true);
    try {
      await apiPut('/sniper/settings', next);
      showToast(nextEnabled ? 'Cloud Engine enabled' : 'Cloud Engine disabled', 'success');
      await load();
      onStatusChange();
    } catch (e: any) {
      showToast(`Failed: ${e?.message || 'Unknown'}`, 'error');
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  /* ---- Connect LinkedIn ---- */
  const handleConnect = async () => {
    if (!cloudEnabled) { showToast('Enable Cloud Engine first.', 'info'); return; }
    setConnectLoading(true);
    try {
      const endpoint = isBrowserbase ? '/sniper/linkedin/auth/start-browserbase' : '/sniper/linkedin/auth/start';
      const resp = await apiPost<{ url?: string; live_view_url?: string; auth_session_id?: string }>(endpoint, {});
      if (resp?.auth_session_id) setAuthSessionId(resp.auth_session_id);
      const liveUrl = resp?.live_view_url || resp?.url;
      if (!liveUrl) throw new Error('Missing live view URL');
      setAuthError(null);
      setAuthUrl(liveUrl);
      setAuthOpen(true);
    } catch (e: any) {
      showToast(`Connect failed: ${e?.message || 'Unknown'}`, 'error');
    } finally {
      setConnectLoading(false);
    }
  };

  const handleAuthComplete = async () => {
    if (!authSessionId) { setAuthError('Missing auth session. Restart the connect flow.'); return; }
    setAuthBusy(true);
    setAuthError(null);
    try {
      const endpoint = isBrowserbase ? '/sniper/linkedin/auth/complete-browserbase' : '/sniper/linkedin/auth/complete';
      await apiPost(endpoint, { auth_session_id: authSessionId });
      const a = await apiGet<AuthStatus>('/sniper/linkedin/auth/status');
      setAirtop(a);
      showToast(a.connected ? 'LinkedIn connected!' : 'Not connected yet.', a.connected ? 'success' : 'info');
      if (a.connected) { setAuthOpen(false); setAuthUrl(null); onStatusChange(); }
    } catch (e: any) {
      setAuthError(String(e?.message || 'Unknown'));
      showToast(`Failed: ${e?.message || 'Unknown'}`, 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRefresh = async () => {
    if (!cloudEnabled) return;
    try {
      if (authSessionId) {
        try {
          const endpoint = isBrowserbase ? '/sniper/linkedin/auth/complete-browserbase' : '/sniper/linkedin/auth/complete';
          await apiPost(endpoint, { auth_session_id: authSessionId });
        } catch {}
      }
      const a = await apiGet<AuthStatus>('/sniper/linkedin/auth/status');
      setAirtop(a);
      showToast(a.connected ? 'LinkedIn connected.' : 'Not connected.', a.connected ? 'success' : 'info');
      onStatusChange();
    } catch (e: any) {
      showToast(`Refresh failed: ${e?.message || 'Unknown'}`, 'error');
    }
  };

  /* ---- Save guardrails ---- */
  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await apiPut('/sniper/settings', settings);
      showToast('Settings saved.', 'success');
    } catch (e: any) {
      showToast(`Failed: ${e?.message || 'Unknown'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ---- Loading state ---- */
  if (loading || !settings) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-slate-600 dark:text-slate-300">Loading settings…</span>
        </div>
      </div>
    );
  }

  /* ---- Render ---- */
  return (
    <div className="space-y-6">
      <Toast show={toast.show} message={toast.message} type={toast.type} />

      <ConnectLinkedInModal
        open={authOpen}
        authUrl={authUrl}
        authError={authError}
        authBusy={authBusy}
        onClose={() => setAuthOpen(false)}
        onComplete={handleAuthComplete}
        onReload={() => {}}
        onOpenNewTab={() => { if (authUrl) window.open(authUrl, '_blank', 'noopener,noreferrer'); }}
      />

      {/* ═══ Cloud Engine Card ═══ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Cloud Engine</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Use HirePilot's cloud browser to automate LinkedIn actions on your behalf.
            </p>
          </div>
          <button
            disabled={saving}
            onClick={handleToggleCloud}
            className={cx(
              'rounded-xl px-4 py-2 text-sm font-semibold transition',
              cloudEnabled
                ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-700'
                : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
              saving && 'opacity-60 cursor-not-allowed',
            )}
          >
            {cloudEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {cloudEnabled ? (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* LinkedIn status */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">LinkedIn Status</div>
              <div className="mt-1 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${airtop?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="text-sm font-bold">{airtop?.connected ? 'Connected' : 'Not connected'}</span>
              </div>
              {airtop?.profile_id && (
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Profile: {airtop.profile_id}</div>
              )}
            </div>

            {/* Connect */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Connect LinkedIn</div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleConnect}
                  disabled={connectLoading}
                  className={cx(
                    'flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-white',
                    connectLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500',
                  )}
                >
                  {connectLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Starting…
                    </span>
                  ) : 'Connect'}
                </button>
                <button
                  onClick={handleRefresh}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Check
                </button>
              </div>
            </div>

            {/* Provider */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Provider</div>
              <div className="mt-2">
                <span className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">
                  HirePilot Cloud Engine
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                AI agent with cloud browser automation.
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-950">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Extension Only Mode</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Cloud actions are disabled. Enable Cloud Engine to automate LinkedIn.
            </p>
          </div>
        )}
      </div>

      {/* ═══ Guardrails ═══ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Guardrails</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Throttle actions to reduce risk and keep your LinkedIn account safe.
            </p>
          </div>
          <button
            disabled={saving}
            onClick={handleSave}
            className={cx(
              'rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500',
              saving && 'opacity-60 cursor-not-allowed',
            )}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Rate Limits */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
            <h4 className="text-sm font-bold">Rate Limits</h4>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Control how fast the engine operates.
            </p>
            <div className="mt-4 space-y-4">
              <FieldNumber label="Max actions / day" value={settings.max_actions_per_day} onChange={(v) => setSettings({ ...settings, max_actions_per_day: v })} />
              <FieldNumber label="Max actions / hour" value={settings.max_actions_per_hour} onChange={(v) => setSettings({ ...settings, max_actions_per_hour: v })} />
              <FieldNumber label="Min delay (seconds)" value={settings.min_delay_seconds} onChange={(v) => setSettings({ ...settings, min_delay_seconds: v })} />
              <FieldNumber label="Max delay (seconds)" value={settings.max_delay_seconds} onChange={(v) => setSettings({ ...settings, max_delay_seconds: v })} />
            </div>
          </div>

          {/* Right: Operating Hours */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
            <h4 className="text-sm font-bold">Operating Hours</h4>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              When your automation is allowed to run.
            </p>
            <div className="mt-4 space-y-4">
              <FieldTime label="Start time" value={settings.active_hours_start} onChange={(v) => setSettings({ ...settings, active_hours_start: v })} />
              <FieldTime label="End time" value={settings.active_hours_end} onChange={(v) => setSettings({ ...settings, active_hours_end: v })} />
              <FieldText label="Timezone" value={settings.timezone} placeholder="America/Chicago" onChange={(v) => setSettings({ ...settings, timezone: v })} />
              <FieldToggle label="Run on weekends" value={settings.run_on_weekends} onChange={(v) => setSettings({ ...settings, run_on_weekends: v })} description="Allow automation on Saturdays and Sundays." />
              <FieldToggle label="Safety mode" value={settings.safety_mode} onChange={(v) => setSettings({ ...settings, safety_mode: v })} description="Extra caution on rate limits." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Field Components                                                   */
/* ------------------------------------------------------------------ */

function FieldNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
  );
}

function FieldTime({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
  );
}

function FieldText({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
  );
}

function FieldToggle({ label, value, description, onChange }: { label: string; value: boolean; description?: string; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
        {description && <p className="text-xs text-slate-400 dark:text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cx(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          value ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700',
        )}
      >
        <span
          className={cx(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform',
            value ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}
