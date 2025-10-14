import { Request, Response } from 'express';
import Stripe from 'stripe';
import jwt from 'jsonwebtoken';
import { supabaseDb } from '../../lib/supabase';
import { notifySlack } from '../../lib/slack';
import { CreditService } from '../../services/creditService';
import { freeForeverQueue } from '../../jobs/freeForeverCadence';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2022-11-15' });

export default async function userCreatedWebhook(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Supabase sends JWT in Authorization header "Bearer <token>"
  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    jwt.verify(token, process.env.SUPABASE_JWT_SECRET!);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { id: user_id, email, raw_user_meta_data } = req.body?.record || {};
  if (!user_id || !email) return res.status(400).json({ error: 'Invalid payload' });

  try {
    // Determine desired plan from metadata; default to free
    const meta = (raw_user_meta_data || {}) as any;
    const desiredPlan = String(meta.plan || meta.plan_tier || meta.selected_plan || '').toLowerCase();

    // Always ensure public.users exists; default to free
    await supabaseDb
      .from('users')
      .upsert({ id: user_id, email, role: desiredPlan === 'free' || !desiredPlan ? 'free' : (meta.role || 'member'), plan: desiredPlan || 'free' } as any, { onConflict: 'id' });

    if (desiredPlan && desiredPlan !== 'free') {
      // Paid path only when plan metadata is explicitly present
      let customerId: string | null = null;
      const { data: userRow2 } = await supabaseDb.from('users').select('stripe_customer_id').eq('id', user_id).single();
      if (userRow2?.stripe_customer_id) {
        customerId = userRow2.stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({ email, metadata: { user_id } });
        customerId = customer.id;
        await supabaseDb.from('users').update({ stripe_customer_id: customerId }).eq('id', user_id);
      }
      const price = process.env.STRIPE_PRICE_ID_STARTER_MONTHLY!;
      const subscription = await stripe.subscriptions.create({
        customer: customerId!,
        items: [{ price }],
        trial_period_days: 7,
        metadata: { user_id, plan_tier: desiredPlan }
      });
      await supabaseDb.from('subscriptions').insert({
        user_id,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        plan_tier: desiredPlan,
        interval: 'monthly',
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000)
      });
      await notifySlack(`🚀 Paid signup (${desiredPlan}) for ${email}`);
    } else {
      // Free default: seed 50 credits
      try {
        await supabaseDb
          .from('user_credits')
          .upsert({ user_id, total_credits: 50, used_credits: 0, remaining_credits: 50, last_updated: new Date().toISOString() } as any, { onConflict: 'user_id' });
      } catch {}
      try { await notifySlack(`🆕 New free signup: ${email}`); } catch {}
    }

    // seed trial_emails row (optional)
    try { await supabaseDb.from('trial_emails').upsert({ user_id }, { onConflict: 'user_id' }); } catch {}

    // Queue Free Forever cadence (best-effort) only for free plan users
    try {
      const { data: planRow } = await supabaseDb
        .from('users')
        .select('plan')
        .eq('id', user_id)
        .single();
      const plan = String(planRow?.plan || '').toLowerCase();
      if (plan === 'free' || plan === '') {
        const first_name = (raw_user_meta_data?.first_name || '').trim();
        await freeForeverQueue.add('step-0', { email, first_name, step: 0 });
      }
    } catch {}

    return res.json({ ok: true });
  } catch (err:any) {
    console.error('[userCreatedWebhook] error', err);
    return res.status(500).json({ error: 'Server error' });
  }
} 