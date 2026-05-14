export type EventKind = 'internal' | 'external';

export type EventStatus = 'draft' | 'planning' | 'live' | 'closed';

export type SponsorStatus = 'prospect' | 'committed' | 'invoiced' | 'paid';
export type SponsorKind = 'cash' | 'in_kind';

export type Sponsor = {
  id: string;
  name: string;
  contact?: string;
  amount: number;
  kind: SponsorKind;
  status: SponsorStatus;
  notes?: string;
  referralPercent?: number;
  referralOwner?: string;
};

export type CostCategory =
  | 'Venue'
  | 'Manpower'
  | 'Booth & Supplies'
  | 'Travel'
  | 'F&B'
  | 'Production'
  | 'Marketing'
  | 'Other';

export type CostLine = {
  id: string;
  category: CostCategory;
  description: string;
  vendor?: string;
  qty: number;
  unitCost: number;
  status: 'budgeted' | 'committed' | 'invoiced' | 'paid';
  notes?: string;
};

export type EventDoc = {
  id: string;
  name: string;
  type: 'beo' | 'invoice' | 'contract' | 'quote' | 'misc';
  uploadedAt: string;
  uploadedBy: string;
};

export type EventRecord = {
  id: string;
  name: string;
  kind: EventKind;
  status: EventStatus;
  clientName?: string;
  startDate: string;
  endDate?: string;
  city: string;
  venue: string;
  headcount: number;
  primaryContact: string;
  ownerName: string;
  description?: string;
  sponsors: Sponsor[];
  costs: CostLine[];
  documents: EventDoc[];
};

const sampleInfraSponsors: Sponsor[] = [
  { id: 'sp_1', name: 'AMD + SMC', amount: 85000, kind: 'cash', status: 'paid', notes: 'Anchor sponsor' },
  { id: 'sp_2', name: 'Micas Networks', amount: 30000, kind: 'cash', status: 'paid' },
  {
    id: 'sp_3',
    name: 'Micas Billboards',
    amount: 16900,
    kind: 'cash',
    status: 'invoiced',
    notes: 'Sell $16,900 / Cost $12,463 + $900 commission. JK margin = $3,537',
  },
  { id: 'sp_4', name: 'SambaNova', amount: 25000, kind: 'cash', status: 'paid' },
  { id: 'sp_5', name: 'Kamiwaza', amount: 0, kind: 'cash', status: 'committed', notes: 'Converted March 10k retainer to sponsorship' },
  {
    id: 'sp_6',
    name: 'Hyperaccell',
    amount: 15000,
    kind: 'cash',
    status: 'paid',
    referralPercent: 20,
    referralOwner: 'Alex Moon',
  },
  { id: 'sp_7', name: 'vCluster', amount: 25000, kind: 'cash', status: 'invoiced' },
  {
    id: 'sp_8',
    name: 'Hammerhead',
    amount: 25000,
    kind: 'cash',
    status: 'paid',
    referralPercent: 20,
    referralOwner: 'Keith Newman',
  },
  { id: 'sp_9', name: 'Neuron DC', amount: 20000, kind: 'cash', status: 'paid' },
  { id: 'sp_10', name: 'Micas Networks – Turnkey Booth', amount: 5000, kind: 'cash', status: 'paid' },
  { id: 'sp_11', name: 'Ticket sales', amount: 11264.5, kind: 'cash', status: 'paid', notes: 'As of 4/30' },
  { id: 'sp_12', name: 'BMW', amount: 0, kind: 'in_kind', status: 'committed', notes: '3 showroom cars for Speakers Studio' },
  { id: 'sp_13', name: 'Herold Wines', amount: 0, kind: 'in_kind', status: 'committed' },
  { id: 'sp_14', name: 'Silicon Data', amount: 0, kind: 'in_kind', status: 'committed', notes: 'Offering Carmen Li booth' },
  { id: 'sp_15', name: 'You.com', amount: 0, kind: 'in_kind', status: 'committed' },
];

const sampleInfraCosts: CostLine[] = [
  {
    id: 'c_1',
    category: 'Venue',
    description: 'Plug and Play – Banquet packages (breakfast 70 / lunch 700 / dinner 800)',
    vendor: 'Plug and Play',
    qty: 1,
    unitCost: 101451.88,
    status: 'invoiced',
    notes: 'Includes floor rentals, AV, F&B, staffing',
  },
  {
    id: 'c_2',
    category: 'F&B',
    description: 'Add-on hors d\'oeuvres switch',
    vendor: 'Plug and Play',
    qty: 1,
    unitCost: 3000,
    status: 'committed',
    notes: 'Convo w/ Brandon and Reza on 4/29',
  },
  {
    id: 'c_3',
    category: 'F&B',
    description: 'Breakfast for Ignite Lounge',
    qty: 1,
    unitCost: 1000,
    status: 'budgeted',
    notes: 'Budgetary only',
  },
  {
    id: 'c_4',
    category: 'F&B',
    description: '5/2 Team Brunch – Dim Sum',
    qty: 1,
    unitCost: 1000,
    status: 'committed',
  },
  {
    id: 'c_5',
    category: 'Manpower',
    description: 'Dreamers (Apr-May)',
    vendor: 'Dreamers',
    qty: 2,
    unitCost: 5000,
    status: 'paid',
    notes: 'May invoice paid',
  },
  {
    id: 'c_6',
    category: 'Manpower',
    description: 'Ned (Apr-May)',
    qty: 2,
    unitCost: 4000,
    status: 'paid',
    notes: 'May invoice paid',
  },
  {
    id: 'c_7',
    category: 'Manpower',
    description: 'Serena (Apr-May)',
    qty: 2,
    unitCost: 4000,
    status: 'paid',
    notes: 'May invoice paid',
  },
  {
    id: 'c_8',
    category: 'Manpower',
    description: 'Haley (internship Apr-Jun)',
    qty: 3,
    unitCost: 700,
    status: 'committed',
    notes: '$2,100 total',
  },
  {
    id: 'c_9',
    category: 'Manpower',
    description: 'Jason Lin – design work',
    qty: 1,
    unitCost: 0,
    status: 'budgeted',
    notes: 'Small design work, $500 roll-in from revshare',
  },
  {
    id: 'c_10',
    category: 'Manpower',
    description: 'Martin Bach',
    qty: 1,
    unitCost: 800,
    status: 'committed',
  },
  {
    id: 'c_11',
    category: 'Manpower',
    description: 'Jonathan – Movers (6h × $80 + drivers + gas)',
    vendor: 'Jonathan',
    qty: 1,
    unitCost: 3120,
    status: 'committed',
    notes: 'Jonathan $480 + Guy 1 $280 + Guy 2 $280 + Gas $200 = $1,240 (per breakdown)',
  },
  {
    id: 'c_12',
    category: 'Booth & Supplies',
    description: 'Fedex – postcards',
    qty: 1,
    unitCost: 486.2,
    status: 'paid',
  },
  {
    id: 'c_13',
    category: 'Booth & Supplies',
    description: 'Tablecloth',
    qty: 2,
    unitCost: 190.59,
    status: 'paid',
    notes: 'Bill ordered online',
  },
  {
    id: 'c_14',
    category: 'Booth & Supplies',
    description: 'Supplies – Haley cams + bill printer',
    qty: 1,
    unitCost: 1623.66,
    status: 'paid',
    notes: 'Printer $447.66, Haley gear $1176',
  },
];

const sampleInfraDocs: EventDoc[] = [
  { id: 'd_1', name: 'Plug-and-Play BEO Quote.pdf', type: 'beo', uploadedAt: '2026-04-12', uploadedBy: 'Brandon' },
  { id: 'd_2', name: 'AMD-SMC Sponsor Agreement.pdf', type: 'contract', uploadedAt: '2026-03-20', uploadedBy: 'Brandon' },
  { id: 'd_3', name: 'Micas Networks Invoice.pdf', type: 'invoice', uploadedAt: '2026-04-04', uploadedBy: 'Haley' },
];

export const MOCK_EVENTS: EventRecord[] = [
  {
    id: 'evt_ai_infra_5',
    name: 'AI Infra Summit 5',
    kind: 'internal',
    status: 'live',
    startDate: '2026-05-21',
    endDate: '2026-05-21',
    city: 'Sunnyvale, CA',
    venue: 'Plug and Play Tech Center',
    headcount: 800,
    primaryContact: 'Reza Khazaeli',
    ownerName: 'Brandon',
    description: 'Flagship AI infrastructure summit. Anchor sponsor AMD + SMC.',
    sponsors: sampleInfraSponsors,
    costs: sampleInfraCosts,
    documents: sampleInfraDocs,
  },
  {
    id: 'evt_warriors_bdm',
    name: 'Warriors BDM – March 13',
    kind: 'internal',
    status: 'closed',
    startDate: '2026-03-13',
    city: 'San Francisco, CA',
    venue: 'Chase Center',
    headcount: 120,
    primaryContact: 'Reza Khazaeli',
    ownerName: 'Brandon',
    description: 'Hospitality dinner around Warriors home game.',
    sponsors: [
      { id: 'sp_w1', name: 'NetApp', amount: 25000, kind: 'cash', status: 'paid' },
      { id: 'sp_w2', name: 'Cirrascale', amount: 15000, kind: 'cash', status: 'paid' },
      { id: 'sp_w3', name: 'Vultr', amount: 10000, kind: 'cash', status: 'paid' },
    ],
    costs: [
      { id: 'cw1', category: 'Venue', description: 'Suite rental – Warriors game', qty: 1, unitCost: 28000, status: 'paid' },
      { id: 'cw2', category: 'F&B', description: 'Catering and beverages', qty: 1, unitCost: 4500, status: 'paid' },
      { id: 'cw3', category: 'Manpower', description: 'On-site staff', qty: 3, unitCost: 600, status: 'paid' },
    ],
    documents: [],
  },
  {
    id: 'evt_apr26_smc_amd',
    name: 'APR26 SMC + AMD NYC Dinner',
    kind: 'internal',
    status: 'closed',
    startDate: '2026-04-26',
    city: 'New York, NY',
    venue: 'Carbone Private',
    headcount: 32,
    primaryContact: 'Reza Khazaeli',
    ownerName: 'Brandon',
    description: 'Intimate dinner with strategic accounts.',
    sponsors: [
      { id: 'sp_n1', name: 'AMD', amount: 22000, kind: 'cash', status: 'paid' },
      { id: 'sp_n2', name: 'SMC', amount: 18000, kind: 'cash', status: 'paid' },
    ],
    costs: [
      { id: 'cn1', category: 'Venue', description: 'Carbone private dining', qty: 1, unitCost: 14500, status: 'paid' },
      { id: 'cn2', category: 'Travel', description: 'Speaker travel and hotel', qty: 4, unitCost: 1100, status: 'paid' },
    ],
    documents: [],
  },
  {
    id: 'evt_gtc1_smc_amd',
    name: 'GTC1 / GTC2 SMC AMD March',
    kind: 'internal',
    status: 'closed',
    startDate: '2026-03-16',
    endDate: '2026-03-18',
    city: 'San Jose, CA',
    venue: 'GTC Conference (Off-site)',
    headcount: 220,
    primaryContact: 'Reza Khazaeli',
    ownerName: 'Brandon',
    sponsors: [
      { id: 'sp_g1', name: 'AMD', amount: 50000, kind: 'cash', status: 'paid' },
      { id: 'sp_g2', name: 'SMC', amount: 35000, kind: 'cash', status: 'paid' },
    ],
    costs: [
      { id: 'cg1', category: 'Venue', description: 'Off-site activation venue', qty: 1, unitCost: 38000, status: 'paid' },
      { id: 'cg2', category: 'Production', description: 'AV and stage', qty: 1, unitCost: 12500, status: 'paid' },
    ],
    documents: [],
  },
  {
    id: 'evt_external_acme_summit',
    name: 'ACME Cloud Customer Summit',
    kind: 'external',
    status: 'planning',
    clientName: 'ACME Cloud',
    startDate: '2026-07-18',
    endDate: '2026-07-19',
    city: 'Austin, TX',
    venue: 'Fairmont Austin',
    headcount: 350,
    primaryContact: 'Lisa Tran (ACME)',
    ownerName: 'Serena',
    description: 'Two-day customer summit produced for ACME Cloud.',
    sponsors: [
      { id: 'sp_a1', name: 'ACME Cloud (client funded)', amount: 425000, kind: 'cash', status: 'committed', notes: 'Master budget – billed to client' },
    ],
    costs: [
      { id: 'ca1', category: 'Venue', description: 'Fairmont Austin – 2 day buyout', qty: 1, unitCost: 188000, status: 'committed' },
      { id: 'ca2', category: 'Production', description: 'Stage, AV, recording', qty: 1, unitCost: 62000, status: 'committed' },
      { id: 'ca3', category: 'Manpower', description: 'Onsite team (Ignite + contract)', qty: 6, unitCost: 4200, status: 'budgeted' },
      { id: 'ca4', category: 'F&B', description: 'Welcome reception + 2 days catered', qty: 1, unitCost: 78000, status: 'budgeted' },
      { id: 'ca5', category: 'Marketing', description: 'Print + signage + swag', qty: 1, unitCost: 24000, status: 'budgeted' },
    ],
    documents: [
      { id: 'da1', name: 'ACME Master SOW.pdf', type: 'contract', uploadedAt: '2026-04-30', uploadedBy: 'Brandon' },
    ],
  },
  {
    id: 'evt_external_finvox_qbr',
    name: 'Finvox Partner QBR',
    kind: 'external',
    status: 'draft',
    clientName: 'Finvox',
    startDate: '2026-09-08',
    city: 'Miami, FL',
    venue: '1 Hotel South Beach',
    headcount: 90,
    primaryContact: 'Mark Doolin (Finvox)',
    ownerName: 'Ned',
    description: 'Partner quarterly business review.',
    sponsors: [
      { id: 'sp_f1', name: 'Finvox (client funded)', amount: 130000, kind: 'cash', status: 'prospect' },
    ],
    costs: [
      { id: 'cf1', category: 'Venue', description: '1 Hotel rooms + meeting space', qty: 1, unitCost: 64000, status: 'budgeted' },
      { id: 'cf2', category: 'F&B', description: 'Welcome dinner + breaks', qty: 1, unitCost: 22000, status: 'budgeted' },
    ],
    documents: [],
  },
];

export function getEventById(id: string): EventRecord | undefined {
  return MOCK_EVENTS.find((event) => event.id === id);
}

export function totalSponsorRevenue(event: EventRecord): number {
  return event.sponsors
    .filter((sponsor) => sponsor.kind === 'cash')
    .reduce((sum, sponsor) => sum + Number(sponsor.amount || 0), 0);
}

export function totalInKindValue(event: EventRecord): number {
  return event.sponsors
    .filter((sponsor) => sponsor.kind === 'in_kind')
    .reduce((sum, sponsor) => sum + Number(sponsor.amount || 0), 0);
}

export function totalCosts(event: EventRecord): number {
  return event.costs.reduce((sum, cost) => sum + Number(cost.qty || 0) * Number(cost.unitCost || 0), 0);
}

export function totalCostsByCategory(event: EventRecord): Record<string, number> {
  return event.costs.reduce<Record<string, number>>((acc, cost) => {
    const key = cost.category;
    acc[key] = (acc[key] || 0) + Number(cost.qty || 0) * Number(cost.unitCost || 0);
    return acc;
  }, {});
}

export function eventMargin(event: EventRecord): { revenue: number; costs: number; margin: number; marginPct: number } {
  const revenue = totalSponsorRevenue(event);
  const costs = totalCosts(event);
  const margin = revenue - costs;
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
  return { revenue, costs, margin, marginPct };
}

export function formatMoney(value: number, opts: { decimals?: number } = {}): string {
  const decimals = opts.decimals ?? 0;
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}
