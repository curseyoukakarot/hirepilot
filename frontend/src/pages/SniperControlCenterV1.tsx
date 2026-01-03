/*
CURSOR INSTRUCTIONS (DO NOT DEVIATE)

- Implement Sniper v1 settings UI with Airtop Cloud Engine toggle + guardrails.

- NO DESIGN DECISIONS: use the exact Tailwind layout/styles in this file.

- Toggle OFF = all cloud engine actions OFF (no Airtop, no fallback cookie sessions). Chrome extension only.

- Toggle ON = enable Airtop cloud engine and show auth status and connect actions.

- Only adjust import paths if necessary. Keep DOM structure and classes unchanged.
*/

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type SniperSettings = {
  cloud_engine_enabled: boolean;
  provider: "airtop" | "extension_only";
  max_actions_per_day: number;
  max_actions_per_hour: number;
  min_delay_seconds: number;
  max_delay_seconds: number;
  active_hours_start: string; // "08:00"
  active_hours_end: string;   // "18:00"
  timezone: string;           // "America/Chicago"
  safety_mode: boolean;
};

type AirtopAuthStatus = {
  connected: boolean;
  profile_id?: string | null;
  last_checked_at?: string | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Toast({ show, message, type }: { show: boolean; message: string; type: "success" | "error" | "info" }) {
  if (!show) return null;
  return (
    <div className="fixed top-5 right-5 z-[9999]">
      <div
        className={cx(
          "rounded-lg border px-4 py-3 shadow-xl backdrop-blur",
          "bg-slate-950/80 border-slate-800 text-slate-100",
          type === "success" && "border-emerald-700/60",
          type === "error" && "border-rose-700/60",
          type === "info" && "border-sky-700/60"
        )}
      >
        <div className="text-sm font-semibold">{message}</div>
      </div>
    </div>
  );
}

export default function SniperControlCenterV1() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SniperSettings | null>(null);
  const [airtop, setAirtop] = useState<AirtopAuthStatus | null>(null);
  const [lastAuthSessionId, setLastAuthSessionId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" | "info" }>({
    show: false,
    message: "",
    type: "info",
  });
  const cloudEnabled = !!settings?.cloud_engine_enabled;
  const API_BASE = (import.meta.env.VITE_BACKEND_URL ? `${import.meta.env.VITE_BACKEND_URL}` : '').replace(/\/$/, '');
  const API_ROOT = API_BASE ? `${API_BASE}/api` : '/api';
  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ show: true, message, type });
    window.setTimeout(() => setToast({ show: false, message: "", type: "info" }), 2200);
  };

  async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function apiGet<T>(path: string): Promise<T> {
    const url = path.startsWith('http') ? path : `${API_ROOT}${path.startsWith('/') ? '' : '/'}${path}`;
    const res = await fetch(url, { credentials: "include", headers: await authHeaders() });
    const bodyText = await res.text();
    if (!res.ok) throw new Error(bodyText || `Request failed: ${res.status}`);
    try { return JSON.parse(bodyText) as T; } catch { return ({} as T); }
  }

  async function apiPut<T>(path: string, body: any): Promise<T> {
    const url = path.startsWith('http') ? path : `${API_ROOT}${path.startsWith('/') ? '' : '/'}${path}`;
    const res = await fetch(url, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(body),
    });
    const bodyText = await res.text();
    if (!res.ok) throw new Error(bodyText || `Request failed: ${res.status}`);
    try { return JSON.parse(bodyText) as T; } catch { return ({} as T); }
  }

  async function apiPost<T>(path: string, body: any): Promise<T> {
    const url = path.startsWith('http') ? path : `${API_ROOT}${path.startsWith('/') ? '' : '/'}${path}`;
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(body),
    });
    const bodyText = await res.text();
    if (!res.ok) throw new Error(bodyText || `Request failed: ${res.status}`);
    try { return JSON.parse(bodyText) as T; } catch { return ({} as T); }
  }

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const s = await apiGet<SniperSettings>("/sniper/settings");
      setSettings(s);

      // Only check Airtop status if cloud engine enabled; otherwise show extension-only.
      if (s.cloud_engine_enabled) {
        const a = await apiGet<AirtopAuthStatus>("/sniper/linkedin/auth/status");
        setAirtop(a);
      } else {
        setAirtop({ connected: false, profile_id: null });
      }
    } catch (e: any) {
      const msg = String(e?.message || "Unknown error");
      setLoadError(msg);
      showToast(`Failed to load settings: ${msg}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headerStatus = useMemo(() => {
    if (!settings) return "—";
    return settings.cloud_engine_enabled ? "Cloud Engine enabled" : "Extension only";
  }, [settings]);

  const handleToggleCloud = async () => {
    if (!settings) return;
    const nextEnabled = !settings.cloud_engine_enabled;

    // IMPORTANT: toggle OFF means everything cloud is OFF. No fallback cookie sessions.
    const next: SniperSettings = {
      ...settings,
      cloud_engine_enabled: nextEnabled,
      provider: nextEnabled ? "airtop" : "extension_only",
    };
    setSettings(next);
    setSaving(true);
    try {
      await apiPut("/sniper/settings", next);
      showToast(nextEnabled ? "Cloud Engine enabled" : "Cloud Engine disabled (extension only)", "success");
      await load();
    } catch (e: any) {
      showToast(`Failed to save: ${e?.message || "Unknown error"}`, "error");
      setSettings(settings); // revert
    } finally {
      setSaving(false);
    }
  };

  const handleAirtopConnect = async () => {
    if (!cloudEnabled) {
      showToast("Enable Cloud Engine to connect Airtop.", "info");
      return;
    }
    try {
      showToast("Starting Airtop LinkedIn connect…", "info");
      const resp = await apiPost<{ url: string; auth_session_id?: string }>("/sniper/linkedin/auth/start", {});
      if (resp?.auth_session_id) setLastAuthSessionId(resp.auth_session_id);
      // Open the auth URL in a new tab (embedded/live view flow)
      window.open(resp.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      showToast(`Airtop connect failed: ${e?.message || "Unknown error"}`, "error");
    }
  };

  const handleAirtopRefresh = async () => {
    if (!cloudEnabled) return;
    try {
      // Best-effort: if user just connected, finalize profile persistence
      if (lastAuthSessionId) {
        try {
          await apiPost("/sniper/linkedin/auth/complete", { auth_session_id: lastAuthSessionId });
        } catch {}
      }
      const a = await apiGet<AirtopAuthStatus>("/sniper/linkedin/auth/status");
      setAirtop(a);
      showToast(a.connected ? "Airtop is connected." : "Airtop not connected yet.", a.connected ? "success" : "info");
    } catch (e: any) {
      showToast(`Failed to refresh Airtop status: ${e?.message || "Unknown error"}`, "error");
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6">
          <div className="text-slate-200 text-lg font-semibold">Sniper Settings</div>
          {loading ? (
            <div className="mt-2 text-slate-400 text-sm">Loading…</div>
          ) : (
            <div className="mt-2 text-slate-400 text-sm">
              {loadError ? (
                <>
                  <div className="text-rose-300 break-words">Failed to load: {loadError}</div>
                  <button
                    className="mt-3 inline-flex items-center rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 hover:bg-slate-950"
                    onClick={() => load()}
                  >
                    Retry
                  </button>
                </>
              ) : (
                "Unable to load settings."
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Toast show={toast.show} message={toast.message} type={toast.type} />

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-2xl font-bold text-slate-100">Sniper Control Center</div>
            <div className="mt-1 text-sm text-slate-400">
              Manage your execution engine, guardrails, and LinkedIn connection status.
            </div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span className="text-xs font-semibold text-slate-200">{headerStatus}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
            >
              Refresh
            </button>
            <button
              disabled={saving}
              onClick={handleToggleCloud}
              className={cx(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                settings.cloud_engine_enabled
                  ? "bg-slate-800 text-slate-100 hover:bg-slate-700"
                  : "bg-sky-600 text-white hover:bg-sky-500",
                saving && "opacity-70 cursor-not-allowed"
              )}
            >
              {settings.cloud_engine_enabled ? "Cloud Engine: ON" : "Cloud Engine: OFF"}
            </button>
          </div>
        </div>

        {/* Cloud Engine Panel */}
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-bold text-slate-100">Cloud Engine (Airtop)</div>
              <div className="mt-1 text-sm text-slate-400">
                Use HirePilot’s cloud engine (Airtop) to run Sniper actions on your behalf.
              </div>
            </div>
            <div className="inline-flex items-center gap-2">
              <span className={cx("text-xs font-semibold", cloudEnabled ? "text-emerald-300" : "text-slate-400")}>
                {cloudEnabled ? "Enabled" : "Disabled"}
              </span>
              <div className={cx("h-2.5 w-2.5 rounded-full", cloudEnabled ? "bg-emerald-400" : "bg-slate-600")} />
            </div>
          </div>

          {!cloudEnabled ? (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-sm font-semibold text-slate-100">Extension Only Mode</div>
              <div className="mt-1 text-sm text-slate-400">
                Cloud actions are fully disabled. Sniper actions must be performed through the Chrome Extension.
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-xs font-semibold text-slate-400">Airtop Status</div>
                <div className="mt-1 text-sm font-bold text-slate-100">{airtop?.connected ? "Connected" : "Not connected"}</div>
                <div className="mt-1 text-xs text-slate-500">Profile: {airtop?.profile_id ? airtop.profile_id : "—"}</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-xs font-semibold text-slate-400">Connect LinkedIn</div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleAirtopConnect}
                    className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                  >
                    Connect
                  </button>
                  <button
                    onClick={handleAirtopRefresh}
                    className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                  >
                    Check
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-500">After connecting, return here and click “Check”.</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-xs font-semibold text-slate-400">Provider</div>
                <div className="mt-1 text-sm font-bold text-slate-100">Airtop (Cloud)</div>
                <div className="mt-1 text-xs text-slate-500">Cloud Engine enabled = Airtop execution only.</div>
              </div>
            </div>
          )}
        </div>

        {/* Guardrails */}
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
          <div className="text-lg font-bold text-slate-100">Guardrails</div>
          <div className="mt-1 text-sm text-slate-400">
            Throttle actions to reduce risk and comply with account safety best practices.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <label className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs font-semibold text-slate-400">Max actions / day</div>
              <input
                type="number"
                min={1}
                value={settings.max_actions_per_day}
                onChange={(e) => setSettings({ ...settings, max_actions_per_day: Number(e.target.value) })}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
              />
            </label>

            <label className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs font-semibold text-slate-400">Max actions / hour</div>
              <input
                type="number"
                min={1}
                value={settings.max_actions_per_hour}
                onChange={(e) => setSettings({ ...settings, max_actions_per_hour: Number(e.target.value) })}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
              />
            </label>

            <label className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs font-semibold text-slate-400">Safety mode</div>
              <div className="mt-2 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
                <span className="text-sm font-semibold text-slate-100">{settings.safety_mode ? "ON" : "OFF"}</span>
                <button
                  onClick={() => setSettings({ ...settings, safety_mode: !settings.safety_mode })}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700"
                >
                  Toggle
                </button>
              </div>
            </label>

            <label className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs font-semibold text-slate-400">Min delay (seconds)</div>
              <input
                type="number"
                min={1}
                value={settings.min_delay_seconds}
                onChange={(e) => setSettings({ ...settings, min_delay_seconds: Number(e.target.value) })}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
              />
            </label>

            <label className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs font-semibold text-slate-400">Max delay (seconds)</div>
              <input
                type="number"
                min={1}
                value={settings.max_delay_seconds}
                onChange={(e) => setSettings({ ...settings, max_delay_seconds: Number(e.target.value) })}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
              />
            </label>

            <label className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs font-semibold text-slate-400">Timezone</div>
              <input
                type="text"
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                placeholder="America/Chicago"
              />
            </label>

            <label className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs font-semibold text-slate-400">Active hours start</div>
              <input
                type="time"
                value={settings.active_hours_start}
                onChange={(e) => setSettings({ ...settings, active_hours_start: e.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
              />
            </label>

            <label className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs font-semibold text-slate-400">Active hours end</div>
              <input
                type="time"
                value={settings.active_hours_end}
                onChange={(e) => setSettings({ ...settings, active_hours_end: e.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
              />
            </label>
          </div>

          <div className="mt-5 flex items-center justify-end">
            <button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await apiPut("/api/sniper/settings", settings);
                  showToast("Settings saved.", "success");
                } catch (e: any) {
                  showToast(`Failed to save: ${e?.message || "Unknown error"}`, "error");
                } finally {
                  setSaving(false);
                }
              }}
              className={cx(
                "rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500",
                saving && "opacity-70 cursor-not-allowed"
              )}
            >
              Save Guardrails
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


