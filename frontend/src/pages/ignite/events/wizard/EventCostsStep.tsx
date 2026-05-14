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
  budgeted: 'bg-gray-100 text-gray-700 border-gray-200',
  committed: 'bg-blue-50 text-blue-700 border-blue-200',
  invoiced: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

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
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Cost Plan</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Group costs by category. Each line tracks status from budgeted → paid.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total cost plan</p>
            <p className="text-xl font-bold text-rose-600">{formatMoney(grandTotal)}</p>
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
              <div key={category} className="overflow-hidden rounded-xl border border-gray-200">
                <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-gray-800">{category}</h3>
                    <span className="text-xs text-gray-500">{lines.length} items</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-700">
                      {formatMoney(categoryTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => addCost(category)}
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
                          <th className="px-3 py-2 font-medium">Description</th>
                          <th className="px-3 py-2 font-medium">Vendor</th>
                          <th className="px-3 py-2 font-medium">Qty</th>
                          <th className="px-3 py-2 font-medium">Unit Cost</th>
                          <th className="px-3 py-2 font-medium">Total</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {lines.map((line) => {
                          const lineTotal = Number(line.qty || 0) * Number(line.unitCost || 0);
                          return (
                            <tr key={line.id} className="hover:bg-gray-50/60">
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={line.description}
                                  onChange={(e) =>
                                    updateCost(line.id, { description: e.target.value })
                                  }
                                  placeholder="e.g. Venue rental – main ballroom"
                                  className="w-64 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm focus:border-blue-300 focus:bg-white focus:outline-none"
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
                                  className="w-36 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm focus:border-blue-300 focus:bg-white focus:outline-none"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={line.qty}
                                  onChange={(e) => updateCost(line.id, { qty: e.target.value })}
                                  className="w-16 rounded-md border border-gray-200 px-2 py-1 text-right text-sm"
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
                                  className="w-28 rounded-md border border-gray-200 px-2 py-1 text-right text-sm"
                                />
                              </td>
                              <td className="px-3 py-2 text-right text-sm font-medium text-gray-700">
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
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeCost(line.id)}
                                  className="text-gray-400 hover:text-rose-500"
                                  title="Remove line"
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
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <i className="fa-solid fa-arrow-left mr-2" /> Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Next: Margin Review <i className="fa-solid fa-arrow-right ml-2" />
        </button>
      </div>
    </div>
  );
}
