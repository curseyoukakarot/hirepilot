import { IgniteProposalComputed } from '../../ignite/types/proposalComputed';

type JsonMap = Record<string, any>;

type BuildComputedProposalArgs = {
  proposal: JsonMap;
  clientName?: string | null;
  options: JsonMap[];
  lineItems: JsonMap[];
};

function asString(value: any, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function asNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeModelType(value: any): 'cost_plus' | 'turnkey' {
  return asString(value).toLowerCase() === 'turnkey' ? 'turnkey' : 'cost_plus';
}

function toTitle(value: any): string {
  const raw = asString(value, '').trim();
  if (!raw) return 'Option';
  return raw;
}

function fallbackIncludedSections(): IgniteProposalComputed['included']['sections'] {
  return [
    {
      title: 'What is Included',
      bullets: [
        'Program strategy and timeline planning',
        'Creative production coordination',
        'Vendor sourcing and management',
      ],
    },
  ];
}

function fallbackNextSteps(): IgniteProposalComputed['nextSteps']['bullets'] {
  return [
    'Review your preferred option',
    'Confirm budget and target date',
    'Approve to start onboarding',
  ];
}

function normalizeIncludedSections(value: any): IgniteProposalComputed['included']['sections'] {
  const sections = asArray(value)
    .map((section: any) => ({
      title: asString(section?.title || section?.heading || 'Included'),
      bullets: asArray<string>(section?.bullets).map((bullet) => asString(bullet)).filter(Boolean),
    }))
    .filter((section: any) => section.bullets.length > 0);
  return sections.length ? sections : fallbackIncludedSections();
}

function normalizeNextSteps(value: any): IgniteProposalComputed['nextSteps']['bullets'] {
  const bullets = asArray<string>(value).map((item) => asString(item)).filter(Boolean);
  return bullets.length ? bullets : fallbackNextSteps();
}

export function buildComputedProposal(args: BuildComputedProposalArgs): IgniteProposalComputed {
  const proposal = args.proposal || {};
  const computedJson = (proposal.computed_json || {}) as JsonMap;
  const perOption = asArray(computedJson.per_option);
  const settings = (proposal.settings_json || {}) as JsonMap;
  const metadata = (proposal.metadata_json || {}) as JsonMap;

  const modelType = normalizeModelType(proposal.pricing_mode || proposal.model_type);
  const showLineItems =
    modelType === 'turnkey'
      ? Boolean(settings.showLineItemsInTurnkey || settings.show_line_items_in_turnkey)
      : settings.showLineItems !== false && settings.show_line_items !== false;
  const showVendors = showLineItems && (settings.showVendors === true || settings.show_vendors === true);

  const options = asArray(args.options).map((option: any, index: number) => {
    const optionId = asString(option?.id);
    const optionComputed = perOption.find((row: any) => asString(row?.option_id) === optionId) || {};
    const optionItems = asArray(args.lineItems).filter(
      (item: any) => asString(item?.option_id) === optionId
    );

    const fallbackSubtotal = optionItems.reduce((sum: number, item: any) => {
      const qty = asNumber(item?.qty, 0);
      const unitCost = asNumber(item?.unit_cost, 0);
      return sum + qty * unitCost;
    }, 0);

    const subtotal = asNumber(optionComputed?.subtotal, fallbackSubtotal);
    const fee = asNumber(optionComputed?.ignite_fee, 0);
    const contingency = asNumber(optionComputed?.contingency, 0);
    const total = asNumber(optionComputed?.total_investment, subtotal + fee + contingency);

    const breakdownObject = (optionComputed?.category_breakdown || {}) as JsonMap;
    const breakdown = Object.keys(breakdownObject).map((key) => ({
      categoryName: key,
      amount: asNumber(breakdownObject[key], 0),
    }));

    const computedLineItemsById = new Map(
      asArray(optionComputed?.line_items).map((item: any) => [asString(item?.line_item_id), item])
    );

    const lineItems = optionItems.map((item: any) => {
      const computed = computedLineItemsById.get(asString(item?.id)) || {};
      const fallbackAmount = asNumber(item?.qty, 0) * asNumber(item?.unit_cost, 0);
      const metadataJson = (item?.metadata_json || {}) as JsonMap;
      return {
        id: item?.id ? asString(item.id) : null,
        category: asString(item?.category, 'Uncategorized'),
        name: asString(item?.line_name || item?.name || 'Line Item'),
        description: item?.description ? asString(item.description) : null,
        amount: asNumber(computed?.line_total, fallbackAmount),
        vendor: asString(item?.vendor_name || metadataJson.vendor || '', '') || null,
      };
    });

    const normalizedBreakdown = breakdown.length
      ? breakdown
      : [
          {
            categoryName: 'Total',
            amount: total,
          },
        ];

    return {
      id: optionId,
      name: toTitle(option?.label || option?.name || `Option ${index + 1}`),
      description: asString(option?.description || ''),
      isRecommended: Boolean(option?.is_recommended) || index === 0,
      totals: {
        subtotal,
        fee,
        contingency,
        total,
      },
      breakdown: normalizedBreakdown,
      lineItems,
    };
  });

  const includedSections = normalizeIncludedSections(
    settings.includedSections || settings.included_sections || metadata.includedSections
  );
  const nextSteps = normalizeNextSteps(
    settings.nextSteps || settings.next_steps || metadata.nextSteps
  );

  return {
    proposalId: asString(proposal.id),
    clientName: asString(args.clientName || proposal.client_name || 'Client'),
    eventName: asString(proposal.event_name || proposal.name || proposal.title || 'Event Proposal'),
    location: asString(proposal.location || proposal.venue || ''),
    date: asString(proposal.event_date || proposal.date || ''),
    headcount: asNumber(proposal.headcount || proposal.attendees || 0),
    modelType,
    options,
    included: {
      sections: includedSections,
    },
    nextSteps: {
      bullets: nextSteps,
    },
    visibilityRules: {
      showLineItems,
      showVendors,
    },
    updatedAt: asString(proposal.updated_at || computedJson.computed_at || new Date().toISOString()),
  };
}

