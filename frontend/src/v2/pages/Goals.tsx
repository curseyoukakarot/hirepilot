/**
 * v2 / Goals — REX-driven outcomes
 *
 * HTML preserved EXACTLY from mockups/goals.html main content block.
 *
 * TODO wire to backend:
 *   - List goals from `goals` table where workspace_id = current
 *   - Filter pills: status IN ('running', 'awaiting_approval', 'completed')
 *   - "Plan goal" button → POST /api/v2/goals { prompt } → REX plans → status='awaiting_approval'
 *   - Approve & run → POST /api/v2/goals/:id/approve
 *   - Live execution console → SSE stream from /api/v2/goals/:id/log
 *   - Agent delegation chips from goal.plan.assigned_agents[]
 */

import React from 'react';
import WorkspaceShell from '../components/WorkspaceShell';
import WorkspaceTopbar, { RexStatusPill } from '../components/WorkspaceTopbar';

// Local helper styles for goal-specific cards
const goalCardStyles: Record<string, React.CSSProperties> = {
  running: {
    background: 'linear-gradient(135deg,rgba(107,70,193,.04),rgba(12,92,244,.02) 50%,white 80%)',
    border: '1px solid rgba(107,70,193,.18)',
  },
  awaiting: {
    background: 'linear-gradient(135deg,rgba(245,158,11,.06),rgba(245,158,11,.01) 50%,white 80%)',
    border: '1px solid rgba(245,158,11,.22)',
    borderLeft: '3px solid #F59E0B',
  },
};

export default function GoalsPage() {
  return (
    <WorkspaceShell autopilot>
      <WorkspaceTopbar
        pageTitle="Goals"
        pageIcon="fa-solid fa-rocket"
        pageIconColor="text-primary"
        pageSubtitle="REX-driven outcomes · 2 running · 1 awaiting"
        statusPill={
          <RexStatusPill text="2 goals running · " highlight="~28m to next milestone" highlightClass="text-text-main font-semibold" />
        }
      />

      <div className="px-8 py-7 space-y-6 max-w-[1100px] mx-auto">

        {/* Hero */}
        <section className="float-in flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] grad-text-rex mb-1.5">
              <i className="fa-solid fa-bullseye text-[10px] mr-1" />Goals
            </div>
            <h1 className="text-[30px] font-extrabold tracking-tight">Outcomes REX is driving for you.</h1>
            <p className="text-text-secondary text-[14px] mt-1.5 max-w-2xl">Tell REX what you want — it plans, delegates to specialists, runs, and reports back. You approve what matters.</p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-[12px] flex items-center gap-3">
              <div><span className="font-bold text-primary tabular-nums">2</span> <span className="text-text-muted">running</span></div>
              <div className="w-px h-3 bg-gray-300" />
              <div><span className="font-bold text-warn tabular-nums">1</span> <span className="text-text-muted">awaiting you</span></div>
              <div className="w-px h-3 bg-gray-300" />
              <div><span className="font-bold text-success tabular-nums">8</span> <span className="text-text-muted">done this week</span></div>
            </div>
          </div>
        </section>

        {/* New goal input */}
        <section
          className="float-in d-1 shimmer-top relative"
          style={{
            background: 'linear-gradient(135deg,rgba(107,70,193,.04),rgba(12,92,244,.02) 50%,white)',
            border: '1px solid rgba(107,70,193,.18)',
            borderRadius: '14px',
            padding: '14px 16px',
          }}
        >
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-8 h-8 rounded-lg grad-rex flex items-center justify-center text-white shrink-0 shadow-md shadow-primary/30">
              <i className="fa-solid fa-wand-magic-sparkles text-[12px]" />
            </div>
            <div>
              <div className="text-[13.5px] font-semibold">Start a new goal</div>
              <div className="text-[10.5px] text-text-muted">REX drafts a plan first — you approve before it runs.</div>
            </div>
          </div>
          <input
            type="text"
            className="w-full bg-white rounded-lg px-3 py-2.5 text-[14px] outline-none border border-gray-200 focus:border-primary/40 transition placeholder:text-text-muted"
            placeholder="e.g. 'Find 50 senior backend engineers in NY at Series B startups, score them, start outreach to top 30'"
          />
          <div className="flex items-center justify-between mt-2.5 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">Templates</span>
              <button className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-gray-200 hover:border-primary/30 text-text-secondary">Source &amp; outreach</button>
              <button className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-gray-200 hover:border-primary/30 text-text-secondary">Scale a campaign</button>
              <button className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-gray-200 hover:border-primary/30 text-text-secondary">Pipeline review</button>
              <button className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-gray-200 hover:border-primary/30 text-text-secondary">Auto-respond</button>
            </div>
            <button className="btn-primary"><i className="fa-solid fa-arrow-up text-[10px]" />Plan goal</button>
          </div>
        </section>

        {/* Filter pills */}
        <div className="float-in d-2 flex items-center gap-1.5 flex-wrap">
          <span className="px-3 py-1 rounded-full bg-primary text-white text-[11.5px] font-semibold">All · 11</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[11.5px] text-text-secondary"><span className="live-dot inline-block mr-1" />Running · 2</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[11.5px] text-text-secondary"><i className="fa-solid fa-circle-question text-warn text-[8px] mr-1" />Awaiting · 1</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[11.5px] text-text-secondary">Done · 8</span>
          <span className="ml-auto text-[11.5px] text-text-muted"><i className="fa-solid fa-arrow-up-wide-short text-[9px] mr-1" />Sort: Recent</span>
        </div>

        {/* RUNNING — full detail */}
        <section className="float-in d-3 shimmer-top flex flex-col gap-4 p-[18px]" style={{ ...goalCardStyles.running, borderRadius: '18px' }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl grad-rex flex items-center justify-center text-white shrink-0 shadow-md shadow-primary/25">
              <i className="fa-solid fa-rocket text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="tag tag-primary"><span className="live-dot" />Running</span>
                <span className="text-[11px] text-text-muted">started 5h 28m ago · ETA ~28m</span>
                <span className="text-[10.5px] text-text-muted ml-auto">Goal · #G-0142</span>
              </div>
              <h2 className="text-[17px] font-bold leading-snug">"Scale Q2 Senior Engineers — find 200 more leads matching the top 12 responders."</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold text-white grad-sourcer"><i className="fa-solid fa-crosshairs text-[8px]" />Sourcer</span>
                <span className="text-text-muted text-[10.5px]">→</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold text-white grad-recruiter"><i className="fa-solid fa-user-tie text-[8px]" />Recruiter</span>
                <span className="text-[10.5px] text-text-muted">· delegated by REX</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button className="ghost-btn"><i className="fa-solid fa-eye text-[10px]" />Watch</button>
              <button className="ghost-btn"><i className="fa-solid fa-pause text-[10px]" />Pause</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plan steps */}
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-2">Plan · 5 steps</div>
              <ol className="relative">
                <div className="absolute left-[8px] top-2 bottom-2 w-px bg-gray-200" />
                {[
                  { n: 1, done: true, title: 'Build ICP fingerprint from top 12 responders', meta: 'REX · 3m 12s' },
                  { n: 2, done: true, title: 'Source 247 candidates via LinkedIn + Apollo', meta: 'Sourcer · 18m 47s · 2 blocklist matches held' },
                  { n: 3, done: true, title: 'Enrich + score (Apollo + Decodo)', meta: 'Sourcer · 12m · 245 enriched · avg score 84' },
                  { n: 4, running: true, title: 'Drafting personalized message variants', meta: 'Recruiter · 102 of 142 · ~28m left' },
                  { n: 5, pending: true, title: 'Send first batch · 50/day rolling', meta: 'Queued · pause on bounce rate > 4%' },
                ].map((s) => (
                  <li key={s.n} className="flex items-start gap-2.5 py-1.5 relative pl-1 text-[12.5px]">
                    <div
                      className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                      style={
                        s.done
                          ? { background: '#10B981', color: 'white' }
                          : s.running
                          ? { background: 'linear-gradient(135deg,#6B46C1,#0C5CF4)', color: 'white' }
                          : { background: '#F4F4F8', color: '#8E8EA0', border: '1px dashed #D1D5DB' }
                      }
                    >
                      {s.done ? <i className="fa-solid fa-check text-[8px]" /> : s.running ? (
                        <><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></>
                      ) : s.n}
                    </div>
                    <div className="flex-1">
                      <div className={`font-semibold ${s.running ? 'text-primary' : s.pending ? 'text-text-muted font-medium' : ''}`}>{s.title}</div>
                      <div className="text-[10.5px] text-text-muted">{s.meta}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-3 progress-quiet"><div style={{ width: '72%' }} /></div>
              <div className="flex items-center justify-between mt-1.5 text-[11px]">
                <span className="text-primary font-semibold">72% · step 4 of 5</span>
                <span className="text-text-muted">102 / 142 drafted</span>
              </div>
            </div>

            {/* Live execution */}
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-2 flex items-center justify-between">
                <span>Live execution</span>
                <button className="text-[10px] text-text-muted hover:text-text-main"><i className="fa-solid fa-arrow-up-right-from-square text-[9px]" /></button>
              </div>
              <div className="font-mono text-[10.5px] rounded-lg p-3 leading-[1.7]" style={{ background: '#0F0F1A', color: '#C4B5FD' }}>
                <div><span style={{ color: '#6B7280' }}>13:42:18</span> <span style={{ color: '#34D399' }}>✓</span> Drafted message for <span style={{ color: '#60A5FA' }}>lead_2841</span></div>
                <div><span style={{ color: '#6B7280' }}>13:42:14</span> <span style={{ color: '#34D399' }}>✓</span> Drafted message for <span style={{ color: '#60A5FA' }}>lead_2840</span></div>
                <div><span style={{ color: '#6B7280' }}>13:42:08</span> <span style={{ color: '#60A5FA' }}>i</span> Tone score 0.91 (target ≥ 0.85)</div>
                <div><span style={{ color: '#6B7280' }}>13:42:03</span> <span style={{ color: '#34D399' }}>✓</span> Drafted message for <span style={{ color: '#60A5FA' }}>lead_2839</span></div>
                <div><span style={{ color: '#6B7280' }}>13:41:55</span> <span style={{ color: '#34D399' }}>✓</span> Drafted message for <span style={{ color: '#60A5FA' }}>lead_2838</span></div>
                <div><span style={{ color: '#6B7280' }}>13:41:47</span> <span style={{ color: '#34D399' }}>✓</span> Drafted message for <span style={{ color: '#60A5FA' }}>lead_2837</span></div>
                <div className="mt-1" style={{ color: '#A78BFA' }}>
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /> drafting…
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3 text-[11.5px]">
                {[
                  { label: 'Sourced', value: '247' },
                  { label: 'Enriched', value: '245' },
                  { label: 'Drafted', value: '102', cls: 'text-primary' },
                  { label: 'Sent', value: '0', cls: 'text-text-muted' },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-[9.5px] uppercase tracking-wider text-text-muted">{s.label}</div>
                    <div className={`font-bold ${s.cls || ''}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* AWAITING APPROVAL */}
        <section className="float-in d-4 flex flex-col gap-4 p-[18px]" style={{ ...goalCardStyles.awaiting, borderRadius: '18px', borderTopLeftRadius: '18px', borderBottomLeftRadius: '18px' }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-warn/15 text-warn flex items-center justify-center shrink-0">
              <i className="fa-solid fa-circle-question text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="tag tag-warn"><i className="fa-solid fa-clock text-[8px]" />Awaiting approval</span>
                <span className="text-[11px] text-text-muted">REX drafted 4m ago</span>
                <span className="text-[10.5px] text-text-muted ml-auto">Goal · #G-0143</span>
              </div>
              <h3 className="text-[16px] font-bold leading-snug">"Find 3 more candidates similar to Sarah Chen and add them to Q2 Engineers."</h3>
            </div>
          </div>

          <div className="bg-white/70 rounded-lg p-3.5" style={{ border: '1px solid rgba(245,158,11,.2)' }}>
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-warn mb-2">REX's plan · 4 steps</div>
            <ol className="text-[12.5px] text-text-secondary space-y-1.5">
              <li className="flex gap-2"><span className="font-bold text-warn w-3">1.</span><span>Build similarity vector from Sarah Chen (Stripe · Sr Backend · Go · 7yr · 4h response)</span></li>
              <li className="flex gap-2"><span className="font-bold text-warn w-3">2.</span><span>Send <span className="inline-flex items-center gap-1 px-1.5 rounded-full text-[9.5px] font-semibold text-white grad-sourcer" style={{ padding: '0 6px' }}><i className="fa-solid fa-crosshairs text-[7px]" />Sourcer</span> on LinkedIn search · top 20 closest matches</span></li>
              <li className="flex gap-2"><span className="font-bold text-warn w-3">3.</span><span>Score them, pick top 3 by ICP match + replyability</span></li>
              <li className="flex gap-2"><span className="font-bold text-warn w-3">4.</span><span>Send <span className="inline-flex items-center gap-1 px-1.5 rounded-full text-[9.5px] font-semibold text-white grad-recruiter" style={{ padding: '0 6px' }}><i className="fa-solid fa-user-tie text-[7px]" />Recruiter</span> to draft initial messages</span></li>
            </ol>
            <div className="flex items-center gap-3 mt-2.5 text-[11px] text-text-muted">
              <span><i className="fa-regular fa-clock mr-1" />~12 min</span>
              <span>·</span>
              <span><i className="fa-solid fa-coins mr-1" />~6 credits</span>
              <span>·</span>
              <span className="text-success"><i className="fa-solid fa-shield-check mr-1" />Within autopilot guardrails</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button className="btn-solid"><i className="fa-solid fa-rocket text-[10px]" />Approve &amp; run</button>
            <button className="ghost-btn">Edit plan</button>
            <button className="ghost-btn">Run dry · no sending</button>
            <button className="ghost-btn ml-auto text-text-muted">Discard</button>
          </div>
        </section>

        {/* OTHER ACTIVE — recurring auto-respond */}
        <section className="float-in d-5 flex flex-col gap-4 p-[18px] bg-white" style={{ borderRadius: '18px', border: '1px solid #ECECEC' }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl grad-recruiter flex items-center justify-center text-white shrink-0 shadow-md shadow-success/25">
              <i className="fa-solid fa-comment-dots text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="tag tag-success"><span className="live-dot" />Running · recurring</span>
                <span className="text-[11px] text-text-muted">started 14m ago · ongoing</span>
                <span className="text-[10.5px] text-text-muted ml-auto">Goal · #G-0141</span>
              </div>
              <h3 className="text-[15.5px] font-bold leading-snug">"Auto-respond to incoming replies on Q2 Senior Engineers (score ≥ 90)."</h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold text-white grad-recruiter"><i className="fa-solid fa-user-tie text-[8px]" />Recruiter</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold text-white grad-coordinator"><i className="fa-solid fa-calendar-check text-[8px]" />Coordinator</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button className="ghost-btn"><i className="fa-solid fa-eye text-[10px]" />Watch</button>
              <button className="ghost-btn"><i className="fa-solid fa-pause text-[10px]" />Pause</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-[11px]">
            <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(16,185,129,.1)' }}>
              <div className="text-base font-bold text-success">5</div>
              <div className="text-[9.5px] text-text-muted uppercase">Auto-sent</div>
            </div>
            <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(245,158,11,.1)' }}>
              <div className="text-base font-bold text-warn">3</div>
              <div className="text-[9.5px] text-text-muted uppercase">Held for you</div>
            </div>
            <div className="rounded-lg p-2.5 text-center bg-surface">
              <div className="text-base font-bold text-text-secondary">4</div>
              <div className="text-[9.5px] text-text-muted uppercase">Score &lt; 90</div>
            </div>
          </div>
        </section>

        {/* COMPLETED */}
        <section>
          <div className="float-in d-6 flex items-center gap-3 mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-success">Completed · today</span>
            <div className="flex-1 h-px bg-gray-200" />
            <button className="text-[11px] text-text-muted hover:text-text-main">View all 8</button>
          </div>

          <div className="space-y-2.5">
            {[
              { d: 'd-7', time: '2h 47m ago', text: '"Draft this morning\'s pipeline review for the team Slack channel."', meta: 'Posted to #recruiting · 7 reactions · 2 comments', agent: { cls: 'grad-rex', icon: 'fa-wand-magic-sparkles', label: 'REX' } },
              { d: 'd-8', time: '8h 12m ago', text: '"Move all replies marked \'interested\' on Sales Reps – SF to Phone Screen stage."', meta: '19 candidates progressed · hiring manager notified', agent: { cls: 'grad-recruiter', icon: 'fa-user-tie', label: 'Recruiter' } },
              { d: 'd-9', time: 'yesterday at 4:18 PM', text: '"Schedule phone screens for all candidates who replied to Designers – Remote."', meta: '8 invites sent · 6 confirmed · 2 rescheduled by candidate', agent: { cls: 'grad-coordinator', icon: 'fa-calendar-check', label: 'Coordinator' } },
            ].map((g) => (
              <div key={g.text} className={`float-in ${g.d} flex items-center gap-3 py-3.5 px-[18px] bg-white opacity-85`} style={{ borderRadius: '18px', border: '1px solid #ECECEC' }}>
                <div className="w-9 h-9 rounded-lg bg-success/15 text-success flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-check text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10.5px] font-bold uppercase text-success">Completed</span>
                    <span className="text-[11px] text-text-muted">{g.time}</span>
                  </div>
                  <p className="text-[13px] font-semibold leading-snug">{g.text}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {g.meta} · <span className={`inline-flex items-center gap-1 px-1.5 rounded-full text-[9px] text-white ${g.agent.cls} ml-1`} style={{ padding: '1px 6px' }}>
                      <i className={`fa-solid ${g.agent.icon} text-[7px]`} />{g.agent.label}
                    </span>
                  </p>
                </div>
                <button className="ghost-btn p-1.5"><i className="fa-solid fa-arrow-right text-[11px]" /></button>
              </div>
            ))}
          </div>
        </section>

      </div>
    </WorkspaceShell>
  );
}
