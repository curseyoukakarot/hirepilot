import React, { useMemo } from 'react';
import { CostCategory, formatMoney } from '../mockData';
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
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">P&amp;L Snapshot</h2>
        <p className="mt-0.5 text-sm text-gray-500">
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

        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Target margin</span>
            <input
              type="number"
              value={state.targetMarginPct}
              onChange={(e) => onChange({ targetMarginPct: e.target.value })}
              className="w-20 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {targetMet ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                <i className="fa-solid fa-circle-check mr-1.5" /> On target
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">
                <i className="fa-solid fa-triangle-exclamation mr-1.5" />
                {gap.toFixed(1)} pts below target — need {formatMoney((target / 100) * totals.revenue - totals.margin)} more revenue or savings
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-gray-900">Costs by Category</h3>
          {byCategory.length === 0 && (
            <p className="text-sm text-gray-500">Add cost lines on the previous step.</p>
          )}
          <div className="space-y-3">
            {byCategory.map(([category, total]) => {
              const pct = totals.costs > 0 ? (total / totals.costs) * 100 : 0;
              return (
                <div key={category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{category}</span>
                    <span className="text-gray-600">
                      {formatMoney(total)} <span className="text-xs text-gray-400">({pct.toFixed(0)}%)</span>
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
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-gray-900">Cash flow status</h3>
          <div className="space-y-4">
            <FlowBlock label="Sponsor revenue (cash)" buckets={sponsorByStatus} accent="emerald" />
            <FlowBlock label="Cost commitments" buckets={byStatus} accent="rose" />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900">Sensitivity</h3>
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
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <i className="fa-solid fa-arrow-left mr-2" /> Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
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
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : accent === 'rose'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : accent === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-blue-200 bg-blue-50 text-blue-700';
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
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
    committed: 'bg-blue-300',
    budgeted: 'bg-gray-300',
    prospect: 'bg-gray-300',
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-600">{formatMoney(total)}</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
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
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
        {Object.entries(buckets).map(([key, value]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${palette[key]}`} />
            <span className="capitalize">{key}</span>
            <span className="text-gray-400">{formatMoney(value)}</span>
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
    <div className={`rounded-xl border p-4 ${positive ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'}`}>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${positive ? 'text-emerald-700' : 'text-rose-700'}`}>
        {formatMoney(margin)}
      </p>
      <p className="text-xs text-gray-500">{pct.toFixed(1)}% margin</p>
    </div>
  );
}
