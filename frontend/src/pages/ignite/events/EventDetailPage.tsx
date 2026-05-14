import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  EventRecord,
  Sponsor,
  SponsorStatus,
  CostLine,
  eventMargin,
  formatMoney,
  getEventById,
  totalCostsByCategory,
  totalInKindValue,
} from './mockData';

type Tab = 'overview' | 'sponsors' | 'costs' | 'people' | 'documents';

const TAB_LABELS: Record<Tab, { label: string; icon: string }> = {
  overview: { label: 'Overview', icon: 'fa-chart-line' },
  sponsors: { label: 'Sponsors', icon: 'fa-handshake' },
  costs: { label: 'Costs', icon: 'fa-receipt' },
  people: { label: 'People', icon: 'fa-users' },
  documents: { label: 'Documents', icon: 'fa-folder-open' },
};

const STATUS_BADGE: Record<EventRecord['status'], string> = {
  draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  planning: 'bg-blue-100 text-blue-800 border-blue-200',
  live: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  closed: 'bg-slate-100 text-slate-800 border-slate-200',
};

const SPONSOR_STATUS_BADGE: Record<SponsorStatus, string> = {
  prospect: 'bg-gray-100 text-gray-700 border-gray-200',
  committed: 'bg-blue-100 text-blue-700 border-blue-200',
  invoiced: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const COST_STATUS_BADGE: Record<CostLine['status'], string> = {
  budgeted: 'bg-gray-100 text-gray-700 border-gray-200',
  committed: 'bg-blue-100 text-blue-700 border-blue-200',
  invoiced: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export default function EventDetailPage() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const event = useMemo(() => (eventId ? getEventById(eventId) : undefined), [eventId]);
  const [tab, setTab] = useState<Tab>('overview');

  if (!event) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-600">
          Event not found.{' '}
          <Link to="/ignite/events" className="text-blue-600 hover:underline">
            Back to events
          </Link>
        </p>
      </div>
    );
  }

  const margin = eventMargin(event);
  const inKind = totalInKindValue(event);
  const sponsorPaid = event.sponsors
    .filter((sponsor) => sponsor.kind === 'cash' && sponsor.status === 'paid')
    .reduce((sum, sponsor) => sum + sponsor.amount, 0);
  const costPaid = event.costs
    .filter((cost) => cost.status === 'paid')
    .reduce((sum, cost) => sum + cost.qty * cost.unitCost, 0);

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate('/ignite/events')}
          className="mb-3 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <i className="fa-solid fa-arrow-left mr-2" /> All events
        </button>
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase ${STATUS_BADGE[event.status]}`}
              >
                {event.status}
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase ${
                  event.kind === 'internal'
                    ? 'border-purple-200 bg-purple-50 text-purple-700'
                    : 'border-cyan-200 bg-cyan-50 text-cyan-700'
                }`}
              >
                {event.kind === 'internal' ? 'Internal' : 'Client'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {event.kind === 'external' && event.clientName ? `${event.clientName} · ` : ''}
              {event.venue}, {event.city}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 sm:grid-cols-4">
              <span>
                <i className="fa-solid fa-calendar mr-1.5 text-gray-400" />
                {event.startDate}
                {event.endDate && event.endDate !== event.startDate ? ` → ${event.endDate}` : ''}
              </span>
              <span>
                <i className="fa-solid fa-users mr-1.5 text-gray-400" />
                {event.headcount.toLocaleString()} attendees
              </span>
              <span>
                <i className="fa-solid fa-user-tie mr-1.5 text-gray-400" />
                Owner: {event.ownerName}
              </span>
              <span>
                <i className="fa-solid fa-address-card mr-1.5 text-gray-400" />
                {event.primaryContact}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => alert('Mock: would export P&L PDF')}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <i className="fa-solid fa-download mr-2" /> Export P&amp;L
            </button>
            <button
              type="button"
              onClick={() => alert('Mock: would open edit wizard')}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <i className="fa-solid fa-pen mr-2" /> Edit Event
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Cash Revenue" value={formatMoney(margin.revenue)} accent="emerald" />
        <KpiTile label="Total Costs" value={formatMoney(margin.costs)} accent="rose" />
        <KpiTile
          label="Net Margin"
          value={`${formatMoney(margin.margin)} · ${margin.marginPct.toFixed(0)}%`}
          accent={margin.margin >= 0 ? 'emerald' : 'rose'}
        />
        <KpiTile
          label="In-kind value"
          value={inKind > 0 ? formatMoney(inKind) : '—'}
          accent="cyan"
          subtitle={inKind > 0 ? `${event.sponsors.filter((s) => s.kind === 'in_kind').length} partners` : undefined}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-1 border-b border-gray-100 px-4 pt-3">
          {(Object.keys(TAB_LABELS) as Tab[]).map((id) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`relative flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <i className={`fa-solid ${TAB_LABELS[id].icon}`} />
                <span>{TAB_LABELS[id].label}</span>
                {active && (
                  <span className="absolute inset-x-3 bottom-0 h-[2px] bg-blue-600" />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-5 sm:p-6">
          {tab === 'overview' && (
            <OverviewTab event={event} sponsorPaid={sponsorPaid} costPaid={costPaid} />
          )}
          {tab === 'sponsors' && <SponsorsTab event={event} />}
          {tab === 'costs' && <CostsTab event={event} />}
          {tab === 'people' && <PeopleTab event={event} />}
          {tab === 'documents' && <DocumentsTab event={event} />}
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  accent,
  subtitle,
}: {
  label: string;
  value: string;
  accent: 'emerald' | 'rose' | 'cyan';
  subtitle?: string;
}) {
  const cls =
    accent === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/60 text-emerald-700'
      : accent === 'rose'
      ? 'border-rose-200 bg-rose-50/60 text-rose-700'
      : 'border-cyan-200 bg-cyan-50/60 text-cyan-700';
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-[11px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}

function OverviewTab({
  event,
  sponsorPaid,
  costPaid,
}: {
  event: EventRecord;
  sponsorPaid: number;
  costPaid: number;
}) {
  const byCategory = totalCostsByCategory(event);
  const totalCost = Object.values(byCategory).reduce((sum, v) => sum + v, 0);
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const margin = eventMargin(event);
  const cashCollectedPct = margin.revenue > 0 ? (sponsorPaid / margin.revenue) * 100 : 0;
  const costsPaidPct = margin.costs > 0 ? (costPaid / margin.costs) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {event.description && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm text-gray-700">{event.description}</p>
          </div>
        )}

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Cost mix
          </h3>
          <div className="space-y-2.5">
            {sortedCategories.map(([category, total]) => {
              const pct = totalCost > 0 ? (total / totalCost) * 100 : 0;
              return (
                <div key={category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-700">{category}</span>
                    <span className="text-gray-600">
                      {formatMoney(total)}{' '}
                      <span className="text-xs text-gray-400">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full bg-gradient-to-r from-rose-400 to-rose-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {sortedCategories.length === 0 && (
              <p className="text-sm text-gray-500">No costs recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Cash collected</p>
          <p className="text-lg font-semibold text-emerald-700">
            {formatMoney(sponsorPaid)}{' '}
            <span className="text-xs font-normal text-gray-500">
              of {formatMoney(margin.revenue)}
            </span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${Math.min(100, cashCollectedPct)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">{cashCollectedPct.toFixed(0)}% paid</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Costs paid</p>
          <p className="text-lg font-semibold text-rose-700">
            {formatMoney(costPaid)}{' '}
            <span className="text-xs font-normal text-gray-500">
              of {formatMoney(margin.costs)}
            </span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-rose-500"
              style={{ width: `${Math.min(100, costsPaidPct)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">{costsPaidPct.toFixed(0)}% paid</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-blue-50/40 p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-blue-600">Margin guidance</p>
          <p className="text-sm text-blue-900">
            Net margin{' '}
            <strong>
              {formatMoney(margin.margin)} ({margin.marginPct.toFixed(1)}%)
            </strong>
            {margin.marginPct >= 20 ? ' is healthy.' : ' is below the 20% target — review costs.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function SponsorsTab({ event }: { event: EventRecord }) {
  const cashSponsors = event.sponsors.filter((sponsor) => sponsor.kind === 'cash');
  const inKindSponsors = event.sponsors.filter((sponsor) => sponsor.kind === 'in_kind');
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          Cash sponsors ({cashSponsors.length})
        </h3>
        <button
          type="button"
          onClick={() => alert('Mock: would open Add Sponsor modal')}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          <i className="fa-solid fa-plus mr-1.5" /> Add sponsor
        </button>
      </div>
      <SponsorTable sponsors={cashSponsors} />

      <div className="flex items-center justify-between pt-4">
        <h3 className="text-base font-semibold text-gray-900">
          In-kind sponsors ({inKindSponsors.length})
        </h3>
      </div>
      {inKindSponsors.length ? (
        <SponsorTable sponsors={inKindSponsors} />
      ) : (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          No in-kind sponsors yet.
        </p>
      )}
    </div>
  );
}

function SponsorTable({ sponsors }: { sponsors: Sponsor[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-2 font-medium">Sponsor</th>
            <th className="px-4 py-2 font-medium">Amount</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Notes</th>
            <th className="px-4 py-2 font-medium">Referral</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {sponsors.map((sponsor) => (
            <tr key={sponsor.id} className="hover:bg-gray-50/60">
              <td className="px-4 py-2.5 font-medium text-gray-900">{sponsor.name}</td>
              <td className="px-4 py-2.5 text-gray-700">{formatMoney(sponsor.amount)}</td>
              <td className="px-4 py-2.5">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${SPONSOR_STATUS_BADGE[sponsor.status]}`}
                >
                  {sponsor.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-gray-600">{sponsor.notes || '—'}</td>
              <td className="px-4 py-2.5 text-gray-600">
                {sponsor.referralOwner
                  ? `${sponsor.referralOwner} (${sponsor.referralPercent || 0}%)`
                  : '—'}
              </td>
              <td className="px-4 py-2.5 text-right">
                <button
                  type="button"
                  onClick={() => alert(`Mock: edit ${sponsor.name}`)}
                  className="text-gray-400 hover:text-blue-600"
                >
                  <i className="fa-solid fa-pen-to-square" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CostsTab({ event }: { event: EventRecord }) {
  const grouped = event.costs.reduce<Record<string, CostLine[]>>((acc, cost) => {
    acc[cost.category] = acc[cost.category] || [];
    acc[cost.category].push(cost);
    return acc;
  }, {});
  const categories = Object.keys(grouped).sort();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Cost ledger</h3>
        <button
          type="button"
          onClick={() => alert('Mock: would open Add Cost Line modal')}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          <i className="fa-solid fa-plus mr-1.5" /> Add cost line
        </button>
      </div>
      {categories.map((category) => {
        const lines = grouped[category];
        const total = lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0);
        return (
          <div key={category} className="overflow-hidden rounded-xl border border-gray-200">
            <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5">
              <p className="text-sm font-semibold text-gray-800">{category}</p>
              <p className="text-sm font-semibold text-gray-700">{formatMoney(total)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-white text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 font-medium">Vendor</th>
                    <th className="px-4 py-2 font-medium">Qty</th>
                    <th className="px-4 py-2 font-medium">Unit</th>
                    <th className="px-4 py-2 font-medium">Total</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {lines.map((line) => (
                    <tr key={line.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-2.5 text-gray-900">{line.description}</td>
                      <td className="px-4 py-2.5 text-gray-600">{line.vendor || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{line.qty}</td>
                      <td className="px-4 py-2.5 text-gray-700">{formatMoney(line.unitCost, { decimals: 2 })}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        {formatMoney(line.qty * line.unitCost, { decimals: 2 })}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${COST_STATUS_BADGE[line.status]}`}
                        >
                          {line.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{line.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PeopleTab({ event }: { event: EventRecord }) {
  const people = event.costs.filter((cost) => cost.category === 'Manpower');
  const totalManpower = people.reduce((sum, line) => sum + line.qty * line.unitCost, 0);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Crew &amp; contractors</h3>
        <p className="text-sm text-gray-600">Total manpower: {formatMoney(totalManpower)}</p>
      </div>
      {people.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          No manpower lines yet. Add them on the Costs tab.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Person / Role</th>
                <th className="px-4 py-2 font-medium">Vendor</th>
                <th className="px-4 py-2 font-medium">Periods</th>
                <th className="px-4 py-2 font-medium">Rate</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {people.map((person) => (
                <tr key={person.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 text-gray-900">{person.description}</td>
                  <td className="px-4 py-2.5 text-gray-600">{person.vendor || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-700">{person.qty}</td>
                  <td className="px-4 py-2.5 text-gray-700">{formatMoney(person.unitCost)}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {formatMoney(person.qty * person.unitCost)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${COST_STATUS_BADGE[person.status]}`}
                    >
                      {person.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DocumentsTab({ event }: { event: EventRecord }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Documents</h3>
        <button
          type="button"
          onClick={() => alert('Mock: would open file upload')}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          <i className="fa-solid fa-upload mr-1.5" /> Upload
        </button>
      </div>
      {event.documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
          <i className="fa-solid fa-folder-open mb-3 text-3xl text-gray-300" />
          <p className="text-sm text-gray-600">No documents attached yet.</p>
          <p className="mt-1 text-xs text-gray-500">
            BEOs, sponsor agreements, invoices, contracts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {event.documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <i className="fa-solid fa-file" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{doc.name}</p>
                <p className="text-xs text-gray-500">
                  {doc.type.toUpperCase()} · uploaded {doc.uploadedAt} · {doc.uploadedBy}
                </p>
              </div>
              <button
                type="button"
                onClick={() => alert(`Mock: download ${doc.name}`)}
                className="text-gray-400 hover:text-blue-600"
                title="Download"
              >
                <i className="fa-solid fa-download" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
