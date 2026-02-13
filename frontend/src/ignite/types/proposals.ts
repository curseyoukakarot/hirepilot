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
