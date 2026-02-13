type JsonMap = Record<string, any>;

export type IgniteProposalLike = {
  id?: string;
  pricing_mode?: 'cost_plus' | 'turnkey' | string;
  settings_json?: JsonMap | null;
};

export type IgniteProposalOptionLike = {
  id: string;
  option_key?: string | null;
  label?: string | null;
  pricing_mode?: 'cost_plus' | 'turnkey' | string | null;
  package_price?: number | string | null;
};

export type IgniteProposalLineItemLike = {
  id?: string;
  option_id?: string | null;
  category?: string | null;
  line_name?: string | null;
  qty?: number | string | null;
  unit_cost?: number | string | null;
  apply_service?: boolean | null;
  service_rate?: number | string | null;
  apply_tax?: boolean | null;
  tax_rate?: number | string | null;
  tax_applies_after_service?: boolean | null;
};

function toNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toRate(value: any): number {
  const raw = toNumber(value, 0);
  if (raw <= 0) return 0;
  // Accept either fractional rates (0.15) or whole-number percentages (15).
  return raw > 1 ? raw / 100 : raw;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizePricingMode(value: any): 'cost_plus' | 'turnkey' {
  return String(value || '').toLowerCase() === 'turnkey' ? 'turnkey' : 'cost_plus';
}

export function computeProposal(
  proposal: IgniteProposalLike,
  options: IgniteProposalOptionLike[],
  lineItems: IgniteProposalLineItemLike[]
) {
  const settings = proposal?.settings_json || {};
  const igniteFeeRate = toRate(settings?.igniteFeeRate ?? settings?.ignite_fee_rate);
  const contingencyRate = toRate(settings?.contingencyRate ?? settings?.contingency_rate);
  const pricingMode = normalizePricingMode(proposal?.pricing_mode);

  const perOption = options.map((option) => {
    const scopedItems = lineItems.filter(
      (item) => String(item.option_id || '') === String(option.id || '')
    );
    const categoryBreakdown: Record<string, number> = {};
    let subtotal = 0;

    const computedLineItems = scopedItems.map((item) => {
      const qty = toNumber(item.qty, 0);
      const unitCost = toNumber(item.unit_cost, 0);
      const base = qty * unitCost;

      const serviceRate = item.apply_service ? toRate(item.service_rate) : 0;
      const taxRate = item.apply_tax ? toRate(item.tax_rate) : 0;
      const taxAfterService = item.tax_applies_after_service !== false;

      const serviceableBase = taxAfterService ? base : base * (1 + taxRate);
      const serviceAmount = serviceableBase * serviceRate;
      const subtotalAfterService = base + serviceAmount;

      const taxableBase = taxAfterService ? subtotalAfterService : base;
      const taxAmount = taxableBase * taxRate;

      const lineTotal = subtotalAfterService + taxAmount;
      subtotal += lineTotal;

      const category = String(item.category || 'Uncategorized');
      categoryBreakdown[category] = roundMoney((categoryBreakdown[category] || 0) + lineTotal);

      return {
        line_item_id: item.id || null,
        category,
        line_name: item.line_name || null,
        qty,
        unit_cost: roundMoney(unitCost),
        base: roundMoney(base),
        service_rate: serviceRate,
        service_amount: roundMoney(serviceAmount),
        tax_rate: taxRate,
        tax_amount: roundMoney(taxAmount),
        tax_applies_after_service: taxAfterService,
        line_total: roundMoney(lineTotal)
      };
    });

    const igniteFee = subtotal * igniteFeeRate;
    const contingency = subtotal * contingencyRate;
    const totalInvestment = subtotal + igniteFee + contingency;

    const packagePrice = roundMoney(toNumber(option.package_price, 0));
    const optionPricingMode = normalizePricingMode(option.pricing_mode || pricingMode);

    return {
      option_id: option.id,
      option_key: option.option_key || null,
      label: option.label || null,
      pricing_mode: optionPricingMode,
      category_breakdown: categoryBreakdown,
      line_items: computedLineItems,
      subtotal: roundMoney(subtotal),
      ignite_fee: roundMoney(igniteFee),
      contingency: roundMoney(contingency),
      total_investment: roundMoney(totalInvestment),
      turnkey: {
        enabled: optionPricingMode === 'turnkey',
        package_price: packagePrice,
        delta_to_computed_total: roundMoney(packagePrice - totalInvestment)
      }
    };
  });

  const rollupSubtotal = perOption.reduce((acc, row) => acc + toNumber(row.subtotal, 0), 0);
  const rollupFee = perOption.reduce((acc, row) => acc + toNumber(row.ignite_fee, 0), 0);
  const rollupContingency = perOption.reduce((acc, row) => acc + toNumber(row.contingency, 0), 0);
  const rollupTotal = perOption.reduce((acc, row) => acc + toNumber(row.total_investment, 0), 0);

  return {
    pricing_mode: pricingMode,
    option_count: perOption.length,
    per_option: perOption,
    subtotal: roundMoney(rollupSubtotal),
    ignite_fee: roundMoney(rollupFee),
    contingency: roundMoney(rollupContingency),
    total_investment: roundMoney(rollupTotal),
    computed_at: new Date().toISOString()
  };
}

