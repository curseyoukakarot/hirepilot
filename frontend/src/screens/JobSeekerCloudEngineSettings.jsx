import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function resolveApiBase() {
  const env = String(import.meta?.env?.VITE_BACKEND_URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.host.endsWith('thehirepilot.com')) return 'https://api.thehirepilot.com';
  return 'http://localhost:8080';
}

export default function JobSeekerCloudEngineSettings() {
  const apiBase = useMemo(() => resolveApiBase(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [profileId, setProfileId] = useState(null);
  const [lastAuthSessionId, setLastAuthSessionId] = useState(null);
  const [settings, setSettings] = useState({
    daily_job_page_limit: 50,
    daily_profile_limit: 100,
    max_concurrency: 1,
    cooldown_minutes: 30,
    notify_email: true,
    notify_inapp: true
  });

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
      if (lastAuthSessionId) {
        try {
          await apiFetch('/api/jobseeker/settings/cloud-engine/connect', {
            method: 'POST',
            body: JSON.stringify({ auth_session_id: lastAuthSessionId })
          });
        } catch {}
      }
      const res = await apiFetch('/api/jobseeker/settings/cloud-engine');
      setSettings((prev) => ({ ...prev, ...(res?.settings || {}) }));
      setConnected(Boolean(res?.connected));
      setProfileId(res?.profile_id || null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiFetch, lastAuthSessionId]);

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

  const handleConnect = async () => {
    try {
      const res = await apiFetch('/api/jobseeker/settings/cloud-engine/connect', { method: 'POST', body: JSON.stringify({}) });
      if (res?.url) {
        window.open(res.url, '_blank');
      }
      if (res?.auth_session_id) {
        setLastAuthSessionId(res.auth_session_id);
      }
    } catch (e) {
      window.alert(e?.message || 'Failed to start connect flow');
    }
  };

  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Cloud Engine Settings</h2>
          <p className="text-sm text-gray-500">Connect Airtop and set daily throttles for Job Seeker Agent runs.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="px-3 py-2 text-sm font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-3 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="border rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-500">LinkedIn Status</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">{connected ? 'Connected' : 'Not connected'}</div>
          <div className="mt-1 text-xs text-gray-500">Profile: {profileId || '—'}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-500">Connect LinkedIn</div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleConnect}
              className="flex-1 px-3 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-500"
            >
              Connect
            </button>
            <button
              onClick={load}
              className="px-3 py-2 text-sm font-semibold rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Check
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500">After connecting, return here and click “Check”.</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-500">Provider</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">HirePilot Cloud Engine</div>
          <div className="mt-1 text-xs text-gray-500">Cloud execution only for Job Seeker Agent.</div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <label className="border rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-500">Daily job page limit</div>
          <input
            type="number"
            min={1}
            value={settings.daily_job_page_limit}
            onChange={(e) => setSettings({ ...settings, daily_job_page_limit: Number(e.target.value) })}
            className="mt-2 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="border rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-500">Daily profile limit</div>
          <input
            type="number"
            min={1}
            value={settings.daily_profile_limit}
            onChange={(e) => setSettings({ ...settings, daily_profile_limit: Number(e.target.value) })}
            className="mt-2 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="border rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-500">Max concurrency</div>
          <input
            type="number"
            min={1}
            max={5}
            value={settings.max_concurrency}
            onChange={(e) => setSettings({ ...settings, max_concurrency: Number(e.target.value) })}
            className="mt-2 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="border rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-500">Cooldown minutes</div>
          <input
            type="number"
            min={5}
            value={settings.cooldown_minutes}
            onChange={(e) => setSettings({ ...settings, cooldown_minutes: Number(e.target.value) })}
            className="mt-2 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="border rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-500">Email notifications</div>
            <div className="text-xs text-gray-400">Notify on completion and pauses.</div>
          </div>
          <input
            type="checkbox"
            checked={settings.notify_email}
            onChange={(e) => setSettings({ ...settings, notify_email: e.target.checked })}
            className="h-4 w-4"
          />
        </label>
        <label className="border rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-500">In-app notifications</div>
            <div className="text-xs text-gray-400">Notify inside HirePilot.</div>
          </div>
          <input
            type="checkbox"
            checked={settings.notify_inapp}
            onChange={(e) => setSettings({ ...settings, notify_inapp: e.target.checked })}
            className="h-4 w-4"
          />
        </label>
      </div>

      {loading && (
        <div className="mt-4 text-sm text-gray-500">Loading settings...</div>
      )}
    </div>
  );
}
