export interface PlanConfig {
  name: string;
  credits: number;
  features: string[];
  priceIds: {
    monthly: string;
    annual: string;
  };
  prices: {
    monthly: number;
    annual: number;
  };
}

export interface PricingConfig {
  [key: string]: PlanConfig;
}

export const PRICING_CONFIG: PricingConfig = {
  starter: {
    name: 'Starter',
    credits: 500,
    features: [
      'Credit rollover while subscribed',
      'Unlimited job reqs & campaigns',
      'Add credits anytime from Billing'
    ],
    priceIds: {
      monthly: import.meta.env.VITE_STRIPE_PRICE_ID_STARTER_MONTHLY || '',
      annual: import.meta.env.VITE_STRIPE_PRICE_ID_STARTER_ANNUAL || ''
    },
    prices: {
      monthly: 59,
      annual: 468 // $39/mo billed annually
    }
  },
  pro: {
    name: 'Pro',
    credits: 1000,
    features: [
      'Everything in Starter (all features unlocked)',
      'Credit rollover while subscribed',
      'Higher-volume outreach + enrichment',
      'Perfect for 2–3 concurrent roles and A/B testing'
    ],
    priceIds: {
      // Legacy plan (not sold anymore)
      monthly: '',
      annual: ''
    },
    prices: {
      monthly: 99,
      annual: 950 // ~20% discount
    }
  },
  team: {
    name: 'Team',
    credits: 500,
    features: [
      'Everything in Starter',
      'Up to 5 team members (contact us if you need more)',
      'Credit rollover while subscribed',
      'High-throughput sourcing + automations',
      'Great for multi-role pipelines and weekly hiring cycles'
    ],
    priceIds: {
      monthly: import.meta.env.VITE_STRIPE_PRICE_ID_TEAM_MONTHLY || '',
      annual: import.meta.env.VITE_STRIPE_PRICE_ID_TEAM_ANNUAL || ''
    },
    prices: {
      monthly: 79,
      annual: 708 // $59/mo billed annually
    }
  }
}; 