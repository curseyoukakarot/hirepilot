import { PRICING_CONFIG, PricingConfig } from './pricing';

type BillingConfig = {
  recruiter: PricingConfig;
  job_seeker: PricingConfig;
};

export const BILLING_CONFIG: BillingConfig = {
  recruiter: PRICING_CONFIG,
  job_seeker: {
    free: {
      name: 'Free',
      credits: 50,
      features: [
        'Core job prep tools',
        'Basic resume + landing templates',
        'Community support'
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
    pro: {
      name: 'Job Seeker Pro',
      credits: 350,
      features: [
        'AI resume + landing builder',
        'Job prep chat with saved context',
        'Export-ready PDF + share links'
      ],
      priceIds: {
        monthly: 'price_1SdxZPAMuJmulDbpvRJ2PokY',
        annual: 'price_1SdxbFAMuJmulDbpLU7huKqS'
      },
      prices: {
        monthly: 39,
        annual: 399
      }
    },
    elite: {
      name: 'Job Seeker Elite',
      credits: 1000,
      features: [
        'Everything in Pro',
        'Unlimited AI iterations',
        'Priority support & concierge prep'
      ],
      priceIds: {
        monthly: 'price_1Sdxa4AMuJmulDbpVHGZM9BT',
        annual: 'price_1SdxcjAMuJmulDbp1AdpVtW0'
      },
      prices: {
        monthly: 59,
        annual: 549
      }
    }
  }
};
