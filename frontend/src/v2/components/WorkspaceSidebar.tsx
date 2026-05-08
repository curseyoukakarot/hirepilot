/**
 * v2 Workspace Sidebar
 *
 * HTML/JSX preserved EXACTLY from mockups/workspace.html sidebar block.
 * Only conversions: class→className, escaped quotes, NavLink for routing.
 *
 * Counts/badges currently hardcoded to match mockup. TODO wire to:
 *   - workspace name + member count from team_settings
 *   - Goals count from goals table
 *   - Decisions count from decisions table
 *   - Team count from agents table
 *   - Leads count from leads table (workspace-scoped)
 *   - Inbox unread from email_replies / messages
 *   - Deals total from opportunities
 */

import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useMyWorkspaces } from '../hooks/useWorkspaces';
import { useUIVersion } from '../hooks/useUIVersion';

interface SidebarCounts {
  goals?: number;
  decisions?: number;
  team?: number;
  leads?: number;
  pipelines?: number;
  inbox?: number;
  dealsTotal?: string; // formatted "$284k"
  agentsWorking?: number;
}

interface Props {
  workspaceInitial?: string;     // "HP" or team initial
  workspaceName?: string;
  workspaceSubtitle?: string;
  counts?: SidebarCounts;
}

export default function WorkspaceSidebar({
  workspaceInitial = 'HP',
  workspaceName = "Brandon's HirePilot",
  workspaceSubtitle = '3 agents working',
  counts = {},
}: Props) {
  const c = {
    goals: 2,
    decisions: 1,
    team: 3,
    leads: 3247,
    pipelines: 5,
    inbox: 12,
    dealsTotal: '$284k',
    agentsWorking: 3,
    ...counts,
  };

  // Helper for active nav class
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-2.5 py-1.5 rounded-md ${
      isActive ? 'channel-active' : 'hover:bg-surface text-text-secondary'
    }`;

  return (
    <aside className="w-[228px] shrink-0 glass border-r border-gray-100 flex flex-col h-screen sticky top-0">
      {/* Workspace header — clickable to switch */}
      <WorkspaceHeader
        fallbackInitial={workspaceInitial}
        fallbackName={workspaceName}
        fallbackSubtitle={workspaceSubtitle}
      />

      {/* Search + ⌘K */}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 bg-surface rounded-lg px-2.5 py-1.5 text-xs text-text-muted">
          <i className="fa-solid fa-magnifying-glass text-[10px]" />
          <span className="flex-1">Jump to anything</span>
          <span className="kbd">⌘K</span>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-1.5 py-2 space-y-4">
        {/* Pinned */}
        <div>
          <div className="mb-1.5">
            <span className="nav-section-h">Pinned</span>
          </div>
          <ul className="space-y-px text-[13px]">
            <li>
              <NavLink to="/v2/today" className={navClass} end>
                <i className="fa-solid fa-sun w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Today</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/v2/goals" className={navClass}>
                <i className="fa-solid fa-rocket w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Goals</span>
                {c.goals ? (
                  <span className="text-[10px] font-bold text-primary">{c.goals}</span>
                ) : null}
              </NavLink>
            </li>
            <li>
              <NavLink to="/v2/decisions" className={navClass}>
                <i className="fa-solid fa-inbox w-4 text-[11px] text-warn" />
                <span className="flex-1">Decisions</span>
                {c.decisions ? (
                  <span className="text-[10px] font-bold bg-warn text-white rounded-full px-1.5 leading-snug">
                    {c.decisions}
                  </span>
                ) : null}
              </NavLink>
            </li>
            <li>
              <NavLink to="/v2/team" className={navClass}>
                <i className="fa-solid fa-users-gear w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Team</span>
                {c.team ? (
                  <span className="text-[10px] text-primary font-bold">{c.team}</span>
                ) : null}
              </NavLink>
            </li>
          </ul>
        </div>

        {/* Workspace */}
        <div>
          <div className="mb-1.5">
            <span className="nav-section-h">Workspace</span>
          </div>
          <ul className="space-y-px text-[13px]">
            <li>
              <NavLink to="/v2/leads" className={navClass}>
                <i className="fa-solid fa-database w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Leads</span>
                <span className="text-[10px] text-text-muted">{c.leads.toLocaleString()}</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/v2/pipelines" className={navClass}>
                <i className="fa-solid fa-table-columns w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Pipelines</span>
                <span className="text-[10px] text-text-muted">{c.pipelines}</span>
              </NavLink>
            </li>
            <li>
              {/* Campaigns aren't in v2 yet — link to the legacy surface. */}
              <a href="/campaigns" className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-surface text-text-secondary">
                <i className="fa-solid fa-paper-plane w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Campaigns</span>
                <i className="fa-solid fa-arrow-up-right-from-square text-[8px] text-text-muted" title="opens in classic UI" />
              </a>
            </li>
            <li>
              <NavLink to="/v2/inbox" className={navClass}>
                <i className="fa-solid fa-envelope w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Inbox</span>
                {c.inbox ? (
                  <span className="text-[10px] font-bold text-primary">{c.inbox}</span>
                ) : null}
              </NavLink>
            </li>
            <li>
              <NavLink to="/v2/deals" className={navClass}>
                <i className="fa-solid fa-handshake w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Deals</span>
                <span className="text-[10px] text-success font-semibold">{c.dealsTotal}</span>
              </NavLink>
            </li>
            <li>
              <a href="/messaging-reports" className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-surface text-text-secondary">
                <i className="fa-solid fa-chart-line w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Reports</span>
                <i className="fa-solid fa-arrow-up-right-from-square text-[8px] text-text-muted" title="opens in classic UI" />
              </a>
            </li>
          </ul>
        </div>

        {/* Tools — link to legacy surfaces until v2 versions ship */}
        <div>
          <div className="mb-1.5">
            <span className="nav-section-h">Tools</span>
          </div>
          <ul className="space-y-px text-[13px]">
            <li>
              <a href="/custom-tables" className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-surface text-text-secondary">
                <i className="fa-solid fa-table w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Tables</span>
                <i className="fa-solid fa-arrow-up-right-from-square text-[8px] text-text-muted" />
              </a>
            </li>
            <li>
              <a href="/custom-forms" className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-surface text-text-secondary">
                <i className="fa-solid fa-clipboard-list w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Forms</span>
                <i className="fa-solid fa-arrow-up-right-from-square text-[8px] text-text-muted" />
              </a>
            </li>
            <li>
              <a href="/tasks" className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-surface text-text-secondary">
                <i className="fa-solid fa-list-check w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Tasks</span>
                <i className="fa-solid fa-arrow-up-right-from-square text-[8px] text-text-muted" />
              </a>
            </li>
            <li>
              <a href="/sequences" className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-surface text-text-secondary">
                <i className="fa-solid fa-list-ol w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Sequences</span>
                <i className="fa-solid fa-arrow-up-right-from-square text-[8px] text-text-muted" />
              </a>
            </li>
            <li>
              <a href="/templates" className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-surface text-text-secondary">
                <i className="fa-solid fa-file-lines w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Templates</span>
                <i className="fa-solid fa-arrow-up-right-from-square text-[8px] text-text-muted" />
              </a>
            </li>
            <li>
              <a href="/settings" className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-surface text-text-secondary">
                <i className="fa-solid fa-gear w-4 text-[11px] text-text-muted" />
                <span className="flex-1">All Settings</span>
                <i className="fa-solid fa-arrow-up-right-from-square text-[8px] text-text-muted" />
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Switch-to-classic escape hatch */}
      <SwitchToClassicLink />

      {/* Footer profile */}
      <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 ring-2 ring-white shadow" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold truncate">Brandon</div>
        </div>
        <button className="w-6 h-6 rounded hover:bg-surface flex items-center justify-center text-text-muted">
          <i className="fa-solid fa-gear text-[10px]" />
        </button>
      </div>
    </aside>
  );
}

/**
 * Lets users flip back to the classic UI mid-session if v2 doesn't have
 * the surface they need. Updates users.ui_version and full-reloads to
 * /dashboard so the legacy app boots fresh.
 */
function SwitchToClassicLink() {
  const { switchTo, isLoading } = useUIVersion();
  return (
    <div className="border-t border-gray-100 px-3 py-2">
      <button
        onClick={() => switchTo('legacy')}
        disabled={isLoading}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11.5px] text-text-muted hover:bg-surface hover:text-text-secondary disabled:opacity-50"
        title="Switch back to the classic HirePilot UI"
      >
        <i className="fa-solid fa-arrow-left text-[10px]" />
        <span className="flex-1 text-left">Switch to classic UI</span>
      </button>
    </div>
  );
}

/**
 * Sidebar workspace header with a popover switcher. Pulls from
 * /api/workspaces/mine and lets the user pick the active workspace; switching
 * writes to localStorage and reloads so every surface refetches.
 */
function WorkspaceHeader({
  fallbackInitial,
  fallbackName,
  fallbackSubtitle,
}: {
  fallbackInitial: string;
  fallbackName: string;
  fallbackSubtitle: string;
}) {
  const { workspaces, activeId, switchTo } = useMyWorkspaces();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close popover on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const active = workspaces.find((w) => w.workspace_id === activeId);
  const activeName = active?.workspaces?.name || fallbackName;
  const activeInitial = (active?.workspaces?.name || fallbackInitial).slice(0, 2).toUpperCase();
  const memberCount = workspaces.length;
  const subtitle = active?.workspaces?.plan
    ? `${active.workspaces.plan} · ${active.role || 'member'}`
    : fallbackSubtitle;

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={() => workspaces.length > 1 && setOpen((v) => !v)}
        className="w-full px-3.5 py-3 border-b border-gray-100 flex items-center gap-2.5 hover:bg-surface/40 text-left"
        title={workspaces.length > 1 ? 'Switch workspace' : undefined}
      >
        <div className="w-7 h-7 rounded-lg grad-icon flex items-center justify-center text-white font-bold text-[11px] shadow-md">
          {activeInitial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold truncate">{activeName}</div>
          <div className="text-[10.5px] text-text-muted flex items-center gap-1">
            <span className="live-dot" />
            {subtitle}
          </div>
        </div>
        {workspaces.length > 1 && (
          <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} text-[10px] text-text-muted`} />
        )}
      </button>

      {open && (
        <div className="absolute z-30 left-2 right-2 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 max-h-[60vh] overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Workspaces · {memberCount}
          </div>
          {workspaces.map((w) => {
            const name = w.workspaces?.name || 'Unnamed workspace';
            const init = name.slice(0, 2).toUpperCase();
            const isActive = w.workspace_id === activeId;
            return (
              <button
                key={w.workspace_id}
                onClick={() => { setOpen(false); switchTo(w.workspace_id); }}
                className={`w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-surface ${isActive ? 'bg-primary/5' : ''}`}
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-white font-bold text-[10px] ${isActive ? 'grad-icon' : 'bg-gradient-to-br from-slate-400 to-slate-600'}`}>
                  {init}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold truncate">{name}</div>
                  <div className="text-[10px] text-text-muted">
                    {w.workspaces?.plan || 'free'} · {w.role || 'member'}
                  </div>
                </div>
                {isActive && <i className="fa-solid fa-check text-primary text-[10px]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
