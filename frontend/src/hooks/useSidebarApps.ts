import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut, apiPost } from '../lib/api';
import { APP_REGISTRY, DEFAULT_APPS, type AppDefinition } from '../config/appRegistry';

const QUERY_KEY = ['sidebar-apps'];

export function useSidebarApps() {
  const queryClient = useQueryClient();

  // Fetch user's enabled app IDs
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiGet('/api/user/sidebar-apps'),
    staleTime: 5 * 60 * 1000,        // 5 minutes — avoid refetch on every render
    gcTime: 30 * 60 * 1000,          // keep in cache 30 minutes
    refetchOnWindowFocus: false,
  });

  const enabledIds: string[] = data?.apps ?? DEFAULT_APPS;

  // Resolve full AppDefinition objects for enabled apps, preserving order
  const enabledApps: AppDefinition[] = enabledIds
    .map(id => APP_REGISTRY.find(a => a.id === id))
    .filter((a): a is AppDefinition => Boolean(a));

  // Toggle a single app on/off
  const toggleMutation = useMutation({
    mutationFn: (appId: string) => {
      const current = [...enabledIds];
      const newApps = current.includes(appId)
        ? current.filter(id => id !== appId)
        : [...current, appId];
      return apiPut('/api/user/sidebar-apps', { apps: newApps });
    },
    // Optimistic update for instant UI feedback
    onMutate: async (appId: string) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const prev = queryClient.getQueryData(QUERY_KEY);
      queryClient.setQueryData(QUERY_KEY, (old: any) => {
        const current: string[] = old?.apps ?? DEFAULT_APPS;
        return {
          apps: current.includes(appId)
            ? current.filter((id: string) => id !== appId)
            : [...current, appId],
        };
      });
      return { prev };
    },
    onError: (_err: any, _appId: string, context: any) => {
      if (context?.prev) queryClient.setQueryData(QUERY_KEY, context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Bulk-save all apps (for catalog page "save all" if needed)
  const setAppsMutation = useMutation({
    mutationFn: (apps: string[]) => apiPut('/api/user/sidebar-apps', { apps }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  // Fire-and-forget navigation tracking
  const trackUsage = (appId: string) => {
    apiPost('/api/user/sidebar-apps/track', { app_id: appId }).catch(() => {});
  };

  return {
    /** Full AppDefinition objects for user's enabled apps (in order) */
    enabledApps,
    /** Just the ID strings of enabled apps */
    enabledIds,
    /** True while fetching from API */
    isLoading,
    /** Toggle a single app on/off (optimistic) */
    toggleApp: toggleMutation.mutate,
    /** Replace the full app list */
    setApps: setAppsMutation.mutate,
    /** Track a navigation event (fire-and-forget) */
    trackUsage,
    /** Full catalog of all available apps */
    allApps: APP_REGISTRY,
  };
}
