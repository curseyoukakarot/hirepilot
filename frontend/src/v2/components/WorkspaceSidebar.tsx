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

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

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
      {/* Workspace header */}
      <div className="px-3.5 py-3 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg grad-icon flex items-center justify-center text-white font-bold text-[11px] shadow-md">
          {workspaceInitial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold truncate">{workspaceName}</div>
          <div className="text-[10.5px] text-text-muted flex items-center gap-1">
            <span className="live-dot" />
            {workspaceSubtitle}
          </div>
        </div>
        <button className="text-text-muted hover:text-text-main">
          <i className="fa-solid fa-chevron-down text-[10px]" />
        </button>
      </div>

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
              <NavLink to="/v2/campaigns" className={navClass}>
                <i className="fa-solid fa-paper-plane w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Campaigns</span>
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
              </NavLink>
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
              <NavLink to="/v2/reports" className={navClass}>
                <i className="fa-solid fa-chart-line w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Reports</span>
              </NavLink>
            </li>
          </ul>
        </div>

        {/* Tools */}
        <div>
          <div className="mb-1.5">
            <span className="nav-section-h">Tools</span>
          </div>
          <ul className="space-y-px text-[13px]">
            <li>
              <NavLink to="/v2/tables" className={navClass}>
                <i className="fa-solid fa-table w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Tables</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/v2/forms" className={navClass}>
                <i className="fa-solid fa-clipboard-list w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Forms</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/v2/tasks" className={navClass}>
                <i className="fa-solid fa-list-check w-4 text-[11px] text-text-muted" />
                <span className="flex-1">Tasks</span>
              </NavLink>
            </li>
          </ul>
        </div>
      </div>

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
