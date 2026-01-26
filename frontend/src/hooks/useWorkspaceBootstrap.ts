import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { apiGet } from '../lib/api';
import { useAppMode } from '../lib/appMode';

const WORKSPACE_STORAGE_KEY = 'hp_active_workspace_id';

type WorkspaceRow = {
  workspace_id: string;
};

export function useWorkspaceBootstrap(role?: string | null) {
  const mode = useAppMode();

  useEffect(() => {
    if (mode !== 'recruiter') return;
    const roleLc = String(role || '').toLowerCase();
    if (roleLc.startsWith('job_seeker')) return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (!token) return;

        const resp = await apiGet('/api/workspaces/mine');
        if (cancelled) return;
        const list = Array.isArray(resp?.workspaces) ? (resp.workspaces as WorkspaceRow[]) : [];
        if (!list.length) return;

        let stored: string | null = null;
        try {
          stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
        } catch {}

        const hasStored = stored && list.some((w) => String(w.workspace_id) === String(stored));
        if (!hasStored) {
          try {
            window.localStorage.setItem(WORKSPACE_STORAGE_KEY, String(list[0].workspace_id));
          } catch {}
        }
      } catch {
        // Non-blocking: proceed without workspace header
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, role]);
}
