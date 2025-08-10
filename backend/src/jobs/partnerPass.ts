import { supabaseAdmin } from '../services/supabase';
import { stripe } from '../services/stripe';

const THRESHOLD_DIY = Number(process.env.PARTNER_PASS_THRESHOLD || 5);
const FREE_MONTHS = Number(process.env.PARTNER_PASS_FREE_MONTHS || 3);
const LOOKBACK_DAYS = Number(process.env.PARTNER_PASS_LOOKBACK_DAYS || 90);

export async function runPartnerPass(): Promise<{ processed: number; granted: number }> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Get all affiliates
  const { data: affiliates, error: affErr } = await supabaseAdmin
    .from('affiliates')
    .select('id, user_id');
  if (affErr) throw new Error(affErr.message);

  if (!affiliates?.length) return { processed: 0, granted: 0 };

  // Get recent active referrals in window
  const { data: recentRefs, error: refErr } = await supabaseAdmin
    .from('referrals')
    .select('affiliate_id, status, first_attributed_at')
    .gte('first_attributed_at', since)
    .eq('status', 'active');
  if (refErr) throw new Error(refErr.message);

  const activeCounts = new Map<string, number>();
  for (const r of recentRefs || []) {
    const k = r.affiliate_id as string;
    activeCounts.set(k, (activeCounts.get(k) || 0) + 1);
  }

  let granted = 0;
  for (const aff of affiliates) {
    const count = activeCounts.get(aff.id) || 0;
    if (count < THRESHOLD_DIY) continue;

    // Find user's active subscription
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', aff.user_id)
      .eq('status', 'active')
      .maybeSingle();
    if (subErr || !sub?.stripe_subscription_id) continue;

    // Retrieve subscription to check discount
    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id).catch(() => null);
    if (!subscription) continue;
    if ((subscription as any).discount) continue; // already has a discount

    // Create a 100% off coupon repeating for FREE_MONTHS
    const coupon = await stripe.coupons.create({
      percent_off: 100,
      duration: 'repeating',
      duration_in_months: FREE_MONTHS,
      name: `Partner Pass ${FREE_MONTHS}mo`,
    });

    // Apply coupon to subscription
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      coupon: coupon.id,
      proration_behavior: 'none',
    });

    granted += 1;
  }

  return { processed: affiliates.length, granted };
}


