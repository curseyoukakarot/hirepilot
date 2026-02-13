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
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Step 3: Build Costs</h2>
              <label className="flex cursor-pointer items-center space-x-2">
                <input
                  type="checkbox"
                  checked={groupPreview}
                  onChange={(e) => onCostsChange({ ...costs, groupPreview: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">Group View Preview</span>
              </label>
            </div>

            <div className="mb-6 flex items-center space-x-2">
              {[1, 2, 3].slice(0, optionsCount).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setActiveOption(n as 1 | 2 | 3)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${
                    activeOption === n
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Option {n}
                </button>
              ))}
            </div>

            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={addRow}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
              >
                <i className="fa-solid fa-plus mr-2" />
                Add Line Item
              </button>
              <button type="button" onClick={addRow} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <i className="fa-solid fa-file-import mr-2" />
                Add from Template
              </button>
              <button type="button" onClick={addRow} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <i className="fa-solid fa-users mr-2" />
                Add from Vendor Library
              </button>
              <button type="button" onClick={addRow} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <i className="fa-solid fa-table mr-2" />
                Bulk Add
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {groupPreview ? (
              <div className="p-6">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Group View Preview
                </h3>
                <div className="space-y-2">
                  {categoryRollup.map(([category, amount]) => (
                    <div key={category} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                      <span className="text-sm font-medium text-gray-800">{category}</span>
                      <span className="text-sm font-semibold text-gray-900">{formatMoney(amount)}</span>
                    </div>
                  ))}
                  {!categoryRollup.length && (
                    <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
                      No visible grouped items for this option.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="w-32 px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                    <th className="w-48 px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Item / Description</th>
                    <th className="w-32 px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Vendor</th>
                    <th className="w-20 px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Qty</th>
                    <th className="w-24 px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Unit Cost</th>
                    <th className="w-20 px-3 py-3 text-center text-xs font-medium uppercase text-gray-500">Service</th>
                    <th className="w-20 px-3 py-3 text-center text-xs font-medium uppercase text-gray-500">Tax</th>
                    <th className="w-24 px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Total</th>
                    <th className="w-28 px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Display</th>
                    <th className="w-20 px-3 py-3 text-center text-xs font-medium uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <select
                          value={row.category}
                          onChange={(e) => updateRow(row.id, { category: e.target.value })}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          <option value="Venue">Venue</option>
                          <option value="F&B">F&B</option>
                          <option value="Entertainment">Entertainment & Collateral</option>
                          <option value="Production">Production Fees</option>
                          <option value="Travel">Travel</option>
                          <option value="Other">Other</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          value={row.item}
                          onChange={(e) => updateRow(row.id, { item: e.target.value })}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          value={row.vendor}
                          onChange={(e) => updateRow(row.id, { vendor: e.target.value })}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          value={row.qty}
                          onChange={(e) => updateRow(row.id, { qty: e.target.value })}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-xs text-gray-500">$</span>
                          <input
                            value={row.unitCost}
                            onChange={(e) => updateRow(row.id, { unitCost: e.target.value })}
                            className="w-full rounded border border-gray-300 py-1.5 pl-5 pr-2 text-sm"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.service}
                          onChange={(e) => updateRow(row.id, { service: e.target.checked })}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.tax}
                          onChange={(e) => updateRow(row.id, { tax: e.target.checked })}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-medium text-gray-900">
                          {formatMoney(computeLineTotal(row, serviceRatePct, taxRatePct, taxAfterService))}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={row.display}
                          onChange={(e) =>
                            updateRow(row.id, { display: e.target.value as IgniteDisplayMode })
                          }
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                        >
                          <option value="DETAIL">Detail</option>
                          <option value="GROUP">Group</option>
                          <option value="HIDE">Hide</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            className="text-gray-500 hover:text-blue-600"
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
                            className="text-gray-500 hover:text-blue-600"
                            title="Duplicate"
                            onClick={() => duplicateRow(row)}
                          >
                            <i className="fa-solid fa-copy text-sm" />
                          </button>
                          <button
                            type="button"
                            className="text-gray-500 hover:text-red-600"
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

          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 p-6">
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-gray-300 px-6 py-2 text-gray-600 hover:bg-gray-50"
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

      <aside className="w-80">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Live Totals</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Costs Subtotal</span>
              <span className="font-medium text-gray-900">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Ignite Fee ({igniteFeePct}%)</span>
              <span className="font-medium text-gray-900">{formatMoney(igniteFee)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Contingency ({contingencyPct}%)</span>
              <span className="font-medium text-gray-900">{formatMoney(contingency)}</span>
            </div>
            <div className="border-t border-gray-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">Total Investment</span>
                <span className="font-semibold text-blue-700">{formatMoney(totalInvestment)}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

