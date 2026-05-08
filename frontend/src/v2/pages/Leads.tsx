/**
 * v2 / Leads — CRM-grade lead database
 *
 * HTML preserved EXACTLY from mockups/leads.html main content block.
 * Multi-pane layout: workspace sidebar | filter sidebar | table | detail drawer.
 *
 * TODO wire to backend:
 *   - GET /api/v2/leads with filter+sort+pagination (reuse existing routes/leads.ts)
 *   - Filter sidebar checkboxes/tags/source/score → filter querystring
 *   - Bulk-action bar → existing /api/leads/bulk-* endpoints
 *   - Detail drawer → /api/v2/leads/:id (reuses LeadProfileDrawer logic)
 *   - REX context strip → REX agent active goal context
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import WorkspaceSidebar from '../components/WorkspaceSidebar';
import { RexSkillButtons, RexSkillsHireCTA, type SkillButtonSpec } from '../components/RexSkillButtons';
import { useAgents, findAgentByRole } from '../hooks/useAgents';
import { useLeads, leadDomain, type Lead } from '../hooks/useLeads';
import { useV2Theme } from '../hooks/useV2Theme';
import { toastSoon, toastInfo, toastSuccess } from '../components/V2Toast';
import V2Modal, { ModalCancel, ModalPrimary } from '../components/V2Modal';
import V2Dropdown from '../components/V2Dropdown';
import '../../styles/v2.css';

/** Random gradient palette for lead avatars (deterministic by id). */
const AV_GRADIENTS = [
  'from-emerald-400 to-emerald-600',
  'from-rose-400 to-pink-600',
  'from-amber-400 to-orange-500',
  'from-cyan-400 to-blue-500',
  'from-purple-400 to-blue-400',
  'from-violet-400 to-purple-600',
];
function avatarBgFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV_GRADIENTS[h % AV_GRADIENTS.length];
}
function initialsFor(lead: Lead): string {
  const f = (lead.first_name || '').trim()[0] || '';
  const l = (lead.last_name || '').trim()[0] || '';
  if (f || l) return (f + l).toUpperCase();
  const name = (lead.name || lead.email || '?').trim();
  return name.split(' ').slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || '?';
}
function fullName(lead: Lead): string {
  return [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() ||
    lead.name || lead.email || 'Unknown';
}
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface LeadRow {
  selected?: boolean;
  active?: boolean;
  initials: string;
  avBg: string;
  name: string;
  hasLinkedIn?: boolean;
  email: string;
  company: string;
  title: string;
  status: { label: string; cls: string };
  score: number;
  source: { icon?: string; iconCls?: string; label: string };
  campaign: string;
  lastActivity: string;
  rexBadge?: 'draft' | 'decision' | 'autosent' | null;
}

const LEADS: LeadRow[] = [
  { active: true, selected: true, initials: 'SC', avBg: 'from-emerald-400 to-emerald-600', name: 'Sarah Chen', hasLinkedIn: true, email: 'sarah.chen@stripe.com', company: 'Stripe', title: 'Senior Backend Eng', status: { label: '● Hot', cls: 'tag-success' }, score: 94, source: { icon: 'fa-brands fa-linkedin', iconCls: 'text-secondary', label: 'Sniper' }, campaign: 'Q2 Senior Engineers', lastActivity: 'Replied · 2m ago', rexBadge: 'draft' },
  { selected: true, initials: 'MR', avBg: 'from-blue-400 to-blue-600', name: 'Marcus Rodriguez', email: 'm.rodriguez@linear.app', company: 'Linear', title: 'Staff Engineer', status: { label: '● Warm', cls: 'tag-warn' }, score: 87, source: { icon: 'fa-brands fa-linkedin', iconCls: 'text-secondary', label: 'Sniper' }, campaign: 'Q2 Senior Engineers', lastActivity: 'Replied · 14m ago', rexBadge: 'decision' },
  { selected: true, initials: 'PP', avBg: 'from-amber-400 to-orange-500', name: 'Priya Patel', email: 'ppatel@figma.com', company: 'Figma', title: 'Sr. Product Designer', status: { label: '● Hot', cls: 'tag-success' }, score: 91, source: { label: 'Apollo' }, campaign: 'Designers Remote', lastActivity: 'Replied · 28m ago', rexBadge: 'draft' },
  { initials: 'JW', avBg: 'from-purple-400 to-purple-700', name: 'Jamal Williams', email: 'jamal@vercel.com', company: 'Vercel', title: 'Backend Engineer', status: { label: '● Phone screen', cls: 'tag-secondary' }, score: 82, source: { icon: 'fa-brands fa-linkedin', iconCls: 'text-secondary', label: 'Sniper' }, campaign: 'Sales Reps SF', lastActivity: 'Stage moved · 1h ago' },
  { initials: 'EK', avBg: 'from-rose-400 to-pink-600', name: 'Emily Kovacs', email: 'ekovacs@notion.so', company: 'Notion', title: 'Director of Engineering', status: { label: '● Hot', cls: 'tag-success' }, score: 96, source: { icon: 'fa-brands fa-linkedin', iconCls: 'text-secondary', label: 'Sniper' }, campaign: 'Q2 Senior Engineers', lastActivity: 'Opened · 2h ago', rexBadge: 'draft' },
  { initials: 'DT', avBg: 'from-cyan-400 to-blue-500', name: 'Devin Tran', email: 'devin@anthropic.com', company: 'Anthropic', title: 'ML Engineer', status: { label: '● Warm', cls: 'tag-warn' }, score: 88, source: { label: 'Apollo' }, campaign: 'ML Engineers', lastActivity: 'Opened · 4h ago' },
  { initials: 'AO', avBg: 'from-violet-400 to-purple-600', name: 'Aisha Okafor', email: 'aisha@replit.com', company: 'Replit', title: 'Engineering Manager', status: { label: '● Hot', cls: 'tag-success' }, score: 93, source: { icon: 'fa-brands fa-linkedin', iconCls: 'text-secondary', label: 'Sniper' }, campaign: 'Q2 Senior Engineers', lastActivity: 'Auto-replied · 5h ago', rexBadge: 'autosent' },
];

export default function LeadsPage() {
  useV2Theme();

  const { leads, isLoading } = useLeads({ limit: 100 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [drawerTab, setDrawerTab] = useState<'activity' | 'messages' | 'notes' | 'files'>('activity');
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const PAGE_SIZE = 25;
  const selected: Lead | undefined = useMemo(
    () => leads.find((l) => l.id === selectedId) || leads[0],
    [leads, selectedId],
  );
  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, leads.length);

  // Clamp page if leads list shrinks (filter changes, etc).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Drawer prev/next navigates the selected lead.
  const selectedIdx = leads.findIndex((l) => l.id === (selectedId || leads[0]?.id));
  const goPrevLead = () => {
    if (selectedIdx > 0) setSelectedId(leads[selectedIdx - 1].id);
  };
  const goNextLead = () => {
    if (selectedIdx >= 0 && selectedIdx < leads.length - 1) setSelectedId(leads[selectedIdx + 1].id);
  };

  return (
    <div className="v2-app autopilot flex min-h-screen relative z-10">

      <WorkspaceSidebar />

      {/* Filter sidebar */}
      <aside className={`filter-sidebar w-[200px] shrink-0 border-r border-gray-100 bg-white/40 h-screen sticky top-0 overflow-y-auto p-3${filtersCollapsed ? ' fs-collapsed' : ''}`}>
        <div className="flex items-center justify-end mb-2 -mt-1">
          <button
            onClick={() => setFiltersCollapsed(true)}
            className="fs-toggle"
            title="Collapse filters"
            aria-label="Collapse filters"
          >
            <i className="fa-solid fa-chevron-left text-[10px]" />
          </button>
        </div>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2 px-2">
            <span className="nav-section-h !p-0">Saved views</span>
            <button onClick={() => toastSoon('Custom saved views')} className="text-text-muted hover:text-text-main" title="Save current filters as a view"><i className="fa-solid fa-plus text-[10px]" /></button>
          </div>
          <ul className="space-y-px text-[13px]">
            {[
              { key: 'hot',     active: true, icon: 'fa-fire',                  label: 'Hot leads',          count: leads.filter((l: any) => (l.score ?? 0) >= 90).length || 0 },
              { key: 'replied', icon: 'fa-regular fa-clock',                    label: 'Replied today',      count: '—' },
              { key: 'bookmarked', icon: 'fa-regular fa-bookmark',              label: 'Bookmarked',         count: '—' },
              { key: 'campaign',   icon: 'fa-regular fa-paper-plane',           label: 'In active campaign', count: leads.filter((l: any) => l.campaign_id).length || 0 },
              { key: 'all',     icon: 'fa-solid fa-database',                   label: 'All leads',          count: leads.length || 0 },
            ].map((v) => (
              <li key={v.key}>
                <button
                  onClick={() => toastSoon(`Saved view: ${v.label}`)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md ${v.active ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-surface text-text-secondary'}`}
                >
                  <span className="flex items-center gap-2"><i className={`fa-solid ${v.icon} w-3 text-[10px] ${v.active ? '' : 'text-text-muted'}`} />{v.label}</span>
                  <span className={`text-[10px] ${v.active ? '' : 'text-text-muted'}`}>{v.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-4">
          <div className="mb-2 px-2"><span className="nav-section-h !p-0">Tags</span></div>
          <div className="flex flex-wrap gap-1 px-1">
            <span className="tag" style={{ background: 'rgba(107,70,193,.1)', color: '#6B46C1' }}>Engineering</span>
            <span className="tag tag-secondary">Sales</span>
            <span className="tag" style={{ background: 'rgba(236,72,153,.1)', color: '#EC4899' }}>Design</span>
            <span className="tag tag-warn">Senior</span>
            <span className="tag tag-success">Remote</span>
            <span className="tag tag-muted">+12</span>
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-2 px-2"><span className="nav-section-h !p-0">Source</span></div>
          <ul className="space-y-1 text-[12.5px] px-1">
            {[
              { checked: true, label: 'LinkedIn (Sniper)', count: '1,842' },
              { checked: true, label: 'Apollo', count: 724 },
              { label: 'CSV import', count: 487 },
              { label: 'Manual', count: 194 },
            ].map((s) => (
              <li key={s.label} className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-text-secondary">
                  <input type="checkbox" defaultChecked={s.checked} className="rounded text-primary w-3 h-3" />
                  <span>{s.label}</span>
                </label>
                <span className="text-[10px] text-text-muted">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-4">
          <div className="mb-2 px-2"><span className="nav-section-h !p-0">REX score</span></div>
          <div className="px-2">
            <input type="range" className="w-full accent-primary" />
            <div className="flex justify-between text-[10px] text-text-muted mt-1">
              <span>0</span><span className="text-primary font-semibold">≥ 70</span><span>100</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">

        {/* Topbar */}
        <header className="border-b border-gray-100 px-6 h-14 glass flex items-center gap-4 sticky top-0 z-30">
          <div>
            <div className="font-semibold text-[14.5px] flex items-center gap-2"><i className="fa-solid fa-database text-primary text-xs" />Leads</div>
            <div className="text-[10.5px] text-text-muted">3,247 total · 847 active · 12 hot</div>
          </div>
          <div className="status-pill ml-3">
            <span className="ping-wrap" />
            <i className="fa-solid fa-wand-magic-sparkles text-primary text-[10px]" />
            <span>scoring 247 new leads</span>
            <span className="text-text-muted">·</span>
            <span className="text-primary font-bold">live</span>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={() => { window.location.href = '/v2/settings/team'; }}
              title="Open guardrails settings"
              className="trust-badge"
            ><i className="fa-solid fa-rocket text-[10px]" />Autopilot<i className="fa-solid fa-chevron-down text-[9px] opacity-80" /></button>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 ring-2 ring-white" />
          </div>
        </header>

        {/* Action bar */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2.5 flex-wrap">
          <h2 className="text-[20px] font-bold tracking-tight flex items-center gap-2">
            Hot leads <span className="text-[12px] text-text-muted font-normal">12 of 3,247</span>
          </h2>
          <div className="flex items-center gap-1.5 ml-3">
            <button
              onClick={() => toastSoon('Remove filter: Score ≥ 90')}
              className="px-2.5 py-1 rounded-full text-[11.5px] font-medium border hover:opacity-80"
              style={{ background: 'rgba(107,70,193,.1)', color: '#6B46C1', borderColor: 'rgba(107,70,193,.3)' }}
            >Score ≥ 90</button>
            <button
              onClick={() => toastSoon('Remove filter: Replied today')}
              className="px-2.5 py-1 rounded-full text-[11.5px] font-medium border hover:opacity-80"
              style={{ background: 'rgba(107,70,193,.1)', color: '#6B46C1', borderColor: 'rgba(107,70,193,.3)' }}
            >Replied today</button>
            <button
              onClick={() => toastSoon('Add a filter')}
              className="px-2.5 py-1 rounded-full text-[11.5px] font-medium border bg-surface hover:bg-gray-100"
              style={{ borderColor: '#E5E7EB' }}
            >+ Filter</button>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <V2Dropdown
              align="right"
              minWidth={180}
              trigger={
                <span className="btn-outline cursor-pointer">
                  <i className="fa-solid fa-arrow-up-wide-short text-[10px]" />Sort: Last activity
                </span>
              }
              items={[
                { key: 'last',  icon: 'clock-rotate-left',     label: 'Last activity', selected: true,  onClick: () => {} },
                { key: 'name',  icon: 'arrow-down-a-z',        label: 'Name (A→Z)',    onClick: () => toastSoon('Sort by name') },
                { key: 'score', icon: 'arrow-down-9-1',        label: 'Score (high→low)', onClick: () => toastSoon('Sort by score') },
                { key: 'created', icon: 'calendar-plus',       label: 'Recently added', onClick: () => toastSoon('Sort by created date') },
              ]}
            />
            <button onClick={() => window.location.href = '/leads/import'} className="btn-outline" title="Import leads (opens in classic UI)"><i className="fa-solid fa-file-import text-[10px]" />Import</button>
            <button onClick={() => toastSoon('Export filtered leads to CSV')} className="btn-outline"><i className="fa-solid fa-file-export text-[10px]" />Export</button>
            <button onClick={() => window.location.href = '/leads'} className="btn-solid" title="Add a new lead (opens in classic UI)"><i className="fa-solid fa-plus text-[10px]" />New lead</button>
          </div>
        </div>

        {/* REX context strip */}
        <div className="px-6 pt-4 pb-2 float-in d-1">
          <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'linear-gradient(90deg,rgba(107,70,193,.05),rgba(12,92,244,.03) 70%,transparent)', border: '1px solid rgba(107,70,193,.12)' }}>
            <div className="w-7 h-7 rounded-md grad-icon flex items-center justify-center text-white shrink-0 shadow-sm"><i className="fa-solid fa-wand-magic-sparkles text-[11px]" /></div>
            <div className="flex-1 text-[13px]">
              <span className="font-semibold">REX:</span>
              <span className="text-text-secondary"> I scored 247 new leads from your Q2 Engineers sourcing run · the 12 below all match your "Stripe-tier engineer" pattern.</span>
              <span className="text-primary font-semibold ml-1.5">Want me to draft outreach for all 12?</span>
            </div>
            <button onClick={() => toastSoon('Bulk draft outreach via Recruiter')} className="btn-solid !py-1 !px-2.5 !text-[11.5px]"><i className="fa-solid fa-bolt text-[9px]" />Draft for all 12</button>
            <button onClick={() => toastInfo('Strip dismissed for this session.')} className="ghost-btn !text-[11.5px]">Dismiss</button>
          </div>
        </div>

        {/* Bulk action bar */}
        <div className="mx-6 mb-2 px-3 py-2 rounded-xl flex items-center gap-3 text-[12px] float-in d-2" style={{ background: 'rgba(107,70,193,.08)', border: '1px solid rgba(107,70,193,.15)' }}>
          <span className="text-primary font-semibold">3 selected</span>
          <span className="w-px h-4 bg-primary/20" />
          <button onClick={() => toastSoon('Add selected leads to a campaign')} className="text-primary hover:underline"><i className="fa-solid fa-paper-plane text-[10px] mr-1" />Add to campaign</button>
          <button onClick={() => toastSoon('Tag selected leads')} className="text-primary hover:underline"><i className="fa-solid fa-tag text-[10px] mr-1" />Tag</button>
          <button onClick={() => toastSoon('Move to a pipeline (job)')} className="text-primary hover:underline"><i className="fa-solid fa-table-columns text-[10px] mr-1" />Move to pipeline</button>
          <button onClick={() => toastInfo('Open REX (⌘K) to act on the selected leads.')} className="text-primary hover:underline font-bold"><i className="fa-solid fa-wand-magic-sparkles text-[10px] mr-1" />Ask REX</button>
          <button onClick={() => toastSoon('Bulk delete selected leads')} className="text-text-muted hover:text-danger ml-auto"><i className="fa-solid fa-trash text-[10px]" /></button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          <div className="bg-white rounded-xl overflow-hidden float-in d-3" style={{ border: '1px solid #ECECEC' }}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider text-text-muted bg-surface/60 font-semibold">
                  <th className="text-left px-4 py-2.5 w-9"><input type="checkbox" className="rounded w-3 h-3" /></th>
                  <th className="text-left px-3 py-2.5">Name</th>
                  <th className="text-left px-3 py-2.5">Title</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-left px-3 py-2.5">Score</th>
                  <th className="text-left px-3 py-2.5">Source</th>
                  <th className="text-left px-3 py-2.5">In campaign</th>
                  <th className="text-left px-3 py-2.5">Last activity</th>
                  <th className="px-3 py-2.5 w-9" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* Live leads from /api/leads — paginated to current page */}
                {leads.length > 0 ? leads.slice(pageStart, pageEnd).map((lead) => {
                  const active = (selectedId || leads[0]?.id) === lead.id;
                  const score = (lead as any).score ?? null;
                  return (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedId(lead.id)}
                    className={`cursor-pointer transition-colors ${active ? '' : 'hover:bg-primary/4'}`}
                    style={active ? { background: 'linear-gradient(90deg,rgba(107,70,193,.06),rgba(12,92,244,.04))' } : undefined}
                  >
                    <td className="px-4 py-2.5"><input type="checkbox" className="rounded text-primary w-3 h-3" onClick={(e) => e.stopPropagation()} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarBgFor(lead.id)} flex items-center justify-center text-white text-[10px] font-semibold ${active ? 'ring-2 ring-primary/30' : ''}`}>{initialsFor(lead)}</div>
                        <div>
                          <div className="font-semibold flex items-center gap-1.5">{fullName(lead)} {lead.linkedin_url && <i className="fa-brands fa-linkedin text-secondary text-[10px]" />}</div>
                          <div className="text-[11px] text-text-muted">{[lead.company, lead.email].filter(Boolean).join(' · ') || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{lead.title || '—'}</td>
                    <td className="px-3 py-2.5"><span className="tag tag-muted">{lead.status || 'New'}</span></td>
                    <td className="px-3 py-2.5">
                      {score != null ? (
                        <div className="flex items-center gap-2">
                          <span className="font-bold w-6">{score}</span>
                          <div className="w-14 h-1 rounded-full bg-gray-200 overflow-hidden"><div className="grad-icon h-full" style={{ width: `${Math.min(100, Math.max(0, score))}%` }} /></div>
                        </div>
                      ) : <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px] text-text-secondary">
                      {lead.enrichment_source || lead.source || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px] text-text-secondary">{lead.campaign_id ? lead.campaign_id.slice(0, 8) : '—'}</td>
                    <td className="px-3 py-2.5 text-[11.5px] text-text-muted">{relativeTime(lead.created_at)}</td>
                    <td className="px-3 py-2.5" />
                  </tr>
                  );
                }) : (!isLoading && LEADS.map((l, i) => (
                  <tr key={i} className={`cursor-pointer transition-colors ${l.active ? '' : 'hover:bg-primary/4'}`} style={l.active ? { background: 'linear-gradient(90deg,rgba(107,70,193,.06),rgba(12,92,244,.04))' } : undefined}>
                    <td className="px-4 py-2.5"><input type="checkbox" defaultChecked={l.selected} className="rounded text-primary w-3 h-3" /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${l.avBg} flex items-center justify-center text-white text-[10px] font-semibold ${l.active ? 'ring-2 ring-primary/30' : ''}`}>{l.initials}</div>
                        <div>
                          <div className="font-semibold flex items-center gap-1.5">{l.name} {l.hasLinkedIn && <i className="fa-brands fa-linkedin text-secondary text-[10px]" />}</div>
                          <div className="text-[11px] text-text-muted">{l.company} · {l.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{l.title}</td>
                    <td className="px-3 py-2.5"><span className={`tag ${l.status.cls}`}>{l.status.label}</span></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold w-6">{l.score}</span>
                        <div className="w-14 h-1 rounded-full bg-gray-200 overflow-hidden"><div className="grad-icon h-full" style={{ width: `${l.score}%` }} /></div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px] text-text-secondary">
                      {l.source.icon && <i className={`${l.source.icon} ${l.source.iconCls} mr-1`} />}{l.source.label}
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px] text-text-secondary">{l.campaign}</td>
                    <td className="px-3 py-2.5 text-[11.5px] text-text-muted">{l.lastActivity}</td>
                    <td className="px-3 py-2.5">
                      {l.rexBadge === 'draft' && <i className="fa-solid fa-wand-magic-sparkles text-primary text-[12px]" title="REX has a draft ready" />}
                      {l.rexBadge === 'decision' && <i className="fa-solid fa-circle-question text-warn text-[12px]" title="Decision waiting" />}
                      {l.rexBadge === 'autosent' && <i className="fa-solid fa-circle-check text-success text-[12px]" title="REX auto-sent reply" />}
                    </td>
                  </tr>
                )))}
                {isLoading && (
                  <tr><td colSpan={9} className="text-center text-text-muted py-8 text-[12.5px]">
                    <i className="fa-solid fa-spinner fa-spin mr-2 text-primary" />Loading leads…
                  </td></tr>
                )}
              </tbody>
            </table>

            <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-[11px] text-text-muted">
              <span>{
                leads.length > 0
                  ? `Showing ${pageStart + 1}–${pageEnd} of ${leads.length} leads`
                  : isLoading ? 'Loading…' : 'No leads yet — sample data shown'
              }</span>
              {leads.length > 0 && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    title="Previous page"
                    className="px-2 py-1 rounded hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                  ><i className="fa-solid fa-chevron-left text-[10px]" /></button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`px-2 py-1 rounded ${page === n ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-surface'}`}
                    >
                      {n}
                    </button>
                  ))}
                  {totalPages > 5 && <span className="px-1 text-text-muted">…</span>}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    title="Next page"
                    className="px-2 py-1 rounded hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                  ><i className="fa-solid fa-chevron-right text-[10px]" /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Detail drawer */}
      <aside className="slide-in-right w-[400px] shrink-0 border-l border-gray-100 bg-white h-screen sticky top-0 overflow-y-auto">
        <div className="sticky top-0 bg-white/90 glass border-b border-gray-100 px-5 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5">
            <button
              onClick={goPrevLead}
              disabled={selectedIdx <= 0}
              title="Previous lead"
              className="text-text-muted hover:text-text-main w-7 h-7 rounded hover:bg-surface flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            ><i className="fa-solid fa-chevron-left text-[11px]" /></button>
            <button
              onClick={goNextLead}
              disabled={selectedIdx < 0 || selectedIdx >= leads.length - 1}
              title="Next lead"
              className="text-text-muted hover:text-text-main w-7 h-7 rounded hover:bg-surface flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            ><i className="fa-solid fa-chevron-right text-[11px]" /></button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => toastSoon('Bookmark this lead')}
              title="Bookmark"
              className="w-7 h-7 rounded hover:bg-surface flex items-center justify-center text-text-secondary"
            ><i className="fa-regular fa-bookmark text-[11px]" /></button>
            <button
              onClick={() => toastSoon('Share lead with teammates')}
              title="Share"
              className="w-7 h-7 rounded hover:bg-surface flex items-center justify-center text-text-secondary"
            ><i className="fa-solid fa-share-nodes text-[11px]" /></button>
            <V2Dropdown
              align="right"
              minWidth={200}
              trigger={
                <span className="w-7 h-7 rounded hover:bg-surface flex items-center justify-center text-text-secondary cursor-pointer">
                  <i className="fa-solid fa-ellipsis text-[11px]" />
                </span>
              }
              items={[
                { key: 'open-classic', icon: 'arrow-up-right-from-square', label: 'Open in classic UI', onClick: () => { if (selected?.id) window.location.href = `/leads/${selected.id}`; } },
                { key: 'add-tag',  icon: 'tag',          label: 'Add tag',           onClick: () => toastSoon('Add tag to lead') },
                { key: 'campaign', icon: 'paper-plane',  label: 'Add to campaign',   onClick: () => toastSoon('Add lead to campaign') },
                { key: 'pipeline', icon: 'table-columns',label: 'Move to pipeline',  onClick: () => toastSoon('Move lead to pipeline') },
                { key: 'd1', divider: true, label: '' },
                { key: 'delete',   icon: 'trash',        label: 'Delete lead', destructive: true, onClick: () => toastSoon('Delete lead') },
              ]}
            />
          </div>
        </div>

        {/* Identity */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            {selected ? (
              <>
                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${avatarBgFor(selected.id)} flex items-center justify-center text-white text-[16px] font-semibold ring-4 ring-primary/15`}>{initialsFor(selected)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-[18px] font-bold tracking-tight">{fullName(selected)}</h2>
                    {selected.status && <span className="tag tag-muted">{selected.status}</span>}
                  </div>
                  <p className="text-[12.5px] text-text-muted">
                    {[selected.title, selected.company, selected.location || [selected.city, selected.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-[16px] font-semibold ring-4 ring-primary/15">SC</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><h2 className="text-[18px] font-bold tracking-tight">Sarah Chen</h2><span className="tag tag-success">● Hot</span></div>
                  <p className="text-[12.5px] text-text-muted">Senior Backend Engineer · Stripe · SF</p>
                </div>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mb-3">
            <span className="tag" style={{ background: 'rgba(107,70,193,.1)', color: '#6B46C1' }}>Engineering</span>
            <span className="tag tag-warn">Senior</span>
            <span className="tag tag-success">Remote</span>
            <button onClick={() => toastSoon('Add tag to lead')} title="Add tag" className="tag tag-muted hover:bg-gray-200"><i className="fa-solid fa-plus text-[8px]" /></button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { window.location.href = '/v2/inbox'; }}
              className="btn-solid flex-1 justify-center"
              title="Open Inbox to reply"
            ><i className="fa-solid fa-paper-plane text-[10px]" />Reply</button>
            <button
              onClick={() => toastSoon('Schedule via Coordinator interview_booker')}
              className="btn-outline"
              title="Schedule meeting"
            ><i className="fa-solid fa-calendar text-[10px]" />Schedule</button>
            <button
              onClick={() => {
                const url = selected?.linkedin_url;
                if (url) window.open(url, '_blank', 'noopener,noreferrer');
                else toastInfo('No LinkedIn URL on this lead.');
              }}
              className="btn-outline"
              title="Open LinkedIn profile"
            ><i className="fa-brands fa-linkedin text-[11px]" /></button>
          </div>
        </div>

        {/* REX context */}
        <div className="mx-5 mt-4 mb-4 p-3.5 rounded-xl" style={{ background: 'linear-gradient(90deg,rgba(107,70,193,.05),rgba(12,92,244,.03) 70%,transparent)', border: '1px solid rgba(107,70,193,.12)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md grad-icon flex items-center justify-center text-white shrink-0"><i className="fa-solid fa-wand-magic-sparkles text-[10px]" /></div>
            <span className="text-[11px] font-bold uppercase tracking-wider grad-text">REX context</span>
            <span className="text-[10.5px] text-text-muted ml-auto">just now</span>
          </div>
          <ul className="text-[12.5px] text-text-secondary space-y-1.5">
            <li className="flex items-start gap-1.5"><i className="fa-solid fa-check text-success text-[10px] mt-1 shrink-0" /><span>Top 6% of all leads · 7yr senior backend, Go + Rust</span></li>
            <li className="flex items-start gap-1.5"><i className="fa-solid fa-check text-success text-[10px] mt-1 shrink-0" /><span>Replied within 4h on first touch — fastest in Q2 Engineers cohort</span></li>
            <li className="flex items-start gap-1.5"><i className="fa-solid fa-circle-check text-success text-[10px] mt-1 shrink-0" /><span>I auto-sent calendar invite for Thu 2:30 PT (score 94 ≥ threshold)</span></li>
          </ul>
          <button
            onClick={() => toastSoon('Find similar leads via Sourcer ICP fingerprint')}
            className="text-[11.5px] text-primary font-semibold hover:underline mt-2.5"
          ><i className="fa-solid fa-magnifying-glass text-[9px] mr-1" />Find 3 more like {selected ? (selected.first_name || fullName(selected).split(' ')[0]) : 'Sarah'} →</button>
        </div>

        {/* REX Skills — invoke installed Skills on the active lead */}
        <RexSkillsPanel
          lead={selected ? {
            id: selected.id,
            firstName: selected.first_name || undefined,
            lastName: selected.last_name || undefined,
            company: selected.company || undefined,
            domain: leadDomain(selected),
            linkedinUrl: selected.linkedin_url || undefined,
          } : {
            // Mockup fallback when no leads exist yet — same shape so panels render.
            id: 'mock-lead-id',
            firstName: 'Sarah',
            lastName: 'Chen',
            company: 'Stripe',
            domain: 'stripe.com',
            linkedinUrl: 'https://linkedin.com/in/sarahchen',
          }}
        />

        {/* Score */}
        <div className="mx-5 mb-4 bg-white rounded-xl p-3.5" style={{ border: '1px solid #ECECEC' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">REX score</span>
            <span className="text-[11px] text-success font-semibold">Top 6%</span>
          </div>
          <div className="flex items-baseline gap-2 mb-2"><span className="text-[28px] font-bold grad-text leading-none">94</span><span className="text-[11px] text-text-muted">/ 100</span></div>
          <div className="h-2 rounded-full bg-surface overflow-hidden mb-2"><div className="h-full grad-icon rounded-full" style={{ width: '94%' }} /></div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="flex justify-between"><span className="text-text-muted">ICP match</span><span className="font-semibold">98</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Replyability</span><span className="font-semibold">92</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Seniority fit</span><span className="font-semibold">95</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Tone match</span><span className="font-semibold">89</span></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 border-b border-gray-100 text-[12.5px]">
          {(['activity', 'messages', 'notes', 'files'] as const).map((tab) => {
            const labels: Record<typeof tab, string> = {
              activity: 'Activity', messages: 'Messages', notes: 'Notes', files: 'Files',
            };
            const isActive = drawerTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setDrawerTab(tab)}
                className={`px-3 py-2 ${isActive ? 'border-b-2 border-primary text-primary font-semibold' : 'text-text-muted hover:text-text-main'}`}
              >
                {labels[tab]}
                {tab === 'messages' && <span className="text-[10px] ml-1">3</span>}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="px-5 py-4">
          {drawerTab === 'activity' && (
            <>
              <div className="text-[10.5px] text-text-muted mb-3 uppercase tracking-wider font-bold">Today</div>
              <ul className="space-y-3">
                <li className="flex gap-2.5">
                  <div className="relative">
                    <div className="w-7 h-7 rounded-md bg-success/15 text-success flex items-center justify-center"><i className="fa-solid fa-comment-dots text-[10px]" /></div>
                    <div className="absolute left-1/2 top-7 bottom-[-12px] w-px bg-gray-200 -translate-x-1/2" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12.5px]"><span className="font-semibold">Replied</span> to Q2 Senior Engineers</p>
                    <p className="text-[11.5px] text-text-muted mt-0.5">"Yes, I'd love to chat — Thursday after 2pm works."</p>
                    <p className="text-[10.5px] text-text-muted mt-1">2 min ago</p>
                  </div>
                </li>
                <li className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-md grad-icon text-white flex items-center justify-center"><i className="fa-solid fa-wand-magic-sparkles text-[10px]" /></div>
                  <div className="flex-1">
                    <p className="text-[12.5px]"><span className="font-semibold text-primary">REX auto-sent</span> calendar invite for Thu 2:30 PT</p>
                    <p className="text-[10.5px] text-text-muted mt-1">2 min ago · score 94 ≥ threshold</p>
                  </div>
                </li>
              </ul>
            </>
          )}

          {drawerTab === 'messages' && (
            <div className="text-center py-10">
              <i className="fa-solid fa-envelope-open-text text-[28px] text-text-muted/40 mb-3" />
              <p className="text-[12.5px] text-text-muted mb-3">View the full thread in Inbox.</p>
              <button
                onClick={() => { window.location.href = '/v2/inbox'; }}
                className="btn-outline !text-[11.5px]"
              ><i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />Open in Inbox</button>
            </div>
          )}

          {drawerTab === 'notes' && (
            <div className="text-center py-10">
              <i className="fa-regular fa-note-sticky text-[28px] text-text-muted/40 mb-3" />
              <p className="text-[12.5px] text-text-muted mb-3">No notes yet on this lead.</p>
              <button
                onClick={() => toastSoon('Add a note to this lead')}
                className="btn-outline !text-[11.5px]"
              ><i className="fa-solid fa-plus text-[10px]" />Add note</button>
            </div>
          )}

          {drawerTab === 'files' && (
            <div className="text-center py-10">
              <i className="fa-regular fa-folder-open text-[28px] text-text-muted/40 mb-3" />
              <p className="text-[12.5px] text-text-muted mb-3">No files attached to this lead.</p>
              <button
                onClick={() => toastSoon('Upload a file to this lead')}
                className="btn-outline !text-[11.5px]"
              ><i className="fa-solid fa-paperclip text-[10px]" />Attach file</button>
            </div>
          )}
        </div>
      </aside>

      <button className="rex-fab" title="Ask REX (⌘K)" aria-label="Open REX">
        <i className="fa-solid fa-wand-magic-sparkles" />
      </button>

      {filtersCollapsed && (
        <button
          onClick={() => setFiltersCollapsed(false)}
          className="fs-reopen-btn"
          title="Show filters"
          aria-label="Show filters"
        >
          <i className="fa-solid fa-chevron-right text-[11px]" />
        </button>
      )}
    </div>
  );
}

/**
 * In-drawer panel: filters the workspace's hired specialists down to the
 * Skills that make sense on a lead row, then renders RexSkillButtons.
 */
export function RexSkillsPanel({
  lead,
}: {
  lead: { id?: string; firstName?: string; lastName?: string; company?: string; domain?: string; linkedinUrl?: string };
}) {
  const { agents } = useAgents();
  const sourcer = findAgentByRole(agents, 'sourcer');
  const researcher = findAgentByRole(agents, 'researcher');

  if (!sourcer && !researcher) {
    return (
      <div className="mx-5 mb-4">
        <RexSkillsHireCTA message="Hire a Sourcer or Researcher to run Skills on this lead." />
      </div>
    );
  }

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
  const skills: SkillButtonSpec[] = [];

  if (sourcer) {
    const has = (id: string) => sourcer.skills?.some((s) => s.skill_id === id);
    if (has('apollo_enrich')) skills.push({
      agentId: sourcer.id, skillId: 'apollo_enrich',
      label: 'Apollo enrich', icon: 'database', cost: '1 cr (house)',
      input: { leadId: lead.id, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, linkedinUrl: lead.linkedinUrl },
    });
    if (has('hunter_skill')) skills.push({
      agentId: sourcer.id, skillId: 'hunter_skill',
      label: 'Hunter find', icon: 'envelope', cost: 'free',
      input: { fullName, domain: lead.domain || lead.company },
    });
    if (has('skrapp_skill')) skills.push({
      agentId: sourcer.id, skillId: 'skrapp_skill',
      label: 'Skrapp find', icon: 'shield-check', cost: 'free',
      input: { fullName, domain: lead.domain || lead.company, companyName: lead.company },
    });
  }
  if (researcher) {
    const has = (id: string) => researcher.skills?.some((s) => s.skill_id === id);
    if (has('company_intel')) skills.push({
      agentId: researcher.id, skillId: 'company_intel',
      label: 'Company intel', icon: 'building', cost: 'free',
      input: { company: lead.company, domain: lead.domain },
    });
    if (has('comp_benchmark')) skills.push({
      agentId: researcher.id, skillId: 'comp_benchmark',
      label: 'Comp benchmark', icon: 'coins', cost: 'free',
      input: { role: 'Senior Engineer' },
    });
  }

  if (!skills.length) return null;

  return (
    <div className="mx-5 mb-4">
      <RexSkillButtons skills={skills} />
    </div>
  );
}
