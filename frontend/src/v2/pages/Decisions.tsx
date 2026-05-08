/**
 * v2 / Decisions — Pending REX approvals queue
 *
 * HTML preserved EXACTLY from mockups/decisions.html main content block.
 *
 * Wired to backend:
 *   - GET /api/v2/decisions?status=pending → drives the topbar count + the live list
 *   - POST /api/v2/decisions/:id/{approve|reject|snooze|graduate} for the live list
 *
 * Still placeholder (rich draft text + custom delegation visuals):
 *   - The 3 hardcoded mockup decision cards (D-0312/D-0311/D-0310) — kept as visual reference
 *     until we have real decision-payload rendering for reply_draft / scale_recommendation /
 *     guardrail_override types.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import WorkspaceShell from '../components/WorkspaceShell';
import WorkspaceTopbar from '../components/WorkspaceTopbar';
import { useDecisions } from '../hooks/useDecisions';
import { toastSuccess, toastInfo } from '../components/V2Toast';
import type { Decision } from '../types';

export default function DecisionsPage() {
  const navigate = useNavigate();
  const pendingQ = useDecisions({ status: 'pending' });

  /**
   * "Approve all safe" — bulk-approve every pending decision whose type
   * is reply_draft / pipeline_move / scale_recommendation. Skips offer
   * sends + submittal sends + guardrail overrides (those need eyes-on).
   */
  const approveAllSafe = () => {
    const SAFE: Decision['type'][] = ['reply_draft', 'pipeline_move', 'scale_recommendation'];
    const safeDecisions = pendingQ.decisions.filter((d) => SAFE.includes(d.type));
    if (safeDecisions.length === 0) {
      toastInfo('No safe-to-approve decisions in the queue.');
      return;
    }
    Promise.all(safeDecisions.map((d) => pendingQ.approve.mutateAsync(d.id))).then(
      () => toastSuccess(`Approved ${safeDecisions.length} decisions`),
      () => toastInfo('Some approvals failed — check the list.'),
    );
  };
  const pending = pendingQ.decisions;
  const oldest = pending.length
    ? pending.reduce((acc, d) => (new Date(d.created_at) < new Date(acc.created_at) ? d : acc), pending[0])
    : null;
  const oldestAge = oldest ? formatAge(oldest.created_at) : null;

  return (
    <WorkspaceShell autopilot>
      <WorkspaceTopbar
        pageTitle="Decisions"
        pageIcon="fa-solid fa-inbox"
        pageIconColor="text-warn"
        pageSubtitle={pendingQ.isLoading
          ? 'Loading…'
          : pending.length === 0
            ? 'Nothing waiting on you · REX is handling things'
            : `${pending.length} awaiting your approval${oldestAge ? ` · oldest is ${oldestAge}` : ''}`
        }
        statusPill={
          <div className="status-pill ml-3">
            <span className="ping-wrap" />
            <i className="fa-solid fa-circle-question text-warn text-[10px]" />
            <span><span className="font-semibold text-text-main">{pending.length}</span> held by REX above autopilot threshold</span>
          </div>
        }
      />

      <div className="px-8 py-7 space-y-6 max-w-[920px] mx-auto">

        {/* Hero */}
        <section className="float-in flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-warn mb-1.5">
              <i className="fa-solid fa-circle-question text-[10px] mr-1" />Awaiting your approval
            </div>
            <h1 className="text-[30px] font-extrabold tracking-tight">Decisions REX held back.</h1>
            <p className="text-text-secondary text-[14px] mt-1.5 max-w-2xl">
              Anything outside your autopilot threshold lives here. Approve, edit, regenerate — or graduate REX to handle this pattern automatically next time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/v2/settings/team')} className="ghost-btn"><i className="fa-solid fa-sliders text-[10px]" />Edit guardrails</button>
            <button onClick={approveAllSafe} disabled={pendingQ.approve.isPending} className="btn-solid disabled:opacity-50"><i className="fa-solid fa-bolt text-[10px]" />Approve all safe</button>
          </div>
        </section>

        {/* Filter pills */}
        <div className="float-in d-1 flex items-center gap-1.5 flex-wrap">
          <span className="px-3 py-1 rounded-full bg-warn text-white text-[11.5px] font-semibold">All · {pending.length}</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[11.5px] text-text-secondary">Pending · {pending.length}</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[11.5px] text-text-secondary">Snoozed · 0</span>
        </div>

        {/* Real workspace decisions (live from DB) */}
        {pending.length > 0 && (
          <section className="float-in d-1 space-y-2">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted px-1">
              Your workspace · {pending.length} pending
            </div>
            {pending.map((d) => (
              <DecisionListRow
                key={d.id}
                decision={d}
                onApprove={() => pendingQ.approve.mutate(d.id)}
                onReject={() => pendingQ.reject.mutate({ id: d.id })}
                onSnooze1d={() => pendingQ.snooze.mutate({ id: d.id, snoozedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })}
                isPending={pendingQ.approve.isPending || pendingQ.reject.isPending || pendingQ.snooze.isPending}
              />
            ))}
          </section>
        )}

        {/* Empty state when nothing pending */}
        {!pendingQ.isLoading && pending.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center float-in d-2">
            <div className="w-12 h-12 rounded-full grad-icon flex items-center justify-center text-white mx-auto mb-3">
              <i className="fa-solid fa-circle-check text-[18px]" />
            </div>
            <div className="text-[15px] font-bold mb-1">All clear.</div>
            <div className="text-[12.5px] text-text-muted max-w-md mx-auto">
              REX hasn't held back any actions for review. When a draft, scale recommendation, or guardrail catch lands here, you'll see it.
            </div>
          </div>
        )}

        {/* History strip */}
        <section>
          <div className="float-in d-5 flex items-center gap-3 mb-3 mt-4">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">Recent activity</span>
            <div className="flex-1 h-px bg-gray-200" />
            <button onClick={() => navigate('/v2/today')} className="text-[11px] text-text-muted hover:text-text-main">View full audit log</button>
          </div>

          <div className="space-y-2">
            {[
              { d: 'd-6', initials: 'SC', av: 'from-emerald-400 to-emerald-600', tag: 'Approved', tagCls: 'tag-success', icon: 'fa-check', time: '2h 47m ago · by you', text: <>Auto-sent calendar invite to <strong>Sarah Chen</strong> for Thu 2:30 PT</>, meta: 'Score 94 ≥ 90 threshold · Coordinator handled' },
              { d: 'd-7', initials: 'AO', av: 'from-violet-400 to-purple-600', tag: 'Approved & graduated', tagCls: 'tag-success', icon: 'fa-check', time: 'yesterday at 4:18 PM · by you', text: <>Auto-replied to <strong>Aisha Okafor</strong> · "Always auto-send these" enabled</>, meta: 'Recruiter no longer holds replies for managers in Phone Screen who said "yes."' },
              { d: 'd-7', initials: 'PP', av: 'from-amber-400 to-orange-500', tag: 'Snoozed', tagCls: 'tag-muted', icon: 'fa-clock', time: 'today 11:30 AM · until tomorrow', text: <>Counter-offer for <strong>Priya Patel</strong> · waiting on hiring manager response</>, meta: '' },
            ].map((row, i) => (
              <div key={i} className={`float-in ${row.d} flex items-center gap-3 py-3 px-[18px] bg-white opacity-70`} style={{ borderRadius: '18px', border: '1px solid #ECECEC', borderLeft: '3px solid #9CA3AF', borderTopLeftRadius: '18px', borderBottomLeftRadius: '18px' }}>
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${row.av} flex items-center justify-center text-white font-bold text-[11px] shrink-0`}>{row.initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`tag ${row.tagCls}`}><i className={`fa-solid ${row.icon} text-[8px]`} />{row.tag}</span>
                    <span className="text-[11px] text-text-muted">{row.time}</span>
                  </div>
                  <p className="text-[13px] font-semibold leading-snug">{row.text}</p>
                  {row.meta && <p className="text-[11px] text-text-muted mt-0.5">{row.meta}</p>}
                </div>
                <button onClick={() => navigate('/v2/today')} title="Open in audit log" className="ghost-btn p-1.5"><i className="fa-solid fa-arrow-right text-[11px]" /></button>
              </div>
            ))}
          </div>
        </section>

      </div>
    </WorkspaceShell>
  );
}

// =====================================================================
// Helper: shared decision card layout for the 2 simpler cases
// =====================================================================
interface DecisionAction {
  label: string;
  icon?: string;
  primary?: boolean;
}

function DecisionCard({
  d, id, tagText, tagIcon, agent, agentLabel, timeText, avatar, title, subline, reason, draftLabel, draft, customDraft, metaSplit, actions, graduate,
}: {
  d: string;
  id: string;
  tagText: string;
  tagIcon?: string;
  agent: 'recruiter' | 'rex' | 'sourcer';
  agentLabel: string;
  timeText: string;
  avatar: React.ReactNode;
  title: React.ReactNode;
  subline?: string;
  reason: string;
  draftLabel: string;
  draft?: string;
  customDraft?: React.ReactNode;
  metaSplit?: string[];
  actions: DecisionAction[];
  graduate: string;
}) {
  const agentClassMap = { recruiter: 'grad-recruiter', rex: 'grad-rex', sourcer: 'grad-sourcer' };
  const agentIconMap = { recruiter: 'fa-user-tie', rex: 'fa-wand-magic-sparkles', sourcer: 'fa-crosshairs' };

  return (
    <article className={`float-in ${d} flex flex-col gap-3.5 p-[18px]`} style={{
      background: 'linear-gradient(135deg,rgba(245,158,11,.06),rgba(245,158,11,.01) 70%,white)',
      border: '1px solid rgba(245,158,11,.22)',
      borderLeft: '3px solid #F59E0B',
      borderRadius: '18px',
      borderTopLeftRadius: '18px',
      borderBottomLeftRadius: '18px',
    }}>
      <div className="flex items-start gap-3">
        {avatar}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="tag tag-warn"><i className={`fa-solid ${tagIcon || 'fa-circle-question'} text-[8px]`} />{tagText}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold text-white ${agentClassMap[agent]}`}>
              <i className={`fa-solid ${agentIconMap[agent]} text-[8px]`} />{agentLabel}
            </span>
            <span className="text-[11px] text-text-muted">{timeText}</span>
            <span className="text-[10.5px] text-text-muted ml-auto">#{id}</span>
          </div>
          <h3 className="text-[16px] font-bold leading-snug mb-1">{title}</h3>
          {subline && <p className="text-[12.5px] text-text-secondary" dangerouslySetInnerHTML={{ __html: subline }} />}
        </div>
      </div>

      <div className="rounded-lg p-2.5 px-3" style={{ background: 'rgba(245,158,11,.06)', border: '1px dashed rgba(245,158,11,.3)', color: '#B45309', fontSize: '12px' }}>
        <i className="fa-solid fa-shield-halved mr-1" /><strong>Why I held it:</strong> {reason}
      </div>

      <div className="rounded-xl p-3 px-3.5 bg-white" style={{ border: '1px solid #ECECEC' }}>
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
          <i className="fa-solid fa-wand-magic-sparkles text-primary text-[9px]" />{draftLabel}
        </div>
        {customDraft || <p className="text-[13.5px] text-text-secondary leading-relaxed italic">{draft}</p>}
        {metaSplit && (
          <div className="flex items-center gap-2 text-[10.5px] text-text-muted mt-2 pt-2 border-t border-gray-100 flex-wrap">
            {metaSplit.map((m, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span>·</span>}
                <span><i className="fa-solid fa-check-circle text-success mr-0.5" />{m}</span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {actions.map((a) => (
          <button key={a.label} className={a.primary ? 'btn-solid' : 'btn-outline'}>
            {a.icon && <i className={`fa-solid ${a.icon} text-[10px]`} />}
            {a.label}
          </button>
        ))}
        <button className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11.5px] font-semibold cursor-pointer" style={{ color: '#6B46C1', background: 'rgba(107,70,193,.06)', border: '1px dashed rgba(107,70,193,.3)' }}>
          <i className="fa-solid fa-arrow-up text-[9px]" />{graduate}
        </button>
      </div>
    </article>
  );
}

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m old`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m old`;
  const days = Math.floor(hrs / 24);
  return `${days}d old`;
}

function decisionTypeLabel(type: Decision['type']): string {
  switch (type) {
    case 'reply_draft':           return 'Reply draft';
    case 'scale_recommendation':  return 'Scale recommendation';
    case 'guardrail_override':    return 'Guardrail catch';
    case 'offer_send':            return 'Offer send';
    case 'pipeline_move':         return 'Pipeline move';
    case 'submittal_send':        return 'Submittal send';
    case 'custom':                return 'Custom decision';
  }
}

/** Rich row for real workspace decisions — renders type-specific payload. */
function DecisionListRow({
  decision,
  onApprove,
  onReject,
  onSnooze1d,
  isPending,
}: {
  decision: Decision;
  onApprove: () => void;
  onReject: () => void;
  onSnooze1d: () => void;
  isPending: boolean;
}) {
  // Pull commonly-used fields out of payload for rendering.
  const p = decision.payload || {};
  const draft: string | undefined =
    p.draft || p.draft_text || p?.options?.stretch_response || undefined;
  const skill: string | undefined = p.skill;
  const candidate = p.candidate || p.lead || p.prospect;
  const candidateName = candidate
    ? `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || candidate.name
    : undefined;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-sm transition">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg grad-warm flex items-center justify-center text-white shrink-0">
          <i className="fa-solid fa-circle-question text-[11px]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="tag tag-warn">{decisionTypeLabel(decision.type)}</span>
            {skill && <span className="text-[10.5px] text-text-muted">via {skill}</span>}
            <span className="text-[10.5px] text-text-muted">·</span>
            <span className="text-[10.5px] text-text-muted">{formatAge(decision.created_at)}</span>
            <span className="text-[10.5px] text-text-muted ml-auto">#{decision.id.slice(0, 8)}</span>
          </div>
          {candidateName && (
            <div className="text-[13.5px] font-bold mb-0.5">
              {candidateName}
              {candidate.company && <span className="text-text-muted font-normal text-[12px]"> · {candidate.company}</span>}
              {candidate.title && <span className="text-text-muted font-normal text-[12px]"> · {candidate.title}</span>}
            </div>
          )}
          {decision.reason && (
            <div className="text-[12.5px] text-text-secondary mb-2">{decision.reason}</div>
          )}

          {/* Type-specific payload preview */}
          {draft && (
            <div className="rounded-lg p-3 mb-2 text-[12.5px] leading-relaxed text-text-main whitespace-pre-wrap" style={{ background: 'rgba(107,70,193,.04)', border: '1px solid rgba(107,70,193,.12)' }}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Drafted</div>
              {draft.length > 600 ? draft.slice(0, 600) + '…' : draft}
            </div>
          )}
          {decision.type === 'scale_recommendation' && p.estimatedCount && (
            <div className="rounded-lg p-3 mb-2 grid grid-cols-3 gap-3 text-[11.5px]" style={{ background: 'rgba(107,70,193,.04)', border: '1px solid rgba(107,70,193,.12)' }}>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Leads</div>
                <div className="font-bold tabular-nums">{p.estimatedCount}</div>
              </div>
              {p.estimatedSpendCents !== undefined && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">Spend</div>
                  <div className="font-bold tabular-nums">${(p.estimatedSpendCents / 100).toFixed(2)}</div>
                </div>
              )}
              {p.filters?.title && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">Filter</div>
                  <div className="font-bold truncate">{p.filters.title}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-gray-100">
        <button onClick={onApprove} disabled={isPending} className="btn-solid !py-1 !px-2.5 !text-[11.5px] disabled:opacity-50">
          <i className="fa-solid fa-check text-[10px]" />
          {decision.type === 'reply_draft' ? 'Approve & send' :
           decision.type === 'submittal_send' ? 'Approve & send submittal' :
           decision.type === 'offer_send' ? 'Approve offer' :
           decision.type === 'scale_recommendation' ? 'Approve scale' :
           decision.type === 'pipeline_move' ? 'Approve move' : 'Approve'}
        </button>
        <button onClick={onSnooze1d} disabled={isPending} className="ghost-btn !text-[11.5px] disabled:opacity-50">
          <i className="fa-solid fa-clock text-[10px]" />Snooze 1d
        </button>
        <button onClick={onReject} disabled={isPending} className="ghost-btn !text-[11.5px] !text-danger disabled:opacity-50">
          <i className="fa-solid fa-xmark text-[10px]" />Reject
        </button>
      </div>
    </div>
  );
}
