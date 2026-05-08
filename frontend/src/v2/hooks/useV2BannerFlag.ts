/**
 * v2 — useV2BannerFlag
 *
 * Reads the global v2 upgrade banner kill-switch flag from
 * `system_settings.v2_banner_enabled`. This is a Super-Admin-controlled
 * lever (toggled from the SuperAdmin dashboard) that:
 *
 *   - Hides the V2UpgradeBanner site-wide when OFF.
 *   - Force-redirects anyone on `/v2/*` back to `/dashboard` when OFF
 *     (see V2KillSwitchGuard).
 *
 * Defaults to `enabled = true` so existing behaviour is preserved if the
 * row hasn't been seeded yet. Reads once on mount; subscribes to realtime
 * updates so flipping the toggle takes effect without a reload.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const KEY = 'v2_banner_enabled';

function parseBool(v: unknown): boolean {
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  return true; // default ON
}

export function useV2BannerFlag() {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', KEY)
          .maybeSingle();
        if (cancelled) return;
        setEnabled(data ? parseBool((data as any).value) : true);
      } catch {
        // fail-soft → keep default ON
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    load();

    // Subscribe to flag changes — flipping off in SuperAdmin should
    // immediately retire the banner / kick users out of /v2/*.
    let channel: any = null;
    try {
      channel = supabase
        .channel('system_settings:v2_banner_enabled')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'system_settings', filter: `key=eq.${KEY}` },
          (payload: any) => {
            const v = payload?.new?.value ?? payload?.record?.value;
            setEnabled(parseBool(v));
          },
        )
        .subscribe();
    } catch {
      // realtime is best-effort; we already have the initial load
    }

    return () => {
      cancelled = true;
      try { channel && supabase.removeChannel(channel); } catch {}
    };
  }, []);

  return { enabled, loaded };
}
