export type IgniteProposalComputedModelType = 'cost_plus' | 'turnkey';

export type IgniteProposalComputedCategoryTotal = {
  categoryName: string;
  amount: number;
};

export type IgniteProposalComputedLineItem = {
  id: string | null;
  category: string;
  name: string;
  description: string | null;
  amount: number;
  vendor: string | null;
};

export type IgniteProposalComputedOption = {
  id: string;
  name: string;
  description: string;
  isRecommended: boolean;
  totals: {
    subtotal: number;
    fee: number;
    contingency: number;
    total: number;
  };
  breakdown: IgniteProposalComputedCategoryTotal[];
  lineItems: IgniteProposalComputedLineItem[];
};

export type IgniteProposalComputedIncludedSection = {
  title: string;
  bullets: string[];
};

export type IgniteProposalComputed = {
  proposalId: string;
  clientName: string;
  eventName: string;
  location: string;
  date: string;
  headcount: number;
  eventSnapshot: {
    venueAddress: string;
    city: string;
    startTime: string;
    endTime: string;
    primarySponsor: string;
    coSponsors: string[];
  };
  overview: {
    objective: string;
    successCriteria: string[];
  };
  agreementTerms: {
    depositPercent: number;
    depositDueRule: string;
    balanceDueRule: string;
    cancellationWindowDays: number;
    confidentialityEnabled: boolean;
    costSplitNotes: string;
    signerName: string;
    signerEmail: string;
    signerTitle: string;
    signerCompany: string;
  };
  modelType: IgniteProposalComputedModelType;
  options: IgniteProposalComputedOption[];
  included: {
    sections: IgniteProposalComputedIncludedSection[];
  };
  nextSteps: {
    bullets: string[];
  };
  visibilityRules: {
    showLineItems: boolean;
    showVendors: boolean;
  };
  updatedAt: string;
};
