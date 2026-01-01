import { Router } from 'express';
import { stripe } from '../services/stripe';
import { supabaseAdmin } from '../services/supabase';

const r = Router();

async function resolveAffiliateByCode(code?: string | null) {
  if (!code) return null;
  const { data } = await supabaseAdmin
    .from('affiliates')
    .select('id, referral_code')
    .eq('referral_code', code)
    .maybeSingle();
  return data ? { id: data.id, code: data.referral_code } : null;
}

r.post('/session', async (req, res) => {
  try {
    const { price_id, success_url, cancel_url, plan_type, planId, interval } = req.body || {};

    if (!price_id || !success_url || !cancel_url) {
      res.status(400).json({ error: 'Missing required fields: price_id, success_url, cancel_url' });
      return;
    }

    const refCode = (req as any).cookies?.hp_ref as string | undefined;
    const affiliate = await resolveAffiliateByCode(refCode);

    const metadata: Record<string, any> = {
      plan_type: plan_type || 'job_seeker',
      price_id,
      plan_id: planId || undefined,
      interval: interval || undefined,
    };
    if (affiliate) {
      metadata.affiliate_id = affiliate.id;
      metadata.referral_code = affiliate.code;
    }

    const normalizedPlanId = String(planId || '').toLowerCase();
    const shouldApplyTrial =
      (plan_type === 'job_seeker' || !plan_type) &&
      ['job_seeker_pro', 'job_seeker_elite'].includes(normalizedPlanId);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      success_url,
      cancel_url,
      allow_promotion_codes: true,
      metadata,
      ...(shouldApplyTrial ? { subscription_data: { trial_period_days: 7 } } : {}),
    });

    res.json({ id: session.id, url: session.url });
  } catch (e: any) {
    console.error('[public-checkout.session] error', e);
    res.status(500).json({ error: e.message || 'Failed to create checkout session' });
  }
});

export default r;
