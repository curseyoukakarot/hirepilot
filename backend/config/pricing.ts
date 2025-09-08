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

function resolvePriceId(planKey: 'STARTER' | 'PRO' | 'TEAM', interval: 'MONTHLY' | 'ANNUAL'): string {
  const candidates = [
    `STRIPE_PRICE_ID_${planKey}_${interval}`,
    `VITE_STRIPE_PRICE_ID_${planKey}_${interval}`,
    `STRIPE_${planKey}_${interval}_PRICE_ID`,
    `${planKey}_${interval}_STRIPE_PRICE_ID`,
    `PRICE_ID_${planKey}_${interval}`,
    `STRIPE_${planKey}_${interval}`,
  ];
  for (const key of candidates) {
    const val = (process.env as Record<string, string | undefined>)[key];
    if (val && val.trim().length > 0) return val.trim();
  }
  return '';
}

export const PRICING_CONFIG: PricingConfig = {
  free: {
    name: 'Free',
    credits: 50,
    features: [
      '50 credits/month',
      'No sequences or exports',
      'Chrome extension + basic enrichment',
    ],
    priceIds: {
      monthly: '',
      annual: ''
    },
    prices: {
      monthly: 0,
      annual: 0
    }
  },
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
      monthly: resolvePriceId('STARTER', 'MONTHLY'),
      annual: resolvePriceId('STARTER', 'ANNUAL')
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
      monthly: resolvePriceId('PRO', 'MONTHLY'),
      annual: resolvePriceId('PRO', 'ANNUAL')
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
      monthly: resolvePriceId('TEAM', 'MONTHLY'),
      annual: resolvePriceId('TEAM', 'ANNUAL')
    },
    prices: {
      monthly: 199,
      annual: 1910 // ~20% discount
    }
  }
};

export const SUBSCRIPTION_PLANS = {
  STARTER: {
    id: 'starter',
    name: 'Starter',
    price: 99,
    credits: 350,
    perCredit: 0.283,
    features: [
      '350 credits/month',
      'Basic support',
      'Core features'
    ]
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    price: 249,
    credits: 1000,
    perCredit: 0.249,
    features: [
      '1000 credits/month',
      'Priority support',
      'Advanced features',
      'Analytics dashboard'
    ]
  },
  TEAM: {
    id: 'team',
    name: 'Team',
    price: 450,
    credits: 2000,
    perCredit: 0.225,
    features: [
      '2000 credits/month',
      'Dedicated support',
      'All features',
      'Team management',
      'Custom integrations'
    ]
  }
};

export const A_LA_CARTE_PACKAGES = {
  LIGHT: {
    id: 'light-boost',
    name: 'Light Boost',
    credits: 100,
    price: 50,
    perCredit: 0.50,
    description: 'Perfect for small campaigns or testing'
  },
  POWER: {
    id: 'power-pack',
    name: 'Power Pack',
    credits: 300,
    price: 135,
    perCredit: 0.45,
    description: 'Ideal for medium-sized campaigns'
  },
  GROWTH: {
    id: 'growth-bundle',
    name: 'Growth Bundle',
    credits: 600,
    price: 240,
    perCredit: 0.40,
    description: 'Best value for larger campaigns'
  }
};

export const CREDIT_THRESHOLDS = {
  LOW_CREDITS_WARNING: 50, // Show warning when credits drop below this
  CRITICAL_CREDITS_WARNING: 20 // Show urgent warning when credits drop below this
};

// Helper function to get credits for a plan
export function getCreditsForPlan(planId: string): number {
  const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.id === planId);
  return plan?.credits || 0;
}

// Helper function to get price per credit for a plan
export function getPricePerCredit(planId: string): number {
  const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.id === planId);
  return plan?.perCredit || 0;
}

// Helper function to calculate savings compared to à la carte
export function calculateSavings(planId: string): number {
  const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.id === planId);
  if (!plan) return 0;
  
  const alaCartePrice = plan.credits * A_LA_CARTE_PACKAGES.LIGHT.perCredit;
  return ((alaCartePrice - plan.price) / alaCartePrice) * 100;
} 