/**
 * v2 — useMyWorkspaces
 * Lists every workspace the user is an active member of.
 * Backed by the existing GET /api/workspaces/mine route.
 *
 * Active workspace selection is stored in localStorage under
 * `hp_active_workspace_id` (matches the key the existing api wrapper reads
 * to set the x-workspace-id header — see frontend/src/lib/api.ts).
 * Switching = update localStorage + invalidate every v2 query so all
 * surfaces refetch under the new workspace context.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

export interface MyWorkspace {
  workspace_id: string;
  role: string | null;
  status: string | null;
  workspaces: {
    id: string;
    name: string | null;
    plan: string | null;
    seat_count: number | null;
  } | null;
}

const ACTIVE_KEY = 'hp_active_workspace_id';

export function getActiveWorkspaceId(): string | null {
  try { return window.localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

export function setActiveWorkspaceId(id: string): void {
  try { window.localStorage.setItem(ACTIVE_KEY, id); } catch {}
}

export function useMyWorkspaces() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['v2', 'my-workspaces'],
    queryFn: () => apiGet('/api/workspaces/mine') as Promise<{ workspaces: MyWorkspace[] }>,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const workspaces = query.data?.workspaces || [];
  const activeId = getActiveWorkspaceId() || (workspaces[0]?.workspace_id ?? null);
  const active = workspaces.find((w) => w.workspace_id === activeId) || null;

  const switchTo = (id: string) => {
    if (id === activeId) return;
    setActiveWorkspaceId(id);
    // Invalidate every v2 query so all surfaces refetch under the new workspace.
    queryClient.invalidateQueries({ queryKey: ['v2'] });
    // Reload to ensure all non-React-Query state (sidebar, contexts) re-resolves.
    setTimeout(() => window.location.reload(), 50);
  };

  return {
    workspaces,
    activeId,
    active,
    isLoading: query.isLoading,
    isError: query.isError,
    switchTo,
  };
}
