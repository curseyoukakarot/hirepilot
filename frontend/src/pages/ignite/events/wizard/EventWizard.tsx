import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CostCategory, formatMoney } from '../mockData';
import EventBasicsStep from './EventBasicsStep';
import EventSponsorsStep from './EventSponsorsStep';
import EventCostsStep from './EventCostsStep';
import EventMarginStep from './EventMarginStep';
import EventLaunchStep from './EventLaunchStep';
import {
  DEFAULT_EVENT_WIZARD_STATE,
  EventWizardState,
  STEP_LABELS,
  WizardStepNumber,
} from './types';

const COST_CATEGORIES: CostCategory[] = [
  'Venue',
  'Manpower',
  'Booth & Supplies',
  'Travel',
  'F&B',
  'Production',
  'Marketing',
  'Other',
];

export default function EventWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStepNumber>(1);
  const [state, setState] = useState<EventWizardState>(DEFAULT_EVENT_WIZARD_STATE);

  const updateState = (patch: Partial<EventWizardState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  };

  const totals = useMemo(() => {
    const revenue = state.sponsors
      .filter((sponsor) => sponsor.kind === 'cash')
      .reduce((sum, sponsor) => sum + Number(sponsor.amount || 0), 0);
    const inKind = state.sponsors
      .filter((sponsor) => sponsor.kind === 'in_kind')
      .reduce((sum, sponsor) => sum + Number(sponsor.amount || 0), 0);
    const costs = state.costs.reduce(
      (sum, cost) => sum + Number(cost.qty || 0) * Number(cost.unitCost || 0),
      0
    );
    const margin = revenue - costs;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
    return { revenue, inKind, costs, margin, marginPct };
  }, [state.sponsors, state.costs]);

  const stepCompletion: Record<WizardStepNumber, boolean> = useMemo(
    () => ({
      1: !!state.name && !!state.startDate && !!state.city && !!state.venue,
      2: state.sponsors.some((sponsor) => sponsor.name && sponsor.amount),
      3: state.costs.some((cost) => cost.description && cost.unitCost),
      4: false,
      5: false,
    }),
    [state]
  );

  return (
    <div>
      <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Create Event</h1>
            <p className="mt-1 text-sm text-gray-600 sm:text-base">
              Plan an internal event or client engagement with end-to-end revenue, cost, and margin tracking.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate('/ignite/events')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 sm:px-4"
            >
              <i className="fa-solid fa-xmark mr-2" />
              Cancel
            </button>
            <button
              type="button"
              onClick={() => alert('Mock: would save draft to /api/ignite/events')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 sm:px-4"
            >
              <i className="fa-solid fa-save mr-2" />
              Save Draft
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex items-center gap-4 overflow-x-auto pb-1 sm:gap-8">
          {([1, 2, 3, 4, 5] as WizardStepNumber[]).map((s, idx) => {
            const done = s < step && stepCompletion[s];
            const active = s === step;
            return (
              <React.Fragment key={s}>
                <button
                  type="button"
                  onClick={() => setStep(s)}
                  className="flex shrink-0 items-center space-x-2"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                      active
                        ? 'bg-blue-600 text-white'
                        : done
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {done ? <i className="fa-solid fa-check text-xs" /> : s}
                  </div>
                  <span
                    className={`${active ? 'font-medium text-blue-600' : 'text-gray-600'} hidden sm:inline`}
                  >
                    {STEP_LABELS[s]}
                  </span>
                </button>
                {idx < 4 && <div className="h-px w-4 bg-gray-300 sm:w-8" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="border-b border-gray-100 bg-blue-50/40 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-blue-900">
            <i className="fa-solid fa-sack-dollar mr-1.5 text-emerald-600" />
            Revenue <strong className="ml-1">{formatMoney(totals.revenue)}</strong>
          </span>
          <span className="text-blue-900">
            <i className="fa-solid fa-receipt mr-1.5 text-rose-600" />
            Costs <strong className="ml-1">{formatMoney(totals.costs)}</strong>
          </span>
          <span className="text-blue-900">
            <i className="fa-solid fa-chart-line mr-1.5 text-blue-600" />
            Margin{' '}
            <strong className="ml-1">
              {formatMoney(totals.margin)} ({totals.marginPct.toFixed(0)}%)
            </strong>
          </span>
          {totals.inKind > 0 && (
            <span className="text-blue-900">
              <i className="fa-solid fa-handshake mr-1.5 text-cyan-600" />
              In-kind <strong className="ml-1">{formatMoney(totals.inKind)}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 md:p-8">
        {step === 1 && (
          <EventBasicsStep
            state={state}
            onChange={updateState}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <EventSponsorsStep
            state={state}
            onChange={updateState}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <EventCostsStep
            state={state}
            onChange={updateState}
            categories={COST_CATEGORIES}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <EventMarginStep
            state={state}
            totals={totals}
            onChange={updateState}
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
          />
        )}
        {step === 5 && (
          <EventLaunchStep
            state={state}
            totals={totals}
            onBack={() => setStep(4)}
            onLaunch={() => {
              alert('Mock: would POST event to /api/ignite/events and redirect to detail page.');
              navigate('/ignite/events');
            }}
          />
        )}
      </div>
    </div>
  );
}
