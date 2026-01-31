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
    if (process.env.LOG_REQUESTS === 'true') {
      console.log('[public-checkout] hit', {
        path: req.path,
        origin: req.headers.origin,
        hasAuth: Boolean(req.headers.authorization),
        hasSessionCookie: Boolean((req as any)?.cookies?.hp_session),
      });
    }
    const {
      price_id,
      priceId,
      success_url,
      cancel_url,
      plan_type,
      planTier,
      userId,
      planId,
      interval,
    } = req.body || {};

    const resolvedPriceId = String(price_id || priceId || '').trim();
    if (!resolvedPriceId || !success_url || !cancel_url) {
      res.status(400).json({ error: 'Missing required fields: price_id, success_url, cancel_url' });
      return;
    }

    const refCode = (req as any).cookies?.hp_ref as string | undefined;
    const affiliate = await resolveAffiliateByCode(refCode);

    const normalizedPlanTier = String(planTier || '').toLowerCase();
    const normalizedPlanType = String(plan_type || '').toLowerCase();
    const normalizedPlanId = String(planId || '').toLowerCase();

    const metadata: Record<string, any> = {
      price_id: resolvedPriceId,
      plan_id: planId || undefined,
      interval: interval || undefined,
    };
    if (normalizedPlanType) metadata.plan_type = normalizedPlanType;
    if (normalizedPlanTier) metadata.plan_tier = normalizedPlanTier;
    if (userId) metadata.user_id = userId;
    if (affiliate) {
      metadata.affiliate_id = affiliate.id;
      metadata.referral_code = affiliate.code;
    }

    const isJobSeeker = normalizedPlanType === 'job_seeker' || (!normalizedPlanType && !normalizedPlanTier);
    let trialDays = 0;
    if (isJobSeeker && ['job_seeker_pro', 'job_seeker_elite'].includes(normalizedPlanId)) {
      trialDays = 7;
    }
    if (!isJobSeeker && (normalizedPlanTier === 'starter' || normalizedPlanTier === 'team')) {
      trialDays = 14;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      success_url,
      cancel_url,
      allow_promotion_codes: true,
      metadata,
      subscription_data: {
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
        metadata,
      },
    });

    res.json({ id: session.id, url: session.url });
  } catch (e: any) {
    console.error('[public-checkout.session] error', e);
    res.status(500).json({ error: e.message || 'Failed to create checkout session' });
  }
});

export default r;
