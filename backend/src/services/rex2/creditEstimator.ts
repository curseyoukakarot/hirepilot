type EstimateBreakdownItem = {
  key: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  notes?: string;
};

type CreditEstimate = {
  min: number;
  max: number;
  expected: number;
  target_leads: number;
  breakdown: EstimateBreakdownItem[];
};

const UNIT_COST = {
  lead_capture: 1,          // 1 credit per lead
 enrich_basic: 1,          // 1 credit per enriched lead
  enrich_enhanced: 1,       // +1 credit per enhanced-enriched lead
  linkedin_action: 1 / 6,   // ~0.1667 credit per LinkedIn action
  apollo_action: 0.25,      // low-cost discovery action
  messaging_action: 0.2      // lightweight sequencing/generation action
} as const;

function toInt(value: any, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function extractLeadTarget(plan: any): number {
  const hints: number[] = [];
  const stepHints = Array.isArray(plan?.steps) ? plan.steps : [];
  for (const s of stepHints) {
    const n = toInt(s?.input_hint?.target_leads, 0);
    if (n > 0) hints.push(n);
    const alt = toInt(s?.input_hint?.lead_count, 0);
    if (alt > 0) hints.push(alt);
  }

  const topHint = toInt(plan?.input_hint?.target_leads, 0);
  if (topHint > 0) hints.push(topHint);

  const text = [String(plan?.goal?.description || ''), ...stepHints.map((s: any) => String(s?.title || ''))].join(' ');
  const m = text.match(/\b(\d{1,4})\s+(?:lead|leads|candidate|candidates|profiles?)\b/i);
  if (m?.[1]) hints.push(toInt(m[1], 0));

  const picked = hints.find((n) => n > 0) || 50;
  return Math.max(10, Math.min(1000, picked));
}

function hasStep(plan: any, matcher: RegExp): boolean {
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  return steps.some((s: any) => matcher.test(`${String(s?.step_id || '')} ${String(s?.title || '')} ${String(s?.description || '')}`.toLowerCase()));
}

export function estimateCreditsForPlan(plan: any): CreditEstimate {
  const targetLeads = extractLeadTarget(plan);
  const enrichEnabled = hasStep(plan, /enrich|profile|contact|email/);
  const sourceEnabled = hasStep(plan, /source|linkedin|indeed|apollo|candidate/);
  const outreachEnabled = hasStep(plan, /outreach|message|sequence|reply/);
  const enhancedExplicit = hasStep(plan, /enhanced|deep enrich|advanced enrich/);

  const enhancedRatio = enhancedExplicit ? 0.5 : 0.25;
  const enhancedCount = enrichEnabled ? Math.round(targetLeads * enhancedRatio) : 0;

  const linkedinActions = sourceEnabled ? Math.max(1, Math.ceil(targetLeads / 25) * 3) : 0;
  const apolloActions = sourceEnabled ? Math.max(1, Math.ceil(targetLeads / 50) * 2) : 0;
  const messageActions = outreachEnabled ? Math.max(1, Math.ceil(targetLeads / 40)) : 0;

  const breakdown: EstimateBreakdownItem[] = [
    {
      key: 'lead_capture',
      quantity: targetLeads,
      unit_cost: UNIT_COST.lead_capture,
      subtotal: targetLeads * UNIT_COST.lead_capture,
      notes: '1 credit per captured lead'
    },
    {
      key: 'basic_enrichment',
      quantity: enrichEnabled ? targetLeads : 0,
      unit_cost: UNIT_COST.enrich_basic,
      subtotal: (enrichEnabled ? targetLeads : 0) * UNIT_COST.enrich_basic,
      notes: enrichEnabled ? '1 credit per basic enrichment' : 'No enrichment step detected'
    },
    {
      key: 'enhanced_enrichment',
      quantity: enhancedCount,
      unit_cost: UNIT_COST.enrich_enhanced,
      subtotal: enhancedCount * UNIT_COST.enrich_enhanced,
      notes: enhancedExplicit ? 'Enhanced enrichment explicitly requested' : 'Default enhanced subset'
    },
    {
      key: 'linkedin_actions',
      quantity: linkedinActions,
      unit_cost: UNIT_COST.linkedin_action,
      subtotal: linkedinActions * UNIT_COST.linkedin_action,
      notes: 'Estimated browsing/sourcing actions'
    },
    {
      key: 'apollo_actions',
      quantity: apolloActions,
      unit_cost: UNIT_COST.apollo_action,
      subtotal: apolloActions * UNIT_COST.apollo_action,
      notes: 'Estimated external search actions'
    },
    {
      key: 'messaging_actions',
      quantity: messageActions,
      unit_cost: UNIT_COST.messaging_action,
      subtotal: messageActions * UNIT_COST.messaging_action,
      notes: 'Draft/send sequence generation actions'
    }
  ];

  const expected = breakdown.reduce((sum, item) => sum + item.subtotal, 0);
  const min = Math.max(1, Math.round(expected * 0.85));
  const max = Math.max(min, Math.round(expected * 1.15));

  return {
    min,
    max,
    expected: Math.round(expected),
    target_leads: targetLeads,
    breakdown
  };
}

