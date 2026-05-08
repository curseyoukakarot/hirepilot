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

  /** Set preference + navigate to the appropriate landing route. */
  const switchTo = (target: UIVersion, opts: { redirect?: boolean } = { redirect: true }) => {
    update.mutate({ ui_version: target } as any, {
      onSuccess: () => {
        if (opts.redirect !== false) {
          window.location.href = target === 'v2' ? '/v2/today' : '/dashboard';
        }
      },
    });
  };

  const dismissBanner = () => update.mutate({ dismiss_banner: true } as any);

  return {
    uiVersion,
    isDismissed,
    isLoading: query.isLoading,
    switchTo,
    dismissBanner,
  };
}
