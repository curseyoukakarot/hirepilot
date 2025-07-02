import { Request, Response } from 'express';
import Stripe from 'stripe';
import { supabaseDb } from '../lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

export default async function startTrial(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, email } = req.body;
  if (!user_id || !email) {
    return res.status(400).json({ error: 'Missing user_id or email' });
  }
  try {
    // Ensure we have a customer
    let customerId: string | null = null;
    const { data: userRow } = await supabaseDb
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user_id)
      .single();

    if (userRow?.stripe_customer_id) {
      customerId = userRow.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({ email, metadata: { user_id } });
      customerId = customer.id;
      // save
      await supabaseDb.from('users').update({ stripe_customer_id: customerId }).eq('id', user_id);
    }

    // Create subscription with 7-day trial on Starter monthly price
    const price = process.env.STRIPE_PRICE_ID_STARTER_MONTHLY!;
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [ { price } ],
      trial_period_days: 7,
      metadata: { user_id, plan_tier: 'starter' }
    });

    // insert subscription row
    await supabaseDb.from('subscriptions').insert({
      user_id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      plan_tier: 'starter',
      interval: 'monthly',
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
    });

    return res.status(200).json({ ok: true, subscriptionId: subscription.id });
  } catch (err:any) {
    console.error('startTrial error', err);
    return res.status(500).json({ error: 'Failed to start trial' });
  }
} 