import React, { useMemo } from 'react';
import { CostCategory, formatMoney } from '../types';
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
  onChange: (patch: Partial<EventWizardState>) => void;
  onBack: () => void;
  onNext: () => void;
};

export default function EventMarginStep({ state, totals, onChange, onBack, onNext }: Props) {
  const target = Number(state.targetMarginPct || 0);
  const targetMet = totals.marginPct >= target;
  const gap = target > 0 && totals.revenue > 0
    ? Math.max(0, target - totals.marginPct)
    : 0;

  const byCategory = useMemo(() => {
    const map = new Map<CostCategory, number>();
    for (const cost of state.costs) {
      const total = Number(cost.qty || 0) * Number(cost.unitCost || 0);
      map.set(cost.category, (map.get(cost.category) || 0) + total);
    }
    return Array.from(map.entries())
      .filter(([, total]) => total > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [state.costs]);

  const byStatus = useMemo(() => {
    const buckets: Record<string, number> = { paid: 0, invoiced: 0, committed: 0, budgeted: 0 };
    for (const cost of state.costs) {
      const total = Number(cost.qty || 0) * Number(cost.unitCost || 0);
      buckets[cost.status] += total;
    }
    return buckets;
  }, [state.costs]);

  const sponsorByStatus = useMemo(() => {
    const buckets: Record<string, number> = { paid: 0, invoiced: 0, committed: 0, prospect: 0 };
    for (const sponsor of state.sponsors) {
      if (sponsor.kind !== 'cash') continue;
      buckets[sponsor.status] += Number(sponsor.amount || 0);
    }
    return buckets;
  }, [state.sponsors]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-white">P&amp;L Snapshot</h2>
        <p className="mt-0.5 text-sm text-gray-400">
          Live computed from your sponsor + cost plan. Adjust target margin to flag risk.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          <BigStat label="Total Revenue" value={formatMoney(totals.revenue)} accent="emerald" />
          <BigStat label="Total Costs" value={formatMoney(totals.costs)} accent="rose" />
          <BigStat
            label="Net Margin"
            value={formatMoney(totals.margin)}
            accent={totals.margin >= 0 ? 'emerald' : 'rose'}
          />
          <BigStat
            label="Margin %"
            value={`${totals.marginPct.toFixed(1)}%`}
            accent={targetMet ? 'emerald' : 'amber'}
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-200">Target margin</span>
            <input
              type="number"
              value={state.targetMarginPct}
              onChange={(e) => onChange({ targetMarginPct: e.target.value })}
              className="w-20 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-right text-sm text-white focus:border-purple-500/50 focus:outline-none"
            />
            <span className="text-sm text-gray-400">%</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {targetMet ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-300">
                <i className="fa-solid fa-circle-check mr-1.5" /> On target
              </span>
            ) : (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-medium text-amber-300">
                <i className="fa-solid fa-triangle-exclamation mr-1.5" />
                {gap.toFixed(1)} pts below target — need {formatMoney((target / 100) * totals.revenue - totals.margin)} more revenue or savings
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl">
          <h3 className="mb-4 text-base font-semibold text-white">Costs by Category</h3>
          {byCategory.length === 0 && (
            <p className="text-sm text-gray-500">Add cost lines on the previous step.</p>
          )}
          <div className="space-y-3">
            {byCategory.map(([category, total]) => {
              const pct = totals.costs > 0 ? (total / totals.costs) * 100 : 0;
              return (
                <div key={category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-200">{category}</span>
                    <span className="text-gray-400">
                      {formatMoney(total)} <span className="text-xs text-gray-500">({pct.toFixed(0)}%)</span>
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
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl">
          <h3 className="mb-4 text-base font-semibold text-white">Cash flow status</h3>
          <div className="space-y-4">
            <FlowBlock label="Sponsor revenue (cash)" buckets={sponsorByStatus} accent="emerald" />
            <FlowBlock label="Cost commitments" buckets={byStatus} accent="rose" />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl">
        <h3 className="mb-4 text-base font-semibold text-white">Sensitivity</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SensitivityCard
            label="If costs grow 10%"
            margin={totals.revenue - totals.costs * 1.1}
            revenue={totals.revenue}
          />
          <SensitivityCard
            label="If 1 sponsor drops"
            margin={totals.revenue * 0.85 - totals.costs}
            revenue={totals.revenue * 0.85}
          />
          <SensitivityCard
            label="Best case (+10% revenue, -5% cost)"
            margin={totals.revenue * 1.1 - totals.costs * 0.95}
            revenue={totals.revenue * 1.1}
          />
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
          onClick={onNext}
          className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-pink-500"
        >
          Next: Launch <i className="fa-solid fa-arrow-right ml-2" />
        </button>
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'emerald' | 'rose' | 'amber' | 'blue';
}) {
  const cls =
    accent === 'emerald'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
      : accent === 'rose'
      ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
      : accent === 'amber'
      ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
      : 'border-blue-500/20 bg-blue-500/10 text-blue-300';
  return (
    <div className={`rounded-xl border p-4 backdrop-blur-md ${cls}`}>
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function FlowBlock({
  label,
  buckets,
  accent,
}: {
  label: string;
  buckets: Record<string, number>;
  accent: 'emerald' | 'rose';
}) {
  const total = Object.values(buckets).reduce((sum, v) => sum + v, 0);
  const palette: Record<string, string> = {
    paid: accent === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500',
    invoiced: accent === 'emerald' ? 'bg-emerald-300' : 'bg-rose-300',
    committed: 'bg-blue-400',
    budgeted: 'bg-white/20',
    prospect: 'bg-white/20',
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-200">{label}</span>
        <span className="text-gray-400">{formatMoney(total)}</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
        {Object.entries(buckets).map(([key, value]) => {
          if (value <= 0 || total === 0) return null;
          const pct = (value / total) * 100;
          return (
            <div
              key={key}
              className={palette[key]}
              style={{ width: `${pct}%` }}
              title={`${key}: ${formatMoney(value)}`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
        {Object.entries(buckets).map(([key, value]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${palette[key]}`} />
            <span className="capitalize">{key}</span>
            <span className="text-gray-500">{formatMoney(value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SensitivityCard({
  label,
  margin,
  revenue,
}: {
  label: string;
  margin: number;
  revenue: number;
}) {
  const pct = revenue > 0 ? (margin / revenue) * 100 : 0;
  const positive = margin >= 0;
  return (
    <div
      className={`rounded-xl border p-4 backdrop-blur-md ${
        positive
          ? 'border-emerald-500/20 bg-emerald-500/5'
          : 'border-rose-500/20 bg-rose-500/5'
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>
        {formatMoney(margin)}
      </p>
      <p className="text-xs text-gray-500">{pct.toFixed(1)}% margin</p>
    </div>
  );
}
