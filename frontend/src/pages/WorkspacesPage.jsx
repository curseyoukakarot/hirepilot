import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGet } from '../lib/api';
import { useWorkspace } from '../context/WorkspaceContext';
import { workspacePlanLabel } from '../lib/workspacePlanLabel';

function WorkspaceRow({ workspace, isActive, onSwitch, onManage }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/80 dark:bg-gray-900/70 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {workspace.name || 'Workspace'}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
              {workspacePlanLabel(workspace.plan)}
            </span>
            {workspace.role && (
              <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                {String(workspace.role).replace(/_/g, ' ')}
              </span>
            )}
            {isActive && (
              <span className="rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                Active
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onManage(workspace)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition"
          >
            Manage
          </button>
          <button
            type="button"
            disabled={isActive}
            onClick={() => onSwitch(workspace.workspace_id)}
            className={`px-3 py-2 text-sm rounded-lg font-medium transition ${
              isActive
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-500'
            }`}
          >
            Switch
          </button>
        </div>
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Seats: {workspace.seat_count ?? '—'}
      </div>
    </div>
  );
}

export default function WorkspacesPage() {
  const { workspaces: cached, activeWorkspaceId, setActiveWorkspace } = useWorkspace();
  const [workspaces, setWorkspaces] = useState(cached || []);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await apiGet('/api/workspaces/mine');
        if (!mounted) return;
        const list = Array.isArray(resp?.workspaces) ? resp.workspaces : [];
        if (list.length) setWorkspaces(list);
      } catch {
        // Non-blocking
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const activeName = useMemo(() => {
    const found = workspaces.find((w) => String(w.workspace_id) === String(activeWorkspaceId));
    return found?.name || null;
  }, [workspaces, activeWorkspaceId]);

  return (
    <div className="min-h-[80vh] px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Workspaces</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your workspace access and switch between environments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeName && (
              <span className="rounded-full border border-indigo-200 dark:border-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                Active: {activeName}
              </span>
            )}
            <button
              type="button"
              disabled
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 text-sm cursor-not-allowed"
            >
              Create Workspace (Coming soon)
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 p-6 text-gray-500 dark:text-gray-400">
            Loading workspaces...
          </div>
        ) : workspaces.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 p-6 text-gray-500 dark:text-gray-400">
            No workspaces found.
          </div>
        ) : (
          <div className="grid gap-4">
            {workspaces.map((ws) => (
              <WorkspaceRow
                key={ws.workspace_id}
                workspace={ws}
                isActive={String(ws.workspace_id) === String(activeWorkspaceId)}
                onSwitch={setActiveWorkspace}
                onManage={(row) => setSelected(row)}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {selected.name || 'Workspace'}
                  </div>
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {workspacePlanLabel(selected.plan)} • Seats: {selected.seat_count ?? '—'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              <div className="mt-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                Member management and invitations are coming soon.
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 transition"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
