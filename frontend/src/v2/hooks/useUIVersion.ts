/**
 * v2 — useUIVersion
 * Read + mutate the user's UI shell preference ('legacy' | 'v2') and
 * v2 upgrade banner dismissal state.
 *
 * Usage:
 *   const { uiVersion, switchTo, dismissBanner, isDismissed } = useUIVersion();
 *   switchTo('v2'); // sets preference + redirects to /v2/today
 *   switchTo('legacy'); // sets preference + redirects to /dashboard
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../../lib/api';

export type UIVersion = 'legacy' | 'v2';

export interface UIPreference {
  ui_version: UIVersion;
  v2_banner_dismissed_at: string | null;
}

const QK = ['v2', 'ui-preference'] as const;

export function useUIVersion() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QK,
    queryFn: () => apiGet('/api/v2/ui-preference') as Promise<UIPreference>,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const update = useMutation({
    mutationFn: (input: Partial<UIPreference> & { dismiss_banner?: boolean }) =>
      apiPatch('/api/v2/ui-preference', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QK }),
  });

  const uiVersion: UIVersion = query.data?.ui_version || 'legacy';
  const isDismissed = !!query.data?.v2_banner_dismissed_at;

  /**
   * Set preference + navigate to the appropriate landing route.
   * Fail-soft: if the migration hasn't been applied yet (503 response),
   * still navigate to the target so users aren't blocked. The next sync
   * after the migration runs will persist their choice.
   */
  const switchTo = (target: UIVersion, opts: { redirect?: boolean } = { redirect: true }) => {
    const fallbackHref = target === 'v2' ? '/v2/today' : '/dashboard';
    update.mutate({ ui_version: target } as any, {
      onSuccess: () => {
        if (opts.redirect !== false) window.location.href = fallbackHref;
      },
      onError: (err: any) => {
        // Detect "apply_migration" hint OR any error message about the
        // ui_version column. Either way, just redirect — the user shouldn't
        // be blocked by missing infra.
        const msg = String(err?.message || err || '').toLowerCase();
        const isMigrationGap =
          msg.includes('apply_migration') ||
          msg.includes('ui_version') ||
          msg.includes('schema cache');
        if (isMigrationGap && opts.redirect !== false) {
          console.warn('[useUIVersion] migration not yet applied — navigating without persisting preference.');
          window.location.href = fallbackHref;
        }
      },
    });
  };

  /** Fail-soft dismiss — if the column doesn't exist yet, hide the banner
   *  client-side via a localStorage flag so users aren't nagged. */
  const dismissBanner = () => {
    update.mutate({ dismiss_banner: true } as any, {
      onError: () => {
        try { window.localStorage.setItem('hp_v2_banner_dismissed', '1'); } catch {}
      },
    });
  };

  return {
    uiVersion,
    isDismissed,
    isLoading: query.isLoading,
    switchTo,
    dismissBanner,
  };
}
