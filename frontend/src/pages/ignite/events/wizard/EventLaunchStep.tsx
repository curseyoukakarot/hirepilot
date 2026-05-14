import React from 'react';
import { formatMoney } from '../types';
import { EventWizardState } from './types';

type Totals = {
  revenue: number;
  inKind: number;
  costs: number;
  margin: number;
  marginPct: number;
};

type Props = {
  state: EventWizardState;
  totals: Totals;
  onBack: () => void;
  onLaunch: () => void;
};

export default function EventLaunchStep({ state, totals, onBack, onLaunch }: Props) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-white">Ready to launch</h2>
        <p className="mt-0.5 text-sm text-gray-400">
          Review the snapshot below. Launching creates the event record and unlocks live tracking.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Event</h3>
            <dl className="space-y-2 text-sm">
              <Row label="Type" value={state.kind === 'internal' ? 'Internal (we host)' : 'Client (external)'} />
              <Row label="Name" value={state.name || '—'} />
              {state.kind === 'external' && <Row label="Client" value={state.clientName || '—'} />}
              <Row label="Date" value={state.startDate ? `${state.startDate}${state.endDate ? ` → ${state.endDate}` : ''}` : '—'} />
              <Row label="Venue" value={state.venue ? `${state.venue}, ${state.city}` : '—'} />
              <Row label="Headcount" value={state.headcount ? Number(state.headcount).toLocaleString() : '—'} />
              <Row label="Owner" value={state.ownerName || '—'} />
              <Row label="Primary contact" value={state.primaryContact || '—'} />
            </dl>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Money</h3>
            <dl className="space-y-2 text-sm">
              <Row label="Sponsors" value={`${state.sponsors.length} total`} />
              <Row label="Cost lines" value={`${state.costs.length} total`} />
              <Row label="Cash revenue" value={formatMoney(totals.revenue)} accent="emerald" />
              <Row label="In-kind value" value={formatMoney(totals.inKind)} accent="cyan" />
              <Row label="Total costs" value={formatMoney(totals.costs)} accent="rose" />
              <Row
                label="Net margin"
                value={`${formatMoney(totals.margin)} (${totals.marginPct.toFixed(1)}%)`}
                accent={totals.margin >= 0 ? 'emerald' : 'rose'}
                bold
              />
              <Row label="Target margin" value={`${state.targetMarginPct}%`} />
            </dl>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-blue-500/5 p-4 text-sm text-gray-200">
          <p className="font-medium text-purple-200">What happens on launch</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-gray-300">
            <li>Event becomes available on the Events Hub.</li>
            <li>Sponsors and cost lines are pushed to the live ledger.</li>
            <li>Status flips from <code className="rounded bg-white/10 px-1 text-purple-200">draft</code> to <code className="rounded bg-white/10 px-1 text-purple-200">planning</code>.</li>
            <li>You can keep editing — every change is auditable.</li>
          </ul>
        </div>
      </section>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-gray-200 hover:border-white/20 hover:bg-white/10"
        >
          <i className="fa-solid fa-arrow-left mr-2" /> Back
        </button>
        <button
          type="button"
          onClick={onLaunch}
          className="rounded-xl bg-gradient-to-r from-emerald-500 via-purple-600 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 hover:from-emerald-400 hover:via-purple-500 hover:to-pink-500"
        >
          <i className="fa-solid fa-rocket mr-2" /> Launch Event
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
  bold = false,
}: {
  label: string;
  value: string;
  accent?: 'emerald' | 'rose' | 'cyan';
  bold?: boolean;
}) {
  const valueClass =
    accent === 'emerald'
      ? 'text-emerald-300'
      : accent === 'rose'
      ? 'text-rose-300'
      : accent === 'cyan'
      ? 'text-cyan-300'
      : 'text-white';
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-gray-400">{label}</dt>
      <dd className={`${valueClass} ${bold ? 'font-semibold' : ''}`}>{value}</dd>
    </div>
  );
}
