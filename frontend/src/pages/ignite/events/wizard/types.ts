import { CostCategory, EventKind, SponsorKind, SponsorStatus } from '../mockData';

export type WizardSponsor = {
  id: string;
  name: string;
  kind: SponsorKind;
  amount: string;
  status: SponsorStatus;
  contact?: string;
  notes?: string;
};

export type WizardCostLine = {
  id: string;
  category: CostCategory;
  description: string;
  vendor: string;
  qty: string;
  unitCost: string;
  status: 'budgeted' | 'committed' | 'invoiced' | 'paid';
};

export type EventWizardState = {
  kind: EventKind;
  name: string;
  clientName: string;
  ownerName: string;
  primaryContact: string;
  startDate: string;
  endDate: string;
  city: string;
  venue: string;
  headcount: string;
  description: string;
  targetMarginPct: string;
  sponsors: WizardSponsor[];
  costs: WizardCostLine[];
};

export const DEFAULT_EVENT_WIZARD_STATE: EventWizardState = {
  kind: 'internal',
  name: '',
  clientName: '',
  ownerName: '',
  primaryContact: '',
  startDate: '',
  endDate: '',
  city: '',
  venue: '',
  headcount: '',
  description: '',
  targetMarginPct: '20',
  sponsors: [
    { id: 'new_s1', name: '', kind: 'cash', amount: '', status: 'prospect' },
  ],
  costs: [
    { id: 'new_c1', category: 'Venue', description: 'Venue rental', vendor: '', qty: '1', unitCost: '', status: 'budgeted' },
    { id: 'new_c2', category: 'Manpower', description: 'On-site staff', vendor: '', qty: '1', unitCost: '', status: 'budgeted' },
  ],
};

export type WizardStepNumber = 1 | 2 | 3 | 4 | 5;

export const STEP_LABELS: Record<WizardStepNumber, string> = {
  1: 'Basics',
  2: 'Sponsors & Revenue',
  3: 'Cost Plan',
  4: 'Margin Review',
  5: 'Launch',
};
