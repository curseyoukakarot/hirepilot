import React from 'react';
import { IgniteDisplayMode, IgniteWizardCostsState, IgniteWizardLineItem } from './types';

type BuildCostsStepProps = {
  onBack: () => void;
  onNext: () => void;
  optionsCount: 1 | 2 | 3;
  serviceRatePct: number;
  taxRatePct: number;
  taxAfterService: boolean;
  igniteFeePct: number;
  contingencyPct: number;
  costs: IgniteWizardCostsState;
  onCostsChange: (next: IgniteWizardCostsState) => void;
};

function toNumber(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function computeLineTotal(
  row: IgniteWizardLineItem,
  serviceRatePct: number,
  taxRatePct: number,
  taxAfterService: boolean
): number {
  const qty = toNumber(row.qty);
  const unit = toNumber(row.unitCost);
  const base = qty * unit;
  const serviceRate = row.service ? serviceRatePct / 100 : 0;
  const taxRate = row.tax ? taxRatePct / 100 : 0;

  if (taxAfterService) {
    return base * (1 + serviceRate) * (1 + taxRate);
  }
  return base * (1 + taxRate) * (1 + serviceRate);
}

export default function BuildCostsStep({
  onBack,
  onNext,
  optionsCount,
  serviceRatePct,
  taxRatePct,
  taxAfterService,
  igniteFeePct,
  contingencyPct,
  costs,
  onCostsChange,
}: BuildCostsStepProps) {
  const fieldClassName =
    'w-full rounded-md border border-slate-600/80 bg-slate-900/70 px-2 py-1.5 text-sm text-slate-100 placeholder-slate-400 shadow-inner shadow-black/20 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30';
  const ghostButtonClassName =
    'rounded-lg border border-slate-600/80 bg-slate-900/55 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800/80';

  const [activeOption, setActiveOption] = React.useState<1 | 2 | 3>(1);

  React.useEffect(() => {
    if (activeOption > optionsCount) setActiveOption(optionsCount);
  }, [activeOption, optionsCount]);

  const rowsByOption = costs.rowsByOption;
  const rows = rowsByOption[activeOption] || [];
  const visibleRows = rows.filter((r) => r.display !== 'HIDE');
  const groupPreview = costs.groupPreview;

  const categoryRollup = React.useMemo(() => {
    const acc: Record<string, number> = {};
    visibleRows.forEach((row) => {
      const total = computeLineTotal(row, serviceRatePct, taxRatePct, taxAfterService);
      acc[row.category] = (acc[row.category] || 0) + total;
    });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [visibleRows, serviceRatePct, taxRatePct, taxAfterService]);

  const subtotal = React.useMemo(
    () => rows.reduce((sum, row) => sum + computeLineTotal(row, serviceRatePct, taxRatePct, taxAfterService), 0),
    [rows, serviceRatePct, taxRatePct, taxAfterService]
  );
  const igniteFee = subtotal * (igniteFeePct / 100);
  const contingency = subtotal * (contingencyPct / 100);
  const totalInvestment = subtotal + igniteFee + contingency;

  const setRowsForOption = (option: 1 | 2 | 3, nextRows: IgniteWizardLineItem[]) => {
    onCostsChange({
      ...costs,
      rowsByOption: {
        ...costs.rowsByOption,
        [option]: nextRows,
      },
    });
  };

  const updateRow = (id: string, patch: Partial<IgniteWizardLineItem>) => {
    const nextRows = (rowsByOption[activeOption] || []).map((row) =>
      row.id === id ? { ...row, ...patch } : row
    );
    setRowsForOption(activeOption, nextRows);
  };

  const addRow = () => {
    const id = `${activeOption}-${Date.now()}`;
    const next: IgniteWizardLineItem = {
      id,
      category: 'Other',
      item: '',
      vendor: '',
      qty: '1',
      unitCost: '0',
      service: true,
      tax: true,
      display: 'DETAIL',
      notes: '',
    };
    setRowsForOption(activeOption, [...(rowsByOption[activeOption] || []), next]);
  };

  const deleteRow = (id: string) => {
    setRowsForOption(
      activeOption,
      (rowsByOption[activeOption] || []).filter((row) => row.id !== id)
    );
  };

  const duplicateRow = (row: IgniteWizardLineItem) => {
    const id = `${activeOption}-${Date.now()}`;
    const copy = { ...row, id };
    setRowsForOption(activeOption, [...(rowsByOption[activeOption] || []), copy]);
  };

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <div className="flex-1">
        <div className="rounded-xl border border-slate-700/70 bg-slate-950/45 shadow-lg shadow-black/20">
          <div className="border-b border-slate-700/70 p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-slate-100">Step 3: Build Costs</h2>
              <label className="flex cursor-pointer items-center space-x-2">
                <input
                  type="checkbox"
                  checked={groupPreview}
                  onChange={(e) => onCostsChange({ ...costs, groupPreview: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-indigo-500"
                />
                <span className="text-sm text-slate-300">Group View Preview</span>
              </label>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-2">
              {[1, 2, 3].slice(0, optionsCount).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setActiveOption(n as 1 | 2 | 3)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${
                    activeOption === n
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700/80'
                  }`}
                >
                  Option {n}
                </button>
              ))}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addRow}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
              >
                <i className="fa-solid fa-plus mr-2" />
                Add Line Item
              </button>
              <button type="button" onClick={addRow} className={ghostButtonClassName}>
                <i className="fa-solid fa-file-import mr-2" />
                Add from Template
              </button>
              <button type="button" onClick={addRow} className={ghostButtonClassName}>
                <i className="fa-solid fa-users mr-2" />
                Add from Vendor Library
              </button>
              <button type="button" onClick={addRow} className={ghostButtonClassName}>
                <i className="fa-solid fa-table mr-2" />
                Bulk Add
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {groupPreview ? (
              <div className="p-6">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Group View Preview
                </h3>
                <div className="space-y-2">
                  {categoryRollup.map(([category, amount]) => (
                    <div key={category} className="flex items-center justify-between rounded-lg border border-slate-700/70 bg-slate-900/50 px-4 py-3">
                      <span className="text-sm font-medium text-slate-200">{category}</span>
                      <span className="text-sm font-semibold text-slate-100">{formatMoney(amount)}</span>
                    </div>
                  ))}
                  {!categoryRollup.length && (
                    <div className="rounded-lg border border-dashed border-slate-600 px-4 py-6 text-center text-sm text-slate-400">
                      No visible grouped items for this option.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <table className="min-w-[1480px] w-full text-[15px]">
                <thead className="border-b border-slate-700/70 bg-slate-900/65">
                  <tr>
                    <th className="w-[180px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">Category</th>
                    <th className="w-[320px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">Item / Description</th>
                    <th className="w-[220px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">Vendor</th>
                    <th className="w-[100px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">Qty</th>
                    <th className="w-[140px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">Unit Cost</th>
                    <th className="w-[100px] px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">Service</th>
                    <th className="w-[100px] px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">Tax</th>
                    <th className="w-[150px] px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">Total</th>
                    <th className="w-[150px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">Display</th>
                    <th className="w-[120px] px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/70">
                  {rows.map((row) => (
                    <tr key={row.id} className="bg-slate-950/20 hover:bg-slate-800/35">
                      <td className="px-4 py-3">
                        <select
                          value={row.category}
                          onChange={(e) => updateRow(row.id, { category: e.target.value })}
                          className={fieldClassName}
                        >
                          <option value="Venue">Venue</option>
                          <option value="F&B">F&B</option>
                          <option value="Entertainment">Entertainment & Collateral</option>
                          <option value="Production">Production Fees</option>
                          <option value="Travel">Travel</option>
                          <option value="Other">Other</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={row.item}
                          onChange={(e) => updateRow(row.id, { item: e.target.value })}
                          className={fieldClassName}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={row.vendor}
                          onChange={(e) => updateRow(row.id, { vendor: e.target.value })}
                          className={fieldClassName}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={row.qty}
                          onChange={(e) => updateRow(row.id, { qty: e.target.value })}
                          className={fieldClassName}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-xs text-slate-400">$</span>
                          <input
                            value={row.unitCost}
                            onChange={(e) => updateRow(row.id, { unitCost: e.target.value })}
                            className="w-full rounded-md border border-slate-600/80 bg-slate-900/70 py-1.5 pl-5 pr-2 text-sm text-slate-100 shadow-inner shadow-black/20 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.service}
                          onChange={(e) => updateRow(row.id, { service: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.tax}
                          onChange={(e) => updateRow(row.id, { tax: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-slate-100">
                          {formatMoney(computeLineTotal(row, serviceRatePct, taxRatePct, taxAfterService))}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.display}
                          onChange={(e) =>
                            updateRow(row.id, { display: e.target.value as IgniteDisplayMode })
                          }
                          className="w-full rounded-md border border-slate-600/80 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        >
                          <option value="DETAIL">Detail</option>
                          <option value="GROUP">Group</option>
                          <option value="HIDE">Hide</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            className="text-slate-400 hover:text-indigo-300"
                            title="Add notes"
                            onClick={() => {
                              const next = window.prompt('Line item notes', row.notes || '');
                              if (next !== null) updateRow(row.id, { notes: next });
                            }}
                          >
                            <i className={`fa-solid fa-note-sticky text-sm ${row.notes ? 'text-blue-600' : ''}`} />
                          </button>
                          <button
                            type="button"
                            className="text-slate-400 hover:text-indigo-300"
                            title="Duplicate"
                            onClick={() => duplicateRow(row)}
                          >
                            <i className="fa-solid fa-copy text-sm" />
                          </button>
                          <button
                            type="button"
                            className="text-slate-400 hover:text-rose-400"
                            title="Delete"
                            onClick={() => deleteRow(row.id)}
                          >
                            <i className="fa-solid fa-trash text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-slate-700/70 bg-slate-900/45 p-4 sm:flex-row sm:items-center sm:p-6">
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-slate-600/80 px-6 py-2 text-slate-300 hover:bg-slate-800/70"
            >
              <i className="fa-solid fa-arrow-left mr-2" />
              Back to Assumptions
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
            >
              Continue to Review
              <i className="fa-solid fa-arrow-right ml-2" />
            </button>
          </div>
        </div>
      </div>

      <aside className="w-full xl:w-80">
        <div className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-6 shadow-lg shadow-black/20">
          <h3 className="mb-4 text-lg font-semibold text-slate-100">Live Totals</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Costs Subtotal</span>
              <span className="font-medium text-slate-100">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Ignite Fee ({igniteFeePct}%)</span>
              <span className="font-medium text-slate-100">{formatMoney(igniteFee)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Contingency ({contingencyPct}%)</span>
              <span className="font-medium text-slate-100">{formatMoney(contingency)}</span>
            </div>
            <div className="border-t border-slate-700/70 pt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-100">Total Investment</span>
                <span className="font-semibold text-indigo-300">{formatMoney(totalInvestment)}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

