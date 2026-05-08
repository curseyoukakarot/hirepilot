/**
 * v2 / Agent Detail — generic page for every specialist except Sourcer.
 *
 * Sourcer has its own dedicated route (`/v2/agents/sourcer` → AgentSourcer.tsx)
 * because it owns a live Browserbase session. All other roles share this
 * generic detail page that renders from a small role-meta map below.
 *
 * Route: `/v2/agents/:role` — :role ∈
 *   recruiter | coordinator | researcher | business_dev | closer |
 *   account_manager | reference_checker
 *
 * Reads the workspace's hired agent record (if any) via useAgents(), so
 * trust level, paused state, and skill list reflect reality.
 *
 * If the role hasn't been hired yet, we render a "Hire" CTA inline rather
 * than 404'ing — that way visitors clicking from /v2/team or /v2/hire
 * always land somewhere meaningful.
 */

import React, { useState } from 'react';
import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import WorkspaceShell from '../components/WorkspaceShell';
import V2Dropdown from '../components/V2Dropdown';
import V2Modal, { ModalCancel, ModalPrimary } from '../components/V2Modal';
import V2ConfirmDialog from '../components/V2ConfirmDialog';
import { toastSoon, toastSuccess } from '../components/V2Toast';
import { useAgents, findAgentByRole } from '../hooks/useAgents';
import { useGoals } from '../hooks/useGoals';
import { useActivity } from '../hooks/useActivity';
import { useV2Theme } from '../hooks/useV2Theme';
import type { TrustLevel, AgentRole } from '../types';

/* ------------------------------------------------------------------
 * Role meta — keep in sync with HireCatalog.tsx's AGENTS table.
 * ------------------------------------------------------------------ */
interface RoleMeta {
  role: AgentRole;
  name: string;
  tagline: string;
  description: string;
  iconClass: string;          // FA icon (no `fa-` prefix)
  gradClass: string;          // tailwind grad class from v2.css
  shadow: string;             // box-shadow rgba
  accent: string;             // hex for ring/text accents
  defaultSkills: { icon: string; label: string; iconColor: string }[];
  surfaces: { icon: string; label: string; href?: string }[];
}

const ROLE_META: Record<string, RoleMeta> = {
  recruiter: {
    role: 'recruiter',
    name: 'Recruiter',
    tagline: 'Engagement · drafts · screens · submittals',
    description:
      'Owns everything between "lead found" and "interview booked" — drafts personalized outreach, handles replies, screens candidates, writes the submittal you\'d send to a hiring manager.',
    iconClass: 'fa-user-tie',
    gradClass: 'grad-recruiter',
    shadow: 'rgba(16,185,129,.4)',
    accent: '#10B981',
    defaultSkills: [
      { icon: 'fa-paper-plane', iconColor: '#10B981', label: 'Outreach Writer' },
      { icon: 'fa-comments', iconColor: '#14B8A6', label: 'Reply Handler' },
      { icon: 'fa-file-lines', iconColor: '#10B981', label: 'Submittal Drafter' },
      { icon: 'fa-table-columns', iconColor: '#059669', label: 'Pipeline Manager' },
    ],
    surfaces: [
      { icon: 'fa-envelope', label: 'Inbox', href: '/v2/inbox' },
      { icon: 'fa-paper-plane', label: 'Campaigns', href: '/v2/campaigns' },
      { icon: 'fa-table-columns', label: 'Pipelines', href: '/v2/pipelines' },
    ],
  },
  coordinator: {
    role: 'coordinator',
    name: 'Coordinator',
    tagline: 'Logistics · scheduling · reminders',
    description:
      'The most overlooked role in agencies — handles all calendar back-and-forth, books interviews, sends reminders, manages reschedules. Recruiters reclaim 6+ hours/week.',
    iconClass: 'fa-calendar-check',
    gradClass: 'grad-coordinator',
    shadow: 'rgba(139,92,246,.4)',
    accent: '#8B5CF6',
    defaultSkills: [
      { icon: 'fa-calendar', iconColor: '#8B5CF6', label: 'Calendar Sync' },
      { icon: 'fa-clock', iconColor: '#A855F7', label: 'Interview Booker' },
      { icon: 'fa-bell', iconColor: '#EC4899', label: 'Reminder Bot' },
      { icon: 'fa-rotate', iconColor: '#8B5CF6', label: 'Reschedule Manager' },
    ],
    surfaces: [
      { icon: 'fa-table-columns', label: 'Pipelines', href: '/v2/pipelines' },
      { icon: 'fa-envelope', label: 'Inbox', href: '/v2/inbox' },
    ],
  },
  researcher: {
    role: 'researcher',
    name: 'Researcher',
    tagline: 'Deep intel · companies · people · comp',
    description:
      "When a quick LinkedIn skim isn't enough. Spins up a full Browserbase session to deep-dive a company, hiring manager, or candidate — reads news, careers pages, funding rounds, team org charts.",
    iconClass: 'fa-magnifying-glass-arrow-right',
    gradClass: 'grad-researcher',
    shadow: 'rgba(124,58,237,.4)',
    accent: '#7C3AED',
    defaultSkills: [
      { icon: 'fa-globe', iconColor: '#7C3AED', label: 'Browser Researcher' },
      { icon: 'fa-building', iconColor: '#4F46E5', label: 'Company Intel' },
      { icon: 'fa-coins', iconColor: '#7C3AED', label: 'Comp Benchmark' },
    ],
    surfaces: [
      { icon: 'fa-database', label: 'Leads', href: '/v2/leads' },
      { icon: 'fa-handshake', label: 'Deals', href: '/v2/deals' },
      { icon: 'fa-rocket', label: 'Goals', href: '/v2/goals' },
    ],
  },
  business_dev: {
    role: 'business_dev',
    name: 'Business Dev',
    tagline: 'Top of funnel · finds new clients',
    description:
      'Finds you new client companies before your pipeline runs dry. Watches funding announcements, job board signals, hiring patterns — flags companies likely to need you.',
    iconClass: 'fa-handshake-angle',
    gradClass: 'grad-bd',
    shadow: 'rgba(245,158,11,.4)',
    accent: '#F59E0B',
    defaultSkills: [
      { icon: 'fa-satellite-dish', iconColor: '#F59E0B', label: 'Hiring Signal Watch' },
      { icon: 'fa-paper-plane', iconColor: '#EA580C', label: 'Cold Outreach' },
      { icon: 'fa-list-ul', iconColor: '#F59E0B', label: 'Job Board Scrape' },
    ],
    surfaces: [
      { icon: 'fa-handshake', label: 'Deals', href: '/v2/deals' },
      { icon: 'fa-paper-plane', label: 'Campaigns', href: '/v2/campaigns' },
    ],
  },
  closer: {
    role: 'closer',
    name: 'Closer',
    tagline: 'Closing · offers · negotiation',
    description:
      'When a candidate is in offer stage, this is the agent that gets it across the line. Drafts offer letters, handles negotiations, predicts counter-offers, drives deals to signed.',
    iconClass: 'fa-trophy',
    gradClass: 'grad-closer',
    shadow: 'rgba(244,63,94,.4)',
    accent: '#F43F5E',
    defaultSkills: [
      { icon: 'fa-file-signature', iconColor: '#F43F5E', label: 'Offer Drafter' },
      { icon: 'fa-comments-dollar', iconColor: '#E11D48', label: 'Negotiation' },
      { icon: 'fa-rotate-left', iconColor: '#F43F5E', label: 'Counter-Handler' },
    ],
    surfaces: [
      { icon: 'fa-table-columns', label: 'Pipelines', href: '/v2/pipelines' },
      { icon: 'fa-handshake', label: 'Deals', href: '/v2/deals' },
    ],
  },
  account_manager: {
    role: 'account_manager',
    name: 'Account Manager',
    tagline: 'Client retention · status reports · renewals',
    description:
      "Keeps your existing clients warm so they keep retaining you. Sends weekly status updates, flags when pipeline health dips, nudges on renewals. The reason your clients say \"you're easy to work with.\"",
    iconClass: 'fa-building-user',
    gradClass: 'grad-account',
    shadow: 'rgba(14,165,233,.4)',
    accent: '#0EA5E9',
    defaultSkills: [
      { icon: 'fa-file-lines', iconColor: '#0EA5E9', label: 'Weekly Reports' },
      { icon: 'fa-arrow-trend-up', iconColor: '#0D9488', label: 'Pipeline Updater' },
      { icon: 'fa-bell', iconColor: '#0EA5E9', label: 'Renewal Nudge' },
    ],
    surfaces: [
      { icon: 'fa-handshake', label: 'Deals', href: '/v2/deals' },
      { icon: 'fa-chart-line', label: 'Reports', href: '/v2/reports' },
    ],
  },
  reference_checker: {
    role: 'reference_checker',
    name: 'Reference Checker',
    tagline: 'Late stage · references · back-channels',
    description:
      'Drafts and sends reference request emails, follows up with reviewers who ghost, synthesizes feedback. Also runs back-channel inquiries when needed (people you trust who know the candidate).',
    iconClass: 'fa-shield-check',
    gradClass: 'grad-refcheck',
    shadow: 'rgba(71,85,105,.4)',
    accent: '#475569',
    defaultSkills: [
      { icon: 'fa-envelope', iconColor: '#475569', label: 'Reference Outreach' },
      { icon: 'fa-comment-dots', iconColor: '#1E40AF', label: 'Back-Channel' },
      { icon: 'fa-list-check', iconColor: '#475569', label: 'Synthesis' },
    ],
    surfaces: [
      { icon: 'fa-table-columns', label: 'Pipelines', href: '/v2/pipelines' },
      { icon: 'fa-envelope', label: 'Inbox', href: '/v2/inbox' },
    ],
  },
};

/* Trust label helper. */
function trustLabel(t: TrustLevel) {
  return t === 'autopilot' ? 'Autopilot' : t === 'suggest' ? 'Suggest' : 'Manual';
}

export default function AgentDetailPage() {
  useV2Theme();
  const navigate = useNavigate();
  const { role: roleParam } = useParams<{ role: string }>();

  // Sourcer has its own dedicated page (live Browserbase session) — bounce there.
  if (roleParam === 'sourcer') return <Navigate to="/v2/agents/sourcer" replace />;

  // Unknown role → bounce to Team. Better than 404.
  const meta = roleParam ? ROLE_META[roleParam] : undefined;
  if (!meta) return <Navigate to="/v2/team" replace />;

  const { agents, hire, update } = useAgents();
  const agent = findAgentByRole(agents, meta.role);
  const isHired = !!agent;
  const trust: TrustLevel = (agent?.trust_level as TrustLevel) || 'autopilot';
  const paused = !!agent?.paused;
  const skills = agent?.skills || [];

  const { activity } = useActivity({ agentId: agent?.id, limit: 20 });

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);

  const { create: createGoal } = useGoals();

  const setTrust = (next: TrustLevel) => {
    if (!agent || next === trust) return;
    update.mutate(
      { id: agent.id, trust_level: next },
      { onSuccess: () => toastSuccess(`${meta.name} set to ${trustLabel(next)}`) },
    );
  };

  const togglePaused = () => {
    if (!agent) return;
    const next = !paused;
    update.mutate(
      { id: agent.id, paused: next },
      { onSuccess: () => toastSuccess(next ? `${meta.name} paused` : `${meta.name} resumed`) },
    );
  };

  const submitGoal = () => {
    const title = goalDraft.trim();
    if (!title) return;
    createGoal.mutate(
      { title, prompt: title },
      {
        onSuccess: () => {
          setGoalModalOpen(false);
          setGoalDraft('');
          toastSuccess('Goal created — REX is planning it.');
          setTimeout(() => navigate('/v2/goals'), 600);
        },
      },
    );
  };

  const onHire = () => {
    if (hire.isPending) return;
    hire.mutate({ role: meta.role });
  };

  return (
    <WorkspaceShell autopilot>
      {/* Topbar with breadcrumb */}
      <header className="border-b border-gray-100 px-8 h-14 glass flex items-center gap-4 sticky top-0 z-30">
        <Link to="/v2/team" className="ghost-btn">
          <i className="fa-solid fa-arrow-left text-[10px]" />Team
        </Link>
        <div className="text-text-muted text-xs">/</div>
        <div className="font-semibold text-[14.5px] flex items-center gap-2">
          <i className={`fa-solid ${meta.iconClass} text-xs`} style={{ color: meta.accent }} />
          {meta.name}
        </div>
        {isHired && (
          <div className="status-pill ml-3">
            <span className="ping-wrap" style={{ background: meta.accent } as React.CSSProperties} />
            <i className={`fa-solid ${meta.iconClass} text-[10px]`} style={{ color: meta.accent }} />
            <span>{paused ? 'Paused' : 'Working'}</span>
            <span className="text-text-muted">·</span>
            <span className="font-bold" style={{ color: meta.accent }}>
              {paused ? 'idle' : 'live'}
            </span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2.5">
          {isHired && (
            <V2Dropdown
              align="right"
              minWidth={260}
              trigger={
                <span className="trust-badge cursor-pointer">
                  <i
                    className={`fa-solid fa-${
                      trust === 'autopilot' ? 'rocket' : trust === 'suggest' ? 'wand-magic-sparkles' : 'hand'
                    } text-[10px]`}
                  />
                  {trustLabel(trust)}
                  <i className="fa-solid fa-chevron-down text-[9px] opacity-80" />
                </span>
              }
              items={[
                { key: 'hdr', header: true, label: `${meta.name} trust` },
                { key: 'auto', icon: 'rocket', label: 'Autopilot — auto-execute above threshold', selected: trust === 'autopilot', onClick: () => setTrust('autopilot') },
                { key: 'sug', icon: 'wand-magic-sparkles', label: 'Suggest — review every action', selected: trust === 'suggest', onClick: () => setTrust('suggest') },
                { key: 'man', icon: 'hand', label: `Manual — ${meta.name} waits for you`, selected: trust === 'manual', onClick: () => setTrust('manual') },
              ]}
            />
          )}
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 ring-2 ring-white" />
        </div>
      </header>

      <div className="px-8 py-7 space-y-7 max-w-[1400px] mx-auto">
        {/* Agent hero */}
        <section
          className="float-in d-1 shimmer-top relative"
          style={{
            background: `linear-gradient(135deg, ${meta.accent}0F, ${meta.accent}07 50%, transparent)`,
            border: `1px solid ${meta.accent}26`,
            borderRadius: '24px',
            padding: '24px',
          }}
        >
          <div className="flex items-start gap-5 flex-wrap">
            <div
              className={`agent-avatar w-20 h-20 rounded-full ${meta.gradClass} flex items-center justify-center text-white shrink-0 shadow-2xl`}
              style={{ boxShadow: `0 16px 40px -10px ${meta.shadow}` }}
            >
              <i className={`fa-solid ${meta.iconClass} text-[26px]`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-[26px] font-extrabold tracking-tight">{meta.name}</h1>
                <span className="tag" style={{ background: `${meta.accent}1A`, color: meta.accent }}>
                  <i className="fa-solid fa-bolt text-[8px]" />Specialist
                </span>
                {isHired ? (
                  <span className="tag tag-success">
                    <span className="live-dot" />
                    {paused ? 'Paused' : 'Working'}
                  </span>
                ) : (
                  <span className="tag tag-muted">Not hired yet</span>
                )}
              </div>
              <p className="text-text-secondary text-[14px] mb-3 max-w-2xl">{meta.description}</p>

              {/* Surfaces — where this agent operates. */}
              <div className="flex items-center gap-2 flex-wrap text-[12.5px]">
                <span className="text-text-muted">Active in:</span>
                {meta.surfaces.map((s) =>
                  s.href ? (
                    <Link
                      key={s.label}
                      to={s.href}
                      className="ghost-btn !py-1 !px-2 !text-[11.5px]"
                    >
                      <i className={`fa-solid ${s.icon} text-[10px]`} />
                      {s.label}
                    </Link>
                  ) : (
                    <span key={s.label} className="ghost-btn !py-1 !px-2 !text-[11.5px] cursor-default">
                      <i className={`fa-solid ${s.icon} text-[10px]`} />
                      {s.label}
                    </span>
                  ),
                )}
              </div>
            </div>

            {/* Action column */}
            <div className="flex flex-col gap-2 shrink-0 min-w-[200px]">
              {isHired ? (
                <>
                  <button
                    onClick={() => setGoalModalOpen(true)}
                    className="btn-solid w-full justify-center"
                  >
                    <i className="fa-solid fa-rocket text-[10px]" />Give {meta.name} a goal
                  </button>
                  <button
                    onClick={() => setPauseConfirmOpen(true)}
                    className="btn-outline w-full justify-center"
                  >
                    <i className={`fa-solid fa-${paused ? 'play' : 'pause'} text-[10px]`} />
                    {paused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={() => navigate('/v2/settings/team')}
                    className="ghost-btn w-full justify-center"
                  >
                    <i className="fa-solid fa-gear text-[10px]" />Configure
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onHire}
                    disabled={hire.isPending}
                    className="btn-solid w-full justify-center"
                  >
                    <i className={`fa-solid fa-${hire.isPending ? 'spinner fa-spin' : 'plus'} text-[10px]`} />
                    {hire.isPending ? 'Hiring…' : `Hire ${meta.name}`}
                  </button>
                  <Link to="/v2/hire" className="btn-outline w-full justify-center">
                    <i className="fa-solid fa-arrow-left text-[10px]" />Back to catalog
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Skills section */}
        <section className="float-in d-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-bold tracking-tight flex items-center gap-2">
              <i className="fa-solid fa-bolt text-warn text-[12px]" />
              Skills
              <span className="text-[11px] text-text-muted font-normal">
                {isHired ? `${skills.length} installed` : `${meta.defaultSkills.length} default`}
              </span>
            </h2>
            {isHired && (
              <button onClick={() => navigate('/v2/hire')} className="btn-outline">
                <i className="fa-solid fa-plus text-[10px]" />Add Skill
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(isHired
              ? skills.map((s, i) => ({
                  icon: 'fa-bolt',
                  iconColor: meta.accent,
                  label: s.skill_id,
                  installed: true,
                  key: `installed-${i}`,
                }))
              : meta.defaultSkills.map((s, i) => ({
                  icon: s.icon.replace('fa-solid ', '').replace('fa-brands ', ''),
                  iconColor: s.iconColor,
                  label: s.label,
                  installed: false,
                  key: `default-${i}`,
                }))
            ).map((s) => (
              <div
                key={s.key}
                className="bg-white rounded-xl p-3.5 flex items-center gap-3"
                style={{ border: '1px solid #ECECEC' }}
              >
                <div
                  className="w-9 h-9 rounded-md flex items-center justify-center text-white shrink-0"
                  style={{ background: s.iconColor }}
                >
                  <i className={`fa-solid ${s.icon} text-[12px]`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] truncate">{s.label}</div>
                  <div className="text-[10.5px] text-text-muted">
                    {s.installed ? 'Installed' : 'Default skill'}
                  </div>
                </div>
                {s.installed ? (
                  <i className="fa-solid fa-circle-check text-success text-[12px]" />
                ) : (
                  <i className="fa-solid fa-circle text-text-muted/30 text-[10px]" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Recent activity */}
        {isHired && (
          <section className="float-in d-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[16px] font-bold tracking-tight flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-text-muted text-[12px]" />
                Recent runs
                <span className="text-[11px] text-text-muted font-normal">{activity.length}</span>
              </h2>
              <Link to="/v2/today" className="ghost-btn">
                View all <i className="fa-solid fa-arrow-right text-[10px]" />
              </Link>
            </div>

            {activity.length === 0 ? (
              <div
                className="bg-white rounded-xl p-6 text-center text-[13px] text-text-muted"
                style={{ border: '1px solid #ECECEC' }}
              >
                <i className={`fa-solid ${meta.iconClass} text-[24px] mb-2 opacity-50`} style={{ color: meta.accent }} />
                <div className="font-medium text-text-main mb-1">No runs yet</div>
                <div className="text-[12px]">Give {meta.name} a goal and runs will show up here.</div>
              </div>
            ) : (
              <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #ECECEC' }}>
                <ul className="divide-y divide-gray-100">
                  {activity.slice(0, 10).map((a) => (
                    <li key={a.id} className="p-3.5 flex items-start gap-3 text-[13px]">
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0 mt-0.5"
                        style={{ background: meta.accent }}
                      >
                        <i className={`fa-solid ${meta.iconClass} text-[10px]`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{a.summary || a.event_type}</div>
                        <div className="text-[11px] text-text-muted mt-0.5">
                          {new Date(a.created_at).toLocaleString()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Guardrails footer */}
        {isHired && (
          <section className="float-in d-4">
            <div
              className="rounded-xl p-4 flex items-center gap-3"
              style={{
                background: 'linear-gradient(90deg, rgba(107,70,193,.05), rgba(12,92,244,.03))',
                border: '1px solid rgba(107,70,193,.12)',
              }}
            >
              <div className="w-8 h-8 rounded-md grad-icon flex items-center justify-center text-white">
                <i className="fa-solid fa-shield-halved text-[12px]" />
              </div>
              <div className="flex-1 text-[12.5px]">
                <span className="font-semibold">Guardrails active.</span>
                <span className="text-text-secondary ml-1">
                  {meta.name} respects spend caps, daily limits, and your trust ladder.
                </span>
              </div>
              <button onClick={() => navigate('/v2/settings/team')} className="btn-outline">
                <i className="fa-solid fa-pen text-[10px]" />Edit
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Give goal modal */}
      <V2Modal
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        title={`Give ${meta.name} a goal`}
        subtitle={`Describe what you want — REX will plan ${meta.name}'s steps.`}
        footer={
          <>
            <ModalCancel onClick={() => setGoalModalOpen(false)} />
            <ModalPrimary
              onClick={submitGoal}
              disabled={!goalDraft.trim() || createGoal.isPending}
              label={createGoal.isPending ? 'Planning…' : 'Plan goal'}
            />
          </>
        }
      >
        <textarea
          value={goalDraft}
          onChange={(e) => setGoalDraft(e.target.value)}
          autoFocus
          rows={4}
          placeholder={`e.g. "Source 50 senior backend engineers at Series B startups"`}
          className="w-full bg-surface border border-gray-200 rounded-lg px-3 py-2 text-[13.5px] focus:outline-none focus:border-primary"
        />
      </V2Modal>

      {/* Pause / resume confirm */}
      <V2ConfirmDialog
        open={pauseConfirmOpen}
        onClose={() => setPauseConfirmOpen(false)}
        title={paused ? `Resume ${meta.name}?` : `Pause ${meta.name}?`}
        message={
          paused
            ? `${meta.name} will start running scheduled work again.`
            : `${meta.name} will stop until you resume. Anything in flight will finish, but no new actions will start.`
        }
        confirmLabel={paused ? 'Resume' : 'Pause'}
        onConfirm={() => {
          togglePaused();
          setPauseConfirmOpen(false);
        }}
      />
    </WorkspaceShell>
  );
}
