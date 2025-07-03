import { Request, Response } from 'express';
import Stripe from 'stripe';
import jwt from 'jsonwebtoken';
import { supabaseDb } from '../../lib/supabase';
import { notifySlack } from '../../lib/slack';

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

  const { id: user_id, email } = req.body?.record || {};
  if (!user_id || !email) return res.status(400).json({ error: 'Invalid payload' });

  try {
    // Ensure stripe customer
    let customerId: string | null = null;
    const { data: userRow } = await supabaseDb.from('users').select('stripe_customer_id').eq('id', user_id).single();
    if (userRow?.stripe_customer_id) {
      customerId = userRow.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({ email, metadata: { user_id } });
      customerId = customer.id;
      await supabaseDb.from('users').update({ stripe_customer_id: customerId }).eq('id', user_id);
    }

    // Create subscription if none
    const { data: subExisting } = await supabaseDb.from('subscriptions').select('id').eq('user_id', user_id).single();
    if (!subExisting) {
      const price = process.env.STRIPE_PRICE_ID_STARTER_MONTHLY!;
      console.log('[userCreatedWebhook] Using price', price);
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price }],
        trial_period_days: 7,
        metadata: { user_id, plan_tier: 'starter' }
      });

      await supabaseDb.from('subscriptions').insert({
        user_id,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        plan_tier: 'starter',
        interval: 'monthly',
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000)
      });

      console.log('[userCreatedWebhook] Subscription created', subscription.id);
    }

    // Insert credits row if not exists
    await supabaseDb.from('user_credits').upsert({
      user_id,
      total_credits: 350,
      remaining_credits: 350,
      used_credits: 0
    }, { onConflict: 'user_id' });

    // Slack notify
    try {
      await notifySlack(`🆓 Starter trial started for ${email}`);
    } catch (err) {
      console.error('[userCreatedWebhook] Slack notify failed', err);
    }

    return res.json({ ok: true });
  } catch (err:any) {
    console.error('[userCreatedWebhook] error', err);
    return res.status(500).json({ error: 'Server error' });
  }
} 