import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
        venueAddress: state.venueAddress,
        city: state.city,
        eventDate: state.eventDate,
        startTime: state.startTime,
        endTime: state.endTime,
        headcount: Number(state.headcount || 0),
        primarySponsor: state.primarySponsor || null,
        coSponsors: state.coSponsors
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        eventObjective: state.eventObjective || null,
        successCriteria: state.successCriteria
          .split('\n')
          .map((value) => value.trim())
          .filter(Boolean),
      },
      agreement: {
        depositPercent: Number(state.depositPercent || 0),
        depositDueRule: state.depositDueRule || null,
        balanceDueRule: state.balanceDueRule || null,
        cancellationWindowDays: Number(state.cancellationWindowDays || 0),
        confidentialityEnabled: state.confidentialityEnabled,
        costSplitNotes: state.costSplitNotes || null,
        signerName: state.signerName || null,
        signerEmail: state.signerEmail || null,
        signerTitle: state.signerTitle || null,
        signerCompany: state.signerCompany || null,
      },
      serviceChargePercent: Number(state.serviceCharge || 0),
      salesTaxPercent: Number(state.salesTax || 0),
      taxAppliesAfterService: state.taxAfterService,
      modelType: state.modelType,
      optionsCount: state.optionsCount,
      quickTemplate: state.quickTemplate || null,
      venuePreset: state.venuePreset || null,
      workflow: {
        lastStep: 1,
      },
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
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<WizardStep>(1);
  const [state, setState] = useState<IgniteWizardState>(DEFAULT_IGNITE_WIZARD_STATE);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [reviewComputed, setReviewComputed] = useState<IgniteProposalComputed | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const resumeProposalId = searchParams.get('proposalId');
  const preselectedClientId = searchParams.get('clientId');
  const stepParam = Number(searchParams.get('step') || 1);

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

  const persistProposal = async (
    draftState: IgniteWizardState,
    existingProposalId?: string | null,
    workflowStep: WizardStep = step
  ) => {
    const clientIsValid =
      Boolean(draftState.clientId) &&
      isUuid(draftState.clientId) &&
      clients.some((client) => client.id === draftState.clientId);
    if (!clientIsValid) {
      throw new Error('Please select a valid client from the client list.');
    }

    const payload = buildProposalPayload(draftState);
    payload.assumptions_json.workflow = {
      ...(payload.assumptions_json.workflow || {}),
      lastStep: workflowStep,
    };
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

  function hydrateStateFromBundle(bundle: any): IgniteWizardState {
    const proposal = bundle?.proposal || {};
    const assumptions = (proposal.assumptions_json || {}) as Record<string, any>;
    const settings = (proposal.settings_json || {}) as Record<string, any>;
    const event = (assumptions.event || {}) as Record<string, any>;
    const agreement = (assumptions.agreement || {}) as Record<string, any>;
    const options = Array.isArray(bundle?.options) ? bundle.options : [];
    const lineItems = Array.isArray(bundle?.line_items) ? bundle.line_items : [];
    const optionNumbersById = new Map<string, 1 | 2 | 3>();
    options.forEach((option: any, index: number) => {
      const n = Math.min(3, Math.max(1, index + 1)) as 1 | 2 | 3;
      optionNumbersById.set(String(option.id), n);
    });

    const rowsByOption: Record<1 | 2 | 3, any[]> = { 1: [], 2: [], 3: [] };
    lineItems.forEach((item: any) => {
      const optionNumber = optionNumbersById.get(String(item.option_id || '')) || 1;
      const metadata = (item.metadata_json || {}) as Record<string, any>;
      rowsByOption[optionNumber].push({
        id: String(metadata.client_row_id || item.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
        category: String(item.category || 'Other'),
        item: String(item.line_name || ''),
        vendor: String(metadata.vendor || ''),
        qty: String(item.qty ?? ''),
        unitCost: String(item.unit_cost ?? ''),
        service: Boolean(item.apply_service),
        tax: Boolean(item.apply_tax),
        display: String(metadata.display || (item.is_hidden_from_client ? 'HIDE' : 'DETAIL')),
        notes: String(item.description || ''),
      });
    });

    return {
      ...DEFAULT_IGNITE_WIZARD_STATE,
      clientId: String(proposal.client_id || ''),
      eventName: String(proposal.name || event.eventName || ''),
      location: String(event.location || ''),
      venueAddress: String(event.venueAddress || ''),
      city: String(event.city || ''),
      eventDate: String(event.eventDate || ''),
      startTime: String(event.startTime || ''),
      endTime: String(event.endTime || ''),
      headcount: String(event.headcount || ''),
      primarySponsor: String(event.primarySponsor || ''),
      coSponsors: Array.isArray(event.coSponsors) ? event.coSponsors.join(', ') : '',
      eventObjective: String(event.eventObjective || ''),
      successCriteria: Array.isArray(event.successCriteria) ? event.successCriteria.join('\n') : '',
      modelType: assumptions.modelType === 'turnkey' ? 'turnkey' : 'cost-plus',
      optionsCount: [1, 2, 3].includes(Number(assumptions.optionsCount)) ? (Number(assumptions.optionsCount) as 1 | 2 | 3) : (Math.min(3, Math.max(1, options.length || 1)) as 1 | 2 | 3),
      quickTemplate: String(assumptions.quickTemplate || ''),
      venuePreset: String(assumptions.venuePreset || ''),
      serviceCharge: String(assumptions.serviceChargePercent ?? DEFAULT_IGNITE_WIZARD_STATE.serviceCharge),
      salesTax: String(assumptions.salesTaxPercent ?? DEFAULT_IGNITE_WIZARD_STATE.salesTax),
      taxAfterService: assumptions.taxAppliesAfterService !== false,
      mgmtFee: String((Number(settings.igniteFeeRate || 0) * 100) || DEFAULT_IGNITE_WIZARD_STATE.mgmtFee),
      contingency: String((Number(settings.contingencyRate || 0) * 100) || DEFAULT_IGNITE_WIZARD_STATE.contingency),
      depositPercent: String(agreement.depositPercent ?? DEFAULT_IGNITE_WIZARD_STATE.depositPercent),
      depositDueRule: String(agreement.depositDueRule || DEFAULT_IGNITE_WIZARD_STATE.depositDueRule),
      balanceDueRule: String(agreement.balanceDueRule || DEFAULT_IGNITE_WIZARD_STATE.balanceDueRule),
      cancellationWindowDays: String(agreement.cancellationWindowDays ?? DEFAULT_IGNITE_WIZARD_STATE.cancellationWindowDays),
      confidentialityEnabled: agreement.confidentialityEnabled !== false,
      costSplitNotes: String(agreement.costSplitNotes || ''),
      signerName: String(agreement.signerName || ''),
      signerEmail: String(agreement.signerEmail || ''),
      signerTitle: String(agreement.signerTitle || ''),
      signerCompany: String(agreement.signerCompany || ''),
      turnkeyMethod: settings.turnkeyMethod === 'price' ? 'price' : 'margin',
      targetMargin: String(settings.targetMarginPercent ?? DEFAULT_IGNITE_WIZARD_STATE.targetMargin),
      targetPrice: String(settings.targetPrice ?? DEFAULT_IGNITE_WIZARD_STATE.targetPrice),
      saveAsDefault: Boolean(settings.saveAsDefault),
      buildCosts: {
        groupPreview: false,
        rowsByOption: {
          1: rowsByOption[1].length ? rowsByOption[1] : DEFAULT_IGNITE_WIZARD_STATE.buildCosts.rowsByOption[1],
          2: rowsByOption[2].length ? rowsByOption[2] : DEFAULT_IGNITE_WIZARD_STATE.buildCosts.rowsByOption[2],
          3: rowsByOption[3].length ? rowsByOption[3] : DEFAULT_IGNITE_WIZARD_STATE.buildCosts.rowsByOption[3],
        },
      },
    };
  }

  useEffect(() => {
    if (!preselectedClientId) return;
    setState((prev) => ({ ...prev, clientId: preselectedClientId }));
  }, [preselectedClientId]);

  useEffect(() => {
    const normalized = Math.min(5, Math.max(1, Number.isFinite(stepParam) ? stepParam : 1)) as WizardStep;
    setStep(normalized);
  }, [stepParam]);

  useEffect(() => {
    if (!resumeProposalId) return;
    let cancelled = false;
    const loadProposal = async () => {
      try {
        const bundle = await apiGet(`/api/ignite/proposals/${resumeProposalId}`);
        if (cancelled) return;
        const nextState = hydrateStateFromBundle(bundle);
        setState(nextState);
        setProposalId(String(bundle?.proposal?.id || resumeProposalId));
        const lastStep = Number(bundle?.proposal?.assumptions_json?.workflow?.lastStep || stepParam || 1);
        setStep(Math.min(5, Math.max(1, lastStep)) as WizardStep);
      } catch (e: any) {
        if (!cancelled) setSaveError(String(e?.message || 'Failed to load proposal draft.'));
      }
    };
    void loadProposal();
    return () => {
      cancelled = true;
    };
  }, [resumeProposalId]);

  useEffect(() => {
    const hasMinimumToSave = selectedClientValid;
    if (!hasMinimumToSave) return;

    const timeout = setTimeout(async () => {
      try {
        setIsSaving(true);
        setSaveError(null);
        await persistProposal(state, proposalId, step);
        setLastSavedAt(Date.now());
      } catch (e: any) {
        setSaveError(String(e?.message || 'Failed to autosave.'));
      } finally {
        setIsSaving(false);
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [state, proposalId, selectedClientValid, step]);

  const onSaveDraft = async () => {
    try {
      if (!selectedClientValid) {
        setSaveError('Select a valid client before saving.');
        return;
      }
      setIsSaving(true);
      setSaveError(null);
      await persistProposal(state, proposalId, step);
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
      const resolvedProposalId = await persistProposal(state, proposalId, step);
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
      <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Create Proposal</h1>
            <p className="mt-1 text-sm text-gray-600 sm:text-base">
              Build professional event proposals with standardized workflows
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 sm:px-4"
            >
              <i className="fa-solid fa-save mr-2" />
              Save Draft
            </button>
            <button
              type="button"
              onClick={onPreview}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 sm:px-4"
            >
              <i className="fa-solid fa-eye mr-2" />
              Preview
            </button>
          </div>
        </div>
        {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
      </header>

      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex items-center gap-4 overflow-x-auto pb-1 sm:gap-8">
          {([1, 2, 3, 4, 5] as WizardStep[]).map((s, idx) => {
            const done = s < step && stepCompletion[s];
            const active = s === step;
            return (
              <React.Fragment key={s}>
                <button
                  type="button"
                  data-step={s}
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
                  <span className={`${active ? 'font-medium text-blue-600' : 'text-gray-600'} hidden sm:inline`}>
                    {STEP_LABELS[s]}
                  </span>
                </button>
                {idx < 4 && <div className="h-px w-4 bg-gray-300 sm:w-8" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="p-4 sm:p-6 md:p-8">
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

