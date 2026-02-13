import React, { useMemo } from 'react';
import type { IgniteWizardState, TurnkeyMethod } from './types';

type AssumptionsStepProps = {
  state: IgniteWizardState;
  onChange: (patch: Partial<IgniteWizardState>) => void;
  onBack: () => void;
  onNext: () => void;
};

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function AssumptionsStep({ state, onChange, onBack, onNext }: AssumptionsStepProps) {
  const upliftInfo = useMemo(() => {
    const service = toNumber(state.serviceCharge);
    const tax = toNumber(state.salesTax);
    const uplift = state.taxAfterService
      ? (1 + service / 100) * (1 + tax / 100) - 1
      : (service + tax) / 100;
    return {
      upliftPercent: (uplift * 100).toFixed(1),
      exampleTotal: (100 * (1 + uplift)).toFixed(2),
    };
  }, [state.serviceCharge, state.salesTax, state.taxAfterService]);

  const estimatedMargin = useMemo(() => {
    const margin = toNumber(state.targetMargin);
    const estimatedCost = 125000;
    const marginAmount = (estimatedCost * margin) / 100;
    return {
      margin: margin.toFixed(1),
      amount: Math.round(marginAmount),
    };
  }, [state.targetMargin]);

  const setTurnkeyMethod = (value: TurnkeyMethod) => onChange({ turnkeyMethod: value });

  return (
    <div className="max-w-6xl">
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="mb-6 text-xl font-semibold text-gray-900">Step 2: Assumptions & Pricing Structure</h2>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Venue & Fee Assumptions</h3>
              <p className="mt-1 text-sm text-gray-500">Configure service charges and tax rates</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Venue Preset (Optional)</label>
              <select
                value={state.venuePreset}
                onChange={(e) => {
                  const value = e.target.value;
                  onChange({ venuePreset: value });
                  if (value === 'convene-nyc') onChange({ serviceCharge: '23', salesTax: '8.875' });
                  if (value === 'hotel-banquet') onChange({ serviceCharge: '22', salesTax: '8.875' });
                  if (value === 'restaurant-no-service') onChange({ serviceCharge: '0', salesTax: '8.875' });
                }}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select venue type...</option>
                <option value="convene-nyc">Convene NYC</option>
                <option value="hotel-banquet">Hotel (Banquet)</option>
                <option value="restaurant-no-service">Restaurant (No Service Fee)</option>
                <option value="custom">Custom</option>
              </select>
              <p className="mt-1.5 text-xs text-gray-500">Auto-fills common venue fee structures</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Service Charge %</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={50}
                  step="0.1"
                  value={state.serviceCharge}
                  onChange={(e) => onChange({ serviceCharge: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-4 top-3.5 text-gray-500">%</span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">Typical range: 18-25%</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Sales Tax %</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={50}
                  step="0.001"
                  value={state.salesTax}
                  onChange={(e) => onChange({ salesTax: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-4 top-3.5 text-gray-500">%</span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">NYC: 8.875% | CA: 7.25-10.25%</p>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Tax applies after service</label>
                <p className="mt-0.5 text-xs text-gray-500">Standard calculation method</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={state.taxAfterService}
                  onChange={(e) => onChange({ taxAfterService: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
              </label>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start space-x-2">
                <i className="fa-solid fa-info-circle mt-0.5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Typical Total Uplift</p>
                  <p className="mt-1 text-sm text-blue-700">~{upliftInfo.upliftPercent}% with current settings</p>
                  <p className="mt-1 text-xs text-blue-600">Example: $100 base -&gt; ${upliftInfo.exampleTotal} total</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Ignite Pricing</h3>
              <p className="mt-1 text-sm text-gray-500">Management fees and contingency</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Ignite Management Fee %</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={50}
                  step="0.5"
                  value={state.mgmtFee}
                  onChange={(e) => onChange({ mgmtFee: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-4 top-3.5 text-gray-500">%</span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">Applied to subtotal before contingency</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Contingency %</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={50}
                  step="0.5"
                  value={state.contingency}
                  onChange={(e) => onChange({ contingency: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-4 top-3.5 text-gray-500">%</span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">Buffer for unexpected costs (optional)</p>
            </div>

            {state.modelType === 'turnkey' && (
              <div>
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start space-x-2">
                    <i className="fa-solid fa-box mt-0.5 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-amber-900">Turnkey Pricing Mode</p>
                      <p className="mt-1 text-xs text-amber-700">Choose your pricing strategy</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="flex cursor-pointer items-start rounded-lg border-2 border-gray-200 p-4 transition-colors hover:border-blue-300">
                    <input
                      type="radio"
                      name="turnkey-method"
                      value="margin"
                      checked={state.turnkeyMethod === 'margin'}
                      onChange={() => setTurnkeyMethod('margin')}
                      className="mt-1 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3 flex-1">
                      <span className="text-sm font-medium text-gray-900">Target Margin %</span>
                      <p className="mt-1 text-xs text-gray-500">Set desired profit margin percentage</p>
                      <div className="mt-3">
                        <div className="relative">
                          <input
                            type="number"
                            value={state.targetMargin}
                            min={0}
                            max={100}
                            step={1}
                            disabled={state.turnkeyMethod !== 'margin'}
                            onChange={(e) => onChange({ targetMargin: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                          />
                          <span className="absolute right-3 top-2.5 text-sm text-gray-500">%</span>
                        </div>
                      </div>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-start rounded-lg border-2 border-gray-200 p-4 transition-colors hover:border-blue-300">
                    <input
                      type="radio"
                      name="turnkey-method"
                      value="price"
                      checked={state.turnkeyMethod === 'price'}
                      onChange={() => setTurnkeyMethod('price')}
                      className="mt-1 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3 flex-1">
                      <span className="text-sm font-medium text-gray-900">Enter Sell Price Directly</span>
                      <p className="mt-1 text-xs text-gray-500">Specify exact package price</p>
                      <div className="mt-3">
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-sm text-gray-500">$</span>
                          <input
                            type="number"
                            value={state.targetPrice}
                            min={0}
                            step={100}
                            disabled={state.turnkeyMethod !== 'price'}
                            onChange={(e) => onChange({ targetPrice: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                          />
                        </div>
                      </div>
                    </div>
                  </label>
                </div>

                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-900">Estimated Margin</p>
                      <p className="mt-0.5 text-xs text-green-700">Based on current inputs</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-900">{estimatedMargin.margin}%</p>
                      <p className="text-xs text-green-700">${estimatedMargin.amount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <label className="flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={state.saveAsDefault}
                  onChange={(e) => onChange({ saveAsDefault: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-3 text-sm text-gray-700">Save as client default</span>
              </label>
              <p className="ml-7 mt-2 text-xs text-gray-500">
                Apply these assumptions to future proposals for this client
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-gray-300 px-6 py-2 text-gray-600 hover:bg-gray-50"
          >
            <i className="fa-solid fa-arrow-left mr-2" />
            Back to Basics
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            Continue to Build Costs
            <i className="fa-solid fa-arrow-right ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}

