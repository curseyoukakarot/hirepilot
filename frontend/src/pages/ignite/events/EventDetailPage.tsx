import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CostInput,
  SponsorInput,
  addDocument,
  archiveEvent,
  deleteDocument,
  fetchEvent,
  replaceCosts,
  replaceSponsors,
} from './api';
import {
  COST_CATEGORIES,
  CostCategory,
  CostLine,
  CostStatus,
  DocumentType,
  EventRecord,
  Sponsor,
  SponsorKind,
  SponsorStatus,
  eventMargin,
  formatMoney,
  totalCostsByCategory,
  totalInKindValue,
} from './types';

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

const COST_STATUS_BADGE: Record<CostStatus, string> = {
  budgeted: 'bg-gray-100 text-gray-700 border-gray-200',
  committed: 'bg-blue-100 text-blue-700 border-blue-200',
  invoiced: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const SPONSOR_STATUS_OPTIONS: SponsorStatus[] = ['prospect', 'committed', 'invoiced', 'paid'];
const COST_STATUS_OPTIONS: CostStatus[] = ['budgeted', 'committed', 'invoiced', 'paid'];
const DOC_TYPE_OPTIONS: DocumentType[] = ['beo', 'invoice', 'contract', 'quote', 'misc'];

export default function EventDetailPage() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [savingMessage, setSavingMessage] = useState<string | null>(null);

  const reload = async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEvent(eventId);
      setEvent(data);
    } catch (e: any) {
      setError(String(e?.message || 'Failed to load event.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [eventId]);

  if (loading && !event) {
    return (
      <div className="p-8 text-sm text-gray-500">Loading event...</div>
    );
  }

  if (error && !event) {
    return (
      <div className="p-8">
        <p className="text-sm text-rose-600">{error}</p>
        <Link to="/ignite/events" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          Back to events
        </Link>
      </div>
    );
  }

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

  const handleSave = async (action: () => Promise<void>, label: string) => {
    setSavingMessage(`${label}...`);
    setError(null);
    try {
      await action();
      await reload();
      setSavingMessage(`${label} ✓`);
      setTimeout(() => setSavingMessage(null), 1500);
    } catch (e: any) {
      setError(String(e?.message || `${label} failed.`));
      setSavingMessage(null);
    }
  };

  const sponsorsToInputs = (sponsors: Sponsor[]): SponsorInput[] =>
    sponsors.map((sponsor) => ({
      name: sponsor.name,
      kind: sponsor.kind,
      amount: sponsor.amount,
      status: sponsor.status,
      contact: sponsor.contact ?? null,
      notes: sponsor.notes ?? null,
      referralOwner: sponsor.referralOwner ?? null,
      referralPercent: sponsor.referralPercent ?? null,
    }));

  const costsToInputs = (costs: CostLine[]): CostInput[] =>
    costs.map((cost) => ({
      category: cost.category,
      description: cost.description,
      vendor: cost.vendor ?? null,
      qty: cost.qty,
      unitCost: cost.unitCost,
      status: cost.status,
      notes: cost.notes ?? null,
    }));

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
              {event.venue || 'Venue TBD'}
              {event.city ? `, ${event.city}` : ''}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 sm:grid-cols-4">
              <span>
                <i className="fa-solid fa-calendar mr-1.5 text-gray-400" />
                {event.startDate || 'TBD'}
                {event.endDate && event.endDate !== event.startDate ? ` → ${event.endDate}` : ''}
              </span>
              <span>
                <i className="fa-solid fa-users mr-1.5 text-gray-400" />
                {event.headcount.toLocaleString()} attendees
              </span>
              <span>
                <i className="fa-solid fa-user-tie mr-1.5 text-gray-400" />
                Owner: {event.ownerName || '—'}
              </span>
              <span>
                <i className="fa-solid fa-address-card mr-1.5 text-gray-400" />
                {event.primaryContact || '—'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {savingMessage && <span className="text-xs text-gray-500">{savingMessage}</span>}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Archive this event? It will be marked closed.')) {
                  void handleSave(() => archiveEvent(event.id), 'Archived');
                }
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <i className="fa-solid fa-box-archive mr-2" /> Archive
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-2 text-sm text-rose-600">{error}</p>
        )}
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
          {tab === 'sponsors' && (
            <SponsorsTab
              event={event}
              onSave={(sponsors) =>
                handleSave(() => replaceSponsors(event.id, sponsorsToInputs(sponsors)), 'Sponsors saved')
              }
            />
          )}
          {tab === 'costs' && (
            <CostsTab
              event={event}
              onSave={(costs) =>
                handleSave(() => replaceCosts(event.id, costsToInputs(costs)), 'Costs saved')
              }
            />
          )}
          {tab === 'people' && (
            <PeopleTab
              event={event}
              onSave={(costs) =>
                handleSave(() => replaceCosts(event.id, costsToInputs(costs)), 'People saved')
              }
            />
          )}
          {tab === 'documents' && (
            <DocumentsTab
              event={event}
              onAdd={(doc) =>
                handleSave(
                  () =>
                    addDocument(event.id, {
                      name: doc.name,
                      docType: doc.docType,
                      fileUrl: doc.fileUrl,
                    }).then(() => undefined),
                  'Document added'
                )
              }
              onDelete={(docId) => handleSave(() => deleteDocument(event.id, docId), 'Document removed')}
            />
          )}
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
            {margin.marginPct >= event.targetMarginPct
              ? ' — on target.'
              : ` — below ${event.targetMarginPct.toFixed(0)}% target.`}
          </p>
        </div>
      </div>
    </div>
  );
}

function makeSponsorId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function makeCostId(): string {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function SponsorsTab({
  event,
  onSave,
}: {
  event: EventRecord;
  onSave: (sponsors: Sponsor[]) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<Sponsor[]>(event.sponsors);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(event.sponsors);
    setDirty(false);
  }, [event.sponsors]);

  const update = (id: string, patch: Partial<Sponsor>) => {
    setDraft((prev) => prev.map((sponsor) => (sponsor.id === id ? { ...sponsor, ...patch } : sponsor)));
    setDirty(true);
  };

  const remove = (id: string) => {
    setDraft((prev) => prev.filter((sponsor) => sponsor.id !== id));
    setDirty(true);
  };

  const add = (kind: SponsorKind) => {
    setDraft((prev) => [
      ...prev,
      {
        id: makeSponsorId(),
        name: '',
        kind,
        amount: 0,
        status: 'prospect',
      },
    ]);
    setDirty(true);
  };

  const cashSponsors = draft.filter((sponsor) => sponsor.kind === 'cash');
  const inKindSponsors = draft.filter((sponsor) => sponsor.kind === 'in_kind');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          Cash sponsors ({cashSponsors.length})
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => add('cash')}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            <i className="fa-solid fa-plus mr-1.5" /> Cash sponsor
          </button>
          <button
            type="button"
            onClick={() => add('in_kind')}
            className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-sm font-medium text-cyan-700 hover:bg-cyan-100"
          >
            <i className="fa-solid fa-handshake mr-1.5" /> In-kind sponsor
          </button>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => onSave(draft)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white ${
              dirty ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-gray-300'
            }`}
          >
            Save changes
          </button>
        </div>
      </div>
      <SponsorTable sponsors={cashSponsors} onUpdate={update} onRemove={remove} />

      <div className="flex items-center justify-between pt-4">
        <h3 className="text-base font-semibold text-gray-900">
          In-kind sponsors ({inKindSponsors.length})
        </h3>
      </div>
      {inKindSponsors.length ? (
        <SponsorTable sponsors={inKindSponsors} onUpdate={update} onRemove={remove} />
      ) : (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          No in-kind sponsors yet.
        </p>
      )}
    </div>
  );
}

function SponsorTable({
  sponsors,
  onUpdate,
  onRemove,
}: {
  sponsors: Sponsor[];
  onUpdate: (id: string, patch: Partial<Sponsor>) => void;
  onRemove: (id: string) => void;
}) {
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
              <td className="px-4 py-2.5">
                <input
                  type="text"
                  value={sponsor.name}
                  onChange={(e) => onUpdate(sponsor.id, { name: e.target.value })}
                  placeholder="Sponsor name"
                  className="w-44 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium focus:border-blue-300 focus:bg-white focus:outline-none"
                />
              </td>
              <td className="px-4 py-2.5">
                <input
                  type="number"
                  value={sponsor.amount}
                  onChange={(e) => onUpdate(sponsor.id, { amount: Number(e.target.value || 0) })}
                  className="w-32 rounded-md border border-gray-200 px-2 py-1 text-right text-sm"
                />
              </td>
              <td className="px-4 py-2.5">
                <select
                  value={sponsor.status}
                  onChange={(e) => onUpdate(sponsor.id, { status: e.target.value as SponsorStatus })}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${SPONSOR_STATUS_BADGE[sponsor.status]}`}
                >
                  {SPONSOR_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-2.5">
                <input
                  type="text"
                  value={sponsor.notes || ''}
                  onChange={(e) => onUpdate(sponsor.id, { notes: e.target.value })}
                  className="w-56 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm focus:border-blue-300 focus:bg-white focus:outline-none"
                />
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={sponsor.referralOwner || ''}
                    onChange={(e) => onUpdate(sponsor.id, { referralOwner: e.target.value })}
                    placeholder="Owner"
                    className="w-24 rounded-md border border-gray-200 px-2 py-1 text-sm"
                  />
                  <input
                    type="number"
                    value={sponsor.referralPercent ?? ''}
                    onChange={(e) =>
                      onUpdate(sponsor.id, {
                        referralPercent: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    placeholder="%"
                    className="w-14 rounded-md border border-gray-200 px-2 py-1 text-right text-sm"
                  />
                </div>
              </td>
              <td className="px-4 py-2.5 text-right">
                <button
                  type="button"
                  onClick={() => onRemove(sponsor.id)}
                  className="text-gray-400 hover:text-rose-500"
                  title="Remove sponsor"
                >
                  <i className="fa-solid fa-trash" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CostsTab({
  event,
  onSave,
}: {
  event: EventRecord;
  onSave: (costs: CostLine[]) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<CostLine[]>(event.costs);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(event.costs);
    setDirty(false);
  }, [event.costs]);

  const update = (id: string, patch: Partial<CostLine>) => {
    setDraft((prev) => prev.map((cost) => (cost.id === id ? { ...cost, ...patch } : cost)));
    setDirty(true);
  };

  const remove = (id: string) => {
    setDraft((prev) => prev.filter((cost) => cost.id !== id));
    setDirty(true);
  };

  const add = (category: CostCategory) => {
    setDraft((prev) => [
      ...prev,
      {
        id: makeCostId(),
        category,
        description: '',
        vendor: null,
        qty: 1,
        unitCost: 0,
        status: 'budgeted',
      },
    ]);
    setDirty(true);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, CostLine[]>();
    for (const cost of draft) {
      const key = String(cost.category || 'Other');
      const list = map.get(key) || [];
      list.push(cost);
      map.set(key, list);
    }
    return map;
  }, [draft]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Cost ledger</h3>
        <button
          type="button"
          disabled={!dirty}
          onClick={() => onSave(draft)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white ${
            dirty ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-gray-300'
          }`}
        >
          Save changes
        </button>
      </div>
      {COST_CATEGORIES.map((category) => {
        const lines = grouped.get(category) || [];
        const total = lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0);
        return (
          <div key={category} className="overflow-hidden rounded-xl border border-gray-200">
            <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5">
              <p className="text-sm font-semibold text-gray-800">{category}</p>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-gray-700">{formatMoney(total)}</p>
                <button
                  type="button"
                  onClick={() => add(category)}
                  className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100"
                >
                  <i className="fa-solid fa-plus mr-1" /> Add line
                </button>
              </div>
            </div>
            {lines.length > 0 && (
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
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {lines.map((line) => (
                      <tr key={line.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => update(line.id, { description: e.target.value })}
                            className="w-64 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm focus:border-blue-300 focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={line.vendor || ''}
                            onChange={(e) => update(line.id, { vendor: e.target.value })}
                            className="w-32 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm focus:border-blue-300 focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            value={line.qty}
                            onChange={(e) => update(line.id, { qty: Number(e.target.value || 0) })}
                            className="w-16 rounded-md border border-gray-200 px-2 py-1 text-right text-sm"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            value={line.unitCost}
                            onChange={(e) => update(line.id, { unitCost: Number(e.target.value || 0) })}
                            className="w-28 rounded-md border border-gray-200 px-2 py-1 text-right text-sm"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm font-medium text-gray-900">
                          {formatMoney(line.qty * line.unitCost, { decimals: 2 })}
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            value={line.status}
                            onChange={(e) => update(line.id, { status: e.target.value as CostStatus })}
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${COST_STATUS_BADGE[line.status]}`}
                          >
                            {COST_STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={line.notes || ''}
                            onChange={(e) => update(line.id, { notes: e.target.value })}
                            className="w-40 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm focus:border-blue-300 focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => remove(line.id)}
                            className="text-gray-400 hover:text-rose-500"
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PeopleTab({
  event,
  onSave,
}: {
  event: EventRecord;
  onSave: (costs: CostLine[]) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<CostLine[]>(event.costs);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(event.costs);
    setDirty(false);
  }, [event.costs]);

  const people = draft.filter((cost) => cost.category === 'Manpower');
  const totalManpower = people.reduce((sum, line) => sum + line.qty * line.unitCost, 0);

  const update = (id: string, patch: Partial<CostLine>) => {
    setDraft((prev) => prev.map((cost) => (cost.id === id ? { ...cost, ...patch } : cost)));
    setDirty(true);
  };

  const add = () => {
    setDraft((prev) => [
      ...prev,
      {
        id: makeCostId(),
        category: 'Manpower',
        description: '',
        vendor: null,
        qty: 1,
        unitCost: 0,
        status: 'budgeted',
      },
    ]);
    setDirty(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Crew &amp; contractors</h3>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-600">Total manpower: {formatMoney(totalManpower)}</p>
          <button
            type="button"
            onClick={add}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            <i className="fa-solid fa-user-plus mr-1.5" /> Add crew
          </button>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => onSave(draft)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white ${
              dirty ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-gray-300'
            }`}
          >
            Save changes
          </button>
        </div>
      </div>
      {people.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          No manpower lines yet.
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
                  <td className="px-4 py-2.5">
                    <input
                      type="text"
                      value={person.description}
                      onChange={(e) => update(person.id, { description: e.target.value })}
                      className="w-56 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm focus:border-blue-300 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="text"
                      value={person.vendor || ''}
                      onChange={(e) => update(person.id, { vendor: e.target.value })}
                      className="w-32 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm focus:border-blue-300 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      value={person.qty}
                      onChange={(e) => update(person.id, { qty: Number(e.target.value || 0) })}
                      className="w-16 rounded-md border border-gray-200 px-2 py-1 text-right text-sm"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      value={person.unitCost}
                      onChange={(e) => update(person.id, { unitCost: Number(e.target.value || 0) })}
                      className="w-28 rounded-md border border-gray-200 px-2 py-1 text-right text-sm"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                    {formatMoney(person.qty * person.unitCost)}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={person.status}
                      onChange={(e) => update(person.id, { status: e.target.value as CostStatus })}
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${COST_STATUS_BADGE[person.status]}`}
                    >
                      {COST_STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
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

function DocumentsTab({
  event,
  onAdd,
  onDelete,
}: {
  event: EventRecord;
  onAdd: (doc: { name: string; docType: DocumentType; fileUrl?: string | null }) => void | Promise<void>;
  onDelete: (docId: string) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [docType, setDocType] = useState<DocumentType>('misc');
  const [fileUrl, setFileUrl] = useState('');

  const submit = async () => {
    if (!name.trim()) return;
    await onAdd({ name: name.trim(), docType, fileUrl: fileUrl.trim() || null });
    setName('');
    setFileUrl('');
    setDocType('misc');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 md:flex-row md:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
            Document name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. AMD Sponsor Agreement.pdf"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
            Type
          </span>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            {DOC_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
            File URL (optional)
          </span>
          <input
            type="url"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
            name.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-gray-300'
          }`}
        >
          <i className="fa-solid fa-plus mr-1.5" /> Add
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
                  {doc.type.toUpperCase()} · uploaded {doc.uploadedAt || 'recently'} · {doc.uploadedBy}
                </p>
              </div>
              {doc.fileUrl && (
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-400 hover:text-blue-600"
                  title="Open"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square" />
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Remove "${doc.name}"?`)) void onDelete(doc.id);
                }}
                className="text-gray-400 hover:text-rose-500"
                title="Remove"
              >
                <i className="fa-solid fa-trash" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
