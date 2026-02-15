import React from 'react';
import { IgniteProposalComputed } from '../../../ignite/types/proposals';
import type { IgniteWizardState } from './types';

type ReviewStepProps = {
  onBack: () => void;
  onNext: () => void;
  computed: IgniteProposalComputed | null;
  state: IgniteWizardState;
  clientName?: string;
};

function Accordion({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-lg border border-slate-700/70 bg-slate-950/35">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left font-medium text-slate-100 hover:bg-slate-800/50"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <i className={`fa-solid ${open ? 'fa-chevron-up' : 'fa-chevron-down'} text-slate-400`} />
      </button>
      {open && <div className="border-t border-slate-700/70 px-4 py-3 text-sm text-slate-300">{children}</div>}
    </div>
  );
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string): string {
  if (!value) return 'Date TBD';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function computeLineTotal(
  qtyRaw: string,
  unitCostRaw: string,
  service: boolean,
  tax: boolean,
  serviceRatePct: number,
  taxRatePct: number,
  taxAfterService: boolean
): number {
  const qty = toNumber(qtyRaw);
  const unitCost = toNumber(unitCostRaw);
  const base = qty * unitCost;
  const serviceRate = service ? serviceRatePct / 100 : 0;
  const taxRate = tax ? taxRatePct / 100 : 0;
  if (taxAfterService) return base * (1 + serviceRate) * (1 + taxRate);
  return base * (1 + taxRate) * (1 + serviceRate);
}

const COLOR_DOTS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-cyan-500', 'bg-pink-500'];

export default function ReviewStep({ onBack, onNext, computed, state, clientName }: ReviewStepProps) {
  const [tab, setTab] = React.useState<'internal' | 'client'>('internal');
  const activeOptionNumber: 1 | 2 | 3 = 1;
  const baseRows = state.buildCosts.rowsByOption[activeOptionNumber] || [];
  const hiddenCount = baseRows.filter((row) => row.display === 'HIDE').length;

  const fallbackLineItems = React.useMemo(() => {
    return baseRows.map((row) => ({
      id: row.id,
      category: row.category || 'Other',
      name: row.item || 'Untitled line item',
      vendor: row.vendor || null,
      amount: computeLineTotal(
        row.qty,
        row.unitCost,
        row.service,
        row.tax,
        toNumber(state.serviceCharge),
        toNumber(state.salesTax),
        state.taxAfterService
      ),
      qty: row.qty,
      unitCost: row.unitCost,
      service: row.service,
      tax: row.tax,
    }));
  }, [baseRows, state.serviceCharge, state.salesTax, state.taxAfterService]);

  const fallbackBreakdown = React.useMemo(() => {
    const acc = new Map<string, number>();
    fallbackLineItems.forEach((item) => {
      acc.set(item.category, (acc.get(item.category) || 0) + item.amount);
    });
    return Array.from(acc.entries()).map(([categoryName, amount]) => ({ categoryName, amount }));
  }, [fallbackLineItems]);

  const fallbackSubtotal = React.useMemo(
    () => fallbackLineItems.reduce((sum, item) => sum + item.amount, 0),
    [fallbackLineItems]
  );
  const fallbackFee = fallbackSubtotal * (toNumber(state.mgmtFee) / 100);
  const fallbackContingency = fallbackSubtotal * (toNumber(state.contingency) / 100);
  const fallbackTotal = fallbackSubtotal + fallbackFee + fallbackContingency;

  const selectedComputedOption = React.useMemo(() => {
    if (!computed?.options?.length) return null;
    return computed.options.find((option) => option.isRecommended) || computed.options[0];
  }, [computed]);

  const totals = selectedComputedOption
    ? {
        subtotal: selectedComputedOption.totals.subtotal,
        fee: selectedComputedOption.totals.fee,
        contingency: selectedComputedOption.totals.contingency,
        total: selectedComputedOption.totals.total,
      }
    : {
        subtotal: fallbackSubtotal,
        fee: fallbackFee,
        contingency: fallbackContingency,
        total: fallbackTotal,
      };

  const breakdown = selectedComputedOption
    ? selectedComputedOption.breakdown
    : fallbackBreakdown;

  const previewLineItems = selectedComputedOption
    ? selectedComputedOption.lineItems
    : fallbackLineItems.map((item) => ({
        id: item.id,
        category: item.category,
        name: item.name,
        description: null,
        amount: item.amount,
        vendor: item.vendor,
      }));

  const warnings = React.useMemo(() => {
    const results: string[] = [];
    fallbackLineItems.forEach((item) => {
      if (!item.vendor) results.push(`${item.name} - Missing vendor information`);
      if (toNumber(item.unitCost) === 0) results.push(`${item.name} - Unit cost is $0`);
    });
    return results.slice(0, 4);
  }, [fallbackLineItems]);

  const unusualSettings = React.useMemo(() => {
    const results: string[] = [];
    fallbackLineItems.forEach((item) => {
      if (!item.service) results.push(`${item.name}: Service OFF`);
      if (item.tax && item.category.toLowerCase() === 'travel') results.push(`${item.name}: Travel marked taxable`);
    });
    return results.slice(0, 4);
  }, [fallbackLineItems]);

  const optionDifferences = React.useMemo(() => {
    const totalsByOption = ([1, 2, 3] as const)
      .slice(0, state.optionsCount)
      .map((opt) => {
        const rows = state.buildCosts.rowsByOption[opt] || [];
        const subtotal = rows.reduce(
          (sum, row) =>
            sum +
            computeLineTotal(
              row.qty,
              row.unitCost,
              row.service,
              row.tax,
              toNumber(state.serviceCharge),
              toNumber(state.salesTax),
              state.taxAfterService
            ),
          0
        );
        const fee = subtotal * (toNumber(state.mgmtFee) / 100);
        const contingency = subtotal * (toNumber(state.contingency) / 100);
        return subtotal + fee + contingency;
      });
    const base = totalsByOption[0] || 0;
    return totalsByOption.slice(1).map((value, idx) => {
      const diff = value - base;
      const label = `Option ${idx + 2}`;
      return `${label} is ${diff >= 0 ? '+' : ''}${formatMoney(diff)} vs Option 1`;
    });
  }, [state]);

  const eventTitle = computed?.eventName || state.eventName || 'Untitled Proposal';
  const eventClientName = computed?.clientName || clientName || 'Client';
  const eventDate = computed?.date || state.eventDate || '';
  const eventHeadcount = computed?.headcount || toNumber(state.headcount);

  const groupedPreviewItems = React.useMemo(() => {
    const map = new Map<string, typeof previewLineItems>();
    previewLineItems.forEach((item) => {
      const key = item.category || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return Array.from(map.entries());
  }, [previewLineItems]);

  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-950/45 shadow-lg shadow-black/20">
      <div className="border-b border-slate-700/70 p-6">
        <h2 className="text-xl font-semibold text-slate-100">Step 4: Review</h2>
        <p className="mt-1 text-slate-300">Review internal calculations and client presentation</p>
      </div>

      <div className="border-b border-slate-700/70">
        <div className="flex">
          <button
            type="button"
            onClick={() => setTab('internal')}
            className={`px-6 py-4 text-sm font-medium ${
              tab === 'internal'
                ? 'border-b-2 border-indigo-500 text-indigo-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-calculator mr-2" />
            Internal Review
          </button>
          <button
            type="button"
            onClick={() => setTab('client')}
            className={`px-6 py-4 text-sm font-medium ${
              tab === 'client'
                ? 'border-b-2 border-indigo-500 text-indigo-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-file-invoice mr-2" />
            Client Preview
          </button>
        </div>
      </div>

      {tab === 'internal' ? (
        <div className="p-6">
          <div className="mb-8 grid grid-cols-4 gap-4">
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/15 p-4">
              <div className="mb-1 text-sm font-medium text-indigo-200">Total Investment</div>
              <div className="text-2xl font-bold text-indigo-100">{formatMoney(totals.total)}</div>
            </div>
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/15 p-4">
              <div className="mb-1 text-sm font-medium text-violet-200">Costs Subtotal</div>
              <div className="text-2xl font-bold text-violet-100">{formatMoney(totals.subtotal)}</div>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 p-4">
              <div className="mb-1 text-sm font-medium text-emerald-200">Ignite Fee ({toNumber(state.mgmtFee)}%)</div>
              <div className="text-2xl font-bold text-emerald-100">{formatMoney(totals.fee)}</div>
            </div>
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/15 p-4">
              <div className="mb-1 text-sm font-medium text-purple-200">Contingency ({toNumber(state.contingency)}%)</div>
              <div className="text-2xl font-bold text-purple-100">{formatMoney(totals.contingency)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="mb-4 text-lg font-semibold text-slate-100">Category Breakdown</h3>
              <div className="space-y-3">
                {breakdown.map((row, index) => (
                  <div key={row.categoryName} className="flex items-center justify-between border-b border-slate-700/60 py-3">
                    <div className="flex items-center space-x-3">
                      <div className={`h-3 w-3 rounded-full ${COLOR_DOTS[index % COLOR_DOTS.length]}`} />
                      <span className="font-medium text-slate-100">{row.categoryName}</span>
                    </div>
                    <span className="font-semibold text-slate-100">{formatMoney(row.amount)}</span>
                  </div>
                ))}
                {!breakdown.length && (
                  <div className="py-3 text-sm text-slate-400">No line items available yet.</div>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-lg font-semibold text-slate-100">Audit</h3>
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-400/40 bg-amber-300/15 p-4">
                  <div className="mb-2 flex items-center space-x-2">
                    <i className="fa-solid fa-exclamation-triangle text-amber-300" />
                    <span className="font-medium text-amber-200">Warnings</span>
                  </div>
                  <ul className="space-y-1 text-sm text-amber-100">
                    {warnings.length ? (
                      warnings.map((warning) => <li key={warning}>• {warning}</li>)
                    ) : (
                      <li>• No blocking warnings detected.</li>
                    )}
                  </ul>
                </div>

                <Accordion title={`Hidden Items (${hiddenCount})`}>
                  {hiddenCount ? `${hiddenCount} item(s) are hidden from client view.` : 'No items are hidden from client view.'}
                </Accordion>
                <Accordion title="Unusual Service/Tax Settings">
                  {unusualSettings.length ? (
                    <div className="space-y-2">
                      {unusualSettings.map((line) => (
                        <div key={line}>• {line}</div>
                      ))}
                    </div>
                  ) : (
                    <div>No unusual settings detected.</div>
                  )}
                </Accordion>
                <Accordion title="Option Differences">
                  {optionDifferences.length ? (
                    <div className="space-y-1">
                      {optionDifferences.map((line) => (
                        <div key={line}>• {line}</div>
                      ))}
                    </div>
                  ) : (
                    <div>Only one option configured.</div>
                  )}
                </Accordion>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6">
          <div className="mx-auto max-w-2xl">
            <div className="mb-6 rounded-lg border border-slate-700/70 bg-slate-900/55 p-6">
              <div className="mb-6 text-center">
                <h3 className="text-xl font-bold text-slate-100">{eventTitle}</h3>
                <p className="mt-1 text-slate-300">
                  {eventClientName} • {formatDate(eventDate)} • {eventHeadcount || 0} guests
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {groupedPreviewItems.map(([category, items]) => (
                <div key={category} className="border-b border-slate-700/60 pb-4">
                  <h4 className="mb-3 font-semibold text-slate-100">{category}</h4>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={`${category}-${item.id || item.name}`} className="flex justify-between text-sm">
                        <span className="text-slate-300">{item.name}</span>
                        <span className="font-medium text-slate-100">{formatMoney(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="border-b border-slate-700/60 pb-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-300">Subtotal</span>
                  <span className="font-medium text-slate-100">{formatMoney(totals.subtotal)}</span>
                </div>
              </div>
              <div className="border-b border-slate-700/60 pb-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-300">Ignite Management Fee ({toNumber(state.mgmtFee)}%)</span>
                  <span className="font-medium text-slate-100">{formatMoney(totals.fee)}</span>
                </div>
              </div>
              <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/15 p-4">
                <div className="flex justify-between">
                  <span className="text-lg font-bold text-indigo-100">Total Investment</span>
                  <span className="text-lg font-bold text-indigo-100">{formatMoney(totals.total)}</span>
                </div>
              </div>
              <div className="mt-6 text-xs text-slate-400">
                <p>
                  This proposal is valid for 30 days. All prices include applicable taxes and service
                  charges.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-700/70 bg-slate-900/45 p-6">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-600/80 px-6 py-2 text-slate-300 hover:bg-slate-800/70"
        >
          <i className="fa-solid fa-arrow-left mr-2" />
          Back to Build Costs
        </button>
        <div className="flex items-center space-x-3">
          <div className="text-sm text-slate-300">
            <i className="fa-solid fa-check-circle mr-1 text-green-500" />
            Ready to export
          </div>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            Continue to Export
            <i className="fa-solid fa-arrow-right ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}

