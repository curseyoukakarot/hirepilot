import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EventKind,
  EventRecord,
  MOCK_EVENTS,
  eventMargin,
  formatMoney,
  totalInKindValue,
} from './mockData';

type Filter = 'all' | EventKind;

const STATUS_STYLES: Record<EventRecord['status'], string> = {
  draft: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
  planning: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
  live: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  closed: 'bg-slate-500/10 border-slate-500/20 text-slate-300',
};

function MarginBar({ revenue, costs }: { revenue: number; costs: number }) {
  if (revenue <= 0 && costs <= 0) {
    return <div className="h-2 w-full rounded-full bg-white/10" />;
  }
  const total = Math.max(revenue, costs);
  const revPct = total > 0 ? Math.min(100, (revenue / total) * 100) : 0;
  const costPct = total > 0 ? Math.min(100, (costs / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-400">
        <span>Revenue</span>
        <span>Costs</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-500"
          style={{ width: `${revPct}%` }}
        />
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-400 to-rose-500"
          style={{ width: `${costPct}%` }}
        />
      </div>
    </div>
  );
}

export default function EventsHubPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return MOCK_EVENTS.filter((event) => {
      if (filter !== 'all' && event.kind !== filter) return false;
      if (search.trim()) {
        const needle = search.trim().toLowerCase();
        const haystack = [event.name, event.city, event.venue, event.clientName || '']
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [filter, search]);

  const portfolioTotals = useMemo(() => {
    const all = MOCK_EVENTS.reduce(
      (acc, event) => {
        const margin = eventMargin(event);
        acc.revenue += margin.revenue;
        acc.costs += margin.costs;
        acc.inKind += totalInKindValue(event);
        if (event.kind === 'internal') acc.internal += 1;
        if (event.kind === 'external') acc.external += 1;
        return acc;
      },
      { revenue: 0, costs: 0, inKind: 0, internal: 0, external: 0 }
    );
    return { ...all, margin: all.revenue - all.costs };
  }, []);

  const draftEvents = filtered.filter((event) => event.status === 'draft' || event.status === 'planning');
  const liveEvents = filtered.filter((event) => event.status === 'live');
  const closedEvents = filtered.filter((event) => event.status === 'closed');

  return (
    <div className="min-h-full rounded-2xl bg-gradient-to-br from-[#060609] via-[#0a0a0f] to-[#060609] text-white">
      <header className="sticky top-0 z-10 rounded-t-2xl border-b border-white/10 bg-gradient-to-r from-purple-900/20 via-pink-900/20 to-blue-900/20 px-8 py-6 backdrop-blur-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-3xl font-bold text-transparent">
              Events
            </h1>
            <p className="text-gray-400">
              Plan, track, and reconcile internal events &amp; client engagements with full P&amp;L visibility.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/ignite/events/new')}
              className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold shadow-lg shadow-purple-500/25 transition-all hover:from-purple-500 hover:to-pink-500"
            >
              <i className="fa-solid fa-plus mr-2" />
              Create Event
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <PortfolioStat label="Cash Sponsorship" value={formatMoney(portfolioTotals.revenue)} accent="emerald" />
          <PortfolioStat label="Total Costs" value={formatMoney(portfolioTotals.costs)} accent="rose" />
          <PortfolioStat
            label="Net Margin"
            value={formatMoney(portfolioTotals.margin)}
            accent={portfolioTotals.margin >= 0 ? 'emerald' : 'rose'}
          />
          <PortfolioStat
            label="Active Events"
            value={`${portfolioTotals.internal} internal · ${portfolioTotals.external} client`}
            accent="purple"
          />
        </div>
      </header>

      <div className="space-y-8 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 p-1">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'internal', label: 'Internal' },
                { id: 'external', label: 'Client (External)' },
              ] as Array<{ id: Filter; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  filter === tab.id
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/30'
                    : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-xs">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by event, venue, city..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
            />
          </div>
        </div>

        <Section title="Live & Upcoming" badge={liveEvents.length}>
          <CardGrid events={liveEvents} onOpen={(id) => navigate(`/ignite/events/${id}`)} />
        </Section>

        <Section title="Drafts & Planning" badge={draftEvents.length}>
          <CardGrid events={draftEvents} onOpen={(id) => navigate(`/ignite/events/${id}`)} />
        </Section>

        <Section title="Closed" badge={closedEvents.length}>
          <CardGrid events={closedEvents} onOpen={(id) => navigate(`/ignite/events/${id}`)} dense />
        </Section>
      </div>
    </div>
  );
}

function PortfolioStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'emerald' | 'rose' | 'purple';
}) {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-300'
      : accent === 'rose'
      ? 'text-rose-300'
      : 'text-purple-300';
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accentClass}`}>{value}</p>
    </div>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-xl font-bold">{title}</h2>
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-medium text-gray-300">
          {badge}
        </span>
      </div>
      {children}
    </section>
  );
}

function CardGrid({
  events,
  onOpen,
  dense = false,
}: {
  events: EventRecord[];
  onOpen: (id: string) => void;
  dense?: boolean;
}) {
  if (!events.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-gray-400">
        Nothing here yet.
      </div>
    );
  }
  return (
    <div className={`grid gap-5 ${dense ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
      {events.map((event) => (
        <EventCard key={event.id} event={event} onOpen={() => onOpen(event.id)} />
      ))}
    </div>
  );
}

function EventCard({ event, onOpen }: { event: EventRecord; onOpen: () => void }) {
  const margin = eventMargin(event);
  const inKind = totalInKindValue(event);
  const marginColor =
    margin.margin > 0 ? 'text-emerald-300' : margin.margin < 0 ? 'text-rose-300' : 'text-gray-300';
  return (
    <article
      onClick={onOpen}
      className="group cursor-pointer rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl transition-all hover:border-purple-500/30 hover:shadow-xl hover:shadow-purple-500/10"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLES[event.status]}`}
          >
            {event.status}
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              event.kind === 'internal'
                ? 'border-purple-400/30 bg-purple-500/10 text-purple-200'
                : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200'
            }`}
          >
            {event.kind === 'internal' ? 'Internal' : 'Client'}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-gray-400 transition-all hover:bg-white/10 hover:text-white"
          title="Open"
        >
          <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
        </button>
      </div>

      <h3 className="mb-1 text-lg font-bold transition-colors group-hover:text-purple-300">
        {event.name}
      </h3>
      <p className="mb-4 text-sm font-medium text-purple-300">
        {event.kind === 'external' && event.clientName ? event.clientName : 'Hosted by Ignite'}
      </p>

      <div className="mb-5 grid grid-cols-2 gap-2 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-calendar w-4" />
          <span>{event.startDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-location-dot w-4" />
          <span className="truncate">{event.city}</span>
        </div>
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-users w-4" />
          <span>{event.headcount.toLocaleString()} attendees</span>
        </div>
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-user-tie w-4" />
          <span className="truncate">{event.ownerName}</span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Revenue</p>
          <p className="text-sm font-semibold text-emerald-300">{formatMoney(margin.revenue)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Costs</p>
          <p className="text-sm font-semibold text-rose-300">{formatMoney(margin.costs)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Margin</p>
          <p className={`text-sm font-semibold ${marginColor}`}>
            {formatMoney(margin.margin)}{' '}
            <span className="text-xs text-gray-500">({margin.marginPct.toFixed(0)}%)</span>
          </p>
        </div>
      </div>

      <MarginBar revenue={margin.revenue} costs={margin.costs} />

      {inKind > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          <i className="fa-solid fa-handshake mr-1.5 text-cyan-300" />
          {formatMoney(inKind)} in-kind value
        </p>
      )}
    </article>
  );
}
