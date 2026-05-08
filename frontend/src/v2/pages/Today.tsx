/**
 * v2 / Today — workspace home with REX briefing + workspace overview
 *
 * HTML preserved EXACTLY from mockups/workspace.html main content block.
 * Activity timeline is wired to /api/v2/activity (rex_activity_log).
 * Hero briefing + workspace cards still use mockup copy until lead/deal/
 * candidate routes are wired to /api/v2/* equivalents.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import WorkspaceShell from '../components/WorkspaceShell';
import WorkspaceTopbar, { RexStatusPill } from '../components/WorkspaceTopbar';
import { useActivity, type ActivityEvent } from '../hooks/useActivity';
import { useGoals } from '../hooks/useGoals';
import { useDecisions } from '../hooks/useDecisions';
import { useAgents } from '../hooks/useAgents';
import { toastSoon, toastInfo } from '../components/V2Toast';
import V2Modal, { ModalCancel } from '../components/V2Modal';
import { useNavigate } from 'react-router-dom';

export default function TodayPage() {
  const navigate = useNavigate();
  const { activity } = useActivity({ limit: 30 });
  const { goals } = useGoals('running');
  const { decisions: pending } = useDecisions({ status: 'pending' });
  const [overnightOpen, setOvernightOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const { agents, isLoading: agentsLoading } = useAgents();

  const runningGoals = goals.length;
  const heldCount = pending.length;
  const showOnboarding = !agentsLoading && agents.length === 0;

  return (
    <WorkspaceShell autopilot>
      <WorkspaceTopbar
        pageTitle="Today"
        pageIcon="fa-solid fa-sun"
        pageIconColor="text-warn"
        pageSubtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        statusPill={
          heldCount > 0
            ? <RexStatusPill text="" highlight={`${heldCount} decision${heldCount === 1 ? '' : 's'} waiting`} highlightClass="text-warn font-semibold" />
            : runningGoals > 0
              ? <RexStatusPill text="working · " highlight={`${runningGoals} goal${runningGoals === 1 ? '' : 's'} in flight`} highlightClass="text-primary font-semibold" />
              : <RexStatusPill text="" highlight="ready when you are" highlightClass="text-text-secondary" />
        }
        trustLevel="autopilot"
      />

      {/* BODY */}
      <div className="px-8 py-7 space-y-7 max-w-[1400px] mx-auto">

        {/* Onboarding hero — first-run guide when no specialists have been hired */}
        {showOnboarding && (
          <section className="float-in" style={{ background: 'linear-gradient(135deg,rgba(107,70,193,.06),rgba(12,92,244,.04) 50%,white)', border: '1px solid rgba(107,70,193,.18)', borderRadius: '18px', padding: '24px 26px' }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl grad-rex flex items-center justify-center text-white shrink-0 shadow-md shadow-primary/30">
                <i className="fa-solid fa-wand-magic-sparkles text-[20px]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] grad-text-rex mb-1">
                  Welcome to HirePilot v2
                </div>
                <h2 className="text-[22px] font-extrabold tracking-tight mb-1.5">
                  Hire your first specialist to put REX to work.
                </h2>
                <p className="text-[14px] text-text-secondary mb-4 max-w-2xl">
                  REX coordinates your team — but the heavy lifting (sourcing, drafting, scheduling)
                  happens through specialist agents you hire. Start with a Sourcer or Recruiter; they're
                  pre-loaded with the Skills you need on day one.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <a href="/v2/hire" className="btn-solid">
                    <i className="fa-solid fa-user-plus text-[10px]" />Browse the catalog
                  </a>
                  <a href="/v2/team" className="ghost-btn">
                    <i className="fa-solid fa-people-group text-[10px]" />Tour your team
                  </a>
                  <a href="/v2/goals" className="ghost-btn">
                    <i className="fa-solid fa-rocket text-[10px]" />Try a goal
                  </a>
                </div>
                <div className="mt-4 pt-4 border-t border-primary/10 grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                    <span><strong>Hire a specialist</strong> from the catalog — Sourcer, Recruiter, Coordinator, or any of 8 roles.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                    <span><strong>Set their trust level</strong> — Manual, Suggest, or Autopilot — per agent or per goal.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                    <span><strong>Tell REX a goal</strong> in plain English. REX plans, your team executes, you approve what matters.</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* HERO: REX briefing */}
        <section className="float-in d-1">
          <article className="flex gap-3">
            <div className="w-7 h-7 rounded-lg grad-icon flex items-center justify-center text-white shrink-0 mt-1 shadow-md shadow-primary/30">
              <i className="fa-solid fa-wand-magic-sparkles text-[11px]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-semibold text-[14px]">REX</span>
                <span className="tag tag-primary">Briefing</span>
                <span className="text-[11px] text-text-muted">7:00 AM · 1h ago</span>
              </div>
              <div className="rex-bubble">
                <p className="text-[15px] leading-relaxed mb-3">Good morning, Brandon. Here's where things stand:</p>
                <div className="stat-line mb-3">
                  <span><span className="stat primary">47</span> <span className="lbl">sent overnight</span></span>
                  <span className="sep">·</span>
                  <span><span className="stat">71%</span> <span className="lbl">open</span></span>
                  <span className="sep">·</span>
                  <span><span className="stat success">14.2%</span> <span className="lbl">reply</span></span>
                  <span className="sep">·</span>
                  <span><span className="stat warn">12</span> <span className="lbl">hot</span></span>
                  <span className="sep">·</span>
                  <span className="stat success">+38% above avg</span>
                </div>
                <ul className="text-[14.5px] leading-relaxed space-y-1.5 text-text-secondary">
                  <li className="flex gap-2">
                    <i className="fa-solid fa-circle-check text-success text-[10px] mt-1.5 shrink-0" />
                    <span><strong className="text-text-main">8 REX drafts ready</strong> for your hot replies — Sarah Chen, Priya Patel and 6 more.</span>
                  </li>
                  <li className="flex gap-2">
                    <i className="fa-solid fa-circle-question text-warn text-[10px] mt-1.5 shrink-0" />
                    <span><strong className="text-text-main">1 decision pending</strong> — Marcus Rodriguez asked about comp; my draft is above your autopilot threshold.</span>
                  </li>
                  <li className="flex gap-2">
                    <i className="fa-solid fa-rocket text-primary text-[10px] mt-1.5 shrink-0" />
                    <span><strong className="text-text-main">2 goals running</strong> — Q2 Senior Engineers (72%) and Sales Reps – SF (33%). On track.</span>
                  </li>
                </ul>
                <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-gray-200/60">
                  <button onClick={() => navigate('/v2/inbox')} className="btn-solid">
                    <i className="fa-solid fa-bolt text-[10px]" />Open hot replies
                  </button>
                  <button onClick={() => navigate('/v2/goals')} className="ghost-btn">Show today's plan</button>
                  <button onClick={() => setOvernightOpen(true)} className="ghost-btn">Open overnight summary</button>
                </div>
              </div>
            </div>
          </article>
        </section>

        {/* DECISION strip — only visible when status='pending' AND assigned_to=user */}
        <div className="decision-strip float-in d-2">
          <i className="fa-solid fa-circle-question text-warn" />
          <div className="flex-1 text-[13px]">
            <span className="font-semibold text-text-main">1 decision waiting</span>
            <span className="text-text-secondary"> · Marcus Rodriguez (Linear) — comp answer · drafted 12:14 PM</span>
          </div>
          <Link to="/v2/decisions" className="btn-solid">
            <i className="fa-solid fa-arrow-right text-[10px]" />Review
          </Link>
        </div>

        {/* WORKSPACE OVERVIEW */}
        <section>
          <div className="float-in d-3 flex items-end justify-between mb-4">
            <div>
              <h2 className="text-[20px] font-bold tracking-tight">Your workspace</h2>
              <p className="text-text-muted text-[13px] mt-0.5">Sourcing · ATS · CRM · outreach · reporting — all in one place.</p>
            </div>
            <button onClick={() => setCustomizeOpen(true)} className="ghost-btn">
              <i className="fa-solid fa-sliders text-[11px]" />Customize
            </button>
          </div>

          {/* Row 1: REX-active surfaces */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">

            {/* GOALS */}
            <Link to="/v2/goals" className="ws-card float-in d-4 relative shimmer-top">
              <div className="flex items-start gap-2.5">
                <div className="card-icon grad-rex"><i className="fa-solid fa-rocket" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold flex items-center gap-1.5">
                    Goals <span className="tag tag-primary">REX</span>
                  </div>
                  <div className="text-[10.5px] text-text-muted">Running outcomes</div>
                </div>
                <span className="live-dot mt-1" />
              </div>
              <div>
                <div className="stat-big text-primary">2 <span className="text-[13px] text-text-muted font-medium">running</span></div>
                <div className="stat-sub mt-1">Q2 Engineers · Sales Reps SF</div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden">
                  <div className="h-full grad-icon rounded-full" style={{ width: '72%' }} />
                </div>
                <span className="text-[10.5px] text-text-secondary font-semibold">72%</span>
              </div>
              <div className="ws-footer">
                <span className="font-semibold text-text-secondary">Q2 Engineers</span>
                <span className="text-text-muted">→</span>
              </div>
            </Link>

            {/* INBOX */}
            <Link to="/v2/inbox" className="ws-card float-in d-5">
              <div className="flex items-start gap-2.5">
                <div className="card-icon grad-icon"><i className="fa-solid fa-envelope" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold">Inbox</div>
                  <div className="text-[10.5px] text-text-muted">Replies + drafts</div>
                </div>
                <span className="tag tag-warn">1 needs you</span>
              </div>
              <div>
                <div className="stat-big">12 <span className="text-[13px] text-text-muted font-medium">unread</span></div>
                <div className="stat-sub mt-1">8 REX drafts ready · 5 auto-sent today</div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 border-2 border-white" />
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white" />
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-white" />
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-rose-400 to-pink-600 border-2 border-white" />
                </div>
                <span className="text-[10.5px] text-text-muted">+8 more</span>
              </div>
              <div className="ws-footer">
                <span className="font-semibold text-warn">Marcus needs you</span>
                <span className="text-text-muted">→</span>
              </div>
            </Link>

            {/* CAMPAIGNS */}
            <Link to="/v2/campaigns" className="ws-card float-in d-6 relative shimmer-top">
              <div className="flex items-start gap-2.5">
                <div className="card-icon grad-icon"><i className="fa-solid fa-paper-plane" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold">Campaigns</div>
                  <div className="text-[10.5px] text-text-muted">Outreach</div>
                </div>
                <span className="live-dot mt-1" />
              </div>
              <div>
                <div className="stat-big">3 <span className="text-[13px] text-text-muted font-medium">sending</span></div>
                <div className="stat-sub mt-1">1,284 sent · 14.2% reply · <span className="text-success font-semibold">+38%</span></div>
              </div>
              <svg viewBox="0 0 200 24" className="w-full h-6">
                <path d="M0,18 L25,16 L50,17 L75,12 L100,13 L125,8 L150,9 L175,5 L200,3" fill="none" stroke="#6B46C1" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div className="ws-footer">
                <span className="font-semibold text-text-secondary">Q2 Senior Engineers</span>
                <span className="text-text-muted">→</span>
              </div>
            </Link>

            {/* SOURCING / SOURCER */}
            <Link to="/v2/team" className="ws-card float-in d-7 relative shimmer-top">
              <div className="flex items-start gap-2.5">
                <div className="card-icon grad-emerald"><i className="fa-solid fa-crosshairs" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold">Sourcing</div>
                  <div className="text-[10.5px] text-text-muted">Find new leads</div>
                </div>
                <span className="live-dot mt-1" />
              </div>
              <div>
                <div className="stat-big text-success">247 <span className="text-[13px] text-text-muted font-medium">new today</span></div>
                <div className="stat-sub mt-1">2 saved searches · LinkedIn + Apollo + databases</div>
              </div>
              <div className="text-[11px] text-text-secondary flex items-center gap-1.5">
                <i className="fa-solid fa-wand-magic-sparkles text-primary text-[10px]" />
                Sourcer is sourcing for Q2 Engineers
              </div>
              <div className="ws-footer">
                <span className="font-semibold text-text-secondary">Run a new search</span>
                <span className="text-text-muted">→</span>
              </div>
            </Link>
          </div>

          {/* Row 2: data surfaces */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* CANDIDATES / LEADS */}
            <Link to="/v2/leads" className="ws-card float-in d-8">
              <div className="flex items-start gap-2.5">
                <div className="card-icon grad-blue"><i className="fa-solid fa-database" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold">Leads</div>
                  <div className="text-[10.5px] text-text-muted">Database</div>
                </div>
              </div>
              <div>
                <div className="stat-big">3,247</div>
                <div className="stat-sub mt-1">847 active · <span className="text-warn font-semibold">12 hot</span> · 23 bookmarked</div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 flex h-1 rounded-full overflow-hidden bg-surface">
                  <div className="bg-success" style={{ width: '32%' }} />
                  <div className="bg-warn" style={{ width: '18%' }} />
                  <div className="bg-secondary" style={{ width: '22%' }} />
                  <div className="bg-text-muted/30" style={{ width: '28%' }} />
                </div>
              </div>
              <div className="ws-footer">
                <span className="font-semibold text-text-secondary">Browse database</span>
                <span className="text-text-muted">→</span>
              </div>
            </Link>

            {/* PIPELINES */}
            <Link to="/v2/pipelines" className="ws-card float-in d-9">
              <div className="flex items-start gap-2.5">
                <div className="card-icon grad-warm"><i className="fa-solid fa-table-columns" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold">Pipelines</div>
                  <div className="text-[10.5px] text-text-muted">ATS · hiring stages</div>
                </div>
                <span className="tag tag-warn">2 due Fri</span>
              </div>
              <div>
                <div className="stat-big">5 <span className="text-[13px] text-text-muted font-medium">open reqs</span></div>
                <div className="stat-sub mt-1">62 candidates in flight · 9 in offer stage</div>
              </div>
              <div className="flex gap-1">
                <div className="flex-1 h-1.5 rounded-full bg-text-muted/20" />
                <div className="flex-1 h-1.5 rounded-full bg-secondary" />
                <div className="flex-1 h-1.5 rounded-full bg-warn" />
                <div className="flex-1 h-1.5 rounded-full bg-success" />
                <div className="flex-1 h-1.5 rounded-full bg-text-muted/20" />
              </div>
              <div className="ws-footer">
                <span className="font-semibold text-text-secondary">Senior Backend · Linear</span>
                <span className="text-text-muted">→</span>
              </div>
            </Link>

            {/* DEALS */}
            <Link to="/v2/deals" className="ws-card float-in d-10">
              <div className="flex items-start gap-2.5">
                <div className="card-icon grad-emerald"><i className="fa-solid fa-handshake" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold">Deals</div>
                  <div className="text-[10.5px] text-text-muted">CRM</div>
                </div>
                <span className="tag tag-success">3 closing</span>
              </div>
              <div>
                <div className="stat-big text-success">$284k</div>
                <div className="stat-sub mt-1">$92k commit · $45k Stripe · $28k Linear · $12k Figma</div>
              </div>
              <svg viewBox="0 0 200 24" className="w-full h-6">
                <path d="M0,20 L40,18 L80,12 L120,14 L160,8 L200,4" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div className="ws-footer">
                <span className="font-semibold text-text-secondary">Stripe placement · $45k</span>
                <span className="text-text-muted">→</span>
              </div>
            </Link>

            {/* REPORTS */}
            <Link to="/v2/reports" className="ws-card float-in d-11">
              <div className="flex items-start gap-2.5">
                <div className="card-icon" style={{ background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)' }}>
                  <i className="fa-solid fa-chart-line" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold">Reports</div>
                  <div className="text-[10.5px] text-text-muted">Analytics + dashboards</div>
                </div>
              </div>
              <div>
                <div className="stat-big">This week</div>
                <div className="stat-sub mt-1">
                  Reply rate <span className="text-success font-semibold">↑ 4.1%</span> · Sent <span className="text-success font-semibold">↑ 12%</span>
                </div>
              </div>
              <svg viewBox="0 0 200 24" className="w-full h-6">
                <path d="M0,16 L25,18 L50,12 L75,14 L100,8 L125,10 L150,6 L175,8 L200,2" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div className="ws-footer">
                <span className="font-semibold text-text-secondary">3 saved dashboards</span>
                <span className="text-text-muted">→</span>
              </div>
            </Link>
          </div>
        </section>

        {/* Today's REX activity timeline (live) */}
        <section>
          <div className="float-in d-12 flex items-end justify-between mb-3">
            <h2 className="text-[15px] font-bold tracking-tight">Today's activity</h2>
            <span className="text-[11.5px] text-text-muted">live · refreshes every 30s</span>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 float-in d-12">
            {activity.length === 0 ? (
              <div className="py-6 text-center text-[12.5px] text-text-muted">
                <i className="fa-solid fa-wand-magic-sparkles text-primary text-[14px] mb-2 block" />
                Nothing yet today. When REX or your specialists run a Skill, it'll show up here.
              </div>
            ) : (
              activity.slice(0, 12).map((row) => <ActivityRow key={row.id} row={row} />)
            )}
          </div>
        </section>
      </div>

      {/* Overnight summary modal */}
      <V2Modal
        open={overnightOpen}
        onClose={() => setOvernightOpen(false)}
        title="Overnight summary"
        subtitle="What REX + your team handled while you slept."
        icon="moon"
        size="lg"
        footer={<ModalCancel onClick={() => setOvernightOpen(false)} label="Close" />}
      >
        <div className="space-y-3 text-[13px]">
          {/* Hero stat row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface/60 rounded-lg p-3 text-center">
              <div className="text-[20px] font-bold grad-text leading-none">{activity.length}</div>
              <div className="text-[10px] text-text-muted mt-1 uppercase tracking-wider">Events</div>
            </div>
            <div className="bg-surface/60 rounded-lg p-3 text-center">
              <div className="text-[20px] font-bold leading-none">{goals.length}</div>
              <div className="text-[10px] text-text-muted mt-1 uppercase tracking-wider">Goals running</div>
            </div>
            <div className="bg-surface/60 rounded-lg p-3 text-center">
              <div className="text-[20px] font-bold text-warn leading-none">{pending.length}</div>
              <div className="text-[10px] text-text-muted mt-1 uppercase tracking-wider">Decisions held</div>
            </div>
          </div>

          {/* Recent activity timeline */}
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-2">
              Recent activity
            </div>
            {activity.length === 0 ? (
              <div className="text-text-muted italic text-[12.5px] py-4 text-center">
                Quiet night — nothing to report.
              </div>
            ) : (
              <ul className="space-y-1.5 max-h-[280px] overflow-y-auto">
                {activity.slice(0, 8).map((row) => (
                  <li key={row.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-surface/50">
                    <i className="fa-solid fa-circle text-text-muted/30 text-[6px] mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] truncate">{row.summary || row.event_type}</div>
                      <div className="text-[10.5px] text-text-muted">{new Date(row.created_at).toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => { setOvernightOpen(false); navigate('/v2/today'); }}
              className="ghost-btn flex-1 justify-center"
            >
              <i className="fa-solid fa-clock-rotate-left text-[10px]" />Full audit log
            </button>
            <button
              onClick={() => { setOvernightOpen(false); navigate('/v2/decisions'); }}
              className="btn-solid flex-1 justify-center"
              disabled={pending.length === 0}
            >
              <i className="fa-solid fa-circle-question text-[10px]" />
              Review {pending.length || 0} decisions
            </button>
          </div>
        </div>
      </V2Modal>

      {/* Customize modal */}
      <V2Modal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        title="Customize workspace"
        subtitle="Pick what shows up on Today. Coming soon — drag-and-drop ordering."
        icon="sliders"
      >
        <div className="space-y-3 text-[13px]">
          <p className="text-text-secondary text-[12.5px]">
            Right now Today shows a default mix of cards. Per-user
            customization is in progress — we're adding:
          </p>
          <ul className="space-y-2 text-[12.5px]">
            {[
              { icon: 'fa-grip-vertical', label: 'Reorder cards by drag-and-drop' },
              { icon: 'fa-eye-slash', label: 'Hide cards you don\'t use (e.g. Reports if you\'re solo)' },
              { icon: 'fa-bell', label: 'Per-card notification preferences' },
              { icon: 'fa-clock', label: 'Choose your "today" cutoff (8am, midnight, etc.)' },
            ].map((row) => (
              <li key={row.label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface/60">
                <i className={`fa-solid ${row.icon} text-text-muted text-[11px] w-4`} />
                <span className="flex-1">{row.label}</span>
                <span className="tag tag-muted">soon</span>
              </li>
            ))}
          </ul>
          <p className="text-[11.5px] text-text-muted pt-2 border-t border-gray-100">
            Want a specific card or hidden? Tell REX with <span className="font-mono bg-surface px-1 rounded">⌘K</span>:
            "<em>hide reports</em>" or "<em>add a renewal reminders card</em>".
          </p>
        </div>
      </V2Modal>
    </WorkspaceShell>
  );
}

function ActivityRow({ row }: { row: ActivityEvent }) {
  // Map event type → dot color + surface tag.
  const dotCls =
    row.event_type === 'skill_failed' || row.event_type === 'goal_failed' ? 'bg-danger' :
    row.event_type === 'skill_held'   || row.event_type === 'agent_trust_changed' ? 'bg-warn' :
    row.event_type === 'goal_started' || row.event_type === 'goal_planned' ? 'bg-secondary' :
    'bg-success';

  const surfaceTag =
    row.goal_id      ? 'Goals' :
    row.decision_id  ? 'Decisions' :
    row.event_type === 'agent_hired'    ? 'Team' :
    row.event_type === 'agent_fired'    ? 'Team' :
    row.event_type === 'agent_trust_changed' ? 'Team' :
    row.skill_id     ? 'Skills' :
    'REX';

  const time = new Date(row.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="activity-row">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
      <span className="text-[12px] text-text-muted shrink-0 w-16">{time}</span>
      <span className="text-[13px] flex-1">{row.summary}</span>
      <span className="text-[11px] text-text-muted">{surfaceTag}</span>
    </div>
  );
}
