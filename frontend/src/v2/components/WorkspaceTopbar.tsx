/**
 * v2 Workspace Topbar
 *
 * HTML/JSX preserved EXACTLY from mockups/workspace.html topbar block.
 *
 * Props let each page customize the title, status pill, and any extra content
 * (e.g. avatar cluster on team workspaces).
 */

import React, { ReactNode } from 'react';
import V2Dropdown from './V2Dropdown';
import { useWorkspaceSettings } from '../hooks/useWorkspaceSettings';
import { toastSuccess } from './V2Toast';

export type TrustLevel = 'manual' | 'suggest' | 'autopilot';

interface Props {
  pageTitle: string;
  pageIcon?: string;       // FA class, e.g. "fa-solid fa-sun"
  pageIconColor?: string;  // tailwind text class, e.g. "text-warn"
  pageSubtitle?: string;
  statusPill?: ReactNode;  // arbitrary status content (e.g. REX status pill)
  trustLevel?: TrustLevel; // shows badge in top-right (overrides workspace default)
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

        <TrustBadgeMenu fallback={trustLevel} />

        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 ring-2 ring-white" />
      </div>
    </header>
  );
}

/**
 * Trust badge → opens a dropdown to change the workspace's default
 * trust level (workspace_settings.default_trust_level). The active level
 * comes from settings; falls back to the prop when settings aren't loaded.
 */
function TrustBadgeMenu({ fallback }: { fallback: TrustLevel }) {
  const { settings, update } = useWorkspaceSettings();
  const active = (settings?.default_trust_level as TrustLevel) || fallback;
  const labels: Record<TrustLevel, string> = { autopilot: 'Autopilot', suggest: 'Suggest', manual: 'Manual' };
  const icons: Record<TrustLevel, string> = { autopilot: 'rocket', suggest: 'wand-magic-sparkles', manual: 'hand' };

  const setLevel = (level: TrustLevel) => {
    if (level === active) return;
    update.mutate({ default_trust_level: level } as any, {
      onSuccess: () => toastSuccess(`Workspace default set to ${labels[level]}`),
    });
  };

  return (
    <V2Dropdown
      align="right"
      minWidth={260}
      trigger={
        <span className="trust-badge cursor-pointer" title="Click to change workspace default trust level">
          <i className={`fa-solid fa-${icons[active]} text-[10px]`} />
          {labels[active]}
          <i className="fa-solid fa-chevron-down text-[9px] opacity-80" />
        </span>
      }
      items={[
        { key: 'hdr', header: true, label: 'Workspace default trust' },
        {
          key: 'autopilot',
          icon: 'rocket',
          label: <span><span className="font-semibold">Autopilot</span> · REX acts above your threshold</span>,
          selected: active === 'autopilot',
          onClick: () => setLevel('autopilot'),
        },
        {
          key: 'suggest',
          icon: 'wand-magic-sparkles',
          label: <span><span className="font-semibold">Suggest</span> · REX drafts, you approve</span>,
          selected: active === 'suggest',
          onClick: () => setLevel('suggest'),
        },
        {
          key: 'manual',
          icon: 'hand',
          label: <span><span className="font-semibold">Manual</span> · REX never acts on its own</span>,
          selected: active === 'manual',
          onClick: () => setLevel('manual'),
        },
        { key: 'd1', divider: true, label: '' },
        {
          key: 'agents',
          icon: 'people-group',
          label: 'Set per-agent trust',
          onClick: () => { window.location.href = '/v2/team'; },
        },
      ]}
    />
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
