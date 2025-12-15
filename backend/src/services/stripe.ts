import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

export interface StripeCtx { client: Stripe; account?: string }

export async function getStripeClient(userId: string): Promise<StripeCtx> {
  // Look up user's integration mode
  // Fallback to platform key if none found
  // Note: we avoid importing supabase here to keep module decoupled; caller provides context if needed
  // For now, read from process.env like platform mode; the route will pass account where applicable
  return { client: stripe, account: undefined };
}

export async function ensureCustomer(opts: { client: Stripe; account?: string; email: string; name?: string }): Promise<[Stripe.Customer]> {
  const { client, account, email, name } = opts;
  // For simplicity, always create-or-update by email using search (idempotent-ish for demo)
  let customer: Stripe.Customer | null = null;
  try {
    const found = await client.customers.list({ email, limit: 1 }, account ? { stripeAccount: account } : undefined);
    customer = (found.data && found.data[0]) || null;
  } catch {}
  if (!customer) {
    customer = await client.customers.create({ email, name }, account ? { stripeAccount: account } : undefined);
  } else if (email && !customer.email) {
    customer = await client.customers.update(customer.id, { email }, account ? { stripeAccount: account } : undefined);
  }
  return [customer];
}

export async function createInvoiceWithItem(opts: {
  userId: string;
  // Provide either `customerId` (preferred) or `customerEmail` (fallback lookup/create).
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  description: string;
  amountCents: number;
  meta?: Record<string, string>;
  account?: string; // optional override when caller already resolved account
  stripeClient?: Stripe; // optional override when caller already resolved Stripe client (e.g. per-user keys)
}) {
  let client: Stripe;
  let acct: string | undefined = opts.account;
  if (opts.stripeClient) {
    client = opts.stripeClient;
  } else {
    const ctx = await getStripeClient(opts.userId);
    client = ctx.client;
    acct = acct ?? ctx.account;
  }

  let customerId = opts.customerId;
  if (!customerId) {
    const email = String(opts.customerEmail || '').trim();
    if (!email) throw new Error('Missing Stripe customer (provide customerId or customerEmail).');
    const [customer] = await ensureCustomer({ client, account: acct, email, name: opts.customerName });
    customerId = customer.id;
  }

  const invoice = await client.invoices.create({
    customer: customerId,
    collection_method: 'send_invoice',
    days_until_due: 14,
    pending_invoice_items_behavior: 'include',
    description: opts.description,
    metadata: opts.meta || {},
  }, acct ? { stripeAccount: acct } : undefined);

  await client.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    currency: 'usd',
    unit_amount: opts.amountCents,
    quantity: 1,
    description: opts.description,
    metadata: opts.meta || {},
  }, acct ? { stripeAccount: acct } : undefined);

  const populated = await client.invoices.retrieve(invoice.id, { expand: ['lines'] }, acct ? { stripeAccount: acct } : undefined);
  if (!populated.lines || populated.lines.data.length === 0) {
    throw new Error('Invoice has zero line items – aborting send.');
  }

  await client.invoices.finalizeInvoice(invoice.id, {}, acct ? { stripeAccount: acct } : undefined);
  return await client.invoices.sendInvoice(invoice.id, {}, acct ? { stripeAccount: acct } : undefined);
}

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


