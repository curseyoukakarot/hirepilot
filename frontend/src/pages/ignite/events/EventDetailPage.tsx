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
  draft: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
  planning: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
  live: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  closed: 'bg-slate-500/10 border-slate-500/20 text-slate-300',
};

const SPONSOR_STATUS_BADGE: Record<SponsorStatus, string> = {
  prospect: 'bg-white/5 text-gray-300 border-white/10',
  committed: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  invoiced: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  paid: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
};

const COST_STATUS_BADGE: Record<CostStatus, string> = {
  budgeted: 'bg-white/5 text-gray-300 border-white/10',
  committed: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  invoiced: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  paid: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
};

const SPONSOR_STATUS_OPTIONS: SponsorStatus[] = ['prospect', 'committed', 'invoiced', 'paid'];
const COST_STATUS_OPTIONS: CostStatus[] = ['budgeted', 'committed', 'invoiced', 'paid'];
const DOC_TYPE_OPTIONS: DocumentType[] = ['beo', 'invoice', 'contract', 'quote', 'misc'];

const INPUT_BASE =
  'rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:bg-white/10 focus:outline-none';
const INPUT_BARE =
  'rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:bg-white/10 focus:outline-none';

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
      <div className="rounded-2xl bg-gradient-to-br from-[#060609] via-[#0a0a0f] to-[#060609] p-8 text-sm text-gray-300">
        Loading event...
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-[#060609] via-[#0a0a0f] to-[#060609] p-8 text-white">
        <p className="text-sm text-rose-300">{error}</p>
        <Link to="/ignite/events" className="mt-3 inline-block text-sm text-purple-300 hover:underline">
          Back to events
        </Link>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-[#060609] via-[#0a0a0f] to-[#060609] p-8 text-white">
        <p className="text-sm text-gray-300">
          Event not found.{' '}
          <Link to="/ignite/events" className="text-purple-300 hover:underline">
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
    <div className="min-h-full rounded-2xl bg-gradient-to-br from-[#060609] via-[#0a0a0f] to-[#060609] text-white">
      <div className="space-y-6 p-6 sm:p-8">
        <div>
          <button
            type="button"
            onClick={() => navigate('/ignite/events')}
            className="mb-3 inline-flex items-center text-sm text-gray-400 hover:text-white"
          >
            <i className="fa-solid fa-arrow-left mr-2" /> All events
          </button>
          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl md:flex-row md:items-start md:justify-between">
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
                      ? 'border-purple-400/30 bg-purple-500/10 text-purple-200'
                      : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200'
                  }`}
                >
                  {event.kind === 'internal' ? 'Internal' : 'Client'}
                </span>
              </div>
              <h1 className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-2xl font-bold text-transparent">
                {event.name}
              </h1>
              <p className="mt-1 text-sm text-gray-400">
                {event.kind === 'external' && event.clientName ? `${event.clientName} · ` : ''}
                {event.venue || 'Venue TBD'}
                {event.city ? `, ${event.city}` : ''}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-400 sm:grid-cols-4">
                <span>
                  <i className="fa-solid fa-calendar mr-1.5 text-gray-500" />
                  {event.startDate || 'TBD'}
                  {event.endDate && event.endDate !== event.startDate ? ` → ${event.endDate}` : ''}
                </span>
                <span>
                  <i className="fa-solid fa-users mr-1.5 text-gray-500" />
                  {event.headcount.toLocaleString()} attendees
                </span>
                <span>
                  <i className="fa-solid fa-user-tie mr-1.5 text-gray-500" />
                  Owner: {event.ownerName || '—'}
                </span>
                <span>
                  <i className="fa-solid fa-address-card mr-1.5 text-gray-500" />
                  {event.primaryContact || '—'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {savingMessage && <span className="text-xs text-gray-400">{savingMessage}</span>}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Archive this event? It will be marked closed.')) {
                    void handleSave(() => archiveEvent(event.id), 'Archived');
                  }
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 hover:border-white/20 hover:bg-white/10"
              >
                <i className="fa-solid fa-box-archive mr-2" /> Archive
              </button>
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
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

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl">
          <div className="flex flex-wrap gap-1 border-b border-white/10 px-4 pt-3">
            {(Object.keys(TAB_LABELS) as Tab[]).map((id) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`relative flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-white/[0.04] text-white'
                      : 'text-gray-400 hover:bg-white/[0.02] hover:text-gray-200'
                  }`}
                >
                  <i className={`fa-solid ${TAB_LABELS[id].icon}`} />
                  <span>{TAB_LABELS[id].label}</span>
                  {active && (
                    <span className="absolute inset-x-3 bottom-0 h-[2px] bg-gradient-to-r from-purple-500 to-pink-500" />
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
  const valueClass =
    accent === 'emerald'
      ? 'text-emerald-300'
      : accent === 'rose'
      ? 'text-rose-300'
      : 'text-cyan-300';
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${valueClass}`}>{value}</p>
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
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="text-sm text-gray-300">{event.description}</p>
          </div>
        )}

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Cost mix
          </h3>
          <div className="space-y-2.5">
            {sortedCategories.map(([category, total]) => {
              const pct = totalCost > 0 ? (total / totalCost) * 100 : 0;
              return (
                <div key={category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-300">{category}</span>
                    <span className="text-gray-400">
                      {formatMoney(total)}{' '}
                      <span className="text-xs text-gray-500">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
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
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">Cash collected</p>
          <p className="text-lg font-semibold text-emerald-300">
            {formatMoney(sponsorPaid)}{' '}
            <span className="text-xs font-normal text-gray-500">
              of {formatMoney(margin.revenue)}
            </span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
              style={{ width: `${Math.min(100, cashCollectedPct)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">{cashCollectedPct.toFixed(0)}% paid</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">Costs paid</p>
          <p className="text-lg font-semibold text-rose-300">
            {formatMoney(costPaid)}{' '}
            <span className="text-xs font-normal text-gray-500">
              of {formatMoney(margin.costs)}
            </span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-rose-400 to-rose-500"
              style={{ width: `${Math.min(100, costsPaidPct)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">{costsPaidPct.toFixed(0)}% paid</p>
        </div>
        <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-blue-500/5 p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-purple-300">Margin guidance</p>
          <p className="text-sm text-gray-200">
            Net margin{' '}
            <strong className="text-white">
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

const PRIMARY_BTN =
  'rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1.5 text-sm font-semibold text-white shadow-md shadow-purple-500/25 hover:from-purple-500 hover:to-pink-500';
const PRIMARY_BTN_DISABLED =
  'rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-gray-500 cursor-not-allowed';
const SECONDARY_BTN =
  'rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-200 hover:border-white/20 hover:bg-white/10';
const ACCENT_BLUE_BTN =
  'rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-200 hover:bg-blue-500/20';
const ACCENT_CYAN_BTN =
  'rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20';

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
        <h3 className="text-base font-semibold text-white">
          Cash sponsors ({cashSponsors.length})
        </h3>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => add('cash')} className={ACCENT_BLUE_BTN}>
            <i className="fa-solid fa-plus mr-1.5" /> Cash sponsor
          </button>
          <button type="button" onClick={() => add('in_kind')} className={ACCENT_CYAN_BTN}>
            <i className="fa-solid fa-handshake mr-1.5" /> In-kind sponsor
          </button>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => onSave(draft)}
            className={dirty ? PRIMARY_BTN : PRIMARY_BTN_DISABLED}
          >
            Save changes
          </button>
        </div>
      </div>
      <SponsorTable sponsors={cashSponsors} onUpdate={update} onRemove={remove} />

      <div className="flex items-center justify-between pt-4">
        <h3 className="text-base font-semibold text-white">
          In-kind sponsors ({inKindSponsors.length})
        </h3>
      </div>
      {inKindSponsors.length ? (
        <SponsorTable sponsors={inKindSponsors} onUpdate={update} onRemove={remove} />
      ) : (
        <p className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-gray-400">
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
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-full divide-y divide-white/10 text-sm">
        <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-gray-400">
          <tr>
            <th className="px-4 py-2 font-medium">Sponsor</th>
            <th className="px-4 py-2 font-medium">Amount</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Notes</th>
            <th className="px-4 py-2 font-medium">Referral</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {sponsors.map((sponsor) => (
            <tr key={sponsor.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-2.5">
                <input
                  type="text"
                  value={sponsor.name}
                  onChange={(e) => onUpdate(sponsor.id, { name: e.target.value })}
                  placeholder="Sponsor name"
                  className={`w-44 font-medium ${INPUT_BARE}`}
                />
              </td>
              <td className="px-4 py-2.5">
                <input
                  type="number"
                  value={sponsor.amount}
                  onChange={(e) => onUpdate(sponsor.id, { amount: Number(e.target.value || 0) })}
                  className={`w-32 text-right ${INPUT_BASE}`}
                />
              </td>
              <td className="px-4 py-2.5">
                <select
                  value={sponsor.status}
                  onChange={(e) => onUpdate(sponsor.id, { status: e.target.value as SponsorStatus })}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${SPONSOR_STATUS_BADGE[sponsor.status]}`}
                >
                  {SPONSOR_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option} className="bg-slate-900 text-white">
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
                  className={`w-56 ${INPUT_BARE}`}
                />
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={sponsor.referralOwner || ''}
                    onChange={(e) => onUpdate(sponsor.id, { referralOwner: e.target.value })}
                    placeholder="Owner"
                    className={`w-24 ${INPUT_BASE}`}
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
                    className={`w-14 text-right ${INPUT_BASE}`}
                  />
                </div>
              </td>
              <td className="px-4 py-2.5 text-right">
                <button
                  type="button"
                  onClick={() => onRemove(sponsor.id)}
                  className="text-gray-500 hover:text-rose-400"
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
        <h3 className="text-base font-semibold text-white">Cost ledger</h3>
        <button
          type="button"
          disabled={!dirty}
          onClick={() => onSave(draft)}
          className={dirty ? PRIMARY_BTN : PRIMARY_BTN_DISABLED}
        >
          Save changes
        </button>
      </div>
      {COST_CATEGORIES.map((category) => {
        const lines = grouped.get(category) || [];
        const total = lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0);
        return (
          <div key={category} className="overflow-hidden rounded-xl border border-white/10">
            <div className="flex items-center justify-between bg-white/[0.04] px-4 py-2.5">
              <p className="text-sm font-semibold text-gray-100">{category}</p>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-gray-200">{formatMoney(total)}</p>
                <button
                  type="button"
                  onClick={() => add(category)}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-200 hover:border-white/20 hover:bg-white/10"
                >
                  <i className="fa-solid fa-plus mr-1" /> Add line
                </button>
              </div>
            </div>
            {lines.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                  <thead className="bg-white/[0.02] text-left text-xs uppercase tracking-wide text-gray-400">
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
                  <tbody className="divide-y divide-white/5">
                    {lines.map((line) => (
                      <tr key={line.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => update(line.id, { description: e.target.value })}
                            className={`w-64 ${INPUT_BARE}`}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={line.vendor || ''}
                            onChange={(e) => update(line.id, { vendor: e.target.value })}
                            className={`w-32 ${INPUT_BARE}`}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            value={line.qty}
                            onChange={(e) => update(line.id, { qty: Number(e.target.value || 0) })}
                            className={`w-16 text-right ${INPUT_BASE}`}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            value={line.unitCost}
                            onChange={(e) => update(line.id, { unitCost: Number(e.target.value || 0) })}
                            className={`w-28 text-right ${INPUT_BASE}`}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm font-medium text-gray-100">
                          {formatMoney(line.qty * line.unitCost, { decimals: 2 })}
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            value={line.status}
                            onChange={(e) => update(line.id, { status: e.target.value as CostStatus })}
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${COST_STATUS_BADGE[line.status]}`}
                          >
                            {COST_STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option} className="bg-slate-900 text-white">
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
                            className={`w-40 ${INPUT_BARE}`}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => remove(line.id)}
                            className="text-gray-500 hover:text-rose-400"
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
        <h3 className="text-base font-semibold text-white">Crew &amp; contractors</h3>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-400">Total manpower: <span className="text-gray-100 font-medium">{formatMoney(totalManpower)}</span></p>
          <button type="button" onClick={add} className={ACCENT_BLUE_BTN}>
            <i className="fa-solid fa-user-plus mr-1.5" /> Add crew
          </button>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => onSave(draft)}
            className={dirty ? PRIMARY_BTN : PRIMARY_BTN_DISABLED}
          >
            Save changes
          </button>
        </div>
      </div>
      {people.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-gray-400">
          No manpower lines yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-2 font-medium">Person / Role</th>
                <th className="px-4 py-2 font-medium">Vendor</th>
                <th className="px-4 py-2 font-medium">Periods</th>
                <th className="px-4 py-2 font-medium">Rate</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {people.map((person) => (
                <tr key={person.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5">
                    <input
                      type="text"
                      value={person.description}
                      onChange={(e) => update(person.id, { description: e.target.value })}
                      className={`w-56 ${INPUT_BARE}`}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="text"
                      value={person.vendor || ''}
                      onChange={(e) => update(person.id, { vendor: e.target.value })}
                      className={`w-32 ${INPUT_BARE}`}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      value={person.qty}
                      onChange={(e) => update(person.id, { qty: Number(e.target.value || 0) })}
                      className={`w-16 text-right ${INPUT_BASE}`}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      value={person.unitCost}
                      onChange={(e) => update(person.id, { unitCost: Number(e.target.value || 0) })}
                      className={`w-28 text-right ${INPUT_BASE}`}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-100">
                    {formatMoney(person.qty * person.unitCost)}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={person.status}
                      onChange={(e) => update(person.id, { status: e.target.value as CostStatus })}
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${COST_STATUS_BADGE[person.status]}`}
                    >
                      {COST_STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option} className="bg-slate-900 text-white">
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
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Document name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. AMD Sponsor Agreement.pdf"
            className={`w-full ${INPUT_BASE} px-3 py-2`}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Type
          </span>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
            className={`${INPUT_BASE} px-3 py-2`}
          >
            {DOC_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option} className="bg-slate-900 text-white">
                {option.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
            File URL (optional)
          </span>
          <input
            type="url"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://..."
            className={`w-full ${INPUT_BASE} px-3 py-2`}
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          className={name.trim() ? PRIMARY_BTN + ' px-4 py-2' : PRIMARY_BTN_DISABLED + ' px-4 py-2'}
        >
          <i className="fa-solid fa-plus mr-1.5" /> Add
        </button>
      </div>

      {event.documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <i className="fa-solid fa-folder-open mb-3 text-3xl text-gray-600" />
          <p className="text-sm text-gray-300">No documents attached yet.</p>
          <p className="mt-1 text-xs text-gray-500">
            BEOs, sponsor agreements, invoices, contracts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {event.documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-purple-400/30"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-300">
                <i className="fa-solid fa-file" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{doc.name}</p>
                <p className="text-xs text-gray-400">
                  {doc.type.toUpperCase()} · uploaded {doc.uploadedAt || 'recently'} · {doc.uploadedBy}
                </p>
              </div>
              {doc.fileUrl && (
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-400 hover:text-purple-300"
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
                className="text-gray-500 hover:text-rose-400"
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
