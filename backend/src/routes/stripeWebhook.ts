import { Router, Request, Response } from 'express';
import { stripe } from '../services/stripe';
import { supabaseAdmin } from '../services/supabase';
import { DIY_BOUNTIES, DFY_PERCENT, DFY_MAX_MONTHS, mapStripePriceToPlanCode, DIY_LOCK_DAYS } from '../services/affiliateLogic';
import { PRICING_CONFIG } from '../../config/pricing';

const r = Router();

export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;
  let event;
  try {
    const buf = req.body as Buffer; // bodyParser.raw provides Buffer
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // helpers
  const resolveRoleFromPrice = (priceId?: string | null, planTypeMeta?: string | null) => {
    if (!priceId) return null;
    // Job seeker mapping first (based on PRICING_CONFIG keys)
    const jobSeekerProIds = Object.values(PRICING_CONFIG.job_seeker_pro.priceIds || {}).filter(Boolean);
    const jobSeekerEliteIds = Object.values(PRICING_CONFIG.job_seeker_elite.priceIds || {}).filter(Boolean);
    if (jobSeekerProIds.includes(priceId)) return 'job_seeker_pro';
    if (jobSeekerEliteIds.includes(priceId)) return 'job_seeker_elite';
    // Recruiter side: use metadata if provided, else map to default recruiter
    if (planTypeMeta && ['member', 'admin', 'team_admin', 'RecruitPro'].includes(planTypeMeta)) {
      return planTypeMeta;
    }
    // Fallback: treat unknown recruiter plans as member
    return 'member';
  };

  async function setUserRoleFromStripe(customerId: string | undefined, priceId: string | undefined, planTypeMeta?: string | null) {
    if (!customerId || !priceId) return;
    // Find user by stripe_customer_id on users table
    const { data: userRow } = await supabaseAdmin.from('users').select('id, role, plan, account_type, primary_app, stripe_customer_id').eq('stripe_customer_id', customerId).maybeSingle();
    if (!userRow?.id) return;
    const nextRole = resolveRoleFromPrice(priceId, planTypeMeta);
    if (!nextRole) return;
    const primaryApp = nextRole.startsWith('job_seeker_') ? 'job_seeker' : 'recruiter';
    await supabaseAdmin
      .from('users')
      .update({
        role: nextRole,
        plan: nextRole,
        account_type: nextRole,
        primary_app: primaryApp,
      })
      .eq('id', userRow.id);
    return { userId: userRow.id, nextRole };
  }

  async function upsertJobSeekerCredits(userId: string, role: string) {
    try {
      const credits =
        role === 'job_seeker_free'
          ? 50
          : (PRICING_CONFIG as any)?.[role]?.credits;
      if (typeof credits !== 'number' || credits <= 0) return;

      const now = new Date().toISOString();

      // Source of truth: user_credits (used by /api/credits/status)
      await supabaseAdmin
        .from('user_credits')
        .upsert(
          { user_id: userId, total_credits: credits, used_credits: 0, remaining_credits: credits, last_updated: now } as any,
          { onConflict: 'user_id' }
        );

      // Keep users table in sync (used by /api/user/plan and some gating)
      await supabaseAdmin
        .from('users')
        .update({ monthly_credits: credits, remaining_credits: credits, plan_updated_at: now } as any)
        .eq('id', userId);
    } catch (e) {
      console.error('[stripe webhook] upsertJobSeekerCredits error', e);
    }
  }
  async function upsertReferralFromMeta(meta: any, stripeCustomerId?: string) {
    const affiliateId = meta?.affiliate_id;
    const planType = meta?.plan_type as 'DIY'|'DFY'|undefined;

    if (!affiliateId) return null;

    const { data: ref } = await supabaseAdmin
      .from('referrals')
      .select('id,status')
      .eq('affiliate_id', affiliateId)
      .eq('stripe_customer_id', stripeCustomerId ?? null)
      .maybeSingle();

    const payload = {
      affiliate_id: affiliateId,
      stripe_customer_id: stripeCustomerId ?? null,
      plan_type: planType ?? 'DIY',
      status: 'active',
      metadata: meta ?? {},
    } as any;

    if (ref) {
      await supabaseAdmin.from('referrals').update(payload).eq('id', ref.id);
      return ref.id;
    } else {
      const { data: created } = await supabaseAdmin.from('referrals').insert(payload).select().single();
      return created?.id ?? null;
    }
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any;
      const meta = session.metadata || {};
      const customerId = session.customer as string | undefined;
      const priceId = (session?.line_items?.[0]?.price?.id) || session?.metadata?.price_id || session?.metadata?.price_code;

      const referralId = await upsertReferralFromMeta(meta, customerId);

      // Map paid checkout to role/plan
      try {
        const result = await setUserRoleFromStripe(customerId, priceId, meta?.plan_type);
        if (result?.userId && typeof result?.nextRole === 'string' && result.nextRole.startsWith('job_seeker_')) {
          await upsertJobSeekerCredits(result.userId, result.nextRole);
        }
      } catch (e) {
        console.error('[stripe webhook] setUserRoleFromStripe error (checkout.session.completed)', e);
      }

      // DIY one-time bounty (if purchase contains DIY price)
      const line = session?.display_items?.[0] ?? null; // legacy; handle subs below
      const planCode = mapStripePriceToPlanCode(session?.metadata?.price_code || line?.price?.id);
      if (planCode) {
        const amount = DIY_BOUNTIES[planCode] || 0;
        if (amount > 0) {
          await supabaseAdmin.from('commissions').insert({
            affiliate_id: meta.affiliate_id,
            referral_id: referralId,
            type: 'DIY_ONE_TIME',
            plan_code: planCode,
            amount_cents: amount,
            status: 'pending',
            source_event: event.id,
          });
        }
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as any;
      const amountPaid = invoice.amount_paid; // cents
      const customerId = invoice.customer as string;
      const meta = invoice.metadata || {};
      const priceId = invoice.lines?.data?.[0]?.price?.id;

      const referralId = await upsertReferralFromMeta(meta, customerId);

      // Map recurring invoice to role/plan
      try {
        const result = await setUserRoleFromStripe(customerId, priceId, meta?.plan_type);
        if (result?.userId && typeof result?.nextRole === 'string' && result.nextRole.startsWith('job_seeker_')) {
          await upsertJobSeekerCredits(result.userId, result.nextRole);
        }
      } catch (e) {
        console.error('[stripe webhook] setUserRoleFromStripe error (invoice.paid)', e);
      }

      // DFY recurring commission (10%, up to 6 months)
      if (meta.plan_type === 'DFY') {
        const start = new Date((invoice.period_start || Math.floor(Date.now() / 1000)) * 1000);
        const y = start.getUTCFullYear();
        const m = String(start.getUTCMonth() + 1).padStart(2, '0');
        const periodMonth = `${y}-${m}-01`;
        const { data: existing } = await supabaseAdmin
          .from('commissions')
          .select('id')
          .eq('referral_id', referralId)
          .eq('type', 'DFY_RECUR')
          .eq('period_month', periodMonth)
          .maybeSingle();

        if (!existing) {
          // count months so far
          const { data: past } = await supabaseAdmin
            .from('commissions')
            .select('id')
            .eq('referral_id', referralId)
            .eq('type', 'DFY_RECUR');
          if ((past?.length ?? 0) < DFY_MAX_MONTHS) {
            const cents = Math.floor(amountPaid * DFY_PERCENT);
            await supabaseAdmin.from('commissions').insert({
              affiliate_id: meta.affiliate_id,
              referral_id: referralId,
              type: 'DFY_RECUR',
              amount_cents: cents,
              status: 'locked',
              locked_at: new Date().toISOString(),
              period_month: periodMonth,
              source_event: event.id,
            });
          }
        }
      }

      break;
    }

    // Refund/void handling – mark related commissions as 'void'
    case 'charge.refunded': {
      const charge: any = event.data.object;
      const customerId: string | undefined = charge.customer as string | undefined;
      if (!customerId) break;

      // If invoice present, try to void the DFY commission for that month only
      let didSpecificVoid = false;
      if (charge.invoice) {
        try {
          const invoice = await stripe.invoices.retrieve(typeof charge.invoice === 'string' ? charge.invoice : charge.invoice.id);
          const start = new Date(((invoice as any).period_start || Math.floor(Date.now() / 1000)) * 1000);
          const y = start.getUTCFullYear();
          const m = String(start.getUTCMonth() + 1).padStart(2, '0');
          const periodMonth = `${y}-${m}-01`;

          // Find referral by customer
          const { data: ref } = await supabaseAdmin
            .from('referrals')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          if (ref?.id) {
            await supabaseAdmin
              .from('commissions')
              .update({ status: 'void' })
              .eq('referral_id', ref.id)
              .eq('type', 'DFY_RECUR')
              .eq('period_month', periodMonth)
              .neq('status', 'paid');
            didSpecificVoid = true;
          }
        } catch {}
      }

      // Fallback: void any recent non-paid commissions tied to this customer (covers DIY one-time)
      if (!didSpecificVoid) {
        const { data: refs } = await supabaseAdmin
          .from('referrals')
          .select('id')
          .eq('stripe_customer_id', customerId);
        const ids = (refs || []).map(r => r.id);
        if (ids.length) {
          await supabaseAdmin
            .from('commissions')
            .update({ status: 'void' })
            .in('referral_id', ids)
            .neq('status', 'paid');
        }
      }
      break;
    }
  }

  res.json({ received: true });
}

// Keep an Express router for potential future extension
r.post('/webhook', stripeWebhookHandler);

export default r;


