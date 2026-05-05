/**
 * v2 Workspace Topbar
 *
 * HTML/JSX preserved EXACTLY from mockups/workspace.html topbar block.
 *
 * Props let each page customize the title, status pill, and any extra content
 * (e.g. avatar cluster on team workspaces).
 */

import React, { ReactNode } from 'react';

export type TrustLevel = 'manual' | 'suggest' | 'autopilot';

interface Props {
  pageTitle: string;
  pageIcon?: string;       // FA class, e.g. "fa-solid fa-sun"
  pageIconColor?: string;  // tailwind text class, e.g. "text-warn"
  pageSubtitle?: string;
  statusPill?: ReactNode;  // arbitrary status content (e.g. REX status pill)
  trustLevel?: TrustLevel; // shows badge in top-right
  rightExtra?: ReactNode;  // e.g. team avatar cluster, admin pill
}

export default function WorkspaceTopbar({
  pageTitle,
  pageIcon,
  pageIconColor,
  pageSubtitle,
  statusPill,
  trustLevel = 'autopilot',
  rightExtra,
}: Props) {
  return (
    <header className="border-b border-gray-100 px-8 h-14 glass flex items-center gap-4 sticky top-0 z-30">
      <div>
        <div className="font-semibold text-[14.5px] flex items-center gap-2">
          {pageIcon && <i className={`${pageIcon} ${pageIconColor || ''} text-xs`} />}
          {pageTitle}
        </div>
        {pageSubtitle && <div className="text-[10.5px] text-text-muted">{pageSubtitle}</div>}
      </div>

      {statusPill}

      <div className="ml-auto flex items-center gap-3">
        {rightExtra}

        <button className="trust-badge" title="Click to change posture">
          <i className="fa-solid fa-rocket text-[10px]" />
          {trustLevel === 'autopilot' && 'Autopilot'}
          {trustLevel === 'suggest' && 'Suggest'}
          {trustLevel === 'manual' && 'Manual'}
          <i className="fa-solid fa-chevron-down text-[9px] opacity-80" />
        </button>

        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 ring-2 ring-white" />
      </div>
    </header>
  );
}

/**
 * Convenience component: the standard "REX is working" status pill.
 * Drop into <WorkspaceTopbar statusPill={<RexStatusPill ... />} />
 */
export function RexStatusPill({
  text,
  highlight,
  highlightClass = 'text-primary',
}: {
  text: string;
  highlight?: string;
  highlightClass?: string;
}) {
  return (
    <div className="status-pill ml-3">
      <span className="ping-wrap" />
      <i className="fa-solid fa-wand-magic-sparkles text-primary text-[10px]" />
      <span>{text}</span>
      {highlight && (
        <>
          <span className="text-text-muted">·</span>
          <span className={`${highlightClass} font-bold`}>{highlight}</span>
        </>
      )}
    </div>
  );
}
