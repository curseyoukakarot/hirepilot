/**
 * Super-Admin toggle: master kill-switch for the v2 upgrade banner /
 * v2 UI access.
 *
 *   - ON  → V2UpgradeBanner shows site-wide, users can opt into /v2/*
 *   - OFF → banner hidden + anyone on /v2/* gets redirected to /dashboard
 *
 * Persists to `system_settings` row with key `v2_banner_enabled`. Defaults
 * to ON if the row is missing.
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const KEY = 'v2_banner_enabled';

function parseBool(v: unknown): boolean {
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  return true;
}

export default function V2BannerToggleCard() {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', KEY)
          .maybeSingle();
        setEnabled(data ? parseBool((data as any).value) : true);
      } catch (e: any) {
        setError(e?.message || 'failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = async () => {
    if (saving) return;
    const next = !enabled;
    setEnabled(next); // optimistic
    setSaving(true);
    setError(null);
    try {
      const { error: upsertErr } = await supabase
        .from('system_settings')
        .upsert([{ key: KEY, value: next }], { onConflict: 'key' });
      if (upsertErr) throw upsertErr;
    } catch (e: any) {
      setEnabled(!next); // rollback
      setError(e?.message || 'failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading v2 banner setting…</div>;
  }

  return (
    <div className="border rounded-xl p-5 shadow-sm bg-white w-full max-w-xl">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="text-lg font-semibold flex items-center gap-2">
            <span aria-hidden>✨</span>
            New UI Access (v2)
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Master kill-switch for the v2 upgrade banner.{' '}
            <span className="font-semibold">When ON</span>, users see the “Try v2” banner and
            can switch to the new UI. <span className="font-semibold">When OFF</span>, the
            banner is hidden and anyone currently on a <code className="bg-gray-100 px-1 rounded">/v2/*</code> route is
            sent back to the classic dashboard.
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            enabled
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
              : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-rose-500'}`}
          />
          {enabled ? 'v2 access ON' : 'v2 access OFF'}
        </span>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div>
          <div className="font-medium text-sm">Show v2 upgrade banner</div>
          <p className="text-xs text-gray-500">
            Affects all users immediately. No reload required.
          </p>
        </div>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={enabled}
            disabled={saving}
            onChange={handleToggle}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-indigo-600 peer-disabled:opacity-50 transition-colors" />
        </label>
      </div>

      {error && (
        <p className="mt-3 text-xs text-rose-600">
          Couldn’t save: {error}
        </p>
      )}
    </div>
  );
}
