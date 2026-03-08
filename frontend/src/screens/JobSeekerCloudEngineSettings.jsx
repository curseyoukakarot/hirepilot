import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ConnectLinkedInModal from '../pages/sniper/ConnectLinkedInModal';

function resolveApiBase() {
  const env = String(import.meta?.env?.VITE_BACKEND_URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.host.endsWith('thehirepilot.com')) return 'https://api.thehirepilot.com';
  return 'http://localhost:8080';
}

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function JobSeekerCloudEngineSettings() {
  const apiBase = useMemo(() => resolveApiBase(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [profileId, setProfileId] = useState(null);
  const [settings, setSettings] = useState({
    daily_job_page_limit: 50,
    daily_profile_limit: 100,
    max_concurrency: 1,
    cooldown_minutes: 30,
    notify_email: true,
    notify_inapp: true
  });

  // Browserbase auth modal state
  const [authOpen, setAuthOpen] = useState(false);
  const [authUrl, setAuthUrl] = useState(null);
  const [authSessionId, setAuthSessionId] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [connectLoading, setConnectLoading] = useState(false);

  const apiFetch = useCallback(
    async (path, init) => {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const headers = {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      const resp = await fetch(`${apiBase}${path}`, { ...init, headers, credentials: 'include' });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || 'request_failed');
      return json;
    },
    [apiBase]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/jobseeker/settings/cloud-engine');
      setSettings((prev) => ({ ...prev, ...(res?.settings || {}) }));
      setConnected(Boolean(res?.connected));
      setProfileId(res?.profile_id || null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/jobseeker/settings/cloud-engine', {
        method: 'PATCH',
        body: JSON.stringify(settings)
      });
      setSettings((prev) => ({ ...prev, ...(res?.settings || {}) }));
    } catch (e) {
      window.alert(e?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Start Browserbase auth flow
  const handleConnect = async () => {
    setConnectLoading(true);
    try {
      const res = await apiFetch('/api/jobseeker/settings/cloud-engine/connect', {
        method: 'POST',
        body: JSON.stringify({})
      });
      if (res?.auth_session_id) setAuthSessionId(res.auth_session_id);
      const liveUrl = res?.live_view_url;
      if (!liveUrl) throw new Error('Missing live view URL');
      setAuthError(null);
      setAuthUrl(liveUrl);
      setAuthOpen(true);
    } catch (e) {
      window.alert(e?.message || 'Failed to start connect flow');
    } finally {
      setConnectLoading(false);
    }
  };

  // Complete Browserbase auth flow
  const handleAuthComplete = async () => {
    if (!authSessionId) {
      setAuthError('Missing auth session. Restart the connect flow.');
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      await apiFetch('/api/jobseeker/settings/cloud-engine/connect', {
        method: 'POST',
        body: JSON.stringify({ auth_session_id: authSessionId })
      });
      await load();
      // After load, connected state will be updated. Close modal if successful.
      setAuthOpen(false);
      setAuthUrl(null);
    } catch (e) {
      setAuthError(String(e?.message || 'Verification failed. Try again.'));
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Browserbase LinkedIn Auth Modal */}
      <ConnectLinkedInModal
        open={authOpen}
        authUrl={authUrl}
        authError={authError}
        authBusy={authBusy}
        onClose={() => { setAuthOpen(false); setAuthUrl(null); }}
        onComplete={handleAuthComplete}
        onReload={() => {}}
        onOpenNewTab={() => { if (authUrl) window.open(authUrl, '_blank', 'noopener,noreferrer'); }}
      />

      {/* Cloud Engine Settings Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Cloud Engine Settings</h2>
            <p className="text-sm text-slate-400 mt-1">Connect your LinkedIn account via Cloud Engine and set daily throttles.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="px-3 py-2 text-sm font-medium rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
            >
              Refresh
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className={cx(
                'px-4 py-2 text-sm font-semibold rounded-xl text-white transition',
                saving || loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'
              )}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* LinkedIn Connection Row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Status */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs font-semibold text-slate-500">LinkedIn Status</div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-sm font-bold text-white">{connected ? 'Connected' : 'Not connected'}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">Profile: {profileId || '\u2014'}</div>
          </div>

          {/* Connect */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs font-semibold text-slate-500">Connect LinkedIn</div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleConnect}
                disabled={connectLoading}
                className={cx(
                  'flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-white transition',
                  connectLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'
                )}
              >
                {connectLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Starting browser...
                  </span>
                ) : 'Connect'}
              </button>
              <button
                onClick={load}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                Check
              </button>
            </div>
            <div className="mt-2 text-xs text-slate-500">After connecting, return here and click &quot;Check&quot;.</div>
          </div>

          {/* Provider */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs font-semibold text-slate-500">Provider</div>
            <div className="mt-2">
              <span className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">
                HirePilot Cloud Engine
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500">Cloud execution for Job Seeker Agent.</div>
          </div>
        </div>

        {/* Throttle Settings */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <label className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs font-semibold text-slate-500">Daily job page limit</div>
            <input
              type="number"
              min={1}
              value={settings.daily_job_page_limit}
              onChange={(e) => setSettings({ ...settings, daily_job_page_limit: Number(e.target.value) })}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs font-semibold text-slate-500">Daily profile limit</div>
            <input
              type="number"
              min={1}
              value={settings.daily_profile_limit}
              onChange={(e) => setSettings({ ...settings, daily_profile_limit: Number(e.target.value) })}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs font-semibold text-slate-500">Max concurrency</div>
            <input
              type="number"
              min={1}
              max={5}
              value={settings.max_concurrency}
              onChange={(e) => setSettings({ ...settings, max_concurrency: Number(e.target.value) })}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs font-semibold text-slate-500">Cooldown minutes</div>
            <input
              type="number"
              min={5}
              value={settings.cooldown_minutes}
              onChange={(e) => setSettings({ ...settings, cooldown_minutes: Number(e.target.value) })}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500">Email notifications</div>
              <div className="text-xs text-slate-600">Notify on completion and pauses.</div>
            </div>
            <input
              type="checkbox"
              checked={settings.notify_email}
              onChange={(e) => setSettings({ ...settings, notify_email: e.target.checked })}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
            />
          </label>
          <label className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500">In-app notifications</div>
              <div className="text-xs text-slate-600">Notify inside HirePilot.</div>
            </div>
            <input
              type="checkbox"
              checked={settings.notify_inapp}
              onChange={(e) => setSettings({ ...settings, notify_inapp: e.target.checked })}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
            />
          </label>
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <svg className="h-4 w-4 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading settings...
          </div>
        )}
      </div>
    </div>
  );
}
