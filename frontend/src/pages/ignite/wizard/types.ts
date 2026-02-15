export type IgniteModelType = 'cost-plus' | 'turnkey';
export type TurnkeyMethod = 'margin' | 'price';
export type IgniteDisplayMode = 'DETAIL' | 'GROUP' | 'HIDE';

export type IgniteWizardLineItem = {
  id: string;
  category: string;
  item: string;
  vendor: string;
  qty: string;
  unitCost: string;
  service: boolean;
  tax: boolean;
  display: IgniteDisplayMode;
  notes: string;
};

export type IgniteWizardCostsState = {
  groupPreview: boolean;
  rowsByOption: Record<1 | 2 | 3, IgniteWizardLineItem[]>;
};

export type IgniteWizardState = {
  clientId: string;
  eventName: string;
  location: string;
  venueAddress: string;
  city: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  headcount: string;
  primarySponsor: string;
  coSponsors: string;
  eventObjective: string;
  successCriteria: string;
  modelType: IgniteModelType;
  optionsCount: 1 | 2 | 3;
  quickTemplate: string;
  venuePreset: string;
  serviceCharge: string;
  salesTax: string;
  taxAfterService: boolean;
  mgmtFee: string;
  contingency: string;
  depositPercent: string;
  depositDueRule: string;
  balanceDueRule: string;
  cancellationWindowDays: string;
  confidentialityEnabled: boolean;
  costSplitNotes: string;
  signerName: string;
  signerEmail: string;
  signerTitle: string;
  signerCompany: string;
  turnkeyMethod: TurnkeyMethod;
  targetMargin: string;
  targetPrice: string;
  saveAsDefault: boolean;
  buildCosts: IgniteWizardCostsState;
};

const INITIAL_LINE_ITEMS: IgniteWizardLineItem[] = [
  {
    id: '1',
    category: 'Venue',
    item: 'Venue rental - Main ballroom',
    vendor: 'Convene NYC',
    qty: '1',
    unitCost: '5000',
    service: true,
    tax: true,
    display: 'DETAIL',
    notes: '',
  },
  {
    id: '2',
    category: 'F&B',
    item: 'Dinner - 3 course plated',
    vendor: 'Convene NYC',
    qty: '100',
    unitCost: '85',
    service: true,
    tax: true,
    display: 'DETAIL',
    notes: '',
  },
  {
    id: '3',
    category: 'Production',
    item: 'AV - Full day package',
    vendor: 'TechPro AV',
    qty: '1',
    unitCost: '3500',
    service: false,
    tax: true,
    display: 'DETAIL',
    notes: '',
  },
  {
    id: '4',
    category: 'Travel',
    item: 'Staff travel - Roundtrip flights',
    vendor: '',
    qty: '3',
    unitCost: '0',
    service: false,
    tax: true,
    display: 'DETAIL',
    notes: '',
  },
];

export const DEFAULT_IGNITE_WIZARD_STATE: IgniteWizardState = {
  clientId: '',
  eventName: '',
  location: '',
  venueAddress: '',
  city: '',
  eventDate: '',
  startTime: '',
  endTime: '',
  headcount: '',
  primarySponsor: '',
  coSponsors: '',
  eventObjective: '',
  successCriteria: '',
  modelType: 'cost-plus',
  optionsCount: 1,
  quickTemplate: '',
  venuePreset: '',
  serviceCharge: '23',
  salesTax: '8.875',
  taxAfterService: true,
  mgmtFee: '20',
  contingency: '0',
  depositPercent: '50',
  depositDueRule: 'Due on signature',
  balanceDueRule: 'Due 7 days before event',
  cancellationWindowDays: '90',
  confidentialityEnabled: true,
  costSplitNotes: '',
  signerName: '',
  signerEmail: '',
  signerTitle: '',
  signerCompany: '',
  turnkeyMethod: 'margin',
  targetMargin: '35',
  targetPrice: '125000',
  saveAsDefault: false,
  buildCosts: {
    groupPreview: false,
    rowsByOption: {
      1: INITIAL_LINE_ITEMS,
      2: INITIAL_LINE_ITEMS.map((row) => ({ ...row, id: `2-${row.id}` })),
      3: INITIAL_LINE_ITEMS.map((row) => ({ ...row, id: `3-${row.id}` })),
    },
  },
};

