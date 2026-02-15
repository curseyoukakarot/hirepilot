import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPatch, apiPost } from '../../../lib/api';
import { IgniteProposalComputed } from '../../../ignite/types/proposals';
import AssumptionsStep from './AssumptionsStep';
import BasicsStep from './BasicsStep';
import BuildCostsStep from './BuildCostsStep';
import ExportStep from './ExportStep';
import ReviewStep from './ReviewStep';
import { DEFAULT_IGNITE_WIZARD_STATE, IgniteWizardState } from './types';

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Basics',
  2: 'Assumptions',
  3: 'Build Costs',
  4: 'Review',
  5: 'Export',
};

function buildProposalPayload(state: IgniteWizardState) {
  return {
    name: state.eventName || 'Untitled Proposal',
    pricing_mode: state.modelType === 'turnkey' ? 'turnkey' : 'cost_plus',
    assumptions_json: {
      event: {
        location: state.location,
        eventDate: state.eventDate,
        headcount: Number(state.headcount || 0),
      },
      serviceChargePercent: Number(state.serviceCharge || 0),
      salesTaxPercent: Number(state.salesTax || 0),
      taxAppliesAfterService: state.taxAfterService,
      modelType: state.modelType,
      optionsCount: state.optionsCount,
      quickTemplate: state.quickTemplate || null,
      venuePreset: state.venuePreset || null,
    },
    settings_json: {
      igniteFeeRate: Number(state.mgmtFee || 0) / 100,
      contingencyRate: Number(state.contingency || 0) / 100,
      turnkeyMethod: state.turnkeyMethod,
      targetMarginPercent: Number(state.targetMargin || 0),
      targetPrice: Number(state.targetPrice || 0),
      saveAsDefault: state.saveAsDefault,
    },
  };
}

function toNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildCostsSyncPayload(state: IgniteWizardState) {
  const options = ([1, 2, 3] as const)
    .slice(0, state.optionsCount)
    .map((optionNumber, index) => ({
      option_key: `option_${optionNumber}`,
      label: `Option ${optionNumber}`,
      sort_order: index,
      is_enabled: true,
      pricing_mode: state.modelType === 'turnkey' ? 'turnkey' : 'cost_plus',
      package_price: state.modelType === 'turnkey' ? toNumber(state.targetPrice, 0) : null,
      metadata_json: {},
    }));

  const line_items = options.flatMap((option) => {
    const optionNumber = Number(option.option_key.replace('option_', '')) as 1 | 2 | 3;
    const rows = state.buildCosts.rowsByOption[optionNumber] || [];
    return rows.map((row, index) => ({
      option_key: option.option_key,
      category: row.category || 'Other',
      line_name: row.item || 'Untitled line item',
      description: row.notes || null,
      qty: toNumber(row.qty, 0),
      unit_cost: toNumber(row.unitCost, 0),
      apply_service: Boolean(row.service),
      service_rate: toNumber(state.serviceCharge, 0) / 100,
      apply_tax: Boolean(row.tax),
      tax_rate: toNumber(state.salesTax, 0) / 100,
      tax_applies_after_service: Boolean(state.taxAfterService),
      sort_order: index,
      is_hidden_from_client: row.display === 'HIDE',
      metadata_json: {
        vendor: row.vendor || null,
        display: row.display,
        client_row_id: row.id,
      },
    }));
  });

  return { options, line_items };
}

export default function IgniteCreateProposalWizard() {
  const [step, setStep] = useState<WizardStep>(1);
  const [state, setState] = useState<IgniteWizardState>(DEFAULT_IGNITE_WIZARD_STATE);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [reviewComputed, setReviewComputed] = useState<IgniteProposalComputed | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateState = (patch: Partial<IgniteWizardState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  };

  const isUuid = (value: string): boolean =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const selectedClientValid = useMemo(() => {
    if (!state.clientId) return false;
    if (!isUuid(state.clientId)) return false;
    return clients.some((client) => client.id === state.clientId);
  }, [state.clientId, clients]);

  const selectedClientName = useMemo(() => {
    const selected = clients.find((client) => client.id === state.clientId);
    return selected?.name || '';
  }, [clients, state.clientId]);

  const stepCompletion = useMemo(() => {
    const activeRows = state.buildCosts.rowsByOption[1] || [];
    return {
      1: selectedClientValid && !!state.eventName,
      2: !!state.serviceCharge && !!state.salesTax,
      3: activeRows.length > 0,
      4: false,
      5: false,
    } as Record<WizardStep, boolean>;
  }, [state, selectedClientValid]);

  useEffect(() => {
    let cancelled = false;
    const loadClients = async () => {
      try {
        setClientsLoading(true);
        const response = await apiGet('/api/ignite/clients');
        if (cancelled) return;
        const rows = Array.isArray(response?.clients) ? response.clients : [];
        const mapped = rows
          .filter((row: any) => row?.id && row?.name)
          .map((row: any) => ({ id: String(row.id), name: String(row.name) }));
        setClients(mapped);
      } catch (e: any) {
        if (!cancelled) {
          setSaveError(String(e?.message || 'Failed to load clients.'));
        }
      } finally {
        if (!cancelled) setClientsLoading(false);
      }
    };
    void loadClients();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistProposal = async (draftState: IgniteWizardState, existingProposalId?: string | null) => {
    const clientIsValid =
      Boolean(draftState.clientId) &&
      isUuid(draftState.clientId) &&
      clients.some((client) => client.id === draftState.clientId);
    if (!clientIsValid) {
      throw new Error('Please select a valid client from the client list.');
    }

    const payload = buildProposalPayload(draftState);
    let resolvedProposalId = existingProposalId || proposalId;
    if (!resolvedProposalId) {
      const created = await apiPost('/api/ignite/proposals', {
        client_id: draftState.clientId,
        ...payload,
      });
      resolvedProposalId = created?.proposal?.id ? String(created.proposal.id) : null;
      if (!resolvedProposalId) throw new Error('Failed to create proposal draft');
      setProposalId(resolvedProposalId);
    } else {
      await apiPatch(`/api/ignite/proposals/${resolvedProposalId}`, payload);
    }

    await apiPatch(`/api/ignite/proposals/${resolvedProposalId}/costs`, buildCostsSyncPayload(draftState));
    return resolvedProposalId;
  };

  useEffect(() => {
    const hasMinimumToSave = selectedClientValid;
    if (!hasMinimumToSave) return;

    const timeout = setTimeout(async () => {
      try {
        setIsSaving(true);
        setSaveError(null);
        await persistProposal(state, proposalId);
        setLastSavedAt(Date.now());
      } catch (e: any) {
        setSaveError(String(e?.message || 'Failed to autosave.'));
      } finally {
        setIsSaving(false);
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [state, proposalId, selectedClientValid]);

  const onSaveDraft = async () => {
    try {
      if (!selectedClientValid) {
        setSaveError('Select a valid client before saving.');
        return;
      }
      setIsSaving(true);
      setSaveError(null);
      await persistProposal(state, proposalId);
      setLastSavedAt(Date.now());
    } catch (e: any) {
      setSaveError(String(e?.message || 'Failed to save draft.'));
    } finally {
      setIsSaving(false);
    }
  };

  const onPreview = async () => {
    try {
      if (!selectedClientValid) {
        setSaveError('Select a valid client before previewing.');
        return;
      }
      setSaveError(null);
      const resolvedProposalId = await persistProposal(state, proposalId);
      const computeResponse = await apiPost(`/api/ignite/proposals/${resolvedProposalId}/compute`, {});
      setReviewComputed((computeResponse?.client_payload as IgniteProposalComputed) || null);
      setStep(4);
      setLastSavedAt(Date.now());
    } catch (e: any) {
      setSaveError(String(e?.message || 'Failed to compute preview.'));
    }
  };

  return (
    <div>
      <header className="border-b border-gray-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Proposal</h1>
            <p className="mt-1 text-gray-600">
              Build professional event proposals with standardized workflows
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {lastSavedAt && !isSaving && (
              <div className="text-xs text-gray-500">
                <i className="fa-solid fa-check-circle mr-1 text-green-500" />
                Saved just now
              </div>
            )}
            {isSaving && <div className="text-xs text-gray-500">Saving...</div>}
            <button
              type="button"
              onClick={onSaveDraft}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-600 hover:bg-gray-50"
            >
              <i className="fa-solid fa-save mr-2" />
              Save Draft
            </button>
            <button
              type="button"
              onClick={onPreview}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <i className="fa-solid fa-eye mr-2" />
              Preview
            </button>
          </div>
        </div>
        {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
      </header>

      <div className="border-b border-gray-200 bg-white px-8 py-4">
        <div className="flex items-center space-x-8">
          {([1, 2, 3, 4, 5] as WizardStep[]).map((s, idx) => {
            const done = s < step && stepCompletion[s];
            const active = s === step;
            return (
              <React.Fragment key={s}>
                <button
                  type="button"
                  data-step={s}
                  onClick={() => setStep(s)}
                  className="flex items-center space-x-2"
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
                  <span className={`${active ? 'font-medium text-blue-600' : 'text-gray-600'}`}>
                    {STEP_LABELS[s]}
                  </span>
                </button>
                {idx < 4 && <div className="h-px w-8 bg-gray-300" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="p-8">
        {step === 1 && (
          <BasicsStep
            state={state}
            clients={clients}
            clientsLoading={clientsLoading}
            onChange={updateState}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <AssumptionsStep
            state={state}
            onChange={updateState}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <BuildCostsStep
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
            optionsCount={state.optionsCount}
            serviceRatePct={Number(state.serviceCharge || 0)}
            taxRatePct={Number(state.salesTax || 0)}
            taxAfterService={state.taxAfterService}
            igniteFeePct={Number(state.mgmtFee || 0)}
            contingencyPct={Number(state.contingency || 0)}
            costs={state.buildCosts}
            onCostsChange={(nextCosts) => updateState({ buildCosts: nextCosts })}
          />
        )}
        {step === 4 && (
          <ReviewStep
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
            computed={reviewComputed}
            state={state}
            clientName={selectedClientName}
          />
        )}
        {step === 5 && <ExportStep onBack={() => setStep(4)} proposalId={proposalId} />}
      </div>
    </div>
  );
}

