/**
 * v2 — useWorkspaceSettings
 * React Query hook around /api/v2/workspace-settings.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../../lib/api';
import type { WorkspaceSettings } from '../types';

const QK = ['v2', 'workspace-settings'] as const;

export function useWorkspaceSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QK,
    queryFn: () => apiGet('/api/v2/workspace-settings') as Promise<{ settings: WorkspaceSettings }>,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const update = useMutation({
    mutationFn: (input: Partial<WorkspaceSettings>) => apiPatch('/api/v2/workspace-settings', input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: QK });
      const prev = queryClient.getQueryData(QK) as { settings: WorkspaceSettings } | undefined;
      if (prev?.settings) {
        queryClient.setQueryData(QK, { settings: { ...prev.settings, ...input } });
      }
      return { prev };
    },
    onError: (_err, _input, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(QK, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QK }),
  });

  return {
    settings: query.data?.settings,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    update,
  };
}
