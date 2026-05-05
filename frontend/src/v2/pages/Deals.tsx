/**
 * v2 / Deals — sales CRM kanban
 *
 * HTML preserved EXACTLY from mockups/deals.html main content block.
 *
 * TODO wire to backend:
 *   - GET /api/v2/deals (opportunities table, scoped via teamDealsScope)
 *   - PATCH /api/v2/deals/:id { stage, value }
 *   - REX context strip → stale deals (days_in_stage > threshold)
 *   - Stripe Connect close-loop → existing services/stripe.ts
 */

import React, { useEffect } from 'react';
import WorkspaceSidebar from '../components/WorkspaceSidebar';
import '../../styles/v2.css';

interface DealCard {
  title: string;
  tag?: { label: string; cls: string };
  meta: string;
  contact: { initials: string; av: string; label: string };
  value: string;
  valueCls?: string;
  age: string;
  ageCls?: string;
  ageBar?: { width: string; cls: string };
  flag?: 'flag' | 'win' | 'rex';
  rexNote?: React.ReactNode;
}

interface Stage {
  name: string;
  count: number;
  total: string;
  totalCls?: string;
  stripeCls: string;
  cards: DealCard[];
}

const STAGES: Stage[] = [
  {
    name: 'Lead',
    count: 2,
    total: '$32k',
    stripeCls: 'bg-text-muted/40',
    cards: [
      { title: 'Notion · Series C eng team', meta: 'Mid-level backend · 3 hires', contact: { initials: 'EK', av: 'from-rose-400 to-pink-600', label: 'Emily Kovacs' }, value: '$22k', age: '2d in stage' },
      { title: 'Replit · Eng manager search', meta: 'Engineering Manager · 1 hire', contact: { initials: 'AO', av: 'from-violet-400 to-purple-600', label: 'Aisha Okafor' }, value: '$10k', age: '5d in stage' },
    ],
  },
  {
    name: 'Qualified',
    count: 1,
    total: '$28k',
    stripeCls: 'bg-secondary/40',
    cards: [
      { title: 'Linear · Q2 senior eng retainer', tag: { label: 'Retainer', cls: 'tag-secondary' }, meta: 'Senior Backend · 2 hires', contact: { initials: 'MR', av: 'from-blue-400 to-blue-600', label: 'Marcus Rodriguez (VP Eng)' }, value: '$28k', valueCls: 'text-text-secondary', age: '7d in stage', ageBar: { width: '35%', cls: '' } },
    ],
  },
  {
    name: 'Proposal',
    count: 1,
    total: '$12k',
    stripeCls: 'bg-warn/40',
    cards: [
      { title: 'Figma · Designer search', tag: { label: 'Stale 9d', cls: 'tag-warn' }, meta: 'Sr Product Designer · 1 hire · scope undefined', contact: { initials: 'PP', av: 'from-amber-400 to-orange-500', label: 'Priya Patel' }, value: '$12k', age: '9d in stage', ageCls: 'text-warn font-semibold', ageBar: { width: '64%', cls: 'bg-warn' }, flag: 'flag', rexNote: 'REX: scope is missing — draft a clarifying note?' },
    ],
  },
  {
    name: 'Negotiating',
    count: 2,
    total: '$90k',
    stripeCls: 'bg-warn/40',
    cards: [
      { title: 'Stripe · Senior Backend placement', tag: { label: 'Hot', cls: 'tag-success' }, meta: 'Sarah Chen · Sr Backend Eng · placement fee 25% of base', contact: { initials: 'SC', av: 'from-emerald-400 to-emerald-600', label: 'candidate placed' }, value: '$45k', valueCls: 'text-success', age: '18d in stage', ageCls: 'text-warn font-semibold', ageBar: { width: '90%', cls: 'bg-danger' }, flag: 'flag', rexNote: <>REX: silent 5d — draft nudge to <strong>James (Stripe TA)</strong>?</> },
      { title: 'Linear · ML hire', meta: 'Devin Tran · ML Engineer · finalizing offer', contact: { initials: 'DT', av: 'from-cyan-400 to-blue-500', label: 'candidate placed' }, value: '$45k', valueCls: 'text-success', age: '3d in stage' },
    ],
  },
  {
    name: 'Closing',
    count: 1,
    total: '$77k',
    stripeCls: 'bg-primary/40',
    cards: [
      { title: 'Vercel · Frontend lead', tag: { label: 'REX', cls: 'tag-primary' }, meta: 'Jamal Williams · offer accepted · contract sent', contact: { initials: 'JW', av: 'from-purple-400 to-purple-700', label: 'candidate placed' }, value: '$77k', valueCls: 'text-success', age: '2d in stage', flag: 'rex', rexNote: 'REX: Stripe invoice ready · auto-send on contract sign?' },
    ],
  },
  {
    name: 'Won (May)',
    count: 1,
    total: '$45k',
    totalCls: 'text-success font-bold',
    stripeCls: 'bg-success/40',
    cards: [
      { title: 'Anthropic · ML researcher', tag: { label: 'Won', cls: 'tag-success' }, meta: 'Closed May 1 · invoice paid', contact: { initials: '', av: '', label: '' }, value: '$45k', valueCls: 'text-success', age: 'via Stripe', flag: 'win', rexNote: <span className="text-success"><i className="fa-solid fa-circle-check mr-1" />Auto-paid · 2d ago</span> },
    ],
  },
];

const flagBg = (f?: string) => {
  if (f === 'flag') return { borderLeft: '3px solid #F59E0B', background: 'linear-gradient(90deg,rgba(245,158,11,.04),white 30%)' };
  if (f === 'win') return { borderLeft: '3px solid #10B981', background: 'linear-gradient(90deg,rgba(16,185,129,.04),white 30%)' };
  if (f === 'rex') return { borderLeft: '3px solid #6B46C1', background: 'linear-gradient(90deg,rgba(107,70,193,.04),white 30%)' };
  return undefined;
};

export default function DealsPage() {
  useEffect(() => {
    document.body.classList.add('v2-app', 'autopilot');
    return () => { document.body.classList.remove('v2-app', 'autopilot'); };
  }, []);

  return (
    <div className="v2-app autopilot flex min-h-screen relative z-10">
      <WorkspaceSidebar />

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-gray-100 px-7 h-14 glass flex items-center gap-4 sticky top-0 z-30">
          <div>
            <div className="font-semibold text-[14.5px] flex items-center gap-2"><i className="fa-solid fa-handshake text-success text-xs" />Deals</div>
            <div className="text-[10.5px] text-text-muted">CRM · client engagements + placements</div>
          </div>
          <div className="status-pill ml-3">
            <span className="ping-wrap" style={{ background: '#10B981' } as any} />
            <i className="fa-solid fa-wand-magic-sparkles text-success text-[10px]" />
            <span>watching <span className="font-semibold text-text-main">7 deals</span></span>
            <span className="text-text-muted">·</span>
            <span className="text-success font-bold">3 stuck</span>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <button className="trust-badge"><i className="fa-solid fa-rocket text-[10px]" />Autopilot<i className="fa-solid fa-chevron-down text-[9px] opacity-80" /></button>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 ring-2 ring-white" />
          </div>
        </header>

        {/* Money strip */}
        <div className="px-7 py-4 border-b border-gray-100 flex items-center gap-7 flex-wrap float-in d-1" style={{ background: 'linear-gradient(90deg,rgba(16,185,129,.03),rgba(12,92,244,.02) 50%,transparent)' }}>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider font-bold text-text-muted">Total pipeline</div>
            <div className="text-[22px] font-extrabold tracking-tight" style={{ background: 'linear-gradient(135deg,#10B981,#0C5CF4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>$284,500</div>
          </div>
          <div className="w-px h-10 bg-gray-200" />
          <div>
            <div className="text-[10.5px] uppercase tracking-wider font-bold text-text-muted">Commit</div>
            <div className="text-[22px] font-extrabold text-success">$92,000</div>
          </div>
          <div className="w-px h-10 bg-gray-200" />
          <div>
            <div className="text-[10.5px] uppercase tracking-wider font-bold text-text-muted">Best case</div>
            <div className="text-[22px] font-extrabold">$162,000</div>
          </div>
          <div className="w-px h-10 bg-gray-200" />
          <div>
            <div className="text-[10.5px] uppercase tracking-wider font-bold text-text-muted">Closed (May)</div>
            <div className="text-[22px] font-extrabold text-success">$45,000 <span className="text-[12px] text-text-muted font-medium">/ $80k goal</span></div>
            <div className="h-1.5 bg-surface rounded-full overflow-hidden mt-1.5 w-32"><div className="h-full grad-success rounded-full" style={{ width: '56%' }} /></div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button className="ghost-btn"><i className="fa-solid fa-filter text-[10px]" />Filter</button>
            <button className="ghost-btn"><i className="fa-solid fa-sliders text-[10px]" />Group: Stage</button>
            <button className="btn-outline"><i className="fa-solid fa-list text-[10px]" />List view</button>
            <button className="btn-solid"><i className="fa-solid fa-plus text-[10px]" />New deal</button>
          </div>
        </div>

        {/* REX context */}
        <div className="px-7 pt-4 pb-1 float-in d-2">
          <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'linear-gradient(90deg,rgba(107,70,193,.05),rgba(12,92,244,.03) 70%,transparent)', border: '1px solid rgba(107,70,193,.12)' }}>
            <div className="w-7 h-7 rounded-md grad-icon flex items-center justify-center text-white shrink-0 shadow-sm"><i className="fa-solid fa-wand-magic-sparkles text-[11px]" /></div>
            <div className="flex-1 text-[13px]">
              <span className="font-semibold">REX:</span>
              <span className="text-text-secondary"> 3 deals are stale — </span>
              <span className="font-semibold">Stripe placement (18d in Negotiating)</span><span className="text-text-secondary">,</span>
              <span className="font-semibold"> Linear retainer (12d, no reply)</span><span className="text-text-secondary">,</span>
              <span className="font-semibold"> Figma project (9d, missing scope).</span>
              <span className="text-primary font-semibold ml-1">Want me to draft follow-ups for all 3?</span>
            </div>
            <button className="btn-solid !py-1 !px-2.5 !text-[11.5px]"><i className="fa-solid fa-bolt text-[9px]" />Draft 3 follow-ups</button>
            <button className="ghost-btn !text-[11.5px]">Dismiss</button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="px-7 py-3 flex items-center gap-1.5 flex-wrap">
          <span className="px-3 py-1 rounded-full bg-primary text-white text-[11.5px] font-semibold">All deals · 7</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[11.5px] text-text-secondary">My deals</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[11.5px] text-text-secondary">Closing this month</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[11.5px] text-text-secondary">Stale &gt; 7d</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[11.5px] text-text-secondary">+ Filter</span>
        </div>

        {/* Kanban */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-7 pb-6">
          <div className="flex gap-3 h-full">
            {STAGES.map((stage, si) => (
              <div key={stage.name} className={`flex flex-col rounded-[14px] border min-w-[280px] max-w-[280px] h-full float-in d-${3 + si}`} style={{ background: 'rgba(244,244,248,.55)', borderColor: '#ECECEC' }}>
                <div className="px-3.5 py-3 border-b flex items-center gap-2" style={{ borderColor: '#ECECEC' }}>
                  <div className={`h-[3px] rounded-full flex-1 ${stage.stripeCls}`} />
                  <span className="text-[12px] font-bold">{stage.name}</span>
                  <span className={`text-[10.5px] text-text-muted ${stage.totalCls || ''}`}>{stage.count} · {stage.total}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
                  {stage.cards.map((c, i) => (
                    <div key={i} className="bg-white border rounded-[11px] p-2.5 px-3 cursor-pointer hover:-translate-y-px transition" style={{ borderColor: '#ECECEC', ...flagBg(c.flag) }}>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="font-semibold text-[13px] truncate">{c.title}</div>
                        {c.tag && <span className={`tag ${c.tag.cls}`}>{c.tag.label}</span>}
                      </div>
                      <div className="text-[11.5px] text-text-muted mb-2">{c.meta}</div>
                      {c.contact.initials && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${c.contact.av} flex items-center justify-center text-white text-[8px] font-semibold`}>{c.contact.initials}</div>
                          <span className="text-[11px] text-text-secondary">{c.contact.label}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className={`text-[14px] font-bold ${c.valueCls || 'text-text-secondary'}`}>{c.value}</span>
                        <span className={`text-[10px] ${c.ageCls || 'text-text-muted'}`}>{c.age}</span>
                      </div>
                      {c.ageBar && (
                        <div className="h-[2px] rounded-full bg-gray-200 overflow-hidden mt-1.5">
                          <div className={`h-full ${c.ageBar.cls || 'bg-text-muted'}`} style={{ width: c.ageBar.width }} />
                        </div>
                      )}
                      {c.rexNote && (
                        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5">
                          {c.flag === 'win' ? null : <i className="fa-solid fa-wand-magic-sparkles text-primary text-[10px]" />}
                          <span className="text-[10.5px] text-text-secondary">{c.rexNote}</span>
                        </div>
                      )}
                    </div>
                  ))}
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
