/**
 * v2 / Inbox — three-pane email/messaging
 *
 * HTML preserved EXACTLY from mockups/inbox.html main content block.
 *
 * TODO wire to backend:
 *   - Conversation list from email_replies + email_events (workspace-scoped)
 *   - Thread messages from email_events ordered by occurred_at
 *   - Per-thread autopilot strip → agents.trust_level for the assigned agent
 *   - REX-drafted reply → POST /api/v2/decisions/:id/approve or POST /api/messages/send
 *   - Right-pane lead context → reuse existing lead profile API
 */

import React, { useEffect } from 'react';
import WorkspaceSidebar from '../components/WorkspaceSidebar';
import { RexSkillButtons, RexSkillsHireCTA, type SkillButtonSpec } from '../components/RexSkillButtons';
import { useAgents, findAgentByRole } from '../hooks/useAgents';
import '../../styles/v2.css';

interface Conv {
  active?: boolean;
  initials: string;
  av: string;
  online?: boolean;
  name: string;
  time: string;
  timeCls?: string;
  preview: string;
  previewBold?: boolean;
  tag: { label: string; cls: string };
  rexBadge?: 'autosent' | 'draft' | 'needs';
  unread?: boolean;
}

const CONVERSATIONS: Conv[] = [
  { active: true, initials: 'SC', av: 'from-emerald-400 to-emerald-600', online: true, name: 'Sarah Chen', time: '2m', preview: '"Yes, I\'d love to chat — Thursday after 2pm…"', tag: { label: 'Hot · 94', cls: 'tag-success' }, rexBadge: 'autosent' },
  { initials: 'MR', av: 'from-blue-400 to-blue-600', name: 'Marcus Rodriguez', time: '14m', timeCls: 'text-warn font-bold', preview: '"Send more details on comp?"', previewBold: true, tag: { label: 'Warm · 87', cls: 'tag-warn' }, rexBadge: 'needs', unread: true },
  { initials: 'PP', av: 'from-amber-400 to-orange-500', name: 'Priya Patel', time: '28m', timeCls: 'text-primary font-bold', preview: '"Interested. What\'s the team makeup?"', previewBold: true, tag: { label: 'Hot · 91', cls: 'tag-success' }, rexBadge: 'draft', unread: true },
  { initials: 'AO', av: 'from-violet-400 to-purple-600', name: 'Aisha Okafor', time: '2h', preview: '"Let\'s set up a chat next week."', tag: { label: 'Hot · 93', cls: 'tag-success' }, rexBadge: 'autosent' },
  { initials: 'EK', av: 'from-rose-400 to-pink-600', name: 'Emily Kovacs', time: '3h', timeCls: 'text-primary font-bold', preview: '"Are you open to a 15-min intro call?"', previewBold: true, tag: { label: 'Hot · 96', cls: 'tag-success' }, rexBadge: 'draft', unread: true },
  { initials: 'DT', av: 'from-cyan-400 to-blue-500', name: 'Devin Tran', time: '4h', preview: '"Thanks for the intro — taking a look."', tag: { label: 'Warm · 88', cls: 'tag-warn' } },
  { initials: 'JW', av: 'from-purple-400 to-purple-700', name: 'Jamal Williams', time: '52m', preview: '"Not the right time but keep me on the list."', tag: { label: 'Cold', cls: 'tag-muted' } },
];

export default function InboxPage() {
  useEffect(() => {
    document.body.classList.add('v2-app', 'autopilot');
    return () => { document.body.classList.remove('v2-app', 'autopilot'); };
  }, []);

  return (
    <div className="v2-app autopilot flex min-h-screen relative z-10">
      <WorkspaceSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="border-b border-gray-100 px-6 h-14 glass flex items-center gap-4 sticky top-0 z-30">
          <div>
            <div className="font-semibold text-[14.5px] flex items-center gap-2"><i className="fa-solid fa-envelope text-primary text-xs" />Inbox</div>
            <div className="text-[10.5px] text-text-muted">12 unread · 8 REX drafts ready · 5 auto-sent today</div>
          </div>
          <div className="status-pill ml-3">
            <span className="ping-wrap" style={{ background: '#10B981' } as any} />
            <i className="fa-solid fa-user-tie text-success text-[10px]" />
            <span><span className="font-semibold text-text-main">Recruiter</span> drafted 8 of 12 hot replies</span>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <button className="trust-badge"><i className="fa-solid fa-rocket text-[10px]" />Autopilot<i className="fa-solid fa-chevron-down text-[9px] opacity-80" /></button>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 ring-2 ring-white" />
          </div>
        </header>

        <div className="flex flex-1 min-h-0">

          {/* LEFT: conversation list */}
          <section className="w-80 shrink-0 border-r border-gray-100 bg-white/40 flex flex-col">
            <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-1.5 text-[11px]">
              <button className="px-2.5 py-1 rounded-full bg-primary text-white font-semibold">All <span className="opacity-80">12</span></button>
              <button className="px-2.5 py-1 rounded-full text-text-secondary hover:bg-surface font-medium">Hot <span className="text-text-muted">8</span></button>
              <button className="px-2.5 py-1 rounded-full text-text-secondary hover:bg-surface font-medium">REX drafts <span className="text-text-muted">8</span></button>
              <button className="ml-auto px-2 py-1 rounded-full text-text-secondary hover:bg-surface"><i className="fa-solid fa-filter text-[10px]" /></button>
            </div>

            <ul className="flex-1 overflow-y-auto">
              {CONVERSATIONS.map((c, i) => (
                <li key={i} className={`px-3.5 py-2.5 cursor-pointer transition-colors ${c.active ? '' : 'hover:bg-black/[0.02]'}`} style={c.active ? { background: 'linear-gradient(90deg,rgba(107,70,193,.08),rgba(12,92,244,.04))', borderLeft: '3px solid #6B46C1' } : { borderLeft: '3px solid transparent' }}>
                  <div className="flex items-start gap-2.5">
                    <div className="relative shrink-0">
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${c.av} flex items-center justify-center text-white text-[11px] font-bold`}>{c.initials}</div>
                      {c.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-[13px] truncate">{c.name}</span>
                        <span className={`text-[10.5px] shrink-0 ${c.timeCls || 'text-text-muted'}`}>{c.time}</span>
                      </div>
                      <p className={`text-[11.5px] truncate ${c.previewBold ? 'text-text-main font-medium' : 'text-text-secondary'}`}>{c.preview}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`tag ${c.tag.cls}`}>{c.tag.label}</span>
                        {c.rexBadge === 'autosent' && <span className="text-[10px] text-success font-semibold flex items-center gap-1"><i className="fa-solid fa-circle-check text-[8px]" />Auto-sent</span>}
                        {c.rexBadge === 'draft' && <span className="text-[10px] text-primary font-semibold flex items-center gap-1"><i className="fa-solid fa-wand-magic-sparkles text-[8px]" />Draft ready</span>}
                        {c.rexBadge === 'needs' && <span className="text-[10px] text-warn font-semibold flex items-center gap-1"><i className="fa-solid fa-circle-question text-[8px]" />Needs you</span>}
                      </div>
                    </div>
                    {c.unread && <div className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* CENTER: thread */}
          <section className="flex-1 flex flex-col min-w-0 bg-white">
            {/* Thread header */}
            <div className="border-b border-gray-100 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-[13px] font-bold ring-2 ring-primary/15">SC</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-[14.5px]">Sarah Chen</h2>
                    <span className="tag tag-success">Hot · 94</span>
                    <span className="flex items-center gap-1 text-[10.5px] text-success font-semibold"><span className="live-dot" />online</span>
                  </div>
                  <p className="text-[11.5px] text-text-muted">Senior Backend Engineer · Stripe · <a href="#" className="text-primary hover:underline">Q2 Senior Engineers</a></p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="w-9 h-9 rounded-md hover:bg-surface flex items-center justify-center text-text-secondary"><i className="fa-solid fa-calendar text-sm" /></button>
                <button className="w-9 h-9 rounded-md hover:bg-surface flex items-center justify-center text-text-secondary"><i className="fa-solid fa-share-nodes text-sm" /></button>
                <button className="w-9 h-9 rounded-md hover:bg-surface flex items-center justify-center text-text-secondary"><i className="fa-solid fa-ellipsis text-sm" /></button>
              </div>
            </div>

            {/* Per-thread autopilot strip */}
            <div className="px-6 py-2.5 flex items-center gap-3 text-[12px]" style={{ background: 'linear-gradient(90deg,rgba(16,185,129,.06),rgba(107,70,193,.04) 70%,transparent)', borderBottom: '1px solid rgba(16,185,129,.15)' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md grad-recruiter flex items-center justify-center text-white"><i className="fa-solid fa-user-tie text-[10px]" /></div>
                <span className="font-semibold">Recruiter is autopilot for this thread</span>
              </div>
              <span className="text-text-muted">·</span>
              <span className="text-text-secondary">Sarah's score is <strong className="text-success">94</strong> — above your auto-send threshold of 90</span>
              <div className="trust-mini ml-auto">
                <span className="trust-mini-seg">M</span>
                <span className="trust-mini-seg">S</span>
                <span className="trust-mini-seg active">Auto</span>
              </div>
              <button className="ghost-btn !text-[11.5px]"><i className="fa-solid fa-sliders text-[10px]" />Adjust</button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              <div className="flex items-center gap-3 text-[10.5px] text-text-muted font-bold uppercase tracking-wider">
                <div className="flex-1 h-px bg-gray-100" /><span>Yesterday</span><div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Outbound */}
              <div className="flex gap-3 justify-end">
                <div className="max-w-[70%]">
                  <div className="grad-icon text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-md shadow-primary/20">
                    <p className="text-[14px] leading-relaxed">Hi Sarah — your work on Stripe's payments infra caught my eye. We're hiring a Senior Backend Engineer at <strong>Linear</strong> to lead the new sync engine. Would you be open to a 15-min chat?</p>
                  </div>
                  <div className="text-[10.5px] text-text-muted mt-1 text-right flex items-center gap-1.5 justify-end">
                    <span className="inline-flex items-center gap-1 px-1.5 rounded-full text-[9px] text-white grad-recruiter" style={{ padding: '1px 6px' }}><i className="fa-solid fa-user-tie text-[7px]" />Recruiter sent</span>
                    <span>9:14 AM</span>
                    <i className="fa-solid fa-check-double text-secondary text-[10px]" title="Read" />
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 shrink-0 ring-2 ring-white" />
              </div>

              <div className="text-center">
                <span className="text-[11px] text-text-muted bg-surface px-3 py-1 rounded-full inline-flex items-center gap-1.5"><i className="fa-solid fa-envelope-open text-[10px]" />Sarah opened your message · 10:42 AM (1st of 3 opens)</span>
              </div>

              <div className="flex items-center gap-3 text-[10.5px] text-text-muted font-bold uppercase tracking-wider">
                <div className="flex-1 h-px bg-gray-100" /><span>Today</span><div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Inbound */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">SC</div>
                <div className="max-w-[70%]">
                  <div className="bg-surface rounded-2xl rounded-tl-sm px-4 py-3">
                    <p className="text-[14px] leading-relaxed text-text-main">Yes, I'd love to chat — Thursday after 2pm works. Do you have a calendar link, or would you rather propose a few times?</p>
                  </div>
                  <div className="text-[10.5px] text-text-muted mt-1 flex items-center gap-1.5"><span>Sarah Chen · 11:36 AM</span></div>
                </div>
              </div>

              {/* Auto-sent confirmation */}
              <div className="flex gap-3 ml-11">
                <div className="text-[11.5px] text-success rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)' }}>
                  <i className="fa-solid fa-circle-check text-[11px]" />
                  <span><strong>Coordinator</strong> auto-sent calendar invite for <strong>Thu 2:30 PT</strong> · score 94 ≥ threshold</span>
                  <button className="text-primary font-semibold hover:underline ml-2">View invite</button>
                </div>
              </div>

              {/* REX-drafted reply */}
              <div className="flex gap-3 ml-11">
                <div className="flex-1 max-w-[80%] shimmer-top rounded-2xl p-3.5" style={{ background: 'linear-gradient(135deg,rgba(107,70,193,.05),rgba(12,92,244,.02) 60%)', border: '1px solid rgba(107,70,193,.18)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-md grad-recruiter flex items-center justify-center text-white text-[10px]"><i className="fa-solid fa-user-tie" /></div>
                    <span className="text-[10.5px] font-bold uppercase tracking-wider grad-text">Recruiter drafted a follow-up</span>
                    <span className="ml-auto text-[10.5px] text-text-muted">just now</span>
                  </div>
                  <p className="text-[14px] text-text-main leading-relaxed">
                    Sarah — Thursday 2:30 PT is locked in (calendar invite already sent). Quick context before we chat: the role is on Linear's new sync engine team, reporting to <strong>Marcus Rodriguez (VP Eng)</strong>. Tech stack is Rust + TypeScript. Comp range: $190–230k base + 0.05–0.1% equity.<br /><br />
                    Anything specific you want me to prep on the call?<br /><br />— Brandon
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-primary/10 flex-wrap">
                    <button className="btn-solid"><i className="fa-solid fa-paper-plane text-[10px]" />Send as-is</button>
                    <button className="btn-outline">Edit</button>
                    <button className="btn-outline"><i className="fa-solid fa-rotate text-[10px]" />Regenerate</button>
                    <span className="ml-auto text-[10.5px] text-text-muted flex items-center gap-1"><i className="fa-solid fa-shield-check text-[10px]" />Tone: warm professional</span>
                  </div>
                </div>
              </div>

              <div className="ml-11 flex items-center gap-2 flex-wrap">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">Or ask Recruiter to:</span>
                <button className="text-[11.5px] px-3 py-1.5 rounded-full bg-surface text-text-main hover:bg-gray-200">Send the role brief</button>
                <button className="text-[11.5px] px-3 py-1.5 rounded-full bg-surface text-text-main hover:bg-gray-200">Loop in Marcus (VP Eng)</button>
                <button className="text-[11.5px] px-3 py-1.5 rounded-full bg-surface text-text-main hover:bg-gray-200">Draft submittal for Marcus</button>
              </div>

              {/* Skills strip — invoke a Skill on this thread's lead */}
              <div className="ml-11 mt-1">
                <InboxSkillsBar
                  lead={{
                    firstName: 'Sarah',
                    lastName: 'Chen',
                    title: 'Senior Backend Engineer',
                    company: 'Stripe',
                  }}
                  lastInboundText="Yes, I'd love to chat — Thursday after 2pm works. Do you have a calendar link, or would you rather propose a few times?"
                />
              </div>
            </div>

            {/* Composer */}
            <div className="border-t border-gray-100 px-6 py-3 bg-white">
              <div className="rounded-2xl bg-white" style={{ border: '1px solid #E5E7EB' }}>
                <textarea className="w-full px-4 py-3 text-[14px] outline-none resize-none rounded-2xl placeholder:text-text-muted" rows={2} placeholder="Type a reply, or hit ⌘K to ask Recruiter…" />
                <div className="flex items-center justify-between px-3 pb-2.5">
                  <div className="flex items-center gap-1 text-text-muted">
                    <button className="w-7 h-7 rounded hover:bg-surface flex items-center justify-center"><i className="fa-solid fa-paperclip text-[11px]" /></button>
                    <button className="w-7 h-7 rounded hover:bg-surface flex items-center justify-center"><i className="fa-solid fa-image text-[11px]" /></button>
                    <button className="w-7 h-7 rounded hover:bg-surface flex items-center justify-center"><i className="fa-solid fa-link text-[11px]" /></button>
                    <button className="w-7 h-7 rounded hover:bg-surface flex items-center justify-center"><i className="fa-solid fa-calendar text-[11px]" /></button>
                    <button className="text-[11px] px-2 py-1 rounded hover:bg-surface text-primary font-semibold"><i className="fa-solid fa-wand-magic-sparkles text-[10px] mr-1" />Improve with REX</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] text-text-muted flex items-center gap-1"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /> Recruiter is suggesting…</span>
                    <button className="text-[12.5px] px-4 py-1.5 rounded-xl grad-icon text-white font-semibold shadow-md shadow-primary/25">Send</button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT: lead context */}
          <aside className="w-80 shrink-0 border-l border-gray-100 bg-white/40 overflow-y-auto px-5 py-5">
            <div className="text-center mb-5">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-[20px] font-bold ring-4 ring-primary/15 mx-auto mb-2">SC</div>
              <h3 className="font-bold text-[16px]">Sarah Chen</h3>
              <p className="text-[11.5px] text-text-muted">Senior Backend Engineer · Stripe</p>
              <div className="flex items-center justify-center gap-1.5 mt-3">
                <button className="text-[11px] px-2.5 py-1.5 rounded-md bg-surface text-text-secondary"><i className="fa-brands fa-linkedin mr-1" />LinkedIn</button>
                <button className="text-[11px] px-2.5 py-1.5 rounded-md bg-surface text-text-secondary"><i className="fa-solid fa-envelope mr-1" />Email</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 mb-4" style={{ border: '1px solid #ECECEC' }}>
              <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-2">REX score</h4>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-[26px] font-bold grad-text leading-none">94</span>
                <span className="text-[11px] text-text-muted">/ 100</span>
                <span className="ml-auto text-[11px] text-success font-semibold">Top 6%</span>
              </div>
              <div className="h-2 rounded-full bg-surface overflow-hidden"><div className="h-full grad-icon rounded-full" style={{ width: '94%' }} /></div>
              <p className="text-[11px] text-text-muted mt-2 leading-relaxed">7yr senior backend at Stripe · payments infra · Go + Rust · open to remote · responded within 4h on first touch.</p>
            </div>

            <div className="bg-white rounded-2xl p-4 mb-4" style={{ border: '1px solid #ECECEC' }}>
              <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-3">Engagement</h4>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex items-center justify-between"><span className="text-text-secondary"><i className="fa-solid fa-envelope-open w-4 text-text-muted" /> Opens</span><span className="font-bold">3</span></div>
                <div className="flex items-center justify-between"><span className="text-text-secondary"><i className="fa-solid fa-comment-dots w-4 text-text-muted" /> Replies</span><span className="font-bold text-success">1</span></div>
                <div className="flex items-center justify-between"><span className="text-text-secondary"><i className="fa-solid fa-clock w-4 text-text-muted" /> Avg response</span><span className="font-bold">4h 12m</span></div>
                <div className="flex items-center justify-between"><span className="text-text-secondary"><i className="fa-solid fa-calendar w-4 text-text-muted" /> Interview</span><span className="font-bold text-success">Thu 2:30 PT</span></div>
              </div>
            </div>

            <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg,rgba(16,185,129,.06),rgba(12,92,244,.04) 70%,transparent)', border: '1px solid rgba(16,185,129,.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md grad-recruiter flex items-center justify-center text-white text-[10px]"><i className="fa-solid fa-user-tie" /></div>
                <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-success">Recruiter on this thread</h4>
              </div>
              <ul className="space-y-1.5 text-[11.5px] text-text-secondary">
                <li className="flex items-start gap-1.5"><i className="fa-solid fa-circle-check text-success text-[9px] mt-1" /><span>Auto-sent the calendar invite</span></li>
                <li className="flex items-start gap-1.5"><i className="fa-solid fa-circle-check text-success text-[9px] mt-1" /><span>Drafted role context follow-up — awaiting your send</span></li>
                <li className="flex items-start gap-1.5"><i className="fa-regular fa-circle text-text-muted text-[9px] mt-1" /><span>Will draft submittal to Marcus after interview</span></li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      <button className="rex-fab" title="Ask REX (⌘K)" aria-label="Open REX">
        <i className="fa-solid fa-wand-magic-sparkles" />
      </button>
    </div>
  );
}

/**
 * Skills strip rendered inline in the message thread. Wires the Recruiter's
 * reply_handler to the last inbound message (so the held draft includes the
 * original text REX is responding to) plus outreach_writer + submittal_drafter
 * for switching gears mid-thread.
 */
function InboxSkillsBar({
  lead,
  lastInboundText,
}: {
  lead: { firstName?: string; lastName?: string; title?: string; company?: string };
  lastInboundText?: string;
}) {
  const { agents } = useAgents();
  const recruiter = findAgentByRole(agents, 'recruiter');

  if (!recruiter) {
    return <RexSkillsHireCTA message="Hire a Recruiter to draft replies, outreach, and submittals from inside this thread." />;
  }

  const skills: SkillButtonSpec[] = [];
  const has = (id: string) => recruiter.skills?.some((s) => s.skill_id === id);

  if (has('reply_handler') && lastInboundText) {
    skills.push({
      agentId: recruiter.id, skillId: 'reply_handler',
      label: 'Draft reply', icon: 'comments', cost: 'held → review',
      input: { lead, original_text: lastInboundText, score: 90 },
    });
  }
  if (has('outreach_writer')) {
    skills.push({
      agentId: recruiter.id, skillId: 'outreach_writer',
      label: 'Draft fresh outreach', icon: 'paper-plane', cost: 'held → review',
      input: {
        lead: { first_name: lead.firstName, last_name: lead.lastName, title: lead.title, company: lead.company },
        jobTitle: 'Senior role',
      },
    });
  }
  if (has('submittal_drafter')) {
    skills.push({
      agentId: recruiter.id, skillId: 'submittal_drafter',
      label: 'Draft submittal', icon: 'file-lines', cost: 'always held',
      input: {
        candidate: { first_name: lead.firstName, last_name: lead.lastName, title: lead.title, company: lead.company },
        job: { title: 'Senior role' },
      },
    });
  }

  if (!skills.length) return null;

  return (
    <RexSkillButtons
      skills={skills}
      title="Recruiter Skills"
      subtitle="run on this thread"
      compact
    />
  );
}
