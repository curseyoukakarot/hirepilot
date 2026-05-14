import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listEvents } from './api';
import {
  EventKind,
  EventListItem,
  EventStatus,
  formatMoney,
  summaryToMargin,
} from './types';

type Filter = 'all' | EventKind;

const STATUS_STYLES: Record<EventStatus, string> = {
  draft: 'bg-amber-50 border-amber-200 text-amber-700',
  planning: 'bg-blue-50 border-blue-200 text-blue-700',
  live: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  closed: 'bg-slate-100 border-slate-200 text-slate-600',
};

const KIND_STYLES: Record<EventKind, string> = {
  internal: 'bg-purple-50 border-purple-200 text-purple-700',
  external: 'bg-cyan-50 border-cyan-200 text-cyan-700',
};

function MarginBar({ revenue, costs }: { revenue: number; costs: number }) {
  if (revenue <= 0 && costs <= 0) {
    return <div className="h-2 w-full rounded-full bg-gray-100" />;
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
      <div className="relative h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="absolute inset-y-0 left-0 bg-emerald-500"
          style={{ width: `${revPct}%` }}
        />
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="absolute inset-y-0 left-0 bg-rose-500"
          style={{ width: `${costPct}%` }}
        />
      </div>
    </div>
  );
}

export default function EventsHubPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listEvents();
      setEvents(rows);
    } catch (e: any) {
      setError(String(e?.message || 'Failed to load events.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(() => {
    return events.filter((event) => {
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
  }, [filter, search, events]);

  const portfolioTotals = useMemo(() => {
    const all = events.reduce(
      (acc, event) => {
        const margin = summaryToMargin(event.totals);
        acc.revenue += margin.revenue;
        acc.costs += margin.costs;
        acc.inKind += event.totals.inKindValue;
        if (event.kind === 'internal') acc.internal += 1;
        if (event.kind === 'external') acc.external += 1;
        return acc;
      },
      { revenue: 0, costs: 0, inKind: 0, internal: 0, external: 0 }
    );
    return { ...all, margin: all.revenue - all.costs };
  }, [events]);

  const draftEvents = filtered.filter((event) => event.status === 'draft' || event.status === 'planning');
  const liveEvents = filtered.filter((event) => event.status === 'live');
  const closedEvents = filtered.filter((event) => event.status === 'closed');

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-6 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Events</h1>
            <p className="mt-1 text-sm text-gray-600">
              Plan, track, and reconcile internal events &amp; client engagements with full P&amp;L visibility.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <i className="fa-solid fa-rotate-right mr-2" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate('/ignite/events/new')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <i className="fa-solid fa-plus mr-2" />
              Create Event
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4 md:gap-4 md:p-5">
          <PortfolioStat
            label="Cash Sponsorship"
            value={formatMoney(portfolioTotals.revenue)}
            icon="fa-sack-dollar"
            accent="emerald"
          />
          <PortfolioStat
            label="Total Costs"
            value={formatMoney(portfolioTotals.costs)}
            icon="fa-receipt"
            accent="rose"
          />
          <PortfolioStat
            label="Net Margin"
            value={formatMoney(portfolioTotals.margin)}
            icon="fa-chart-line"
            accent={portfolioTotals.margin >= 0 ? 'emerald' : 'rose'}
            subtitle={
              portfolioTotals.revenue > 0
                ? `${((portfolioTotals.margin / portfolioTotals.revenue) * 100).toFixed(0)}%`
                : undefined
            }
          />
          <PortfolioStat
            label="Active Events"
            value={`${portfolioTotals.internal + portfolioTotals.external}`}
            icon="fa-calendar-star"
            accent="blue"
            subtitle={`${portfolioTotals.internal} internal · ${portfolioTotals.external} client`}
          />
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'internal', label: 'Internal' },
              { id: 'external', label: 'Client' },
            ] as Array<{ id: Filter; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event, venue, city..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
          <i className="fa-solid fa-spinner fa-spin mr-2 text-gray-400" />
          Loading events...
        </div>
      ) : (
        <>
          <Section title="Live & Upcoming" badge={liveEvents.length} accent="emerald">
            <CardGrid events={liveEvents} onOpen={(id) => navigate(`/ignite/events/${id}`)} />
          </Section>

          <Section title="Drafts & Planning" badge={draftEvents.length} accent="amber">
            <CardGrid events={draftEvents} onOpen={(id) => navigate(`/ignite/events/${id}`)} />
          </Section>

          <Section title="Closed" badge={closedEvents.length} accent="slate">
            <CardGrid events={closedEvents} onOpen={(id) => navigate(`/ignite/events/${id}`)} />
          </Section>
        </>
      )}
    </div>
  );
}

function PortfolioStat({
  label,
  value,
  icon,
  accent,
  subtitle,
}: {
  label: string;
  value: string;
  icon: string;
  accent: 'emerald' | 'rose' | 'blue';
  subtitle?: string;
}) {
  const valueClass =
    accent === 'emerald'
      ? 'text-emerald-700'
      : accent === 'rose'
      ? 'text-rose-700'
      : 'text-blue-700';
  const iconClass =
    accent === 'emerald'
      ? 'bg-emerald-50 text-emerald-600'
      : accent === 'rose'
      ? 'bg-rose-50 text-rose-600'
      : 'bg-blue-50 text-blue-600';
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
        <i className={`fa-solid ${icon}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
        <p className={`text-base font-semibold ${valueClass}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function Section({
  title,
  badge,
  accent,
  children,
}: {
  title: string;
  badge: number;
  accent: 'emerald' | 'amber' | 'slate';
  children: React.ReactNode;
}) {
  const badgeClass =
    accent === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : accent === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-100 text-slate-600';
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}>
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
}: {
  events: EventListItem[];
  onOpen: (id: string) => void;
}) {
  if (!events.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
        Nothing here yet.
      </div>
    );
  }
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} onOpen={() => onOpen(event.id)} />
      ))}
    </div>
  );
}

function EventCard({ event, onOpen }: { event: EventListItem; onOpen: () => void }) {
  const margin = summaryToMargin(event.totals);
  const inKind = event.totals.inKindValue;
  const marginColor =
    margin.margin > 0 ? 'text-emerald-700' : margin.margin < 0 ? 'text-rose-700' : 'text-gray-700';
  return (
    <article
      onClick={onOpen}
      className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[event.status]}`}
          >
            {event.status}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_STYLES[event.kind]}`}
          >
            {event.kind === 'internal' ? 'Internal' : 'Client'}
          </span>
        </div>
        <i className="fa-solid fa-arrow-up-right-from-square text-xs text-gray-300 group-hover:text-blue-500" />
      </div>

      <h3 className="mb-1 text-base font-semibold text-gray-900 group-hover:text-blue-700">
        {event.name}
      </h3>
      <p className="mb-4 text-sm text-gray-500">
        {event.kind === 'external' && event.clientName ? event.clientName : 'Hosted by Ignite'}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-calendar w-4 text-gray-400" />
          <span className="truncate">{event.startDate || 'Date TBD'}</span>
        </div>
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-location-dot w-4 text-gray-400" />
          <span className="truncate">{event.city || 'Location TBD'}</span>
        </div>
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-users w-4 text-gray-400" />
          <span>{event.headcount.toLocaleString()} attendees</span>
        </div>
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-user-tie w-4 text-gray-400" />
          <span className="truncate">{event.ownerName || '—'}</span>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Revenue</p>
          <p className="text-sm font-semibold text-emerald-700">{formatMoney(margin.revenue)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Costs</p>
          <p className="text-sm font-semibold text-rose-700">{formatMoney(margin.costs)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Margin</p>
          <p className={`text-sm font-semibold ${marginColor}`}>
            {formatMoney(margin.margin)}
            <span className="ml-1 text-xs text-gray-400">({margin.marginPct.toFixed(0)}%)</span>
          </p>
        </div>
      </div>

      <MarginBar revenue={margin.revenue} costs={margin.costs} />

      {inKind > 0 && (
        <p className="mt-3 text-xs text-gray-500">
          <i className="fa-solid fa-handshake mr-1.5 text-cyan-600" />
          {formatMoney(inKind)} in-kind value
        </p>
      )}
    </article>
  );
}
