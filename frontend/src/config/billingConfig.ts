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
      credits: 250,
      features: [
        'AI resume + landing builder',
        'Job prep chat with saved context',
        'Export-ready PDF + share links'
      ],
      priceIds: {
        monthly: import.meta.env.VITE_STRIPE_PRICE_ID_JS_PRO_MONTHLY || '',
        annual: import.meta.env.VITE_STRIPE_PRICE_ID_JS_PRO_ANNUAL || ''
      },
      prices: {
        monthly: 19.99,
        annual: 199
      }
    },
    elite: {
      name: 'Job Seeker Elite',
      credits: 500,
      features: [
        'Everything in Pro',
        'Unlimited AI iterations',
        'Priority support & concierge prep'
      ],
      priceIds: {
        monthly: import.meta.env.VITE_STRIPE_PRICE_ID_JS_ELITE_MONTHLY || '',
        annual: import.meta.env.VITE_STRIPE_PRICE_ID_JS_ELITE_ANNUAL || ''
      },
      prices: {
        monthly: 39,
        annual: 399
      }
    }
  }
};
