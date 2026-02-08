import React, { createContext, useContext, useEffect } from 'react';
import { useWorkspaceBootstrap } from '../hooks/useWorkspaceBootstrap';

type WorkspaceRow = {
  workspace_id: string;
  name?: string | null;
  plan?: string | null;
  seat_count?: number | null;
  role?: string | null;
  status?: string | null;
};

type WorkspaceContextValue = {
  workspaces: WorkspaceRow[];
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceRow | null;
  setActiveWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  activeWorkspaceId: null,
  activeWorkspace: null,
  setActiveWorkspace: () => {},
  refreshWorkspaces: async () => {}
});

const WORKSPACE_STORAGE_KEY = 'hp_active_workspace_id';

export function WorkspaceProvider({
  children,
  role
}: {
  children: React.ReactNode;
  role?: string | null;
}) {
  const { workspaces, activeWorkspaceId, activeWorkspace, refreshWorkspaces } = useWorkspaceBootstrap(role);

  useEffect(() => {
    try {
      if (!activeWorkspaceId) return;
      if (typeof window === 'undefined') return;
      const extId = (import.meta as any)?.env?.VITE_EXTENSION_ID || 'hocopaaojddfommlkiegnflimmmppbnk';
      if (!(window as any).chrome?.runtime || !extId) return;
      (window as any).chrome.runtime.sendMessage(extId, { action: 'SET_WORKSPACE', workspace_id: activeWorkspaceId }, () => {});
    } catch {}
  }, [activeWorkspaceId]);

  const setActiveWorkspace = (workspaceId: string) => {
    try {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, String(workspaceId));
    } catch {}
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspaceId, activeWorkspace, setActiveWorkspace, refreshWorkspaces }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
