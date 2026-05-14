import React, { useMemo } from 'react';
import { CostCategory, formatMoney } from '../types';
import { EventWizardState, WizardCostLine } from './types';

type Props = {
  state: EventWizardState;
  onChange: (patch: Partial<EventWizardState>) => void;
  categories: CostCategory[];
  onBack: () => void;
  onNext: () => void;
};

const STATUS_OPTIONS: WizardCostLine['status'][] = ['budgeted', 'committed', 'invoiced', 'paid'];

const STATUS_COLOR: Record<WizardCostLine['status'], string> = {
  budgeted: 'bg-white/5 text-gray-300 border-white/10',
  committed: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  invoiced: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  paid: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
};

const INPUT_BARE =
  'rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:bg-white/10 focus:outline-none';
const INPUT_BASE =
  'rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:bg-white/10 focus:outline-none';

function newCost(category: CostCategory): WizardCostLine {
  return {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    category,
    description: '',
    vendor: '',
    qty: '1',
    unitCost: '',
    status: 'budgeted',
  };
}

export default function EventCostsStep({
  state,
  onChange,
  categories,
  onBack,
  onNext,
}: Props) {
  const updateCost = (id: string, patch: Partial<WizardCostLine>) => {
    onChange({
      costs: state.costs.map((cost) => (cost.id === id ? { ...cost, ...patch } : cost)),
    });
  };

  const removeCost = (id: string) => {
    onChange({ costs: state.costs.filter((cost) => cost.id !== id) });
  };

  const addCost = (category: CostCategory) => {
    onChange({ costs: [...state.costs, newCost(category)] });
  };

  const grouped = useMemo(() => {
    const map = new Map<CostCategory, WizardCostLine[]>();
    for (const category of categories) map.set(category, []);
    for (const cost of state.costs) {
      const list = map.get(cost.category) ?? [];
      list.push(cost);
      map.set(cost.category, list);
    }
    return map;
  }, [state.costs, categories]);

  const grandTotal = state.costs.reduce(
    (sum, cost) => sum + Number(cost.qty || 0) * Number(cost.unitCost || 0),
    0
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 backdrop-blur-xl sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Cost Plan</h2>
            <p className="mt-0.5 text-sm text-gray-400">
              Group costs by category. Each line tracks status from budgeted → paid.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-gray-400">Total cost plan</p>
            <p className="text-xl font-bold text-rose-300">{formatMoney(grandTotal)}</p>
          </div>
        </div>

        <div className="space-y-5">
          {categories.map((category) => {
            const lines = grouped.get(category) || [];
            const categoryTotal = lines.reduce(
              (sum, cost) => sum + Number(cost.qty || 0) * Number(cost.unitCost || 0),
              0
            );
            return (
              <div key={category} className="overflow-hidden rounded-xl border border-white/10">
                <div className="flex items-center justify-between bg-white/[0.04] px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-gray-100">{category}</h3>
                    <span className="text-xs text-gray-500">{lines.length} items</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-200">
                      {formatMoney(categoryTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => addCost(category)}
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
                          <th className="px-3 py-2 font-medium">Description</th>
                          <th className="px-3 py-2 font-medium">Vendor</th>
                          <th className="px-3 py-2 font-medium">Qty</th>
                          <th className="px-3 py-2 font-medium">Unit Cost</th>
                          <th className="px-3 py-2 font-medium">Total</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {lines.map((line) => {
                          const lineTotal = Number(line.qty || 0) * Number(line.unitCost || 0);
                          return (
                            <tr key={line.id} className="hover:bg-white/[0.02]">
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={line.description}
                                  onChange={(e) =>
                                    updateCost(line.id, { description: e.target.value })
                                  }
                                  placeholder="e.g. Venue rental – main ballroom"
                                  className={`w-64 ${INPUT_BARE}`}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={line.vendor}
                                  onChange={(e) =>
                                    updateCost(line.id, { vendor: e.target.value })
                                  }
                                  placeholder="Vendor"
                                  className={`w-36 ${INPUT_BARE}`}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={line.qty}
                                  onChange={(e) => updateCost(line.id, { qty: e.target.value })}
                                  className={`w-16 text-right ${INPUT_BASE}`}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={line.unitCost}
                                  onChange={(e) =>
                                    updateCost(line.id, { unitCost: e.target.value })
                                  }
                                  placeholder="0"
                                  className={`w-28 text-right ${INPUT_BASE}`}
                                />
                              </td>
                              <td className="px-3 py-2 text-right text-sm font-medium text-gray-100">
                                {formatMoney(lineTotal)}
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={line.status}
                                  onChange={(e) =>
                                    updateCost(line.id, {
                                      status: e.target.value as WizardCostLine['status'],
                                    })
                                  }
                                  className={`rounded-full border px-2 py-0.5 text-xs font-medium uppercase ${STATUS_COLOR[line.status]}`}
                                >
                                  {STATUS_OPTIONS.map((option) => (
                                    <option key={option} value={option} className="bg-slate-900 text-white">
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeCost(line.id)}
                                  className="text-gray-500 hover:text-rose-400"
                                  title="Remove"
                                >
                                  <i className="fa-solid fa-trash" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
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
          Next: Margin Review <i className="fa-solid fa-arrow-right ml-2" />
        </button>
      </div>
    </div>
  );
}
