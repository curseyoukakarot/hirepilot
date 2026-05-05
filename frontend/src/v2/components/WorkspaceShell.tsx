/**
 * v2 WorkspaceShell — wraps a page with sidebar + main pane + REX FAB.
 *
 * Usage:
 *   <WorkspaceShell autopilot>
 *     <WorkspaceTopbar ... />
 *     <div className="px-8 py-7 ...">page body</div>
 *   </WorkspaceShell>
 *
 * The `.v2-app` class scopes our v2.css so it doesn't leak into legacy screens.
 * The `autopilot` boolean flips the shimmering top-edge ribbon.
 */

import React, { ReactNode, useEffect, useState } from 'react';
import WorkspaceSidebar from './WorkspaceSidebar';
import RexSlideOver from './RexSlideOver';
import '../../styles/v2.css';

interface Props {
  children: ReactNode;
  autopilot?: boolean;
  workspaceInitial?: string;
  workspaceName?: string;
  workspaceSubtitle?: string;
  sidebarCounts?: any;
  showRexFab?: boolean;
}

export default function WorkspaceShell({
  children,
  autopilot = true,
  workspaceInitial,
  workspaceName,
  workspaceSubtitle,
  sidebarCounts,
  showRexFab = true,
}: Props) {
  // Add `v2-app` class to <body> so background + atmosphere apply.
  useEffect(() => {
    const cls = autopilot ? 'v2-app autopilot' : 'v2-app';
    document.body.classList.add(...cls.split(' '));
    return () => {
      document.body.classList.remove('v2-app', 'autopilot');
    };
  }, [autopilot]);

  return (
    <div className={`v2-app ${autopilot ? 'autopilot' : ''} flex min-h-screen relative z-10`}>
      <WorkspaceSidebar
        workspaceInitial={workspaceInitial}
        workspaceName={workspaceName}
        workspaceSubtitle={workspaceSubtitle}
        counts={sidebarCounts}
      />

      <main className="flex-1 min-w-0">{children}</main>

      {showRexFab && <RexFab />}
    </div>
  );
}

/**
 * REX FAB + slide-over wired together. Stateful so any page using
 * WorkspaceShell automatically gets the working REX panel.
 */
function RexFab() {
  const [open, setOpen] = useState(false);

  // ⌘K opens the panel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        className="rex-fab"
        title="Ask REX (⌘K)"
        aria-label="Open REX"
        onClick={() => setOpen(true)}
      >
        <i className="fa-solid fa-wand-magic-sparkles" />
      </button>
      <RexSlideOver open={open} onClose={() => setOpen(false)} />
    </>
  );
}
