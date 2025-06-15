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
      '350 credits/month',
      'Basic campaign features',
      'Email support',
      'Up to 2 team members'
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
      '1,000 credits/month',
      'Advanced campaign features',
      'Priority support',
      'Up to 5 team members',
      'Custom templates'
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
    credits: 2000,
    features: [
      '2,000 credits/month',
      'All Pro features',
      'Dedicated support',
      'Unlimited team members',
      'API access',
      'Custom integrations'
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