import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COST_CATEGORIES, formatMoney } from '../types';
import { createEvent, replaceCosts, replaceSponsors, updateEventBasics } from '../api';
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

function wizardStateToBasics(state: EventWizardState) {
  return {
    name: state.name || 'Untitled Event',
    kind: state.kind,
    clientName: state.kind === 'external' ? state.clientName : null,
    startDate: state.startDate || null,
    endDate: state.endDate || null,
    city: state.city || null,
    venue: state.venue || null,
    headcount: state.headcount,
    primaryContact: state.primaryContact || null,
    ownerName: state.ownerName || null,
    description: state.description || null,
    targetMarginPct: state.targetMarginPct,
  };
}

function wizardStateToSponsors(state: EventWizardState) {
  return state.sponsors
    .filter((sponsor) => String(sponsor.name || '').trim())
    .map((sponsor) => ({
      name: sponsor.name,
      kind: sponsor.kind,
      amount: sponsor.amount || 0,
      status: sponsor.status,
      contact: sponsor.contact || null,
      notes: sponsor.notes || null,
    }));
}

function wizardStateToCosts(state: EventWizardState) {
  return state.costs
    .filter((cost) => String(cost.description || '').trim())
    .map((cost) => ({
      category: cost.category,
      description: cost.description,
      vendor: cost.vendor || null,
      qty: cost.qty || 0,
      unitCost: cost.unitCost || 0,
      status: cost.status,
    }));
}

export default function EventWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStepNumber>(1);
  const [state, setState] = useState<EventWizardState>(DEFAULT_EVENT_WIZARD_STATE);
  const [eventId, setEventId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const updateState = (patch: Partial<EventWizardState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  };

  const persistDraft = async (currentState: EventWizardState): Promise<string | null> => {
    if (!currentState.name.trim()) {
      throw new Error('Add an event name before saving.');
    }
    let resolvedId = eventId;
    if (!resolvedId) {
      const created = await createEvent(wizardStateToBasics(currentState));
      resolvedId = created.id;
      setEventId(resolvedId);
    } else {
      await updateEventBasics(resolvedId, wizardStateToBasics(currentState));
    }
    if (!resolvedId) throw new Error('Failed to create event.');
    await replaceSponsors(resolvedId, wizardStateToSponsors(currentState));
    await replaceCosts(resolvedId, wizardStateToCosts(currentState));
    return resolvedId;
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await persistDraft(state);
      setSavedAt(Date.now());
    } catch (e: any) {
      setSaveError(String(e?.message || 'Failed to save draft.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLaunch = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const id = await persistDraft(state);
      if (!id) throw new Error('Failed to launch event.');
      await updateEventBasics(id, { status: 'planning' });
      navigate(`/ignite/events/${id}`);
    } catch (e: any) {
      setSaveError(String(e?.message || 'Failed to launch event.'));
      setIsSaving(false);
    }
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
    <div className="min-h-full rounded-2xl bg-gradient-to-br from-[#060609] via-[#0a0a0f] to-[#060609] text-white">
      <header className="rounded-t-2xl border-b border-white/10 bg-gradient-to-r from-purple-900/20 via-pink-900/20 to-blue-900/20 px-6 py-6 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
              Create Event
            </h1>
            <p className="mt-1 text-sm text-gray-400 sm:text-base">
              Plan an internal event or client engagement with end-to-end revenue, cost, and margin tracking.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {savedAt && !isSaving && (
              <span className="text-xs text-gray-400">
                <i className="fa-solid fa-check-circle mr-1 text-emerald-400" />
                Saved
              </span>
            )}
            {isSaving && <span className="text-xs text-gray-400">Saving…</span>}
            <button
              type="button"
              onClick={() => navigate('/ignite/events')}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-gray-300 hover:border-white/20 hover:bg-white/10"
            >
              <i className="fa-solid fa-xmark mr-2" />
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={isSaving}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-gray-200 hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
            >
              <i className="fa-solid fa-save mr-2" />
              Save Draft
            </button>
          </div>
        </div>
        {saveError && <p className="mt-2 text-sm text-rose-300">{saveError}</p>}
      </header>

      <div className="border-b border-white/10 bg-white/[0.02] px-6 py-4">
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
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all ${
                      active
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/30'
                        : done
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-white/5 text-gray-400 border border-white/10'
                    }`}
                  >
                    {done ? <i className="fa-solid fa-check text-xs" /> : s}
                  </div>
                  <span
                    className={`hidden sm:inline ${active ? 'font-medium text-white' : 'text-gray-400'}`}
                  >
                    {STEP_LABELS[s]}
                  </span>
                </button>
                {idx < 4 && <div className="h-px w-4 bg-white/10 sm:w-8" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="border-b border-white/10 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-blue-500/5 px-6 py-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-gray-300">
            <i className="fa-solid fa-sack-dollar mr-1.5 text-emerald-400" />
            Revenue <strong className="ml-1 text-white">{formatMoney(totals.revenue)}</strong>
          </span>
          <span className="text-gray-300">
            <i className="fa-solid fa-receipt mr-1.5 text-rose-400" />
            Costs <strong className="ml-1 text-white">{formatMoney(totals.costs)}</strong>
          </span>
          <span className="text-gray-300">
            <i className="fa-solid fa-chart-line mr-1.5 text-purple-400" />
            Margin{' '}
            <strong className="ml-1 text-white">
              {formatMoney(totals.margin)} ({totals.marginPct.toFixed(0)}%)
            </strong>
          </span>
          {totals.inKind > 0 && (
            <span className="text-gray-300">
              <i className="fa-solid fa-handshake mr-1.5 text-cyan-400" />
              In-kind <strong className="ml-1 text-white">{formatMoney(totals.inKind)}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="p-6 sm:p-8">
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
            onLaunch={() => void handleLaunch()}
          />
        )}
      </div>
    </div>
  );
}
