import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorkspace } from '../../context/WorkspaceContext';

export default function ProfileDropdown({ avatarUrl }) {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const workspaceName = activeWorkspace?.name || 'Workspace';
  const displayRole = activeWorkspace?.display_role || activeWorkspace?.role;
  const workspaceRole = displayRole
    ? String(displayRole).replace(/_/g, ' ')
    : null;

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const onNavigate = (path) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center rounded-full ring-1 ring-transparent hover:ring-indigo-300 dark:hover:ring-indigo-500 transition"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 mt-3 w-64 rounded-xl border border-gray-200/70 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 shadow-xl backdrop-blur-md z-50"
            role="menu"
          >
            <div className="px-3 py-2">
              <button
                type="button"
                onClick={() => onNavigate('/settings')}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition"
                role="menuitem"
              >
                Settings
              </button>
            </div>
            <div className="h-px bg-gray-200/80 dark:bg-gray-800/80" />
            <div className="px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Current Workspace
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                <span>Workspace: {workspaceName}</span>
                {workspaceRole && (
                  <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                    {workspaceRole}
                  </span>
                )}
              </div>
            </div>
            <div className="px-3 pb-3">
              <button
                type="button"
                onClick={() => onNavigate('/workspaces')}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 transition"
                role="menuitem"
              >
                Add New Workspace
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
