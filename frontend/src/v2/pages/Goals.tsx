/**
 * v2 / Goals — REX-driven outcomes
 *
 * HTML preserved EXACTLY from mockups/goals.html main content block.
 *
 * Wired to backend:
 *   - GET /api/v2/goals — drives the topbar counts + the "Your workspace goals" list
 *   - POST /api/v2/goals — the Plan goal input creates a goal in 'planning' status
 *   - POST /api/v2/goals/:id/{approve|pause|resume|cancel} — controls
 *
 * Still placeholder (rich animation/visuals; no SSE log yet):
 *   - "Live execution" terminal
 *   - "Plan · 5 steps" timeline (needs rex_activity_log + plan jsonb shape)
 *   - The mockup's hardcoded G-0142 / G-0140 / G-0138 cards stay as visual reference
 */

import React, { useState } from 'react';
import WorkspaceShell from '../components/WorkspaceShell';
import WorkspaceTopbar, { RexStatusPill } from '../components/WorkspaceTopbar';
import { useGoals, useGoalLogs } from '../hooks/useGoals';
import V2Dropdown from '../components/V2Dropdown';
import FilterPill from '../components/FilterPill';
import type { Goal, GoalStatus } from '../types';

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

type GoalsFilter = 'all' | 'running' | 'awaiting_approval' | 'completed';
type GoalsSort   = 'recent' | 'oldest' | 'most_steps' | 'progress';
const SORT_LABELS: Record<GoalsSort, string> = {
  recent: 'Recent', oldest: 'Oldest first', most_steps: 'Most steps', progress: '% progress',
};

export default function GoalsPage() {
  const { goals, isLoading, create, approve, pause, resume, cancel, planGoal, executeStep } = useGoals();
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<GoalsFilter>('all');
  const [sort, setSort] = useState<GoalsSort>('recent');

  const counts: Record<GoalStatus | 'total', number> = {
    planning: 0, awaiting_approval: 0, running: 0, paused: 0,
    completed: 0, failed: 0, cancelled: 0, total: goals.length
  } as any;
  for (const g of goals) counts[g.status as GoalStatus] = (counts[g.status as GoalStatus] || 0) + 1;

  const visibleGoals = (() => {
    let list = goals;
    if (filter === 'running')           list = list.filter((g) => g.status === 'running');
    else if (filter === 'awaiting_approval') list = list.filter((g) => g.status === 'awaiting_approval');
    else if (filter === 'completed')    list = list.filter((g) => g.status === 'completed');
    const sorted = [...list].sort((a, b) => {
      if (sort === 'recent')     return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === 'oldest')     return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === 'most_steps') return ((b.plan as any)?.steps?.length || 0) - ((a.plan as any)?.steps?.length || 0);
      if (sort === 'progress') {
        const prog = (g: any) => {
          const steps = g.plan?.steps || [];
          if (!steps.length) return 0;
          return steps.filter((s: any) => s.status === 'done').length / steps.length;
        };
        return prog(b) - prog(a);
      }
      return 0;
    });
    return sorted;
  })();

  const handlePlan = () => {
    const title = draft.trim();
    if (!title || create.isPending || planGoal.isPending) return;
    // Create the goal, then immediately ask REX to plan it. Two-step flow so
    // the user sees the goal appear first, then the plan fills in.
    create.mutate({ title, prompt: title }, {
      onSuccess: (resp: any) => {
        setDraft('');
        const newId = resp?.goal?.id;
        if (newId) planGoal.mutate(newId);
      },
    });
  };

  return (
    <WorkspaceShell autopilot>
      <WorkspaceTopbar
        pageTitle="Goals"
        pageIcon="fa-solid fa-rocket"
        pageIconColor="text-primary"
        pageSubtitle={isLoading ? 'Loading goals…' : `REX-driven outcomes · ${counts.running} running · ${counts.awaiting_approval} awaiting`}
        statusPill={
          counts.running > 0
            ? <RexStatusPill text={`${counts.running} goal${counts.running === 1 ? '' : 's'} running · `} highlight={`${counts.awaiting_approval} awaiting`} highlightClass="text-warn font-semibold" />
            : <RexStatusPill text="REX is " highlight="ready for your next goal" highlightClass="text-primary font-semibold" />
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
              <div><span className="font-bold text-primary tabular-nums">{counts.running}</span> <span className="text-text-muted">running</span></div>
              <div className="w-px h-3 bg-gray-300" />
              <div><span className="font-bold text-warn tabular-nums">{counts.awaiting_approval}</span> <span className="text-text-muted">awaiting you</span></div>
              <div className="w-px h-3 bg-gray-300" />
              <div><span className="font-bold text-success tabular-nums">{counts.completed}</span> <span className="text-text-muted">completed</span></div>
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
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handlePlan(); }}
            className="w-full bg-white rounded-lg px-3 py-2.5 text-[14px] outline-none border border-gray-200 focus:border-primary/40 transition placeholder:text-text-muted"
            placeholder="e.g. 'Find 50 senior backend engineers in NY at Series B startups, score them, start outreach to top 30'"
          />
          <div className="flex items-center justify-between mt-2.5 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">Templates</span>
              <button onClick={() => setDraft('Source 50 senior engineers and start outreach to the top 30')} className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-gray-200 hover:border-primary/30 text-text-secondary">Source &amp; outreach</button>
              <button onClick={() => setDraft('Scale our active campaign — find 200 more matching the top responders')} className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-gray-200 hover:border-primary/30 text-text-secondary">Scale a campaign</button>
              <button onClick={() => setDraft('Review every pipeline and surface stalled candidates')} className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-gray-200 hover:border-primary/30 text-text-secondary">Pipeline review</button>
              <button onClick={() => setDraft('Auto-respond to every reply that scores above 0.85')} className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-gray-200 hover:border-primary/30 text-text-secondary">Auto-respond</button>
            </div>
            <button
              onClick={handlePlan}
              disabled={!draft.trim() || create.isPending}
              className="btn-primary disabled:opacity-50"
            >
              <i className={`fa-solid ${create.isPending ? 'fa-spinner fa-spin' : 'fa-arrow-up'} text-[10px]`} />
              {create.isPending ? 'Planning…' : 'Plan goal'}
            </button>
          </div>
        </section>

        {/* Empty state when no goals at all */}
        {!isLoading && goals.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center float-in d-2">
            <div className="w-12 h-12 rounded-full grad-rex flex items-center justify-center text-white mx-auto mb-3">
              <i className="fa-solid fa-rocket text-[18px]" />
            </div>
            <div className="text-[15px] font-bold mb-1">No goals running yet.</div>
            <div className="text-[12.5px] text-text-muted max-w-md mx-auto">
              Type what you want above — REX will plan it, you approve it, your team executes.
              Anything REX holds back will land on Decisions for review.
            </div>
          </div>
        )}

        {/* Real workspace goals (live from DB) */}
        {goals.length > 0 && (
          <section className="float-in d-2 space-y-2">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted px-1">
              {filter === 'all' ? 'Your workspace' : `Filtered · ${filter.replace('_', ' ')}`} · {visibleGoals.length} of {goals.length} goal{goals.length === 1 ? '' : 's'}
            </div>
            {visibleGoals.length === 0 && (
              <div className="bg-white border border-gray-100 rounded-xl p-6 text-center text-[12.5px] text-text-muted">
                No goals match this filter.
              </div>
            )}
            {visibleGoals.map((g) => (
              <GoalListRow
                key={g.id}
                goal={g}
                onApprove={() => approve.mutate(g.id)}
                onPause={() => pause.mutate(g.id)}
                onResume={() => resume.mutate(g.id)}
                onCancel={() => cancel.mutate(g.id)}
                onPlan={() => planGoal.mutate(g.id)}
                onExecuteStep={() => executeStep.mutate(g.id)}
                isPending={approve.isPending || pause.isPending || resume.isPending || cancel.isPending || planGoal.isPending || executeStep.isPending}
              />
            ))}
          </section>
        )}

        {/* Filter pills + sort */}
        <div className="float-in d-2 flex items-center gap-1.5 flex-wrap">
          <FilterPill label={`All · ${counts.total}`}                         active={filter === 'all'}               onClick={() => setFilter('all')} />
          <FilterPill label={<><span className="live-dot inline-block mr-1" />Running · {counts.running}</>}                  active={filter === 'running'}           onClick={() => setFilter('running')} />
          <FilterPill label={<><i className="fa-solid fa-circle-question text-warn text-[8px] mr-1" />Awaiting · {counts.awaiting_approval}</>} active={filter === 'awaiting_approval'} onClick={() => setFilter('awaiting_approval')} />
          <FilterPill label={`Done · ${counts.completed}`}                    active={filter === 'completed'}         onClick={() => setFilter('completed')} />
          <V2Dropdown
            align="right"
            minWidth={180}
            trigger={
              <span className="ml-auto text-[11.5px] text-text-muted cursor-pointer hover:text-text-main">
                <i className="fa-solid fa-arrow-up-wide-short text-[9px] mr-1" />
                Sort: {SORT_LABELS[sort]}
              </span>
            }
            items={(['recent', 'oldest', 'most_steps', 'progress'] as GoalsSort[]).map((k) => ({
              key: k, label: SORT_LABELS[k], selected: sort === k, onClick: () => setSort(k),
            }))}
          />
        </div>

      </div>
    </WorkspaceShell>
  );
}

/**
 * Workspace goal row with full plan + execution affordances.
 *
 * Status flow:
 *   planning → (Plan it) → awaiting_approval → (Approve & run) → running → completed
 *
 * "Run next step" advances one step at a time so users can watch what
 * happens. A future cron worker will drive this automatically; the manual
 * button stays available either way.
 */
function GoalListRow({
  goal,
  onApprove,
  onPause,
  onResume,
  onCancel,
  onPlan,
  onExecuteStep,
  isPending,
}: {
  goal: Goal;
  onApprove: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onPlan: () => void;
  onExecuteStep: () => void;
  isPending: boolean;
}) {
  const statusTag = (status: GoalStatus) => {
    switch (status) {
      case 'planning':         return <span className="tag tag-muted"><i className="fa-solid fa-sparkles text-[8px]" />Planning</span>;
      case 'awaiting_approval': return <span className="tag tag-warn"><i className="fa-solid fa-circle-question text-[8px]" />Awaiting you</span>;
      case 'running':          return <span className="tag tag-primary"><span className="live-dot" />Running</span>;
      case 'paused':           return <span className="tag tag-muted"><i className="fa-solid fa-pause text-[8px]" />Paused</span>;
      case 'completed':        return <span className="tag tag-success"><i className="fa-solid fa-check text-[8px]" />Done</span>;
      case 'failed':           return <span className="tag tag-danger"><i className="fa-solid fa-circle-exclamation text-[8px]" />Failed</span>;
      case 'cancelled':        return <span className="tag tag-muted"><i className="fa-solid fa-xmark text-[8px]" />Cancelled</span>;
    }
  };

  const plan = (goal.plan as any) || null;
  const steps = (plan?.steps || []) as Array<{ index: number; title: string; role: string; skill_id: string; status?: string; rationale?: string }>;
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const heldCount = steps.filter((s) => s.status === 'held').length;
  const failedCount = steps.filter((s) => s.status === 'failed').length;
  const runningStep = steps.find((s) => s.status === 'running');
  const nextStep = steps.find((s) => !s.status || s.status === 'pending');
  const progress = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3.5 hover:shadow-sm transition">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg grad-rex flex items-center justify-center text-white shrink-0">
          <i className="fa-solid fa-rocket text-[12px]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {statusTag(goal.status)}
            {steps.length > 0 && (
              <span className="text-[10.5px] text-text-muted">
                {doneCount}/{steps.length} step{steps.length === 1 ? '' : 's'}
                {heldCount > 0 && <span className="text-warn"> · {heldCount} held</span>}
                {failedCount > 0 && <span className="text-danger"> · {failedCount} failed</span>}
              </span>
            )}
            <span className="text-[10.5px] text-text-muted">created {new Date(goal.created_at).toLocaleDateString()}</span>
          </div>
          <div className="font-semibold text-[13.5px] truncate">{goal.title}</div>
          {plan?.summary && (
            <div className="text-[11.5px] text-text-secondary mt-0.5 line-clamp-2">{plan.summary}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          {goal.status === 'planning' && (
            <button onClick={onPlan} disabled={isPending} className="ghost-btn disabled:opacity-50">
              <i className="fa-solid fa-sparkles text-[10px]" />Plan it
            </button>
          )}
          {(goal.status === 'planning' || goal.status === 'awaiting_approval') && steps.length > 0 && (
            <button onClick={onApprove} disabled={isPending} className="ghost-btn disabled:opacity-50">
              <i className="fa-solid fa-play text-[10px]" />Approve &amp; run
            </button>
          )}
          {goal.status === 'running' && nextStep && (
            <button onClick={onExecuteStep} disabled={isPending} className="btn-primary disabled:opacity-50 !py-1 !text-[11.5px]">
              <i className={`fa-solid ${isPending ? 'fa-spinner fa-spin' : 'fa-forward-step'} text-[10px]`} />
              Run next step
            </button>
          )}
          {goal.status === 'running' && (
            <button onClick={onPause} disabled={isPending} className="ghost-btn disabled:opacity-50">
              <i className="fa-solid fa-pause text-[10px]" />Pause
            </button>
          )}
          {goal.status === 'paused' && (
            <button onClick={onResume} disabled={isPending} className="ghost-btn disabled:opacity-50">
              <i className="fa-solid fa-play text-[10px]" />Resume
            </button>
          )}
          {(goal.status === 'planning' || goal.status === 'awaiting_approval' || goal.status === 'running' || goal.status === 'paused') && (
            <button onClick={onCancel} disabled={isPending} className="ghost-btn !text-danger disabled:opacity-50">
              <i className="fa-solid fa-xmark text-[10px]" />Cancel
            </button>
          )}
        </div>
      </div>

      {/* Live execution console while running */}
      <GoalExecutionConsole goalId={goal.id} isRunning={goal.status === 'running'} />

      {/* Plan steps preview */}
      {steps.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
              Plan · {steps.length} step{steps.length === 1 ? '' : 's'}
            </div>
            {goal.status === 'running' && (
              <div className="text-[10.5px] text-primary font-semibold">{progress}%</div>
            )}
          </div>
          {goal.status === 'running' && (
            <div className="h-1 rounded-full bg-surface mb-2 overflow-hidden">
              <div className="h-full grad-icon rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <ol className="space-y-1.5">
            {steps.map((s) => (
              <li key={s.index} className="flex items-start gap-2 text-[12px]">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5 ${
                    s.status === 'done' ? 'bg-success text-white' :
                    s.status === 'held' ? 'bg-warn text-white' :
                    s.status === 'failed' ? 'bg-danger text-white' :
                    s.status === 'running' ? 'grad-icon text-white' :
                    'bg-surface text-text-muted border border-gray-200'
                  }`}
                >
                  {s.status === 'done' ? '✓' :
                   s.status === 'held' ? '?' :
                   s.status === 'failed' ? '!' :
                   s.status === 'running' ? '…' :
                   s.index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium truncate ${s.status === 'running' ? 'text-primary' : s.status === 'failed' ? 'text-danger' : ''}`}>
                    {s.title}
                  </div>
                  <div className="text-[10.5px] text-text-muted">
                    {s.role} · {s.skill_id}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/**
 * Terminal-style live execution console for a running goal. Polls
 * /api/v2/goals/:id/logs every 3s while running. Auto-collapses when
 * idle / not running.
 */
function GoalExecutionConsole({ goalId, isRunning }: { goalId: string; isRunning: boolean }) {
  const { data, isLoading } = useGoalLogs(goalId, isRunning) as any;
  const logs: any[] = data?.logs || [];
  if (!isRunning && logs.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
          Live execution {isRunning && <span className="text-primary">· streaming</span>}
        </div>
        {isLoading && logs.length === 0 && <span className="text-[10.5px] text-text-muted">connecting…</span>}
      </div>
      <div className="font-mono text-[10.5px] rounded-lg p-3 leading-[1.7] max-h-[180px] overflow-y-auto" style={{ background: '#0F0F1A', color: '#C4B5FD' }}>
        {logs.length === 0 && (
          <div style={{ color: '#6B7280' }}>(no log entries yet)</div>
        )}
        {logs.map((row: any) => {
          const time = row.started_at ? new Date(row.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
          const dur = row.duration_ms ? ` (${(row.duration_ms / 1000).toFixed(1)}s)` : '';
          const icon =
            row.status === 'done' ? <span style={{ color: '#34D399' }}>✓</span> :
            row.status === 'held' ? <span style={{ color: '#FBBF24' }}>?</span> :
            row.status === 'failed' ? <span style={{ color: '#F87171' }}>✗</span> :
            row.status === 'skipped' ? <span style={{ color: '#6B7280' }}>↷</span> :
            <span style={{ color: '#A78BFA' }}>…</span>;
          return (
            <div key={row.id}>
              <span style={{ color: '#6B7280' }}>{time}</span>{' '}
              {icon}{' '}
              <span style={{ color: '#60A5FA' }}>step {row.step_index + 1}</span>{' '}
              <span style={{ color: '#A78BFA' }}>{row.skill_id}</span>
              {row.error ? <span style={{ color: '#F87171' }}> — {String(row.error).slice(0, 80)}</span> : null}
              <span style={{ color: '#6B7280' }}>{dur}</span>
            </div>
          );
        })}
        {isRunning && (
          <div style={{ color: '#A78BFA' }} className="mt-1">
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /> waiting for next tick…
          </div>
        )}
      </div>
    </div>
  );
}

// FilterPill is imported from '../components/FilterPill'.
