/**
 * v2 / Agent Detail — Sourcer
 *
 * HTML preserved EXACTLY from mockups/agent-sourcer.html main content block.
 *
 * TODO wire to backend:
 *   - GET /api/v2/agents/:id (here: by role='sourcer')
 *   - Live Browserbase session embed → reuse services/sniperV1/linkedinAutomation
 *   - Skills list joined to skills_catalog
 *   - Schedule entries from agent_skills.schedule_cron
 *   - Recent runs from rex_activity_log filtered by agent_id
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import WorkspaceShell from '../components/WorkspaceShell';
import WorkspaceTopbar from '../components/WorkspaceTopbar';
import V2Dropdown from '../components/V2Dropdown';
import V2Modal, { ModalCancel, ModalPrimary } from '../components/V2Modal';
import V2ConfirmDialog from '../components/V2ConfirmDialog';
import { toastSoon, toastSuccess, toastInfo } from '../components/V2Toast';
import { useAgents, findAgentByRole } from '../hooks/useAgents';
import { useGoals } from '../hooks/useGoals';
import type { TrustLevel } from '../types';

const sourcerStatusPill = (
  <div className="status-pill ml-3">
    <span className="ping-wrap" style={{ background: '#06B6D4' } as React.CSSProperties} />
    <i className="fa-solid fa-globe text-sourcer text-[10px]" />
    <span>Browserbase session · <span className="font-semibold text-text-main tabular-nums">2m 14s</span></span>
    <span className="text-text-muted">·</span>
    <span className="text-sourcer font-bold">live</span>
  </div>
);

export default function AgentSourcerPage() {
  const navigate = useNavigate();
  const { agents, update } = useAgents();
  const sourcer = findAgentByRole(agents, 'sourcer');
  const trust: TrustLevel = (sourcer?.trust_level as TrustLevel) || 'autopilot';
  const paused = !!sourcer?.paused;

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);

  const { create: createGoal } = useGoals();

  const setTrust = (next: TrustLevel) => {
    if (!sourcer || next === trust) return;
    update.mutate({ id: sourcer.id, trust_level: next }, {
      onSuccess: () => toastSuccess(`Sourcer set to ${next === 'autopilot' ? 'Autopilot' : next === 'suggest' ? 'Suggest' : 'Manual'}`),
    });
  };
  const togglePaused = () => {
    if (!sourcer) return;
    const next = !paused;
    update.mutate({ id: sourcer.id, paused: next }, {
      onSuccess: () => toastSuccess(next ? 'Sourcer paused' : 'Sourcer resumed'),
    });
  };
  const submitGoal = () => {
    const title = goalDraft.trim();
    if (!title) return;
    createGoal.mutate({ title, prompt: title }, {
      onSuccess: () => {
        setGoalModalOpen(false);
        setGoalDraft('');
        toastSuccess('Goal created — REX is planning it.');
        setTimeout(() => navigate('/v2/goals'), 600);
      },
    });
  };

  return (
    <WorkspaceShell autopilot>
      {/* Custom topbar with breadcrumb */}
      <header className="border-b border-gray-100 px-8 h-14 glass flex items-center gap-4 sticky top-0 z-30">
        <Link to="/v2/team" className="ghost-btn"><i className="fa-solid fa-arrow-left text-[10px]" />Team</Link>
        <div className="text-text-muted text-xs">/</div>
        <div className="font-semibold text-[14.5px] flex items-center gap-2">
          <i className="fa-solid fa-crosshairs text-sourcer text-xs" />Sourcer
        </div>
        {sourcerStatusPill}
        <div className="ml-auto flex items-center gap-2.5">
          <V2Dropdown
            align="right"
            minWidth={260}
            trigger={
              <span className="trust-badge cursor-pointer">
                <i className={`fa-solid fa-${trust === 'autopilot' ? 'rocket' : trust === 'suggest' ? 'wand-magic-sparkles' : 'hand'} text-[10px]`} />
                {trust === 'autopilot' ? 'Autopilot' : trust === 'suggest' ? 'Suggest' : 'Manual'}
                <i className="fa-solid fa-chevron-down text-[9px] opacity-80" />
              </span>
            }
            items={[
              { key: 'hdr', header: true, label: 'Sourcer trust' },
              { key: 'auto', icon: 'rocket', label: 'Autopilot — auto-execute above threshold', selected: trust === 'autopilot', onClick: () => setTrust('autopilot') },
              { key: 'sug',  icon: 'wand-magic-sparkles', label: 'Suggest — review every action', selected: trust === 'suggest', onClick: () => setTrust('suggest') },
              { key: 'man',  icon: 'hand', label: 'Manual — Sourcer waits for you', selected: trust === 'manual', onClick: () => setTrust('manual') },
            ]}
          />
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 ring-2 ring-white" />
        </div>
      </header>

      <div className="px-8 py-7 space-y-7 max-w-[1400px] mx-auto">

        {/* Agent hero */}
        <section className="float-in d-1 shimmer-top relative" style={{
          background: 'linear-gradient(135deg,rgba(6,182,212,.04),rgba(12,92,244,.03) 50%,transparent)',
          border: '1px solid rgba(6,182,212,.15)',
          borderRadius: '24px',
          padding: '24px',
        }}>
          <div className="flex items-start gap-5 flex-wrap">
            <div className="agent-avatar w-20 h-20 rounded-full grad-sourcer flex items-center justify-center text-white shrink-0 shadow-2xl" style={{ boxShadow: '0 16px 40px -10px rgba(6,182,212,.45)' }}>
              <i className="fa-solid fa-crosshairs text-[26px]" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-[26px] font-extrabold tracking-tight">Sourcer</h1>
                <span className="tag tag-sourcer"><i className="fa-solid fa-bolt text-[8px]" />Specialist</span>
                <span className="tag tag-success"><span className="live-dot cyan" />Working</span>
                <span className="text-[11px] text-text-muted">· hired 14 days ago</span>
              </div>
              <p className="text-text-secondary text-[14px] mb-3 max-w-2xl">Finds and qualifies new leads. Owns the funnel before outreach — runs LinkedIn, Apollo, ICP, and Browserbase research on your behalf.</p>

              <div className="flex items-center gap-5 flex-wrap text-[12.5px]">
                <div><span className="font-bold text-text-main tabular-nums">247</span> <span className="text-text-muted">sourced this week</span></div>
                <div className="w-px h-3 bg-gray-300" />
                <div><span className="font-bold text-warn tabular-nums">12</span> <span className="text-text-muted">hot</span></div>
                <div className="w-px h-3 bg-gray-300" />
                <div><span className="font-bold text-success tabular-nums">14.2%</span> <span className="text-text-muted">avg reply rate on Sourcer leads</span></div>
                <div className="w-px h-3 bg-gray-300" />
                <div><span className="font-bold text-success tabular-nums">+38%</span> <span className="text-text-muted">vs your historical avg</span></div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="trust-mini">
                <span className={`trust-mini-seg cursor-pointer${trust === 'manual' ? ' active' : ''}`} onClick={() => setTrust('manual')}>Manual</span>
                <span className={`trust-mini-seg cursor-pointer${trust === 'suggest' ? ' active suggest' : ''}`} onClick={() => setTrust('suggest')}>Suggest</span>
                <span className={`trust-mini-seg cursor-pointer${trust === 'autopilot' ? ' active' : ''}`} onClick={() => setTrust('autopilot')}>Autopilot</span>
              </div>
              <button
                onClick={() => setGoalModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#06B6D4,#3B82F6)', boxShadow: '0 6px 14px -4px rgba(6,182,212,.35)' }}
              >
                <i className="fa-solid fa-bolt text-[10px]" />Give Sourcer a goal
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => setPauseConfirmOpen(true)} className="ghost-btn">
                  <i className={`fa-solid fa-${paused ? 'play' : 'pause'} text-[10px]`} />
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <button onClick={() => navigate('/v2/settings/team')} className="ghost-btn">
                  <i className="fa-solid fa-sliders text-[10px]" />Configure
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Live Browserbase session — header */}
        <section>
          <div className="float-in d-2 flex items-end justify-between mb-3 flex-wrap gap-2">
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.15em] mb-1" style={{ background: 'linear-gradient(135deg,#06B6D4,#3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                <i className="fa-solid fa-globe text-[9px] mr-1" />Skill running
              </div>
              <h2 className="text-[18px] font-bold tracking-tight">Browser Researcher · researching <span style={{ background: 'linear-gradient(135deg,#06B6D4,#3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>stripe.com</span></h2>
              <p className="text-text-muted text-[12px] mt-0.5">Goal: Build company intel for Q2 Senior Engineers ICP fingerprint · started 2m 14s ago</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => toastSoon('Live session viewer')} className="ghost-btn"><i className="fa-solid fa-expand text-[10px]" />Open session</button>
              <button onClick={() => toastSoon('Pause running session')} className="ghost-btn"><i className="fa-solid fa-pause text-[10px]" />Pause</button>
              <button onClick={() => toastSoon('Stop session')} className="ghost-btn"><i className="fa-solid fa-stop text-[10px]" />Stop</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Browser frame */}
            <div className="lg:col-span-2 float-in d-3" style={{ background: '#1F2937', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 20px 50px -12px rgba(0,0,0,.25), 0 0 0 1px rgba(0,0,0,.05)' }}>
              {/* Chrome */}
              <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: '#374151' }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-[11px] h-[11px] rounded-full bg-red-400" />
                  <span className="w-[11px] h-[11px] rounded-full bg-yellow-400" />
                  <span className="w-[11px] h-[11px] rounded-full bg-green-400" />
                </div>
                <div className="flex-1 rounded-md px-3 py-1 flex items-center gap-1.5 font-mono text-[11.5px]" style={{ background: '#1F2937', color: '#9CA3AF' }}>
                  <i className="fa-solid fa-lock text-[9px]" style={{ color: '#10B981' }} />https://stripe.com/jobs/teams/engineering
                </div>
                <span className="text-[10.5px] font-mono whitespace-nowrap" style={{ color: '#9CA3AF' }}>via Browserbase</span>
                <i className="fa-solid fa-rotate text-[10px]" style={{ color: '#9CA3AF' }} />
              </div>

              {/* Body — simulated stripe.com */}
              <div className="bg-white relative px-7 py-5" style={{ minHeight: '280px', color: '#1A1A2E' }}>
                {/* Annotation 1 */}
                <div className="absolute" style={{ top: '14px', right: '24px', background: 'rgba(15,15,26,.95)', color: 'white', fontSize: '10.5px', fontWeight: 600, padding: '5px 9px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 8px 20px -6px rgba(6,182,212,.5)', zIndex: 10 }}>
                  <i className="fa-solid fa-circle-check" style={{ color: '#06B6D4', fontSize: '9px' }} />Page loaded · 1.2s
                </div>

                <div className="flex items-center gap-2 mb-5">
                  <span className="font-bold text-[20px]" style={{ color: '#635BFF' }}>stripe</span>
                  <span className="text-[11px] text-gray-400">/ Jobs / Engineering</span>
                </div>

                <h3 className="text-[22px] font-bold tracking-tight mb-1.5">Engineering at Stripe</h3>
                <p className="text-[13px] text-gray-600 mb-4">We build the financial infrastructure that powers the internet. Engineers at Stripe work across payments, banking, and developer tools.</p>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Engineering org', value: '~800' },
                    { label: 'Funding', value: 'Series H · $1B' },
                    { label: 'Total', value: '7,500' },
                  ].map((s, i) => (
                    <div key={s.label} className="bg-gray-50 rounded-md p-2 text-center" style={{ position: 'relative', outline: '2px solid rgba(6,182,212,.5)', outlineOffset: '2px', borderRadius: '4px', animation: `highlight-pulse 2s ease-in-out infinite ${i * 0.3}s` }}>
                      <div className="text-[10px] text-gray-500 uppercase">{s.label}</div>
                      <div className="text-[17px] font-bold">{s.value}</div>
                    </div>
                  ))}
                </div>

                <h4 className="text-[14px] font-bold mb-2">Open engineering roles · 47</h4>
                <div className="space-y-1.5">
                  <div className="bg-gray-50 rounded-md p-2.5 flex items-center justify-between text-[12px]" style={{ outline: '2px solid rgba(6,182,212,.5)', outlineOffset: '2px' }}>
                    <span><strong>Senior Backend Engineer</strong> — Payments Infra</span>
                    <span className="text-gray-500">Remote · NYC · SF</span>
                  </div>
                  <div className="bg-gray-50 rounded-md p-2.5 flex items-center justify-between text-[12px]">
                    <span><strong>Staff Engineer</strong> — Atlas</span>
                    <span className="text-gray-500">Remote</span>
                  </div>
                  <div className="bg-gray-50 rounded-md p-2.5 flex items-center justify-between text-[12px]">
                    <span><strong>ML Engineer</strong> — Risk</span>
                    <span className="text-gray-500">SF</span>
                  </div>
                  <div className="text-[11px] text-gray-400 italic pl-2.5">+ 44 more open roles…</div>
                </div>
              </div>

              {/* Console */}
              <div className="p-4 font-mono text-[11px] leading-[1.7]" style={{ background: '#0F0F1A', color: '#C4B5FD', borderRadius: 0 }}>
                {[
                  ['14:32:18', 'ok', '✓ Started Browserbase session ', 'bs_a8f3...'],
                  ['14:32:19', 'ok', '✓ Navigated to ', 'stripe.com/jobs/teams/engineering'],
                  ['14:32:21', 'ok', '✓ Page loaded · 1.2s · 134 elements'],
                  ['14:32:24', 'ok', '✓ Extracted company size · funding stage · eng org count'],
                  ['14:32:31', 'ok', '✓ Found 47 open engineering roles'],
                  ['14:32:38', 'ok', '✓ Reading "Senior Backend Engineer · Payments Infra"'],
                  ['14:32:42', 'info', 'i Tech stack: Go · Rust · Ruby · Python · Postgres'],
                  ['14:32:46', 'ok', '✓ Extracted required years experience: 5+'],
                ].map(([ts, kind, text, info], i) => (
                  <div key={i}>
                    <span style={{ color: '#6B7280' }}>{ts}</span>{' '}
                    <span style={{ color: kind === 'ok' ? '#34D399' : '#60A5FA' }}>{text}</span>
                    {info && <span style={{ color: '#60A5FA' }}>{info}</span>}
                  </div>
                ))}
                <div style={{ color: '#A78BFA', marginTop: '6px' }}>
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /> reading job description for ICP fingerprint…
                </div>
              </div>
            </div>

            {/* Live extracted intel panel */}
            <div className="float-in d-4 bg-white rounded-2xl p-5 space-y-4" style={{ border: '1px solid #ECECEC' }}>
              <div className="flex items-center gap-2 mb-2">
                <i className="fa-solid fa-database text-sourcer text-sm" />
                <h3 className="text-[14px] font-bold">Company intel · live</h3>
                <span className="ml-auto text-[10px] text-success font-bold uppercase tracking-wider flex items-center gap-1"><span className="live-dot cyan" />filling</span>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1">Company</div>
                <div className="font-bold text-[14px]">Stripe</div>
                <div className="text-[11.5px] text-text-muted">Series H · $1B raised · 7,500 employees</div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Engineering org</div>
                <div className="text-[12.5px] space-y-1">
                  <div className="flex justify-between"><span className="text-text-secondary">Total engineers</span><span className="font-semibold">~800</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Open eng roles</span><span className="font-semibold text-warn">47</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">YoY headcount</span><span className="font-semibold text-success">+23%</span></div>
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Tech stack</div>
                <div className="flex flex-wrap gap-1">
                  {['Go', 'Rust', 'Ruby', 'Python', 'Postgres'].map((t) => (
                    <span key={t} className="tag tag-sourcer">{t}</span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1.5">ICP fingerprint <span className="text-[9px] font-medium text-text-muted normal-case tracking-normal">· building…</span></div>
                <ul className="text-[12px] text-text-secondary space-y-1">
                  {['5+ years senior backend', 'Payments / fintech infra', 'Go or Rust primary', 'Distributed systems'].map((f) => (
                    <li key={f} className="flex items-start gap-1.5"><i className="fa-solid fa-check text-success text-[9px] mt-1" /><span>{f}</span></li>
                  ))}
                  <li className="flex items-start gap-1.5 text-text-muted"><span className="typing-dot" /><span className="ml-1">Compensation band…</span></li>
                </ul>
              </div>

              <button
                onClick={() => {
                  if (!sourcer) return;
                  const fingerprint = {
                    label: 'Q2 Senior Engineers',
                    must_haves: [
                      '5+ years senior backend',
                      'Payments / fintech infra',
                      'Go or Rust primary',
                      'Distributed systems',
                    ],
                    saved_at: new Date().toISOString(),
                  };
                  update.mutate(
                    { id: sourcer.id, config: { ...(sourcer.config || {}), icp_fingerprint: fingerprint } },
                    {
                      onSuccess: () => toastSuccess('ICP fingerprint saved to Sourcer · used for future runs.'),
                    },
                  );
                }}
                disabled={!sourcer || update.isPending}
                className="w-full inline-flex items-center gap-1.5 justify-center px-3.5 py-2 rounded-lg text-[11.5px] font-semibold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#06B6D4,#3B82F6)', boxShadow: '0 6px 14px -4px rgba(6,182,212,.35)' }}
              >
                <i className={`fa-solid ${update.isPending ? 'fa-spinner fa-spin' : 'fa-arrow-right'} text-[9px]`} />
                {update.isPending ? 'Saving…' : 'Use as ICP for Q2 Engineers'}
              </button>
            </div>
          </div>
        </section>

        {/* Skills inventory (compact) */}
        <section>
          <div className="float-in d-5 flex items-end justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-[18px] font-bold tracking-tight">Skills</h2>
              <p className="text-text-muted text-[12px] mt-0.5">4 installed · 4 more available in the catalog.</p>
            </div>
            <button onClick={() => navigate('/v2/hire')} className="btn-outline"><i className="fa-solid fa-plus text-[10px]" />Add Skill</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { running: false, brand: '#0077B5', icon: 'fa-brands fa-linkedin', name: 'LinkedIn Sourcer', desc: 'Scrapes profiles · enriches via Sniper', status: 'Idle', meta: 'Last run · 2h ago · sourced 87 leads' },
              { running: true, gradClass: 'grad-sourcer', icon: 'fa-solid fa-database', name: 'Apollo Enrich', desc: 'Email · phone · firmographics', statusActive: true, meta: 'Enriched 245 of 247 · avg score 84' },
              { running: false, gradClass: 'grad-sourcer', icon: 'fa-solid fa-bullseye', name: 'ICP Researcher', desc: 'Builds ideal-customer profile', status: 'Idle', meta: 'Top 12 responder fingerprint · 1d ago' },
              { running: true, shimmer: true, gradClass: 'grad-sourcer', icon: 'fa-solid fa-globe', name: 'Browser Researcher', desc: 'Browserbase · deep web research', statusActive: 'Live', meta: 'Researching stripe.com · 2m 14s' },
            ].map((s, i) => (
              <div key={s.name} className={`float-in d-${6 + Math.floor(i / 2)} ${s.shimmer ? 'shimmer-top' : ''}`} style={{
                background: s.running ? 'linear-gradient(135deg,rgba(6,182,212,.04),white 30%)' : 'white',
                border: s.running ? '1px solid rgba(6,182,212,.4)' : '1px solid #ECECEC',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}>
                <div className="flex items-start gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] ${s.gradClass || ''}`} style={s.brand ? { background: s.brand } : undefined}>
                    <i className={s.icon} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[13px]">{s.name}</div>
                    <div className="text-[10.5px] text-text-muted">{s.desc}</div>
                  </div>
                  {s.statusActive ? (
                    <span className="tag tag-success"><span className="live-dot cyan" />{typeof s.statusActive === 'string' ? s.statusActive : 'Active'}</span>
                  ) : (
                    <span className="tag tag-muted">{s.status}</span>
                  )}
                </div>
                <div className="text-[11px] text-text-muted">{s.meta}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Schedule + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="float-in d-9 bg-white rounded-2xl p-5" style={{ border: '1px solid #ECECEC' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold tracking-tight">Schedule</h2>
              <button onClick={() => navigate('/v2/team')} className="ghost-btn" title="Manage scheduled Skills on the Team page">
                <i className="fa-solid fa-plus text-[10px]" />Add
              </button>
            </div>
            {[
              { icon: 'fa-clock-rotate-left', title: 'Daily ICP refresh', desc: 'Re-analyzes top responders · 9:00 AM PT every weekday', when: 'Next · tomorrow 9 AM' },
              { icon: 'fa-arrows-rotate', title: 'Weekly LinkedIn sweep', desc: 'Sources matching ICP · Mondays 6 AM PT', when: 'Next · Mon 6 AM' },
              { icon: 'fa-bell', title: 'Apollo daily enrich', desc: 'Enriches new leads on intake · continuous', when: 'Always on', whenCls: 'text-success font-semibold' },
              { icon: 'fa-globe', title: 'On-demand Browser Research', desc: 'Triggered by REX or by you', when: 'Manual' },
            ].map((s, i) => (
              <div key={s.title} className={`flex items-center gap-3 py-2.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                <i className={`fa-solid ${s.icon} text-sourcer text-[11px] w-4`} />
                <div className="flex-1 text-[12.5px]">
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-[11px] text-text-muted">{s.desc}</div>
                </div>
                <span className={`text-[10.5px] text-text-muted ${s.whenCls || ''}`}>{s.when}</span>
              </div>
            ))}
          </section>

          <section className="float-in d-9 bg-white rounded-2xl p-5" style={{ border: '1px solid #ECECEC' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold tracking-tight">Recent runs · 24h</h2>
              <button onClick={() => navigate('/v2/today')} className="ghost-btn">View all →</button>
            </div>
            {[
              { dot: 'bg-sourcer', when: '2m ago', text: <><strong>Browser Researcher</strong> started · stripe.com</>, tag: 'Running', tagCls: 'tag-sourcer' },
              { dot: 'bg-success', when: '14m ago', text: <><strong>Apollo Enrich</strong> · 245 of 247 enriched · avg score 84</>, tag: 'Done', tagCls: 'tag-success' },
              { dot: 'bg-success', when: '38m ago', text: <><strong>LinkedIn Sourcer</strong> · 87 candidates from "Senior Backend Engineer" search</>, tag: 'Done', tagCls: 'tag-success' },
              { dot: 'bg-warn', when: '42m ago', text: <>Caught 2 leads on blocklist · held for review</>, tag: 'Held', tagCls: 'tag-warn' },
              { dot: 'bg-success', when: '1h ago', text: <><strong>ICP Researcher</strong> · top 12 responder fingerprint built</>, tag: 'Done', tagCls: 'tag-success' },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-t border-gray-50 first:border-0">
                <span className={`w-1.5 h-1.5 rounded-full ${r.dot} shrink-0`} style={r.dot === 'bg-sourcer' ? { background: '#06B6D4' } : undefined} />
                <span className="text-[11px] text-text-muted shrink-0 w-14">{r.when}</span>
                <span className="text-[12.5px] flex-1">{r.text}</span>
                <span className={`tag ${r.tagCls}`}>{r.tag}</span>
              </div>
            ))}
          </section>
        </div>

        {/* Guardrails */}
        <section className="float-in d-9 bg-white rounded-2xl p-5" style={{ border: '1px solid #ECECEC' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight">Guardrails</h2>
              <p className="text-[11.5px] text-text-muted mt-0.5">What Sourcer is allowed to do on autopilot. Edit any of these to tighten or loosen.</p>
            </div>
            <button onClick={() => navigate('/v2/settings/team')} className="ghost-btn"><i className="fa-solid fa-pen text-[10px]" />Edit</button>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[12.5px]">
            {[
              { ok: true, text: <><strong>Source up to 500 leads/day</strong> per goal</> },
              { ok: true, text: <><strong>Auto-enrich</strong> any new lead via Apollo + Decodo</> },
              { ok: true, text: <><strong>Browserbase research</strong> up to 30 min per goal</> },
              { ok: true, text: <><strong>Auto-skip blocklist matches</strong> · alert me</> },
              { ok: false, text: <><strong>Always ask before</strong> · sourcing &gt; 1,000 leads in one batch</> },
              { ok: false, text: <><strong>Always ask before</strong> · spending &gt; $50 on enrichment in one run</> },
            ].map((g, i) => (
              <li key={i} className="flex items-start gap-2">
                <i className={`fa-solid ${g.ok ? 'fa-circle-check text-success' : 'fa-circle-exclamation text-warn'} text-[10px] mt-1`} />
                <span>{g.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Give Sourcer a goal modal */}
      <V2Modal
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        title="Give Sourcer a goal"
        subtitle="Plain English. REX will plan it; Sourcer will execute."
        icon="bolt"
        iconGradient="linear-gradient(135deg,#06B6D4,#3B82F6)"
        footer={
          <>
            <ModalCancel onClick={() => setGoalModalOpen(false)} />
            <ModalPrimary
              onClick={submitGoal}
              label="Plan goal"
              icon="arrow-up"
              disabled={!goalDraft.trim()}
              loading={createGoal.isPending}
            />
          </>
        }
      >
        <textarea
          value={goalDraft}
          onChange={(e) => setGoalDraft(e.target.value)}
          rows={4}
          placeholder="e.g. 'Find 50 senior backend engineers in NY at Series B startups, score them, queue the top 30 for outreach.'"
          className="w-full px-3 py-2.5 rounded-lg text-[13.5px] outline-none resize-none focus:border-primary/40"
          style={{ border: '1px solid #E5E7EB' }}
          autoFocus
        />
        <div className="text-[11px] text-text-muted mt-2 flex items-center gap-1.5">
          <i className="fa-solid fa-info-circle text-[10px]" />
          REX drafts a plan first — you approve before any sourcing runs.
        </div>
      </V2Modal>

      <V2ConfirmDialog
        open={pauseConfirmOpen}
        onClose={() => setPauseConfirmOpen(false)}
        onConfirm={() => { togglePaused(); setPauseConfirmOpen(false); }}
        title={paused ? 'Resume Sourcer?' : 'Pause Sourcer?'}
        message={
          paused
            ? 'Sourcer will start picking up scheduled Skill runs again. Active goals will resume execution.'
            : 'Sourcer will stop running scheduled Skills and pause any in-flight goal steps that involve it. You can resume any time.'
        }
        confirmLabel={paused ? 'Resume Sourcer' : 'Pause Sourcer'}
        icon={paused ? 'play' : 'pause'}
        loading={update.isPending}
      />
    </WorkspaceShell>
  );
}
