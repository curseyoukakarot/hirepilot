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
    credits: 350,
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
      monthly: 49,
      annual: 470 // ~20% discount
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
      monthly: import.meta.env.VITE_STRIPE_PRICE_ID_PRO_MONTHLY || '',
      annual: import.meta.env.VITE_STRIPE_PRICE_ID_PRO_ANNUAL || ''
    },
    prices: {
      monthly: 99,
      annual: 950 // ~20% discount
    }
  },
  team: {
    name: 'Team',
    credits: 5000,
    features: [
      'Everything in Starter & Pro (all features unlocked)',
      '5 users included (contact us if you need more)',
      'Credit rollover while subscribed',
      'High-throughput sourcing + automations',
      'Great for multi-role pipelines and weekly hiring cycles'
    ],
    priceIds: {
      monthly: import.meta.env.VITE_STRIPE_PRICE_ID_TEAM_MONTHLY || '',
      annual: import.meta.env.VITE_STRIPE_PRICE_ID_TEAM_ANNUAL || ''
    },
    prices: {
      monthly: 199,
      annual: 1910 // ~20% discount
    }
  }
}; 