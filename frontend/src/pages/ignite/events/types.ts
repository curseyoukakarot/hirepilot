export type EventKind = 'internal' | 'external';

export type EventStatus = 'draft' | 'planning' | 'live' | 'closed';

export type SponsorStatus = 'prospect' | 'committed' | 'invoiced' | 'paid';
export type SponsorKind = 'cash' | 'in_kind';

export type CostStatus = 'budgeted' | 'committed' | 'invoiced' | 'paid';

export type DocumentType = 'beo' | 'invoice' | 'contract' | 'quote' | 'misc';

export type CostCategory =
  | 'Venue'
  | 'Manpower'
  | 'Booth & Supplies'
  | 'Travel'
  | 'F&B'
  | 'Production'
  | 'Marketing'
  | 'Other';

export const COST_CATEGORIES: CostCategory[] = [
  'Venue',
  'Manpower',
  'Booth & Supplies',
  'Travel',
  'F&B',
  'Production',
  'Marketing',
  'Other',
];

export type Sponsor = {
  id: string;
  name: string;
  contact?: string | null;
  amount: number;
  kind: SponsorKind;
  status: SponsorStatus;
  notes?: string | null;
  referralPercent?: number | null;
  referralOwner?: string | null;
};

export type CostLine = {
  id: string;
  category: CostCategory | string;
  description: string;
  vendor?: string | null;
  qty: number;
  unitCost: number;
  status: CostStatus;
  notes?: string | null;
};

export type EventDoc = {
  id: string;
  name: string;
  type: DocumentType;
  uploadedAt: string;
  uploadedBy: string;
  fileUrl?: string | null;
};

export type EventRecord = {
  id: string;
  name: string;
  kind: EventKind;
  status: EventStatus;
  clientId?: string | null;
  clientName?: string | null;
  startDate: string;
  endDate?: string | null;
  city: string;
  venue: string;
  headcount: number;
  primaryContact: string;
  ownerName: string;
  description?: string | null;
  targetMarginPct: number;
  sponsors: Sponsor[];
  costs: CostLine[];
  documents: EventDoc[];
};

export type EventSummary = {
  cashRevenue: number;
  inKindValue: number;
  totalCosts: number;
  margin: number;
  marginPct: number;
  sponsorCount: number;
  costLineCount: number;
};

export type EventListItem = Omit<EventRecord, 'sponsors' | 'costs' | 'documents'> & {
  totals: EventSummary;
};

export function totalSponsorRevenue(event: { sponsors: Sponsor[] }): number {
  return event.sponsors
    .filter((sponsor) => sponsor.kind === 'cash')
    .reduce((sum, sponsor) => sum + Number(sponsor.amount || 0), 0);
}

export function totalInKindValue(event: { sponsors: Sponsor[] }): number {
  return event.sponsors
    .filter((sponsor) => sponsor.kind === 'in_kind')
    .reduce((sum, sponsor) => sum + Number(sponsor.amount || 0), 0);
}

export function totalCosts(event: { costs: CostLine[] }): number {
  return event.costs.reduce((sum, cost) => sum + Number(cost.qty || 0) * Number(cost.unitCost || 0), 0);
}

export function totalCostsByCategory(event: { costs: CostLine[] }): Record<string, number> {
  return event.costs.reduce<Record<string, number>>((acc, cost) => {
    const key = String(cost.category || 'Other');
    acc[key] = (acc[key] || 0) + Number(cost.qty || 0) * Number(cost.unitCost || 0);
    return acc;
  }, {});
}

export function eventMargin(event: { sponsors: Sponsor[]; costs: CostLine[] }): {
  revenue: number;
  costs: number;
  margin: number;
  marginPct: number;
} {
  const revenue = totalSponsorRevenue(event);
  const costs = totalCosts(event);
  const margin = revenue - costs;
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
  return { revenue, costs, margin, marginPct };
}

export function summaryToMargin(totals: EventSummary): {
  revenue: number;
  costs: number;
  margin: number;
  marginPct: number;
} {
  return {
    revenue: totals.cashRevenue,
    costs: totals.totalCosts,
    margin: totals.margin,
    marginPct: totals.marginPct,
  };
}

export function formatMoney(value: number, opts: { decimals?: number } = {}): string {
  const decimals = opts.decimals ?? 0;
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}
