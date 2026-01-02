import React, { useEffect, useState } from 'react';
import { api, apiGet, apiPost } from '../lib/api';
import { toast } from '../components/ui/use-toast';

const DEFAULT = {
  provider_preference: 'airtop',
  max_actions_per_day: 120,
  max_actions_per_hour: 30,
  min_delay_seconds: 20,
  max_delay_seconds: 60,
  timezone: 'America/Chicago',
  safety_mode: true,
  active_hours_json: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', runOnWeekends: false }
};

function DayPicker({ value, onChange }) {
  const days = [
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
    { label: 'Sun', value: 7 }
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {days.map((d) => {
        const active = value.includes(d.value);
        return (
          <button
            key={d.value}
            type="button"
            onClick={() => {
              const next = active ? value.filter((x) => x !== d.value) : [...value, d.value];
              onChange(next.sort((a, b) => a - b));
            }}
            className={`px-3 py-1 rounded text-sm ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

export default function SniperControlCenterV1() {
  const [settings, setSettings] = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [authStatus, setAuthStatus] = useState({ status: 'needs_reauth', airtop_profile_id: null, airtop_last_auth_at: null });
  const [authModal, setAuthModal] = useState({ open: false, live_view_url: '', auth_session_id: '' });

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet('/api/sniper/settings', { requireAuth: true });
      setSettings({ ...DEFAULT, ...(data || {}) });
      const auth = await apiGet('/api/sniper/linkedin/auth/status', { requireAuth: true });
      setAuthStatus(auth || { status: 'needs_reauth' });
    } catch (e) {
      toast({ title: 'Failed to load', description: e.message || 'Unable to load Sniper settings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      await api('/api/sniper/settings', { method: 'PUT', body: JSON.stringify(settings) });
      toast({ title: 'Saved', description: 'Sniper settings updated.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message || 'Unable to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function startAuth() {
    try {
      if (settings.provider_preference !== 'airtop') {
        toast({ title: 'Switch provider to Airtop', description: 'Embedded LinkedIn login is available only with Airtop provider.', variant: 'destructive' });
        return;
      }
      const resp = await apiPost('/api/sniper/linkedin/auth/start', {});
      setAuthModal({ open: true, live_view_url: resp.live_view_url, auth_session_id: resp.auth_session_id });
    } catch (e) {
      toast({ title: 'Auth failed', description: e.message || 'Unable to start LinkedIn auth', variant: 'destructive' });
    }
  }

  async function completeAuth() {
    try {
      await apiPost('/api/sniper/linkedin/auth/complete', { auth_session_id: authModal.auth_session_id });
      toast({ title: 'Connected', description: 'LinkedIn session saved.' });
      setAuthModal({ open: false, live_view_url: '', auth_session_id: '' });
      await load();
    } catch (e) {
      toast({ title: 'Complete failed', description: e.message || 'Unable to complete auth', variant: 'destructive' });
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sniper Control Center (v1)</h1>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded bg-slate-800 text-white" onClick={load}>Refresh</button>
          <button className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-2">
        <div className="font-medium">LinkedIn Session (Airtop)</div>
        <div className="text-sm text-gray-600">
          Status: <span className="font-mono">{authStatus.status || 'needs_reauth'}</span>
          {authStatus.airtop_last_auth_at ? ` · last auth: ${new Date(authStatus.airtop_last_auth_at).toLocaleString()}` : ''}
        </div>
        <button className="px-3 py-2 rounded bg-emerald-600 text-white" onClick={startAuth}>
          Connect / Reconnect LinkedIn
        </button>
        <div className="text-xs text-gray-500">You will login to LinkedIn inside an embedded Airtop live view. No Airtop account required.</div>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-4">
        <div className="font-medium">Provider</div>
        <select
          className="border rounded px-3 py-2 text-sm"
          value={settings.provider_preference}
          onChange={(e) => setSettings((s) => ({ ...s, provider_preference: e.target.value }))}
        >
          <option value="airtop">Airtop (embedded login)</option>
          <option value="local_playwright">Chrome Extension (li_at cookie)</option>
        </select>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-4">
        <div className="font-medium">Guardrails</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm">
            Max actions/day
            <input className="mt-1 w-full border rounded px-3 py-2" type="number" min={1} max={5000}
              value={settings.max_actions_per_day}
              onChange={(e) => setSettings((s) => ({ ...s, max_actions_per_day: Number(e.target.value) }))} />
          </label>
          <label className="text-sm">
            Max actions/hour
            <input className="mt-1 w-full border rounded px-3 py-2" type="number" min={1} max={500}
              value={settings.max_actions_per_hour}
              onChange={(e) => setSettings((s) => ({ ...s, max_actions_per_hour: Number(e.target.value) }))} />
          </label>
          <label className="text-sm">
            Min delay (seconds)
            <input className="mt-1 w-full border rounded px-3 py-2" type="number" min={1} max={600}
              value={settings.min_delay_seconds}
              onChange={(e) => setSettings((s) => ({ ...s, min_delay_seconds: Number(e.target.value) }))} />
          </label>
          <label className="text-sm">
            Max delay (seconds)
            <input className="mt-1 w-full border rounded px-3 py-2" type="number" min={1} max={1800}
              value={settings.max_delay_seconds}
              onChange={(e) => setSettings((s) => ({ ...s, max_delay_seconds: Number(e.target.value) }))} />
          </label>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-4">
        <div className="font-medium">Active Hours</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm">
            Start
            <input className="mt-1 w-full border rounded px-3 py-2" type="time"
              value={settings.active_hours_json.start}
              onChange={(e) => setSettings((s) => ({ ...s, active_hours_json: { ...s.active_hours_json, start: e.target.value } }))} />
          </label>
          <label className="text-sm">
            End
            <input className="mt-1 w-full border rounded px-3 py-2" type="time"
              value={settings.active_hours_json.end}
              onChange={(e) => setSettings((s) => ({ ...s, active_hours_json: { ...s.active_hours_json, end: e.target.value } }))} />
          </label>
          <label className="text-sm">
            Timezone
            <input className="mt-1 w-full border rounded px-3 py-2" value={settings.timezone}
              onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))} />
          </label>
        </div>
        <DayPicker value={settings.active_hours_json.days} onChange={(days) => setSettings((s) => ({ ...s, active_hours_json: { ...s.active_hours_json, days } }))} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!settings.active_hours_json.runOnWeekends}
            onChange={(e) => setSettings((s) => ({ ...s, active_hours_json: { ...s.active_hours_json, runOnWeekends: e.target.checked } }))} />
          Allow weekends
        </label>
      </div>

      {authModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-medium">LinkedIn Login</div>
              <button className="text-sm text-gray-600" onClick={() => setAuthModal({ open: false, live_view_url: '', auth_session_id: '' })}>Close</button>
            </div>
            <div className="p-0">
              <iframe
                title="Airtop Live View"
                src={authModal.live_view_url}
                className="w-full h-[70vh]"
                allow="clipboard-read;clipboard-write"
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
              <button className="px-3 py-2 rounded bg-slate-800 text-white" onClick={() => setAuthModal({ open: false, live_view_url: '', auth_session_id: '' })}>
                Cancel
              </button>
              <button className="px-3 py-2 rounded bg-emerald-600 text-white" onClick={completeAuth}>
                I’m logged in
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


