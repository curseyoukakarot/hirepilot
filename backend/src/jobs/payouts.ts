import { supabaseAdmin } from '../services/supabase';
import { stripe } from '../services/stripe';

export async function processPayouts({ since, until }: { since: Date; until: Date }) {
  // 1) group locked commissions by affiliate
  const { data: locked, error } = await supabaseAdmin
    .from('commissions')
    .select('id, affiliate_id, amount_cents')
    .eq('status', 'locked');
  if (error) throw new Error(error.message);

  const grouped = new Map<string, number>();
  locked?.forEach(c => {
    grouped.set(c.affiliate_id, (grouped.get(c.affiliate_id) ?? 0) + c.amount_cents);
  });

  for (const [affiliateId, totalCents] of grouped) {
    if (totalCents <= 0) continue;

    // Enforce minimum payout threshold (default $50)
    const minCents = Number(process.env.AFFILIATE_MIN_PAYOUT_CENTS || 5000);
    if (totalCents < minCents) {
      // Skip creating transfer; leave commissions locked for next cycle
      continue;
    }

    const { data: aff } = await supabaseAdmin.from('affiliates').select('stripe_connect_id').eq('id', affiliateId).single();
    if (!aff?.stripe_connect_id) continue;

    // 2) create transfer
    const transfer = await stripe.transfers.create({
      amount: totalCents,
      currency: 'usd',
      destination: aff.stripe_connect_id,
      description: 'HirePilot affiliate payout',
    });

    // 3) record payout + mark commissions as paid
    const { data: payout } = await supabaseAdmin.from('payouts').insert({
      affiliate_id: affiliateId,
      total_cents: totalCents,
      method: 'stripe_connect',
      period_start: since.toISOString().slice(0,10),
      period_end: until.toISOString().slice(0,10),
      status: 'paid',
      transfer_id: transfer.id,
    }).select().single();

    const ids = locked!.filter(x => x.affiliate_id === affiliateId).map(x => x.id);
    await supabaseAdmin.from('commissions').update({ status: 'paid', paid_at: new Date().toISOString() }).in('id', ids);
  }
}


