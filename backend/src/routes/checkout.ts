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

// Normalize recruiter plan types so webhook gets consistent roles
function normalizeRecruiterPlanType(input: any): 'member' | 'admin' | 'team_admin' | 'RecruitPro' {
  const v = String(input || '').trim();
  const lower = v.toLowerCase();
  if (lower === 'admin') return 'admin';
  if (lower === 'team_admin' || lower === 'teamadmin' || lower === 'team admin') return 'team_admin';
  if (lower === 'recruitpro' || lower === 'recruit_pro' || lower === 'recruit pro') return 'RecruitPro';
  if (lower === 'member') return 'member';
  // Safe default for recruiter paid upgrades
  return 'member';
}

r.post('/session', async (req, res) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const { price_id, success_url, cancel_url, plan_type } = req.body || {};

    if (!price_id || !success_url || !cancel_url) {
      res.status(400).json({ error: 'Missing required fields: price_id, success_url, cancel_url' });
      return;
    }

    const refCode = (req as any).cookies?.hp_ref as string | undefined;
    const affiliate = await resolveAffiliateByCode(refCode);

    const normalizedPlanType = normalizeRecruiterPlanType(plan_type);

    const metadata: Record<string, any> = {
      plan_type: normalizedPlanType,
      price_id,
    };
    if (userId) {
      metadata.user_id = userId;
    }
    if (affiliate) {
      metadata.affiliate_id = affiliate.id;
      metadata.referral_code = affiliate.code;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      success_url,
      cancel_url,
      allow_promotion_codes: true,
      metadata,
      subscription_data: {
        metadata,
      },
      client_reference_id: userId,
    });

    res.json({ id: session.id, url: session.url });
  } catch (e: any) {
    console.error('[checkout.session] error', e);
    res.status(500).json({ error: e.message || 'Failed to create checkout session' });
  }
});

export default r;


