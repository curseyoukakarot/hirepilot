import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function ensureConnectAccount(userId: string, existing?: string) {
  if (existing) return existing;
  const acct = await stripe.accounts.create({
    type: 'express',
    capabilities: { transfers: { requested: true } },
    metadata: { userId },
  });
  return acct.id;
}

export async function connectOnboardingLink(accountId: string) {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: process.env.STRIPE_CONNECT_REFRESH_URL!,
    return_url: process.env.STRIPE_CONNECT_RETURN_URL!,
    type: 'account_onboarding',
  });
}


