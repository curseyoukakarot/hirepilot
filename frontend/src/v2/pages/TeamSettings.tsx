/**
 * v2 / Team Settings — Admin: name, color, members, sharing, plan, danger
 *
 * HTML preserved EXACTLY from mockups/team-settings.html main content block.
 *
 * Wired to backend:
 *   - GET  /api/v2/workspace-settings  (workspace identity + sharing flags)
 *   - PATCH /api/v2/workspace-settings (name, team_color, sharing toggles, trust defaults)
 *
 * Still placeholder (separate endpoints not yet built):
 *   - Members section (needs /api/workspaces/:id/members)
 *   - Plan card (needs Stripe/billing join)
 *   - Danger zone (needs ownership-transfer + workspace-delete endpoints)
 */

import React, { useEffect, useState } from 'react';
import WorkspaceSidebar from '../components/WorkspaceSidebar';
import { useWorkspaceSettings } from '../hooks/useWorkspaceSettings';
import { useBillingSummary, openBillingPortal } from '../hooks/useBilling';
import { useV2Theme } from '../hooks/useV2Theme';
import type { TeamColor } from '../types';
import '../../styles/v2.css';

const SWATCHES: { key: TeamColor; gradient: string; title: string }[] = [
  { key: 'indigo',  gradient: 'linear-gradient(135deg,#6B46C1,#0C5CF4)', title: 'Indigo' },
  { key: 'emerald', gradient: 'linear-gradient(135deg,#10B981,#0D9488)', title: 'Emerald' },
  { key: 'amber',   gradient: 'linear-gradient(135deg,#F59E0B,#EA580C)', title: 'Amber' },
  { key: 'rose',    gradient: 'linear-gradient(135deg,#F43F5E,#E11D48)', title: 'Rose' },
  { key: 'teal',    gradient: 'linear-gradient(135deg,#0EA5E9,#0D9488)', title: 'Teal' },
  { key: 'slate',   gradient: 'linear-gradient(135deg,#475569,#1E40AF)', title: 'Slate' },
  { key: 'violet',  gradient: 'linear-gradient(135deg,#7C3AED,#4F46E5)', title: 'Violet' },
  { key: 'sky',     gradient: 'linear-gradient(135deg,#38BDF8,#0284C7)', title: 'Sky' },
];

const MEMBERS = [
  { initials: 'B', av: 'from-purple-400 to-blue-400', name: 'Brandon Omoregie', email: 'brandon@apex-recruiting.com · joined May 2025', role: 'Owner', roleCls: 'owner', icon: 'fa-crown', isYou: true, online: true },
  { initials: 'SM', av: 'from-rose-400 to-pink-600', name: 'Sarah Mitchell', email: 'sarah@apex-recruiting.com · joined Jun 2025', role: 'Admin', roleCls: 'admin', icon: 'fa-shield-halved', online: true },
  { initials: 'JP', av: 'from-amber-400 to-orange-500', name: 'James Park', email: 'james@apex-recruiting.com · joined Aug 2025', role: 'Member', icon: 'fa-user', online: true, dropdown: true },
  { initials: 'AT', av: 'from-cyan-400 to-blue-500', name: 'Aaliyah Thomas', email: 'aaliyah@apex-recruiting.com · joined Feb 2026', role: 'Member', icon: 'fa-user', online: true, dropdown: true },
];

export default function TeamSettingsPage() {
  useV2Theme();

  const { settings, isLoading, update } = useWorkspaceSettings();
  const currentColor: TeamColor = settings?.team_color || 'indigo';
  const [nameDraft, setNameDraft] = useState<string>('');
  const [initialDraft, setInitialDraft] = useState<string>('');

  // Hydrate local drafts when settings load.
  useEffect(() => {
    if (settings) {
      setNameDraft(settings.workspace_name || '');
      setInitialDraft((settings.workspace_name || '').slice(0, 2).toUpperCase());
    }
  }, [settings?.workspace_name]);

  const handleSaveIdentity = () => {
    update.mutate({ workspace_name: nameDraft.trim() || null });
  };

  const handlePickColor = (color: TeamColor) => {
    if (color === currentColor) return;
    update.mutate({ team_color: color });
  };

  const toggleShare = (key: 'share_leads' | 'share_candidates' | 'share_deals' | 'share_analytics') => {
    if (!settings) return;
    update.mutate({ [key]: !settings[key] } as any);
  };

  const wsInitial = (initialDraft || nameDraft.slice(0, 2) || 'WS').toUpperCase();
  const currentSwatch = SWATCHES.find((s) => s.key === currentColor) || SWATCHES[0];

  return (
    <div className="v2-app autopilot flex min-h-screen relative z-10">
      <WorkspaceSidebar
        workspaceInitial={wsInitial}
        workspaceName={settings?.workspace_name || (isLoading ? 'Loading…' : 'My HirePilot')}
        workspaceSubtitle="Workspace settings"
      />

      <main className="flex-1 min-w-0 flex">
        {/* Sub-nav */}
        <aside className="w-[200px] shrink-0 border-r border-gray-100 bg-white/40 h-screen sticky top-0 p-4 overflow-y-auto">
          <div className="font-bold text-[15px] mb-4 px-1">Settings</div>
          <div className="flex flex-col gap-px">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-2.5 pt-2.5 pb-1">Workspace</span>
            <a className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] font-semibold cursor-pointer" style={{ background: 'rgba(107,70,193,.1)', color: '#6B46C1' }}><i className="fa-solid fa-people-roof w-3.5 text-[10.5px]" />Team</a>
            <a className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] cursor-pointer hover:bg-surface text-text-secondary"><i className="fa-solid fa-puzzle-piece w-3.5 text-[10.5px]" />Integrations</a>
            <a className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] cursor-pointer hover:bg-surface text-text-secondary"><i className="fa-solid fa-credit-card w-3.5 text-[10.5px]" />Billing</a>
            <a className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] cursor-pointer hover:bg-surface text-text-secondary"><i className="fa-solid fa-key w-3.5 text-[10.5px]" />API &amp; Webhooks</a>

            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-2.5 pt-2.5 pb-1">REX</span>
            <a className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] cursor-pointer hover:bg-surface text-text-secondary"><i className="fa-solid fa-shield-halved w-3.5 text-[10.5px]" />Guardrails</a>
            <a className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] cursor-pointer hover:bg-surface text-text-secondary"><i className="fa-solid fa-microphone w-3.5 text-[10.5px]" />Voice &amp; tone</a>
            <a className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] cursor-pointer hover:bg-surface text-text-secondary"><i className="fa-solid fa-bolt w-3.5 text-[10.5px]" />Automations</a>

            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-2.5 pt-2.5 pb-1">Account</span>
            <a className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] cursor-pointer hover:bg-surface text-text-secondary"><i className="fa-solid fa-user w-3.5 text-[10.5px]" />Profile</a>
            <a className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] cursor-pointer hover:bg-surface text-text-secondary"><i className="fa-solid fa-bell w-3.5 text-[10.5px]" />Notifications</a>
            <a className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] cursor-pointer hover:bg-surface text-text-secondary"><i className="fa-solid fa-shield w-3.5 text-[10.5px]" />Security &amp; 2FA</a>
          </div>
        </aside>

        {/* Settings content */}
        <section className="flex-1 min-w-0">
          <header className="border-b border-gray-100 px-7 h-14 glass flex items-center gap-4 sticky top-0 z-30">
            <div>
              <div className="font-semibold text-[14.5px] flex items-center gap-2"><i className="fa-solid fa-people-roof text-[#047857] text-xs" />Team Settings</div>
              <div className="text-[10.5px] text-text-muted">Apex Recruiting · 4 members</div>
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase text-white" style={{ background: 'linear-gradient(135deg,#475569,#1E293B)', letterSpacing: '.04em' }}><i className="fa-solid fa-shield-halved text-[8px]" />Admin</span>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 ring-2 ring-white" />
            </div>
          </header>

          <div className="px-7 py-6 space-y-5 max-w-[900px]">

            {/* Workspace identity */}
            <section className="bg-white rounded-[14px] p-5 px-[22px] float-in d-1" style={{ border: '1px solid #ECECEC' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[16px] font-bold tracking-tight">Workspace identity</h2>
                  <p className="text-[11.5px] text-text-muted">Your team's name and color show across the app — sidebar, briefings, emails, Slack.</p>
                </div>
                <button
                  onClick={handleSaveIdentity}
                  disabled={update.isPending || !nameDraft.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold text-white disabled:opacity-50"
                  style={{ background: currentSwatch.gradient, boxShadow: '0 6px 14px -4px rgba(16,185,129,.4)' }}
                >
                  {update.isPending ? 'Saving…' : 'Save changes'}
                </button>
              </div>

              <div className="flex items-start gap-5 mb-5">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-[22px] font-bold shadow-lg" style={{ background: currentSwatch.gradient, boxShadow: '0 12px 28px -8px rgba(16,185,129,.45)' }}>{wsInitial}</div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">Workspace name</label>
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder="My HirePilot"
                      className="mt-1.5 w-full px-3 py-2 rounded-lg text-[13.5px] outline-none focus:border-primary/40"
                      style={{ border: '1px solid #E5E7EB' }}
                    />
                    <p className="text-[10.5px] text-text-muted mt-1">Visible in sidebar, briefings, emails, Slack messages.</p>
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">Initial</label>
                    <input
                      type="text"
                      value={initialDraft}
                      onChange={(e) => setInitialDraft(e.target.value.toUpperCase())}
                      maxLength={3}
                      className="mt-1.5 w-full px-3 py-2 rounded-lg text-[13.5px] outline-none focus:border-primary/40"
                      style={{ border: '1px solid #E5E7EB' }}
                    />
                    <p className="text-[10.5px] text-text-muted mt-1">Shown in the workspace badge.</p>
                  </div>
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">Workspace color</label>
                <p className="text-[11.5px] text-text-muted mt-1 mb-3">Picks the sidebar tint, badge gradient, and team accent. REX, success, and danger colors stay system-controlled.</p>
                <div className="flex items-center gap-3 flex-wrap">
                  {SWATCHES.map((s) => {
                    const isSelected = s.key === currentColor;
                    return (
                      <div
                        key={s.key}
                        className="cursor-pointer relative transition"
                        onClick={() => handlePickColor(s.key)}
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '11px',
                          background: s.gradient,
                          border: '2px solid white',
                          boxShadow: isSelected
                            ? `0 0 0 3px white, 0 0 0 5px ${s.gradient.match(/#\w+/)?.[0] || '#10B981'}, 0 8px 16px -4px rgba(0,0,0,.15)`
                            : '0 0 0 1px rgba(0,0,0,.08)',
                          opacity: update.isPending ? 0.7 : 1,
                        }}
                        title={s.title + (isSelected ? ' (current)' : '')}
                      >
                        {isSelected && <div className="absolute inset-0 flex items-center justify-center text-white text-[14px]" style={{ textShadow: '0 1px 2px rgba(0,0,0,.2)' }}><i className="fa-solid fa-check" /></div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Members + roles */}
            <section className="bg-white rounded-[14px] p-5 px-[22px] float-in d-2" style={{ border: '1px solid #ECECEC' }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-[16px] font-bold tracking-tight">Members &amp; roles</h2>
                  <p className="text-[11.5px] text-text-muted mt-0.5">4 of 5 seats used · $79/mo per additional seat (prorated)</p>
                </div>
                <button className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold text-white" style={{ background: 'linear-gradient(135deg,#10B981,#0D9488)', boxShadow: '0 6px 14px -4px rgba(16,185,129,.4)' }}>
                  <i className="fa-solid fa-user-plus text-[10px]" />Invite teammate
                </button>
              </div>

              <div className="bg-surface/60 rounded-xl p-3 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11.5px]">
                <div className="flex items-start gap-2"><span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold text-white mt-0.5" style={{ background: 'linear-gradient(135deg,#10B981,#0D9488)' }}><i className="fa-solid fa-crown text-[8px]" />Owner</span><span className="text-text-secondary">Pays. Owns the workspace. One per workspace.</span></div>
                <div className="flex items-start gap-2"><span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold text-white mt-0.5" style={{ background: 'linear-gradient(135deg,#475569,#1E293B)' }}><i className="fa-solid fa-shield-halved text-[8px]" />Admin</span><span className="text-text-secondary">Manages settings, members, sharing, billing.</span></div>
                <div className="flex items-start gap-2"><span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold text-text-secondary bg-surface mt-0.5" style={{ border: '1px solid #E5E7EB' }}><i className="fa-solid fa-user text-[8px]" />Member</span><span className="text-text-secondary">Full workspace access. Can be added as collaborator on specific jobs/tables/tasks.</span></div>
              </div>

              <div>
                {MEMBERS.map((m, i) => (
                  <div key={i} className={`flex items-center gap-3.5 py-2.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${m.av} flex items-center justify-center text-white text-[11px] font-semibold ring-2 ring-white shadow`}>{m.initials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13.5px] flex items-center gap-2">{m.name} {m.isYou && <span className="text-[10.5px] text-text-muted font-normal">(you)</span>}</div>
                      <div className="text-[11px] text-text-muted">{m.email}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                      m.roleCls === 'owner' ? 'text-white' : m.roleCls === 'admin' ? 'text-white' : 'bg-surface text-text-secondary'
                    }`} style={
                      m.roleCls === 'owner' ? { background: 'linear-gradient(135deg,#10B981,#0D9488)' } :
                      m.roleCls === 'admin' ? { background: 'linear-gradient(135deg,#475569,#1E293B)' } :
                      { border: '1px solid #E5E7EB' }
                    }>
                      <i className={`fa-solid ${m.icon} text-[8px]`} />{m.role}
                      {m.dropdown && <i className="fa-solid fa-chevron-down text-[8px] ml-0.5 opacity-60" />}
                    </span>
                    <span className="text-[10.5px] text-success font-semibold flex items-center gap-1"><span className="live-dot" />Online</span>
                    <button className="ghost-btn p-1.5"><i className="fa-solid fa-ellipsis text-[11px]" /></button>
                  </div>
                ))}
                <div className="flex items-center gap-3.5 py-2.5 border-t border-gray-50 opacity-70">
                  <div className="w-9 h-9 rounded-full bg-surface flex items-center justify-center text-text-muted text-[11px] font-semibold ring-2 ring-white"><i className="fa-solid fa-envelope text-[10px]" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[13.5px]">danielle@apex-recruiting.com</div>
                    <div className="text-[11px] text-text-muted">Invitation pending · sent 2 days ago</div>
                  </div>
                  <span className="tag tag-warn">Pending</span>
                  <button className="ghost-btn p-1.5 text-[11px]">Resend</button>
                  <button className="ghost-btn p-1.5 text-[11px] text-danger">Revoke</button>
                </div>
              </div>

              <p className="text-[11px] text-text-muted mt-4">Need read-only / commenter access for a specific job, table, or task? Use <a href="#" className="text-primary font-semibold hover:underline">per-resource collaborators</a> from the resource itself — no extra seat charge.</p>
            </section>

            {/* Sharing defaults */}
            <section className="bg-white rounded-[14px] p-5 px-[22px] float-in d-3" style={{ border: '1px solid #ECECEC' }}>
              <div className="mb-4">
                <h2 className="text-[16px] font-bold tracking-tight">Sharing defaults</h2>
                <p className="text-[11.5px] text-text-muted mt-0.5">What's pooled across your team by default. Each member can still toggle to "Mine" view.</p>
              </div>

              {([
                { key: 'share_leads',      icon: 'fa-database',       title: 'Leads · shared pool',           desc: 'Everyone sees the team\'s leads · ownership tracked per record', tag: 'Default', tagCls: 'tag-success' },
                { key: 'share_candidates', icon: 'fa-table-columns',  title: 'Candidates · shared pool',      desc: 'All hiring pipelines visible to team · per-job collaborators control edit access', tag: 'Default', tagCls: 'tag-success' },
                { key: 'share_deals',      icon: 'fa-handshake',      title: 'Deals · shared pipeline',       desc: 'One unified deal kanban for the team · pipeline visible to all', tag: 'Default', tagCls: 'tag-success' },
                { key: 'share_analytics',  icon: 'fa-chart-line',     title: 'Analytics · pooled team view',  desc: 'Pool everyone\'s numbers into a single team analytics view', tag: 'Opt-in', tagCls: 'tag-muted' },
              ] as const).map((s, i) => {
                const on = !!settings?.[s.key];
                return (
                <div key={s.title} className={`flex items-center gap-3.5 py-3.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                  <i className={`fa-solid ${s.icon} text-base w-5 text-primary`} />
                  <div className="flex-1">
                    <div className="font-semibold text-[13.5px]">{s.title}</div>
                    <div className="text-[11.5px] text-text-muted">{s.desc}</div>
                  </div>
                  <span className={`tag ${s.tagCls}`}>{s.tag}</span>
                  <div
                    onClick={() => toggleShare(s.key)}
                    className="relative w-[38px] h-[22px] rounded-full cursor-pointer transition shrink-0"
                    style={on
                      ? { background: currentSwatch.gradient }
                      : { background: '#E5E7EB' }
                    }
                  >
                    <div className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform" style={{ left: on ? '18px' : '2px' }} />
                  </div>
                </div>
                );
              })}
              <div className="flex items-center gap-3.5 py-3.5 border-t border-gray-50">
                <i className="fa-solid fa-shield-halved text-base w-5 text-warn" />
                <div className="flex-1">
                  <div className="font-semibold text-[13.5px]">Admin override</div>
                  <div className="text-[11.5px] text-text-muted">Admins always see all team data — including private analytics — for oversight</div>
                </div>
                <span className="tag tag-primary">Admin only</span>
                <div className="relative w-[38px] h-[22px] rounded-full transition shrink-0" style={{ background: currentSwatch.gradient }}>
                  <div className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow" style={{ left: '18px' }} />
                </div>
              </div>
            </section>

            {/* Plan card — live billing data */}
            <PlanCardLive />

            {/* (Mockup plan card replaced with live data above.) */}

            {/* Danger zone */}
            <section className="bg-white rounded-[14px] p-5 px-[22px] float-in d-5" style={{ border: '1px solid rgba(239,68,68,.12)' }}>
              <h2 className="text-[15px] font-bold tracking-tight mb-1 text-danger">Danger zone</h2>
              <p className="text-[11.5px] text-text-muted mb-4">Irreversible. Be very sure.</p>

              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div>
                  <div className="font-semibold text-[13px]">Transfer ownership</div>
                  <div className="text-[11.5px] text-text-muted">Move workspace ownership to another Admin. Billing transfers too.</div>
                </div>
                <button className="ghost-btn !text-danger"><i className="fa-solid fa-arrow-right-arrow-left text-[10px]" />Transfer</button>
              </div>
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div>
                  <div className="font-semibold text-[13px] text-danger">Delete workspace</div>
                  <div className="text-[11.5px] text-text-muted">Permanently delete Apex Recruiting and all its data.</div>
                </div>
                <button className="ghost-btn !text-danger" style={{ borderColor: 'rgba(239,68,68,.25)' }}><i className="fa-solid fa-trash text-[10px]" />Delete</button>
              </div>
            </section>

          </div>
        </section>
      </main>

      <button className="rex-fab" title="Ask REX (⌘K)" aria-label="Open REX">
        <i className="fa-solid fa-wand-magic-sparkles" />
      </button>
    </div>
  );
}

/** Live plan card backed by /api/v2/billing/summary + Stripe Customer Portal. */
function PlanCardLive() {
  const { summary, isLoading } = useBillingSummary();

  const planLabel = summary?.workspace?.plan ? summary.workspace.plan.charAt(0).toUpperCase() + summary.workspace.plan.slice(1) : 'Free';
  const seatCap = summary?.workspace?.seat_count || 1;
  const seatsUsed = summary?.members_active || 0;
  const stripeMeta = summary?.stripe;

  const monthlyTotal = stripeMeta?.unit_amount && stripeMeta?.quantity
    ? `$${((stripeMeta.unit_amount * stripeMeta.quantity) / 100).toFixed(2)}`
    : '—';
  const perSeatLine = stripeMeta?.unit_amount
    ? `$${(stripeMeta.unit_amount / 100).toFixed(0)}/seat/${stripeMeta.interval || 'month'}`
    : 'Free plan';
  const nextCharge = stripeMeta?.current_period_end
    ? new Date(stripeMeta.current_period_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const isActive = stripeMeta?.status === 'active';
  const willCancel = stripeMeta?.cancel_at_period_end;

  return (
    <section className="float-in d-4 p-[18px] px-[22px] rounded-[14px]" style={{ background: 'linear-gradient(135deg,rgba(16,185,129,.04),rgba(13,148,136,.02) 70%,white)', border: '1px solid rgba(16,185,129,.18)' }}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg,#10B981,#0D9488)', boxShadow: '0 6px 14px -4px rgba(16,185,129,.3)' }}><i className="fa-solid fa-people-roof" /></div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-[15px] font-bold">{summary?.workspace?.name || 'Workspace'} · {planLabel} plan</h3>
            {isActive && <span className="tag tag-team" style={{ background: 'rgba(16,185,129,.1)', color: '#047857' }}><i className="fa-solid fa-circle-check text-[8px]" />Active</span>}
            {!isActive && stripeMeta && <span className="tag tag-warn"><i className="fa-solid fa-circle-question text-[8px]" />{stripeMeta.status}</span>}
            {willCancel && <span className="tag tag-warn"><i className="fa-solid fa-circle-exclamation text-[8px]" />Cancels at period end</span>}
          </div>
          <p className="text-[12.5px] text-text-secondary">
            {perSeatLine}
            {stripeMeta && nextCharge && ` · billing ${stripeMeta.interval || 'monthly'} · next charge ${nextCharge}`}
            {!stripeMeta && !isLoading && ' · upgrade for team features'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 text-[12px]">
            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Seats used</div>
              <div className="font-bold text-text-main mt-0.5">{seatsUsed} of {seatCap}</div>
            </div>
            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Monthly</div>
              <div className="font-bold text-text-main mt-0.5">{monthlyTotal}</div>
            </div>
            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Subscription</div>
              <div className="font-bold text-text-main mt-0.5 truncate">{stripeMeta ? stripeMeta.subscription_id.slice(0, 14) + '…' : '—'}</div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button onClick={() => openBillingPortal()} className="btn-outline" disabled={!stripeMeta}>
            <i className="fa-solid fa-credit-card text-[10px]" />
            {stripeMeta ? 'Manage billing' : 'No subscription'}
          </button>
          <button onClick={() => openBillingPortal()} className="ghost-btn" disabled={!stripeMeta}>
            <i className="fa-solid fa-receipt text-[10px]" />Invoices
          </button>
        </div>
      </div>
    </section>
  );
}
