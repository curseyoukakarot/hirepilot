/**
 * v2 / Today — workspace home with REX briefing + workspace overview
 *
 * HTML preserved EXACTLY from mockups/workspace.html main content block.
 * Conversions: class→className, self-closing tags, JSX comment style,
 * NavLink for clickable cards.
 *
 * TODO wire to backend:
 *   - REX briefing text + stats from analytics services + REX agent
 *   - "Decision waiting" strip from decisions table (where status='pending' AND assigned_to=user)
 *   - Each workspace card's metric from its respective surface (leads count, deals total, etc.)
 *   - Today's activity timeline from rex_activity_log + lead_activities
 */

import React from 'react';
import { Link } from 'react-router-dom';
import WorkspaceShell from '../components/WorkspaceShell';
import WorkspaceTopbar, { RexStatusPill } from '../components/WorkspaceTopbar';

export default function TodayPage() {
  return (
    <WorkspaceShell autopilot>
      <WorkspaceTopbar
        pageTitle="Today"
        pageIcon="fa-solid fa-sun"
        pageIconColor="text-warn"
        pageSubtitle="Saturday, May 3"
        statusPill={
          <RexStatusPill
            text="drafting "
            highlight="102 / 142 · 72%"
            highlightClass="text-primary"
          />
        }
        trustLevel="autopilot"
      />

      {/* BODY */}
      <div className="px-8 py-7 space-y-7 max-w-[1400px] mx-auto">

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
                  <button className="btn-solid">
                    <i className="fa-solid fa-bolt text-[10px]" />Open 12 hot replies
                  </button>
                  <button className="ghost-btn">Show today's plan</button>
                  <button className="ghost-btn">Open overnight summary</button>
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
            <button className="ghost-btn">
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

        {/* Today's REX activity timeline */}
        <section>
          <div className="float-in d-12 flex items-end justify-between mb-3">
            <h2 className="text-[15px] font-bold tracking-tight">Today's activity</h2>
            <button className="ghost-btn">View all →</button>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 float-in d-12">
            <div className="activity-row">
              <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
              <span className="text-[12px] text-text-muted shrink-0 w-16">1:14 PM</span>
              <span className="text-[13px] flex-1"><strong>Auto-sent</strong> intro to Aisha Okafor (Replit · 93)</span>
              <span className="text-[11px] text-text-muted">Q2 Engineers</span>
            </div>
            <div className="activity-row">
              <span className="w-1.5 h-1.5 rounded-full bg-warn shrink-0" />
              <span className="text-[12px] text-text-muted shrink-0 w-16">12:42 PM</span>
              <span className="text-[13px] flex-1"><strong>Held 2 sends</strong> — caught Jane Doe + Alex Kim on blocklist</span>
              <span className="text-[11px] text-text-muted">Q2 Engineers</span>
            </div>
            <div className="activity-row">
              <span className="w-1.5 h-1.5 rounded-full bg-warn shrink-0" />
              <span className="text-[12px] text-text-muted shrink-0 w-16">12:14 PM</span>
              <span className="text-[13px] flex-1"><strong>Drafted comp answer</strong> for Marcus Rodriguez · awaiting your approval</span>
              <span className="text-[11px] text-text-muted">Inbox</span>
            </div>
            <div className="activity-row">
              <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
              <span className="text-[12px] text-text-muted shrink-0 w-16">11:36 AM</span>
              <span className="text-[13px] flex-1"><strong>Sarah Chen</strong> (Stripe) replied — auto-sent calendar invite for Thu 2:30 PT</span>
              <span className="text-[11px] text-text-muted">Q2 Engineers</span>
            </div>
            <div className="activity-row">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
              <span className="text-[12px] text-text-muted shrink-0 w-16">8:14 AM</span>
              <span className="text-[13px] flex-1"><strong>Started "Scale Q2 Engineers"</strong> — sourcing 200 more leads matching top responders</span>
              <span className="text-[11px] text-text-muted">Goals</span>
            </div>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
