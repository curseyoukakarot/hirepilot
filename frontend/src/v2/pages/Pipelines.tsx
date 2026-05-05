/**
 * v2 / Pipelines — ATS kanban
 *
 * HTML preserved EXACTLY from mockups/pipelines.html main content block.
 * Multi-pane: workspace sidebar | jobs sidebar | main pane (job header + kanban).
 *
 * TODO wire to backend:
 *   - GET /api/v2/pipelines (job_requisitions with stage counts)
 *   - GET /api/v2/pipelines/:id (job + candidate_jobs joined to candidates)
 *   - PATCH /api/v2/pipelines/:jobId/candidates/:candidateId { stage_id }
 *   - REX context strip → which candidates are ready to advance (from goals/decisions)
 */

import React, { useEffect } from 'react';
import WorkspaceSidebar from '../components/WorkspaceSidebar';
import '../../styles/v2.css';

interface JobReq {
  active?: boolean;
  title: string;
  due?: string;
  company: string;
  age: string;
  inFlight: number;
  next: { count: number; label: string; cls: string };
}

const JOBS: JobReq[] = [
  { active: true, title: 'Senior Backend Engineer', due: 'Due Fri', company: 'Linear', age: 'opened 14 days ago', inFlight: 12, next: { count: 3, label: 'offer', cls: 'text-success' } },
  { title: 'Sr Product Designer', company: 'Figma', age: 'opened 8 days ago', inFlight: 8, next: { count: 1, label: 'offer', cls: 'text-success' } },
  { title: 'ML Engineer', due: 'Due Fri', company: 'Anthropic', age: 'opened 21 days ago', inFlight: 9, next: { count: 2, label: 'screen', cls: '' } },
  { title: 'Frontend Lead', company: 'Vercel', age: 'opened 5 days ago', inFlight: 14, next: { count: 2, label: 'offer', cls: 'text-success' } },
  { title: 'Sales Rep – SF', company: 'Stripe', age: 'opened 11 days ago', inFlight: 19, next: { count: 3, label: 'screen', cls: '' } },
];

interface Card {
  initials: string;
  avBg: string;
  name: string;
  meta: string;
  score?: number;
  scoreCls?: 'hot' | 'warm' | 'cold';
  ringHot?: boolean;
  flag?: 'advance' | 'flag' | 'rex' | null;
  body?: React.ReactNode;
  footer?: React.ReactNode;
}

const cardClass = (flag?: string) => {
  const base = 'bg-white border rounded-[11px] p-2.5 cursor-pointer transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-px';
  if (flag === 'advance') return `${base}`; // styled below
  return base;
};
const cardStyle = (flag?: string): React.CSSProperties => {
  if (flag === 'advance') {
    return { borderLeft: '3px solid #10B981', background: 'linear-gradient(90deg,rgba(16,185,129,.04),white 30%)', borderColor: '#ECECEC' };
  }
  if (flag === 'flag') {
    return { borderLeft: '3px solid #F59E0B', background: 'linear-gradient(90deg,rgba(245,158,11,.04),white 30%)', borderColor: '#ECECEC' };
  }
  if (flag === 'rex') {
    return { borderLeft: '3px solid #6B46C1', background: 'linear-gradient(90deg,rgba(107,70,193,.04),white 30%)', borderColor: '#ECECEC' };
  }
  return { borderColor: '#ECECEC' };
};

export default function PipelinesPage() {
  useEffect(() => {
    document.body.classList.add('v2-app', 'autopilot');
    return () => { document.body.classList.remove('v2-app', 'autopilot'); };
  }, []);

  return (
    <div className="v2-app autopilot flex min-h-screen relative z-10">
      <WorkspaceSidebar />

      {/* Jobs list sidebar */}
      <aside className="w-[240px] shrink-0 border-r border-gray-100 bg-white/40 h-screen sticky top-0 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="nav-section-h !p-0">Open requisitions · 5</span>
          <button className="w-5 h-5 rounded hover:bg-surface flex items-center justify-center text-text-muted"><i className="fa-solid fa-plus text-[10px]" /></button>
        </div>

        <ul className="space-y-1">
          {JOBS.map((j) => (
            <li key={j.title} className={`rounded-md p-2.5 cursor-pointer ${j.active ? 'border-l-2' : 'border-l-2 border-transparent text-text-secondary hover:bg-surface'}`} style={j.active ? { background: 'rgba(245,158,11,.08)', color: '#B45309', fontWeight: 600, borderLeftColor: '#F59E0B' } : undefined}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12.5px] font-semibold truncate">{j.title}</span>
                {j.due && <span className="tag tag-warn">{j.due}</span>}
              </div>
              <div className="text-[10.5px] text-text-muted mb-2">{j.company} · {j.age}</div>
              <div className="flex items-center gap-3 text-[10.5px]">
                <span className="inline-flex items-baseline gap-1"><span className="font-bold tabular-nums" style={{ color: '#1A1A2E' }}>{j.inFlight}</span><span className="text-text-muted text-[10.5px]">in flight</span></span>
                <span className="inline-flex items-baseline gap-1"><span className={`font-bold tabular-nums ${j.next.cls}`}>{j.next.count}</span><span className="text-text-muted text-[10.5px]">{j.next.label}</span></span>
              </div>
            </li>
          ))}
        </ul>

        <button className="w-full mt-3 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] text-text-muted hover:border-primary/30 hover:text-primary" style={{ border: '1px dashed #E5E7EB' }}>
          <i className="fa-solid fa-plus text-[10px]" />New requisition
        </button>

        <div className="mt-5">
          <div className="mb-2 px-1"><span className="nav-section-h !p-0">Closed · last 30d</span></div>
          <ul className="space-y-px text-[12.5px]">
            <li><a href="#" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface text-text-muted"><i className="fa-solid fa-circle-check text-success text-[9px]" /><span className="flex-1 truncate">ML researcher · Anthropic</span></a></li>
            <li><a href="#" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface text-text-muted"><i className="fa-solid fa-circle-check text-success text-[9px]" /><span className="flex-1 truncate">DevRel · Vercel</span></a></li>
          </ul>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-gray-100 px-7 h-14 glass flex items-center gap-4 sticky top-0 z-30">
          <div>
            <div className="font-semibold text-[14.5px] flex items-center gap-2"><i className="fa-solid fa-table-columns text-warn text-xs" />Pipelines</div>
            <div className="text-[10.5px] text-text-muted">5 open reqs · 62 candidates in flight</div>
          </div>
          <div className="status-pill ml-3">
            <span className="ping-wrap" />
            <i className="fa-solid fa-wand-magic-sparkles text-primary text-[10px]" />
            <span>watching <span className="font-semibold text-text-main">12 candidates</span></span>
            <span className="text-text-muted">·</span>
            <span className="text-primary font-bold">3 ready to advance</span>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <button className="trust-badge"><i className="fa-solid fa-rocket text-[10px]" />Autopilot<i className="fa-solid fa-chevron-down text-[9px] opacity-80" /></button>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 ring-2 ring-white" />
          </div>
        </header>

        {/* Job header */}
        <div className="px-7 py-4 border-b border-gray-100 flex items-start gap-4 float-in d-1">
          <div className="w-12 h-12 rounded-xl grad-warm flex items-center justify-center text-white shadow-md shrink-0" style={{ boxShadow: '0 6px 14px -4px rgba(245,158,11,.25)' }}><i className="fa-solid fa-briefcase text-base" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[20px] font-bold tracking-tight">Senior Backend Engineer</h2>
              <span className="tag tag-warn">Due Friday</span>
              <span className="text-[12px] text-text-muted">·</span>
              <span className="text-[12px] text-text-muted">Linear · $190–230k · Remote OK</span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-[12px] text-text-muted">
              <span><i className="fa-regular fa-clock text-[10px] mr-1" />Opened 14 days ago</span>
              <span>·</span>
              <span>Hiring manager: Marcus Rodriguez (VP Eng)</span>
              <span>·</span>
              <span><i className="fa-solid fa-users text-[10px] mr-1" />2 collaborators</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="ghost-btn"><i className="fa-regular fa-file-lines text-[11px]" />JD</button>
            <button className="ghost-btn"><i className="fa-solid fa-share-nodes text-[11px]" />Public link</button>
            <button className="ghost-btn"><i className="fa-solid fa-sliders text-[11px]" />Settings</button>
            <button className="btn-solid"><i className="fa-solid fa-plus text-[10px]" />Add candidate</button>
          </div>
        </div>

        {/* REX context */}
        <div className="px-7 pt-4 pb-1 float-in d-2">
          <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'linear-gradient(90deg,rgba(107,70,193,.05),rgba(12,92,244,.03) 70%,transparent)', border: '1px solid rgba(107,70,193,.12)' }}>
            <div className="w-7 h-7 rounded-md grad-icon flex items-center justify-center text-white shrink-0 shadow-sm"><i className="fa-solid fa-wand-magic-sparkles text-[11px]" /></div>
            <div className="flex-1 text-[13px]">
              <span className="font-semibold">REX:</span>
              <span className="text-text-secondary"> 3 candidates are ready to advance — </span>
              <span className="font-semibold">Sarah Chen (replied · Hot)</span>,
              <span className="font-semibold"> Jamal Williams (Phone Screen → Interview, 5d)</span>,
              <span className="font-semibold"> Aisha Okafor (Interview → Offer, hiring manager said yes).</span>
              <span className="text-primary font-semibold ml-1">Advance all 3?</span>
            </div>
            <button className="btn-solid !py-1 !px-2.5 !text-[11.5px]"><i className="fa-solid fa-arrow-right text-[9px]" />Advance 3</button>
            <button className="ghost-btn !text-[11.5px]">Review individually</button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="px-7 py-3 flex items-center gap-1.5 flex-wrap">
          <span className="px-3 py-1 rounded-full bg-primary text-white text-[11.5px] font-semibold">All · 12</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[11.5px] text-text-secondary">Hot · 3</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[11.5px] text-text-secondary">Stuck &gt; 5d · 2</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[11.5px] text-text-secondary">Mine · 8</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[11.5px] text-text-secondary">+ Filter</span>
          <div className="ml-auto flex items-center gap-1.5 text-[11.5px] text-text-muted">
            <span>Time-to-hire avg: <span className="font-semibold text-text-main">23 days</span></span>
            <span>·</span>
            <span>SLA: <span className="font-semibold text-success">on track</span></span>
          </div>
        </div>

        {/* Kanban board */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-7 pb-6">
          <div className="flex gap-3 h-full">
            {[
              { stripe: 'bg-text-muted/40', name: 'Sourced', count: 142, cards: [
                { initials: 'SC', avBg: 'from-emerald-400 to-emerald-600', name: 'Sarah Chen', meta: 'Stripe · Senior Backend', score: 94, scoreCls: 'hot', sub: 'Sourced via Sniper · 1d ago' } as any,
                { initials: 'EK', avBg: 'from-rose-400 to-pink-600', name: 'Emily Kovacs', meta: 'Notion · Director Eng', score: 96, scoreCls: 'hot', sub: 'Sourced via Apollo · 2d ago' } as any,
                { textOnly: '+ 140 more' } as any,
              ] },
              { stripe: 'bg-secondary/40', name: 'Outreach', count: '7 · auto-running', cards: [
                { initials: 'MR', avBg: 'from-blue-400 to-blue-600', name: 'Marcus Rodriguez', meta: 'Linear · Staff Eng', score: 87, scoreCls: 'warm', flag: 'rex', sub: 'Step 2 of 3 · 3d ago', subIcon: 'fa-paper-plane', rexNote: 'REX: comp question · awaiting you' } as any,
                { initials: 'DT', avBg: 'from-cyan-400 to-blue-500', name: 'Devin Tran', meta: 'Anthropic · ML Eng', score: 88, scoreCls: 'warm', sub: 'Opened · 4h ago', subIcon: 'fa-envelope-open' } as any,
                { initials: 'RH', avBg: 'from-amber-400 to-orange-500', name: 'Rohan Mehta', meta: 'Datadog · Sr Backend', score: 76, scoreCls: 'cold', sub: 'Step 1 of 3 · 1d ago', subIcon: 'fa-paper-plane' } as any,
                { textOnly: '+ 4 more' } as any,
              ] },
              { stripe: 'bg-success/40', name: 'Reply', count: 3, countCls: 'text-success font-bold', cards: [
                { initials: 'SC', avBg: 'from-emerald-400 to-emerald-600', name: <>Sarah Chen <i className="fa-solid fa-fire text-warn text-[9px] inline-block ml-0.5" /></>, meta: 'Stripe · Senior Backend', score: 94, scoreCls: 'hot', flag: 'advance', ring: true, quote: '"Yes, I\'d love to chat — Thursday after 2pm works."', footer: <><i className="fa-solid fa-circle-check text-success text-[9px]" /><span className="text-[10.5px] text-success">Calendar invite auto-sent</span></> } as any,
                { initials: 'AO', avBg: 'from-violet-400 to-purple-600', name: 'Aisha Okafor', meta: 'Replit · Eng Manager', score: 93, scoreCls: 'hot', flag: 'advance', quote: '"Open to learning more — let\'s set a chat next week."', sub: '5h in stage', age: 'warn' } as any,
                { initials: 'JW', avBg: 'from-purple-400 to-purple-700', name: 'Jamal Williams', meta: 'Vercel · Backend', score: 82, scoreCls: 'warm', sub: 'Replied · 2d ago', subIcon: 'fa-comment-dots' } as any,
              ] },
              { stripe: 'bg-primary/40', name: 'Phone Screen', count: 2, cards: [
                { initials: 'JW', avBg: 'from-purple-400 to-purple-700', name: 'Jamal Williams', meta: 'Vercel · Backend', score: 82, scoreCls: 'warm', flag: 'flag', sub: 'Screen done · 2d ago', subIcon: 'fa-phone', age: 'warn', advance: true } as any,
                { initials: 'PP', avBg: 'from-amber-400 to-orange-500', name: 'Priya Patel', meta: 'Figma · Sr Designer', score: 91, scoreCls: 'hot', sub: 'Scheduled · Thu 3pm', subIcon: 'fa-calendar' } as any,
              ] },
              { stripe: 'bg-warn/40', name: 'Interview', count: 2, cards: [
                { initials: 'AO', avBg: 'from-violet-400 to-purple-600', name: 'Aisha Okafor', meta: 'Replit · Eng Manager', score: 93, scoreCls: 'hot', flag: 'advance', sub: <span><span className="text-text-secondary">Hiring manager: <strong>strong yes</strong></span></span>, subIcon: 'fa-regular fa-thumbs-up text-success', rexNote: 'REX: ready for offer · advance?' } as any,
                { initials: 'DT', avBg: 'from-cyan-400 to-blue-500', name: 'Devin Tran', meta: 'Anthropic · ML Eng', score: 88, scoreCls: 'warm', sub: 'Tech interview · Mon', subIcon: 'fa-calendar' } as any,
              ] },
              { stripe: 'grad-success', name: 'Offer', count: 3, countCls: 'text-success font-bold', cards: [
                { initials: 'SC', avBg: 'from-emerald-400 to-emerald-600', name: 'Sarah Chen', meta: '$210k base · 0.08% equity', tag: { label: 'Verbal', cls: 'tag-success' }, sub: 'Sent · 1d ago', subIcon: 'fa-regular fa-clock' } as any,
                { initials: 'CL', avBg: 'from-blue-400 to-blue-600', name: 'Claire Liu', meta: '$220k base', tag: { label: 'Counter', cls: 'tag-warn' } } as any,
              ] },
              { stripe: 'bg-success', name: 'Hired', count: 1, countCls: 'text-success font-bold', collapsed: true, cards: [
                { initials: 'RT', avBg: 'from-emerald-400 to-emerald-600', name: 'Riya Thapa', meta: 'Started May 1', flag: 'advance', tail: <i className="fa-solid fa-circle-check text-success text-[12px]" /> } as any,
              ] },
            ].map((col, ci) => (
              <div key={col.name} className={`flex flex-col rounded-[14px] border min-w-[248px] max-w-[248px] h-full float-in d-${3 + ci} ${col.collapsed ? 'opacity-70' : ''}`} style={{ background: 'rgba(244,244,248,.55)', borderColor: '#ECECEC' }}>
                <div className="px-3 py-2.5 border-b" style={{ borderColor: '#ECECEC' }}>
                  <div className={`h-[3px] mb-2 rounded-full ${col.stripe}`} />
                  <div className="flex items-center justify-between"><span className="text-[12px] font-bold">{col.name}</span><span className={`text-[10.5px] text-text-muted ${col.countCls || ''}`}>{col.count}</span></div>
                </div>
                <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
                  {col.cards.map((c: any, i: number) => {
                    if (c.textOnly) return <div key={i} className="text-center mt-1"><button className="text-[10.5px] text-text-muted hover:text-primary">{c.textOnly}</button></div>;
                    return (
                      <div key={i} className={cardClass(c.flag)} style={cardStyle(c.flag)}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${c.avBg} flex items-center justify-center text-white text-[10px] font-semibold ${c.ring ? 'ring-2 ring-success/30' : ''}`}>{c.initials}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[12.5px] truncate flex items-center gap-1">{c.name}</div>
                            <div className="text-[10.5px] text-text-muted truncate">{c.meta}</div>
                          </div>
                          {c.score && <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${c.scoreCls === 'hot' ? 'text-success' : c.scoreCls === 'warm' ? 'text-warn' : 'text-text-muted'}`} style={{ background: c.scoreCls === 'hot' ? 'rgba(16,185,129,.1)' : c.scoreCls === 'warm' ? 'rgba(245,158,11,.1)' : '#F4F4F8' }}>{c.score}</span>}
                          {c.tag && <span className={`tag ${c.tag.cls}`}>{c.tag.label}</span>}
                          {c.tail}
                        </div>
                        {c.quote && <div className="text-[10.5px] text-text-secondary italic mb-1.5 line-clamp-2">{c.quote}</div>}
                        {c.sub && (
                          <div className="flex items-center gap-2 text-[10.5px] mb-1">
                            {c.subIcon && <i className={`fa-solid ${c.subIcon} text-text-muted`} />}
                            <span className="text-text-muted">{c.sub}</span>
                          </div>
                        )}
                        {c.age && <div className="h-[2px] rounded-full bg-gray-200 overflow-hidden mt-1.5"><div className="h-full bg-warn" style={{ width: c.age === 'warn' ? '64%' : '100%' }} /></div>}
                        {c.advance && <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-gray-100"><span className="text-[10px] text-warn font-semibold">5d in stage</span><span className="text-[10px] text-text-muted">→ Interview</span></div>}
                        {c.footer && <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center gap-1.5">{c.footer}</div>}
                        {c.rexNote && (
                          <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center gap-1.5">
                            <i className="fa-solid fa-wand-magic-sparkles text-primary text-[9px]" />
                            <span className="text-[10.5px] text-text-secondary">{c.rexNote}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <button className="rex-fab" title="Ask REX (⌘K)" aria-label="Open REX">
        <i className="fa-solid fa-wand-magic-sparkles" />
      </button>
    </div>
  );
}
