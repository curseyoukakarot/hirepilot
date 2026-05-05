/**
 * v2 / Hire Catalog — Pick a specialist agent to add to your team
 *
 * HTML preserved EXACTLY from mockups/hire-catalog.html main content block.
 *
 * TODO wire to backend:
 *   - GET /api/v2/agents (already-hired list, mark with green ribbon)
 *   - GET /api/v2/skills/catalog?role=:role (default Skills shown per agent)
 *   - POST /api/v2/agents/:role to hire (creates agents row + auto-installs default Skills)
 *   - Plan tier banner from `users.role` / Stripe (Free | Starter | Team)
 */

import React from 'react';
import { Link } from 'react-router-dom';
import WorkspaceShell from '../components/WorkspaceShell';
import WorkspaceTopbar from '../components/WorkspaceTopbar';

interface CatalogAgent {
  role: string;
  name: string;
  taglineRow: string;
  description: string;
  workflow: string;
  defaultSkills: { icon: string; iconColor: string; label: string }[];
  surfaces: { icon: string; label: string }[];
  footnote: React.ReactNode;
  hired: boolean;
  detailHref?: string;
  avatarClass: string;
  shadow: string;
  iconClass: string;
}

const AGENTS: CatalogAgent[] = [
  {
    role: 'sourcer',
    name: 'Sourcer',
    taglineRow: 'Top of funnel · finds & qualifies new leads',
    description: 'Tirelessly scans LinkedIn, Apollo, GitHub, and the open web for people who match your ICP. Enriches contact info, scores them, and queues the best for your Recruiter.',
    workflow: '"Find 50 senior backend at Series B startups in NY" → I source via LinkedIn + Apollo, enrich every result, score them against your ICP, and queue the top 30 for outreach.',
    defaultSkills: [
      { icon: 'fa-brands fa-linkedin', iconColor: '#0077B5', label: 'LinkedIn Sourcer' },
      { icon: 'fa-solid fa-database', iconColor: '#0891B2', label: 'Apollo Enrich' },
      { icon: 'fa-solid fa-bullseye', iconColor: '#06B6D4', label: 'ICP Researcher' },
      { icon: 'fa-solid fa-globe', iconColor: '#3B82F6', label: 'Browser Researcher' },
    ],
    surfaces: [{ icon: 'fa-database', label: 'Leads' }, { icon: 'fa-rocket', label: 'Goals' }],
    footnote: <span className="text-[11px] text-text-muted">247 sourced this week</span>,
    hired: true,
    detailHref: '/v2/agents/sourcer',
    avatarClass: 'sourcer grad-sourcer',
    shadow: 'rgba(6,182,212,.4)',
    iconClass: 'fa-crosshairs',
  },
  {
    role: 'recruiter',
    name: 'Recruiter',
    taglineRow: 'Engagement · drafts · screens · submittals',
    description: 'Owns everything between "lead found" and "interview booked" — drafts personalized outreach, handles replies, screens candidates, writes the submittal you\'d send to a hiring manager.',
    workflow: 'When Sarah replies to your campaign, I draft the perfect response in your tone, schedule next step, and write the submittal for your hiring manager.',
    defaultSkills: [
      { icon: 'fa-solid fa-paper-plane', iconColor: '#10B981', label: 'Outreach Writer' },
      { icon: 'fa-solid fa-comments', iconColor: '#14B8A6', label: 'Reply Handler' },
      { icon: 'fa-solid fa-file-lines', iconColor: '#10B981', label: 'Submittal Drafter' },
      { icon: 'fa-solid fa-table-columns', iconColor: '#059669', label: 'Pipeline Manager' },
    ],
    surfaces: [{ icon: 'fa-envelope', label: 'Inbox' }, { icon: 'fa-paper-plane', label: 'Campaigns' }, { icon: 'fa-table-columns', label: 'Pipelines' }],
    footnote: <span className="text-[11px] text-text-muted">49 replies handled this week</span>,
    hired: true,
    avatarClass: 'recruiter grad-recruiter',
    shadow: 'rgba(16,185,129,.4)',
    iconClass: 'fa-user-tie',
  },
  {
    role: 'coordinator',
    name: 'Coordinator',
    taglineRow: 'Logistics · scheduling · reminders',
    description: 'The most overlooked role in agencies — handles all calendar back-and-forth, books interviews, sends reminders, manages reschedules. Recruiters reclaim 6+ hours/week.',
    workflow: 'When a candidate clears phone screen, I instantly book the technical interview across 3 calendars, send invites + reminders, and handle reschedules without you noticing.',
    defaultSkills: [
      { icon: 'fa-solid fa-calendar', iconColor: '#8B5CF6', label: 'Calendar Sync' },
      { icon: 'fa-solid fa-clock', iconColor: '#A855F7', label: 'Interview Booker' },
      { icon: 'fa-solid fa-bell', iconColor: '#EC4899', label: 'Reminder Bot' },
      { icon: 'fa-solid fa-rotate', iconColor: '#8B5CF6', label: 'Reschedule Mgr' },
    ],
    surfaces: [{ icon: 'fa-table-columns', label: 'Pipelines' }, { icon: 'fa-envelope', label: 'Inbox' }],
    footnote: <span className="text-[11px] text-text-muted">28 interviews scheduled this week</span>,
    hired: true,
    avatarClass: 'coordinator grad-coordinator',
    shadow: 'rgba(139,92,246,.4)',
    iconClass: 'fa-calendar-check',
  },
  {
    role: 'researcher',
    name: 'Researcher',
    taglineRow: 'Deep intel · companies · people · comp',
    description: "When a quick LinkedIn skim isn't enough. Spins up a full Browserbase session to deep-dive a company, hiring manager, or candidate — reads news, careers pages, funding rounds, team org charts.",
    workflow: 'Drop me a company URL — I read their careers page, news, funding history, and team org, then hand you a 1-page intel brief before you hop on the call.',
    defaultSkills: [
      { icon: 'fa-solid fa-globe', iconColor: '#7C3AED', label: 'Browser Researcher' },
      { icon: 'fa-solid fa-building', iconColor: '#4F46E5', label: 'Company Intel' },
      { icon: 'fa-solid fa-coins', iconColor: '#7C3AED', label: 'Comp Benchmark' },
    ],
    surfaces: [{ icon: 'fa-database', label: 'Leads' }, { icon: 'fa-handshake', label: 'Deals' }, { icon: 'fa-rocket', label: 'Goals' }],
    footnote: <span className="text-[11px] text-success font-semibold flex items-center gap-1"><i className="fa-solid fa-fire text-[9px]" />Most popular this month</span>,
    hired: false,
    avatarClass: 'researcher grad-researcher',
    shadow: 'rgba(124,58,237,.3)',
    iconClass: 'fa-magnifying-glass-arrow-right',
  },
  {
    role: 'business_dev',
    name: 'Business Dev',
    taglineRow: 'Top of funnel · finds new clients',
    description: 'Finds you new client companies before your pipeline runs dry. Watches funding announcements, job board signals, hiring patterns — flags companies likely to need you.',
    workflow: 'I scan job boards and funding announcements daily. When a Series B startup posts 5+ engineering roles, I ping you with a draft cold-outreach to their TA leader.',
    defaultSkills: [
      { icon: 'fa-solid fa-satellite-dish', iconColor: '#F59E0B', label: 'Hiring Signal Watch' },
      { icon: 'fa-solid fa-paper-plane', iconColor: '#EA580C', label: 'Cold Outreach' },
      { icon: 'fa-solid fa-list-ul', iconColor: '#F59E0B', label: 'Job Board Scrape' },
    ],
    surfaces: [{ icon: 'fa-handshake', label: 'Deals' }, { icon: 'fa-paper-plane', label: 'Campaigns' }],
    footnote: <span className="text-[11px] text-text-muted">For freelancers + small agencies</span>,
    hired: false,
    avatarClass: 'bd grad-bd',
    shadow: 'rgba(245,158,11,.3)',
    iconClass: 'fa-handshake-angle',
  },
  {
    role: 'closer',
    name: 'Closer',
    taglineRow: 'Closing · offers · negotiation',
    description: 'When a candidate is in offer stage, this is the agent that gets it across the line. Drafts offer letters, handles negotiations, predicts counter-offers, drives deals to signed.',
    workflow: 'Drafts your offer letters with current comp benchmarks. When the candidate counter-offers, I draft your response and forecast their likely reaction based on similar deals.',
    defaultSkills: [
      { icon: 'fa-solid fa-file-signature', iconColor: '#F43F5E', label: 'Offer Drafter' },
      { icon: 'fa-solid fa-comments-dollar', iconColor: '#E11D48', label: 'Negotiation' },
      { icon: 'fa-solid fa-rotate-left', iconColor: '#F43F5E', label: 'Counter-handler' },
    ],
    surfaces: [{ icon: 'fa-table-columns', label: 'Pipelines' }, { icon: 'fa-handshake', label: 'Deals' }],
    footnote: <span className="text-[11px] text-text-muted">Best paired with Recruiter</span>,
    hired: false,
    avatarClass: 'closer grad-closer',
    shadow: 'rgba(244,63,94,.3)',
    iconClass: 'fa-trophy',
  },
  {
    role: 'account_manager',
    name: 'Account Manager',
    taglineRow: 'Client retention · status reports · renewals',
    description: 'Keeps your existing clients warm so they keep retaining you. Sends weekly status updates, flags when pipeline health dips, nudges on renewals. The reason your clients say "you\'re easy to work with."',
    workflow: 'Every Friday, I send each active client a clean status report — pipeline health, candidates in flight, time-to-hire vs SLA. They feel covered without you typing a word.',
    defaultSkills: [
      { icon: 'fa-solid fa-file-lines', iconColor: '#0EA5E9', label: 'Weekly Reports' },
      { icon: 'fa-solid fa-arrow-trend-up', iconColor: '#0D9488', label: 'Pipeline Updater' },
      { icon: 'fa-solid fa-bell', iconColor: '#0EA5E9', label: 'Renewal Nudge' },
    ],
    surfaces: [{ icon: 'fa-handshake', label: 'Deals' }, { icon: 'fa-chart-line', label: 'Reports' }],
    footnote: <span className="text-[11px] text-text-muted">Best for retainer agencies</span>,
    hired: false,
    avatarClass: 'account grad-account',
    shadow: 'rgba(14,165,233,.3)',
    iconClass: 'fa-building-user',
  },
  {
    role: 'reference_checker',
    name: 'Reference Checker',
    taglineRow: 'Late stage · references · back-channels',
    description: 'Drafts and sends reference request emails, follows up with reviewers who ghost, synthesizes feedback. Also runs back-channel inquiries when needed (people you trust who know the candidate).',
    workflow: 'I draft reference request emails, follow up if reviewers ghost, and synthesize their feedback into a 5-line summary for your hiring manager — saves 90 min/candidate.',
    defaultSkills: [
      { icon: 'fa-solid fa-envelope', iconColor: '#475569', label: 'Reference Outreach' },
      { icon: 'fa-solid fa-comment-dots', iconColor: '#1E40AF', label: 'Back-channel' },
      { icon: 'fa-solid fa-list-check', iconColor: '#475569', label: 'Synthesis' },
    ],
    surfaces: [{ icon: 'fa-table-columns', label: 'Pipelines' }, { icon: 'fa-envelope', label: 'Inbox' }],
    footnote: <span className="text-[11px] text-text-muted">For senior &amp; exec placements</span>,
    hired: false,
    avatarClass: 'refcheck grad-refcheck',
    shadow: 'rgba(71,85,105,.3)',
    iconClass: 'fa-shield-check',
  },
];

export default function HireCatalogPage() {
  return (
    <WorkspaceShell autopilot>
      <WorkspaceTopbar
        pageTitle="Hire team member"
        pageIcon="fa-solid fa-user-plus"
        pageIconColor="text-primary"
        pageSubtitle="Catalog · 8 specialists available"
      />

      <div className="px-8 py-7 space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <section className="float-in flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] grad-text-rex mb-1.5">
              <i className="fa-solid fa-people-group text-[10px] mr-1" />Catalog
            </div>
            <h1 className="text-[32px] font-extrabold tracking-tight">Build your AI team.</h1>
            <p className="text-text-secondary text-[14.5px] mt-1.5 max-w-2xl">Hire specialists for every stage of recruiting — sourcing, engagement, scheduling, deal-closing. Each comes pre-loaded with Skills and integrates with the team you already have.</p>
          </div>
        </section>

        {/* Plan banner */}
        <section className="float-in d-1 flex items-center gap-3.5 px-4.5 py-3.5"
          style={{ background: 'linear-gradient(90deg,rgba(107,70,193,.04),rgba(12,92,244,.02) 70%,transparent)', border: '1px solid rgba(107,70,193,.12)', borderRadius: '14px' }}
        >
          <div className="w-9 h-9 rounded-xl grad-icon flex items-center justify-center text-white shrink-0 shadow-md shadow-primary/25"><i className="fa-solid fa-circle-check text-sm" /></div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold">You're on Starter — all 8 specialists are available</div>
            <div className="text-[11.5px] text-text-muted mt-0.5">$59/mo · 500 credits · unlimited goals · all Skills · single workspace</div>
          </div>
          <button className="btn-outline"><i className="fa-solid fa-people-roof text-[10px]" />Need teammates? Upgrade to Team — $79/user/mo</button>
        </section>

        {/* Filter pills */}
        <div className="float-in d-2 flex items-center gap-1.5 flex-wrap">
          <span className="px-3 py-1.5 rounded-full bg-primary text-white text-[12px] font-semibold">All · 8</span>
          <span className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-[12px] text-text-secondary">Top of funnel · 3</span>
          <span className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-[12px] text-text-secondary">Engagement · 2</span>
          <span className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-[12px] text-text-secondary">Closing · 3</span>
          <span className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-[12px] text-text-secondary"><i className="fa-solid fa-circle-check text-success text-[9px]" />Already hired · 3</span>
          <span className="ml-auto text-[12px] text-text-muted"><i className="fa-solid fa-arrow-up-wide-short text-[9px] mr-1" />Sort: Most popular</span>
        </div>

        {/* Catalog grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {AGENTS.map((a, i) => (
            <CatalogCard key={a.role} agent={a} d={`d-${3 + i}`} />
          ))}
        </section>

        {/* Coming soon */}
        <section className="float-in d-12 mt-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-[15px] font-bold tracking-tight">Coming next quarter</h2>
            <div className="flex-1 h-px bg-gray-200" />
            <button className="text-[11.5px] text-primary font-semibold hover:underline">Suggest a specialist →</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: 'fa-coins', label: 'Comp Benchmarker', desc: 'Live market salary data', grad: 'linear-gradient(135deg,#84CC16,#10B981)' },
              { icon: 'fa-map', label: 'Talent Mapper', desc: 'Industry-wide org charts', grad: 'linear-gradient(135deg,#06B6D4,#8B5CF6)' },
              { icon: 'fa-pen-nib', label: 'Content Writer', desc: 'LinkedIn posts + newsletters', grad: 'linear-gradient(135deg,#EC4899,#F43F5E)' },
              { icon: 'fa-magnifying-glass-chart', label: 'Diligence Auditor', desc: 'Background + employment verify', grad: 'linear-gradient(135deg,#475569,#0EA5E9)' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl p-4 opacity-80" style={{ border: '1px dashed #E5E7EB' }}>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm" style={{ background: s.grad, boxShadow: '0 8px 20px -6px rgba(132,204,22,.3)' }}>
                    <i className={`fa-solid ${s.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[13px]">{s.label}</div>
                    <div className="text-[10.5px] text-text-muted">{s.desc}</div>
                  </div>
                </div>
                <div className="text-[10.5px] text-text-muted italic">Q3–Q4 2026</div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </WorkspaceShell>
  );
}

function CatalogCard({ agent, d }: { agent: CatalogAgent; d: string }) {
  return (
    <div className={`agent-card float-in ${d} ${agent.hired ? '' : ''}`} style={agent.hired ? { background: 'linear-gradient(135deg,rgba(16,185,129,.03),white 30%)', borderColor: 'rgba(16,185,129,.18)' } : undefined}>
      {agent.hired && (
        <span className="absolute" style={{ top: '18px', right: '18px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '9999px', background: 'rgba(16,185,129,.1)', color: '#059669', fontSize: '10px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          <i className="fa-solid fa-check text-[8px]" />Hired
        </span>
      )}
      <div className="flex items-start gap-3.5">
        <div className={`agent-avatar ${agent.avatarClass} w-[52px] h-[52px] flex items-center justify-center text-white shrink-0 text-[18px]`} style={{ boxShadow: `0 8px 20px -6px ${agent.shadow}`, borderRadius: '9999px' }}>
          <i className={`fa-solid ${agent.iconClass}`} />
        </div>
        <div className="flex-1 min-w-0 pr-12">
          <h3 className="text-[18px] font-bold tracking-tight">{agent.name}</h3>
          <p className="text-[11.5px] text-text-muted">{agent.taglineRow}</p>
        </div>
      </div>

      <p className="text-[13px] text-text-secondary leading-relaxed">{agent.description}</p>

      {/* Workflow callout */}
      <div className="rounded-xl p-3 px-3.5" style={{ background: 'linear-gradient(135deg,rgba(107,70,193,.04),rgba(12,92,244,.02))', border: '1px solid rgba(107,70,193,.1)' }}>
        <div className="text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5" style={{ color: '#6B46C1' }}>
          <i className="fa-solid fa-bolt text-[9px]" />What they'd do
        </div>
        <p className="text-[12px] text-text-secondary leading-relaxed italic">{agent.workflow}</p>
      </div>

      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Comes with · {agent.defaultSkills.length} Skills</div>
        <div className="flex flex-wrap gap-1.5">
          {agent.defaultSkills.map((s) => (
            <span key={s.label} className="skill-chip"><i className={s.icon} style={{ color: s.iconColor }} />{s.label}</span>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1">Works in</div>
        <div className="flex flex-wrap gap-1">
          {agent.surfaces.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium" style={{ color: '#6B46C1', background: 'rgba(107,70,193,.06)', border: '1px solid rgba(107,70,193,.12)' }}>
              <i className={`fa-solid ${s.icon} text-[9px]`} />{s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-auto">
        {agent.footnote}
        {agent.hired ? (
          agent.detailHref ? (
            <Link to={agent.detailHref} className="btn-outline" style={{ paddingTop: 6, paddingBottom: 6 }}>
              <i className="fa-solid fa-arrow-right text-[9px]" />Manage
            </Link>
          ) : (
            <button className="btn-outline" style={{ paddingTop: 6, paddingBottom: 6 }}>
              <i className="fa-solid fa-arrow-right text-[9px]" />Manage
            </button>
          )
        ) : (
          <button className="btn-solid" style={{ paddingTop: 6, paddingBottom: 6 }}>
            <i className="fa-solid fa-user-plus text-[9px]" />Hire {agent.name}
          </button>
        )}
      </div>
    </div>
  );
}
