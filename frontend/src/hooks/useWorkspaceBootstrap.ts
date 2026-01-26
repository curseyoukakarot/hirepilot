import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { apiGet } from '../lib/api';
import { useAppMode } from '../lib/appMode';

const WORKSPACE_STORAGE_KEY = 'hp_active_workspace_id';

type WorkspaceRow = {
  workspace_id: string;
  name?: string | null;
  plan?: string | null;
  seat_count?: number | null;
  role?: string | null;
  status?: string | null;
  auth_role?: string | null;
  display_role?: string | null;
  display_plan?: string | null;
  display_seat_count?: number | null;
};

export function useWorkspaceBootstrap(role?: string | null) {
  const mode = useAppMode();
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  const refreshWorkspaces = useCallback(async () => {
    if (mode !== 'recruiter') return;
    const roleLc = String(role || '').toLowerCase();
    if (roleLc.startsWith('job_seeker')) return;

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;

      const resp = await apiGet('/api/workspaces/mine');
      const list = Array.isArray(resp?.workspaces) ? (resp.workspaces as WorkspaceRow[]) : [];
      if (!list.length) return;

      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
      } catch {}

      const hasStored = stored && list.some((w) => String(w.workspace_id) === String(stored));
      const nextActive = hasStored ? String(stored) : String(list[0].workspace_id);
      if (!hasStored) {
        try {
          window.localStorage.setItem(WORKSPACE_STORAGE_KEY, nextActive);
        } catch {}
      }
      setWorkspaces(list);
      setActiveWorkspaceId(nextActive);
    } catch {
      // Non-blocking: proceed without workspace header
    }
  }, [mode, role]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await refreshWorkspaces();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshWorkspaces]);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => String(w.workspace_id) === String(activeWorkspaceId)) || null,
    [workspaces, activeWorkspaceId]
  );

  return { workspaces, activeWorkspaceId, activeWorkspace, refreshWorkspaces };
}
