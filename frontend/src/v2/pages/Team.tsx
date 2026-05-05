/**
 * v2 / Team — your AI team (REX + specialist agents)
 *
 * HTML preserved EXACTLY from mockups/team.html main content block.
 * Conversions: class→className, self-closing tags, JSX comment style.
 *
 * TODO wire to backend:
 *   - Hired agents from `agents` table where workspace_id = current
 *   - Agent's installed Skills from `agent_skills` joined to `skills_catalog`
 *   - Per-agent "right now" status from rex_activity_log + goals
 *   - Trust mini-toggle persists via PATCH /api/v2/agents/:id { trust_level }
 *   - "Hire team member" button → /v2/hire (catalog page)
 *   - Available-to-hire cards = skills_catalog roles where no agent row exists yet
 *   - Activity timeline from rex_activity_log filtered to agent_id IS NOT NULL
 */

import React from 'react';
import { Link } from 'react-router-dom';
import WorkspaceShell from '../components/WorkspaceShell';
import WorkspaceTopbar, { RexStatusPill } from '../components/WorkspaceTopbar';

export default function TeamPage() {
  return (
    <WorkspaceShell autopilot>
      <WorkspaceTopbar
        pageTitle="Team"
        pageIcon="fa-solid fa-users-gear"
        pageIconColor="text-primary"
        pageSubtitle="Your AI team · 3 agents · 2 active"
        statusPill={
          <RexStatusPill
            text="team is working "
            highlight="3 in flight · 1 awaiting"
            highlightClass="text-warn"
          />
        }
        trustLevel="autopilot"
      />

      {/* BODY */}
      <div className="px-8 py-7 space-y-7 max-w-[1400px] mx-auto">

        {/* Page hero */}
        <section className="float-in flex items-end justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] grad-text-rex mb-1.5">
              <i className="fa-solid fa-people-group text-[10px] mr-1" />Your AI team
            </div>
            <h1 className="text-[32px] font-extrabold tracking-tight">REX, plus the specialists you've hired.</h1>
            <p className="text-text-secondary text-[14.5px] mt-1.5 max-w-2xl">
              REX is your team lead — they coordinate everything. Hire specialist agents to scale specific functions.
              Each agent runs on its own trust setting and you can give them goals or schedules.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="ghost-btn">
              <i className="fa-solid fa-clock-rotate-left text-[11px]" />Activity
            </button>
            <Link to="/v2/hire" className="btn-solid">
              <i className="fa-solid fa-user-plus text-[10px]" />Hire team member
            </Link>
          </div>
        </section>

        {/* REX HERO */}
        <section className="float-in d-1 rex-hero">
          <div className="flex items-start gap-5">
            <div className="agent-avatar rex grad-rex w-20 h-20 shadow-2xl shadow-primary/30">
              <i className="fa-solid fa-wand-magic-sparkles text-[26px] drop-shadow-lg" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-[22px] font-extrabold tracking-tight">REX</h2>
                <span className="tag tag-primary"><i className="fa-solid fa-star text-[8px]" />Team Lead</span>
                <span className="tag tag-success"><span className="live-dot" />Working</span>
              </div>
              <p className="text-[13.5px] text-text-secondary mb-3">
                Coordinates your team and runs anything none of your specialists handle. The glue between every Skill, every channel, and every surface in HirePilot.
              </p>

              {/* Currently */}
              <div className="bg-white/70 border border-primary/15 rounded-xl p-3 mb-3">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Currently</div>
                <ul className="text-[13px] space-y-1.5">
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-rocket text-primary text-[10px] mt-1 shrink-0" />
                    <span>Watching <strong>2 goals</strong> — Q2 Senior Engineers (72%) · Sales Reps SF (33%)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-circle-question text-warn text-[10px] mt-1 shrink-0" />
                    <span><strong>1 decision pending</strong> — Marcus Rodriguez comp answer</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-people-arrows text-secondary text-[10px] mt-1 shrink-0" />
                    <span>Coordinating <strong>2 specialists</strong> — Sourcer · Recruiter</span>
                  </li>
                </ul>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">All skills available</span>
                <span className="skill-chip"><i className="fa-solid fa-wand-magic-sparkles" />24 installed</span>
                <span className="skill-chip"><i className="fa-solid fa-comment-dots" />Inbox draft</span>
                <span className="skill-chip"><i className="fa-solid fa-calendar" />Calendar</span>
                <span className="skill-chip"><i className="fa-solid fa-rocket" />Goal planner</span>
                <span className="skill-chip text-text-muted">+ 21 more</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="trust-mini">
                <span className="trust-mini-seg">Manual</span>
                <span className="trust-mini-seg">Suggest</span>
                <span className="trust-mini-seg active">Auto</span>
              </div>
              <button className="btn-solid">
                <i className="fa-solid fa-comments text-[10px]" />Talk to REX
              </button>
              <button className="ghost-btn">
                <i className="fa-solid fa-sliders text-[11px]" />Configure
              </button>
            </div>
          </div>
        </section>

        {/* SPECIALIST AGENTS — 3 hired */}
        <section>
          <div className="float-in d-2 flex items-end justify-between mb-4">
            <div>
              <h2 className="text-[18px] font-bold tracking-tight">Specialists you've hired</h2>
              <p className="text-text-muted text-[12.5px] mt-0.5">Each specialist owns a function and runs on its own trust setting.</p>
            </div>
            <div className="flex items-center gap-2 text-[11.5px] text-text-muted">
              <span><span className="font-bold text-text-main">2</span> active</span>
              <span>·</span>
              <span><span className="font-bold text-text-main">8</span> Skills installed</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

            {/* SOURCER */}
            <Link to="/v2/agents/sourcer" className="agent-card float-in d-3 shimmer-top">
              <div className="flex items-start gap-3">
                <div className="agent-avatar sourcer grad-sourcer w-12 h-12 shadow-lg" style={{ boxShadow: '0 8px 20px -6px rgba(6,182,212,.4)' }}>
                  <i className="fa-solid fa-crosshairs text-[16px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-[16px] font-bold">Sourcer</h3>
                    <span className="tag tag-success"><span className="live-dot" />Running</span>
                  </div>
                  <p className="text-[11.5px] text-text-muted">Finds and qualifies new leads. Owns the funnel before outreach.</p>
                </div>
                <div className="trust-mini shrink-0" onClick={(e) => e.preventDefault()}>
                  <span className="trust-mini-seg">M</span>
                  <span className="trust-mini-seg">S</span>
                  <span className="trust-mini-seg active">A</span>
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1">Right now</div>
                <p className="text-[13px] text-text-secondary mb-2">
                  <strong>Sourcing 200 senior backend engineers</strong> matching the top 12 responders from Q2.
                </p>
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 progress-sourcer"><div style={{ width: '72%' }} /></div>
                  <span className="text-[11px] font-semibold text-sourcer tabular-nums" style={{ color: '#06B6D4' }}>102 / 142 · ~28m</span>
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Skills · 4 installed · 4 available</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="skill-chip"><i className="fa-brands fa-linkedin" style={{ color: '#0077B5' }} />LinkedIn Sourcer</span>
                  <span className="skill-chip"><i className="fa-solid fa-database" style={{ color: '#0891B2' }} />Apollo Enrich</span>
                  <span className="skill-chip"><i className="fa-solid fa-bullseye" style={{ color: '#06B6D4' }} />ICP Researcher</span>
                  <span className="skill-chip"><i className="fa-solid fa-globe" style={{ color: '#3B82F6' }} />Browser Researcher</span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-3 text-text-muted">
                  <span><span className="font-bold text-text-main tabular-nums">247</span> sourced this week</span>
                  <span>·</span>
                  <span><span className="font-bold text-warn tabular-nums">12</span> hot</span>
                </div>
                <span className="ghost-btn"><i className="fa-solid fa-arrow-right text-[10px]" /></span>
              </div>
            </Link>

            {/* RECRUITER */}
            <Link to="/v2/agents/recruiter" className="agent-card float-in d-4">
              <div className="flex items-start gap-3">
                <div className="agent-avatar recruiter grad-recruiter w-12 h-12 shadow-lg" style={{ boxShadow: '0 8px 20px -6px rgba(16,185,129,.4)' }}>
                  <i className="fa-solid fa-user-tie text-[16px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-[16px] font-bold">Recruiter</h3>
                    <span className="tag tag-warn"><i className="fa-solid fa-circle-question text-[8px]" />1 needs you</span>
                  </div>
                  <p className="text-[11.5px] text-text-muted">Engages candidates, drafts replies, manages pipelines, schedules interviews.</p>
                </div>
                <div className="trust-mini shrink-0" onClick={(e) => e.preventDefault()}>
                  <span className="trust-mini-seg">M</span>
                  <span className="trust-mini-seg active suggest">S</span>
                  <span className="trust-mini-seg">A</span>
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1">Right now</div>
                <p className="text-[13px] text-text-secondary mb-2">
                  <strong>Drafting replies for 8 hot leads</strong> · 1 above your trust threshold (comp answer to Marcus).
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex -space-x-1.5">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 ring-2 ring-white" />
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 ring-2 ring-white" />
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 ring-2 ring-white" />
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-400 to-pink-600 ring-2 ring-white" />
                  </div>
                  <span className="text-[10.5px] text-text-muted">+ 4 more</span>
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Skills · 4 installed · 3 available</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="skill-chip"><i className="fa-solid fa-paper-plane" style={{ color: '#10B981' }} />Outreach Writer</span>
                  <span className="skill-chip"><i className="fa-solid fa-comments" style={{ color: '#14B8A6' }} />Reply Handler</span>
                  <span className="skill-chip"><i className="fa-solid fa-file-lines" style={{ color: '#10B981' }} />Submittal Drafter</span>
                  <span className="skill-chip"><i className="fa-solid fa-table-columns" style={{ color: '#059669' }} />Pipeline Manager</span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-3 text-text-muted">
                  <span><span className="font-bold text-text-main">49</span> replies handled</span>
                  <span>·</span>
                  <span><span className="font-bold text-success">12</span> invites sent</span>
                </div>
                <span className="ghost-btn"><i className="fa-solid fa-arrow-right text-[10px]" /></span>
              </div>
            </Link>

            {/* COORDINATOR */}
            <Link to="/v2/agents/coordinator" className="agent-card float-in d-5 shimmer-top">
              <div className="flex items-start gap-3">
                <div className="agent-avatar grad-coordinator w-12 h-12 shadow-lg flex items-center justify-center text-white" style={{ boxShadow: '0 8px 20px -6px rgba(139,92,246,.4)', borderRadius: '9999px' }}>
                  <i className="fa-solid fa-calendar-check text-[16px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-[16px] font-bold">Coordinator</h3>
                    <span className="tag tag-success"><span className="live-dot" />Working</span>
                  </div>
                  <p className="text-[11.5px] text-text-muted">Schedules interviews, sends invites, handles reschedules + reminders.</p>
                </div>
                <div className="trust-mini shrink-0" onClick={(e) => e.preventDefault()}>
                  <span className="trust-mini-seg">M</span>
                  <span className="trust-mini-seg">S</span>
                  <span className="trust-mini-seg active">A</span>
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1">Right now</div>
                <p className="text-[13px] text-text-secondary mb-2">
                  <strong>Booking 3 interviews</strong> for Senior Backend role · 2 invites sent · 1 awaiting candidate confirm.
                </p>
                <div className="flex items-center gap-2 text-[11px] text-text-muted">
                  <span className="flex items-center gap-1"><i className="fa-brands fa-google text-[10px]" />Google Cal · synced</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><i className="fa-brands fa-microsoft text-[10px]" />Outlook · synced</span>
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Skills · 4 installed</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="skill-chip"><i className="fa-solid fa-calendar" style={{ color: '#8B5CF6' }} />Calendar Sync</span>
                  <span className="skill-chip"><i className="fa-solid fa-clock" style={{ color: '#A855F7' }} />Interview Booker</span>
                  <span className="skill-chip"><i className="fa-solid fa-bell" style={{ color: '#EC4899' }} />Reminder Bot</span>
                  <span className="skill-chip"><i className="fa-solid fa-rotate" style={{ color: '#8B5CF6' }} />Reschedule Mgr</span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-3 text-text-muted">
                  <span><span className="font-bold text-text-main">28</span> scheduled this week</span>
                  <span>·</span>
                  <span><span className="font-bold text-success">0</span> conflicts</span>
                </div>
                <span className="ghost-btn"><i className="fa-solid fa-arrow-right text-[10px]" /></span>
              </div>
            </Link>
          </div>
        </section>

        {/* AVAILABLE TO HIRE */}
        <section>
          <div className="float-in d-6 flex items-end justify-between mb-4">
            <div>
              <h2 className="text-[18px] font-bold tracking-tight">Available to hire</h2>
              <p className="text-text-muted text-[12.5px] mt-0.5">More specialists join the catalog over time.</p>
            </div>
            <Link to="/v2/hire" className="ghost-btn">
              <i className="fa-solid fa-grip text-[11px]" />Browse catalog
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">

            {[
              {
                role: 'researcher', label: 'Researcher', icon: 'fa-magnifying-glass-arrow-right',
                gradClass: 'grad-researcher', shadow: 'rgba(124,58,237,.3)',
                desc: 'Deep intel on companies, hiring managers, candidates. Owns Browserbase research.',
                skills: [
                  { icon: 'fa-globe', text: 'Browser Researcher' },
                  { icon: 'fa-building', text: 'Company Intel' },
                  { icon: 'fa-coins', text: 'Comp Benchmark' },
                ],
              },
              {
                role: 'business_dev', label: 'Business Dev', icon: 'fa-handshake-angle',
                gradClass: 'grad-bd', shadow: 'rgba(245,158,11,.3)',
                desc: 'Finds new clients hiring + drafts BD outreach to TA leaders & founders.',
                skills: [
                  { icon: 'fa-satellite-dish', text: 'Hiring Signal' },
                  { icon: 'fa-paper-plane', text: 'Cold Outreach' },
                  { icon: 'fa-list-ul', text: 'Job Board Scrape' },
                ],
              },
              {
                role: 'closer', label: 'Closer', icon: 'fa-trophy',
                gradClass: 'grad-closer', shadow: 'rgba(244,63,94,.3)',
                desc: 'Drafts offers, handles negotiations, drives deals to signed.',
                skills: [
                  { icon: 'fa-file-signature', text: 'Offer Drafter' },
                  { icon: 'fa-comments-dollar', text: 'Negotiation' },
                  { icon: 'fa-rotate-left', text: 'Counter-handler' },
                ],
              },
              {
                role: 'account_manager', label: 'Account Mgr', icon: 'fa-building-user',
                gradClass: 'grad-account', shadow: 'rgba(14,165,233,.3)',
                desc: 'Ongoing client relationship — status reports, pipeline updates, renewal nudges.',
                skills: [
                  { icon: 'fa-file-lines', text: 'Weekly Reports' },
                  { icon: 'fa-arrow-trend-up', text: 'Pipeline Updater' },
                  { icon: 'fa-bell', text: 'Renewal Nudge' },
                ],
              },
              {
                role: 'reference_checker', label: 'Reference Checker', icon: 'fa-shield-check',
                gradClass: 'grad-refcheck', shadow: 'rgba(71,85,105,.3)',
                desc: 'Drafts reference requests, processes responses, summarizes back-channel intel.',
                skills: [
                  { icon: 'fa-envelope', text: 'Reference Outreach' },
                  { icon: 'fa-comment-dots', text: 'Back-channel' },
                  { icon: 'fa-list-check', text: 'Synthesis' },
                ],
              },
            ].map((agent, i) => (
              <div key={agent.role} className={`agent-card dashed float-in d-${7 + i}`} style={{ padding: '16px', gap: '12px' }}>
                <div className="flex items-start gap-2.5">
                  <div className={`agent-avatar ${agent.gradClass} w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0`} style={{ boxShadow: `0 8px 20px -6px ${agent.shadow}` }}>
                    <i className={`fa-solid ${agent.icon} text-[13px]`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-[13.5px]">{agent.label}</h4>
                    <p className="text-[10.5px] text-text-muted leading-snug mt-0.5">{agent.desc}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {agent.skills.map((s) => (
                    <span key={s.text} className="skill-chip text-[9.5px]">
                      <i className={`fa-solid ${s.icon}`} />{s.text}
                    </span>
                  ))}
                </div>
                <button className="w-full text-[11.5px] font-semibold text-primary hover:bg-primary/5 py-1.5 rounded-md transition border border-transparent hover:border-primary/20">
                  <i className="fa-solid fa-plus text-[9px] mr-1" />Hire {agent.label}
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-[11px] text-text-muted mt-4 italic">
            More specialists land in the catalog every release — Comp Benchmarker, Talent Mapper, Content Writer.
          </p>
        </section>

        {/* TODAY'S TEAM ACTIVITY */}
        <section>
          <div className="float-in d-7 flex items-end justify-between mb-3">
            <h2 className="text-[15px] font-bold tracking-tight">Team activity · today</h2>
            <button className="ghost-btn">View all →</button>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 float-in d-7">
            <div className="activity-row">
              <div className="agent-avatar sourcer grad-sourcer w-7 h-7 rounded-md text-[10px]" style={{ borderRadius: '6px' }}>
                <i className="fa-solid fa-crosshairs" />
              </div>
              <div className="flex-1 text-[13px]">
                <span className="text-[10.5px] text-text-muted font-bold uppercase tracking-wider">Sourcer · 1:42 PM</span>
                <p className="mt-0.5">Drafting personalized variants for 142 leads in Q2 Engineers scale-up · 102/142 · 72%</p>
              </div>
              <span className="tag tag-sourcer">Running</span>
            </div>
            <div className="activity-row">
              <div className="agent-avatar recruiter grad-recruiter w-7 h-7 rounded-md text-[10px]" style={{ borderRadius: '6px' }}>
                <i className="fa-solid fa-user-tie" />
              </div>
              <div className="flex-1 text-[13px]">
                <span className="text-[10.5px] text-text-muted font-bold uppercase tracking-wider">Recruiter · 1:14 PM</span>
                <p className="mt-0.5">Drafted submittal for <strong>Aisha Okafor</strong> (Replit · Eng Mgr) — sent to hiring manager Marcus</p>
              </div>
              <span className="tag tag-success">Done</span>
            </div>
            <div className="activity-row">
              <div className="agent-avatar grad-coordinator w-7 h-7 rounded-md text-[10px] flex items-center justify-center text-white" style={{ borderRadius: '6px' }}>
                <i className="fa-solid fa-calendar-check" />
              </div>
              <div className="flex-1 text-[13px]">
                <span className="text-[10.5px] text-text-muted font-bold uppercase tracking-wider">Coordinator · 12:48 PM</span>
                <p className="mt-0.5">Booked phone screen for <strong>Sarah Chen</strong> (Stripe) on Thu 2:30 PT · sent invite + 24h reminder</p>
              </div>
              <span className="tag tag-success">Done</span>
            </div>
            <div className="activity-row">
              <div className="agent-avatar rex grad-rex w-7 h-7 rounded-md text-[10px]" style={{ borderRadius: '6px' }}>
                <i className="fa-solid fa-wand-magic-sparkles" />
              </div>
              <div className="flex-1 text-[13px]">
                <span className="text-[10.5px] text-text-muted font-bold uppercase tracking-wider">REX · 12:14 PM</span>
                <p className="mt-0.5">Held a Recruiter draft for review — <strong>Marcus Rodriguez</strong> comp answer is above your autopilot threshold</p>
              </div>
              <span className="tag tag-warn">Awaiting you</span>
            </div>
            <div className="activity-row">
              <div className="agent-avatar rex grad-rex w-7 h-7 rounded-md text-[10px]" style={{ borderRadius: '6px' }}>
                <i className="fa-solid fa-wand-magic-sparkles" />
              </div>
              <div className="flex-1 text-[13px]">
                <span className="text-[10.5px] text-text-muted font-bold uppercase tracking-wider">REX · 8:14 AM</span>
                <p className="mt-0.5">Started <strong>"Scale Q2 Engineers"</strong> goal — delegated sourcing to Sourcer, outreach drafting to Recruiter</p>
              </div>
              <span className="tag tag-primary">Started</span>
            </div>
          </div>
        </section>

      </div>
    </WorkspaceShell>
  );
}
