import express from 'express';
import Stripe from 'stripe';
import { supabase } from '../lib/supabase';
import { validateStripeWebhook } from '../middleware/validateStripeWebhook';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

// Credit allocation by plan
const PLAN_CREDITS = {
  starter: 350,
  pro: 1000,
  team: 2000
};

// Helper to log webhook events
async function logWebhookEvent(eventId: string, eventType: string, eventData: any, error?: string) {
  try {
    await supabase.from('webhook_logs').insert({
      stripe_event_id: eventId,
      event_type: eventType,
      event_data: eventData,
      processing_error: error
    });
  } catch (err) {
    console.error('Error logging webhook event:', err);
  }
}

// Helper to update user credits with rollover from free plan (if applicable)
async function updateUserCredits(userId: string, planTier: string) {
  const baseCredits = PLAN_CREDITS[planTier as keyof typeof PLAN_CREDITS];

  try {
    // Inspect current user record for free-plan rollover
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('plan, remaining_credits')
      .eq('id', userId)
      .single();
    if (userErr) {
      console.warn('Could not read user row for rollover check:', userErr);
    }

    let rollover = 0;
    if (userRow && userRow.plan === 'free' && typeof userRow.remaining_credits === 'number') {
      rollover = Math.max(0, userRow.remaining_credits || 0);
    }

    const newTotal = Math.max(0, baseCredits + rollover);

    // Upsert into user_credits
    const { data: currentCredits } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (currentCredits) {
      await supabase
        .from('user_credits')
        .update({
          total_credits: newTotal,
          used_credits: 0,
          remaining_credits: newTotal,
          last_updated: new Date().toISOString()
        })
        .eq('user_id', userId);
    } else {
      await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          total_credits: newTotal,
          used_credits: 0,
          remaining_credits: newTotal
        });
    }

    // Update users table with plan and remaining_credits for consistency with app reads
    await supabase
      .from('users')
      .update({ plan: planTier, plan_updated_at: new Date().toISOString(), remaining_credits: newTotal })
      .eq('id', userId);

    // Track credits_rolled_over if rollover applied
    if (rollover > 0) {
      try {
        await supabase.from('product_events').insert({
          user_id: userId,
          event_name: 'credits_rolled_over',
          metadata: { rollover, baseCredits, newTotal, plan: planTier },
          created_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Failed to log credits_rolled_over event:', e);
      }
    }
  } catch (error) {
    console.error('Error updating user credits:', error);
    throw error;
  }
}

// Webhook endpoint
router.post('/webhook', validateStripeWebhook, async (req, res) => {
  const event = req.body;
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const customerId = session.customer as string;
        
        // Get plan details from metadata
        const planTier = subscription.metadata.plan_tier || 'starter';
        const interval = subscription.items.data[0].price.recurring?.interval || 'month';
        
        // Get user_id from metadata
        if (!session.metadata) {
          await logWebhookEvent(event.id, event.type, event.data.object, 'Missing session metadata');
          res.status(400).json({ error: 'Missing session metadata' });
          return;
        }
        const userId = session.metadata.user_id;
        if (!userId) throw new Error('No user_id in session metadata');

        // Create subscription record
        await supabase.from('subscriptions').insert({
          user_id: userId,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId,
          plan_tier: planTier,
          interval: interval === 'month' ? 'monthly' : 'annual',
          credits_granted: PLAN_CREDITS[planTier as keyof typeof PLAN_CREDITS],
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
        });

        // Initialize user credits (roll over any remaining free credits)
        await updateUserCredits(userId, planTier);

        // Track user_upgraded event
        try {
          await supabase.from('product_events').insert({
            user_id: userId,
            event_name: 'user_upgraded',
            metadata: {
              plan: planTier,
              interval,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: customerId,
            },
            created_at: new Date().toISOString()
          });
        } catch (e) {
          console.warn('Failed to log user_upgraded event:', e);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const userId = subscription.metadata.user_id;
        
        if (!userId) throw new Error('No user_id in subscription metadata');

        // Record payment in billing history
        await supabase.from('billing_history').insert({
          user_id: userId,
          stripe_invoice_id: invoice.id,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: invoice.status,
          stripe_hosted_url: invoice.hosted_invoice_url,
          pdf_url: invoice.invoice_pdf
        });

        // Reset credits on renewal
        if (invoice.billing_reason === 'subscription_cycle') {
          await updateUserCredits(userId, subscription.metadata.plan_tier);
        }

        // Clear payment warning if existed
        await supabase.from('users').update({ payment_warning:false, is_suspended:false }).eq('id', userId);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const userId = subscription.metadata.user_id;
        if (userId) {
          await supabase.from('users').update({ payment_warning:true }).eq('id', userId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.user_id;
        const planTier = subscription.metadata.plan_tier;
        
        if (!userId) throw new Error('No user_id in subscription metadata');

        // Update subscription record
        await supabase.from('subscriptions').update({
          plan_tier: planTier,
          credits_granted: PLAN_CREDITS[planTier as keyof typeof PLAN_CREDITS],
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          status: subscription.status
        }).eq('stripe_subscription_id', subscription.id);

        // Handle plan change (no rollover unless upgrading from free which updateUserCredits handles by checking users.plan)
        if (subscription.status === 'active') {
          await updateUserCredits(userId, planTier);
        }

        // Track plan_changed event
        try {
          await supabase.from('product_events').insert({
            user_id: userId,
            event_name: 'plan_changed',
            metadata: {
              plan: planTier,
              status: subscription.status,
              current_period_end: subscription.current_period_end,
              current_period_start: subscription.current_period_start,
              stripe_subscription_id: subscription.id,
            },
            created_at: new Date().toISOString()
          });
        } catch (e) {
          console.warn('Failed to log plan_changed event:', e);
        }

        if (['past_due','canceled','incomplete_expired','unpaid'].includes(subscription.status)) {
          await supabase.from('users').update({ is_suspended:true, payment_warning:false }).eq('id', userId);
        } else if (subscription.status === 'active') {
          await supabase.from('users').update({ is_suspended:false, payment_warning:false }).eq('id', userId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Update subscription status
        await supabase.from('subscriptions').update({
          status: 'canceled',
          canceled_at: new Date().toISOString()
        }).eq('stripe_subscription_id', subscription.id);
        break;
      }
    }

    // Log successful event
    await logWebhookEvent(event.id, event.type, event.data.object);
    
    res.json({ received: true });
  } catch (error) {
    // Log error
    await logWebhookEvent(event.id, event.type, event.data.object, error instanceof Error ? error.message : String(error));
    console.error('Error processing webhook:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// Create checkout session endpoint
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId, userId, planTier } = req.body;
    const trialDays = 7;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: `${process.env.FRONTEND_URL}/signup?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      subscription_data: {
        trial_period_days: trialDays,
        metadata: {
          user_id: userId,
          plan_tier: planTier
        }
      }
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(400).json({ error: 'Could not create checkout session' });
  }
});

// Create customer portal session endpoint
router.post('/create-portal-session', async (req, res) => {
  try {
    const { customerId } = req.body;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL}/settings/billing`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(400).json({ error: 'Could not create portal session' });
  }
});

// Link a checkout session to a newly created user
router.post('/link-session', async (req, res) => {
  try {
    const { sessionId, userId } = req.body;
    if (!sessionId || !userId) return res.status(400).json({ error: 'Missing parameters' });

    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
    const subscription = session.subscription as Stripe.Subscription;
    const customerId = session.customer as string;

    // Update subscription metadata with user_id if not set
    if (!subscription.metadata.user_id) {
      await stripe.subscriptions.update(subscription.id, {
        metadata: { ...subscription.metadata, user_id: userId }
      });
    }

    // Ensure users table has stripe_customer_id
    await supabase
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', userId);

    // Upsert subscription row if missing
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    const planTier = subscription.metadata.plan_tier || 'starter';
    const interval = subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly';

    if (!existing) {
      await supabase.from('subscriptions').insert({
        user_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        plan_tier: planTier,
        interval,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000)
      });
    } else {
      await supabase.from('subscriptions').update({ user_id: userId }).eq('stripe_subscription_id', subscription.id);
    }

    const credits = { starter:350, pro:1000, team:5000 }[planTier] || 350;
    const included = { starter:1, pro:1, team:5 }[planTier] || 1;
    // update subscription row fields
    await supabase.from('subscriptions').update({ included_seats: included, seat_count: 1, credits_granted: credits }).eq('stripe_subscription_id', subscription.id);
    // upsert credits
    await supabase.from('user_credits').upsert({ user_id:userId,total_credits:credits, remaining_credits:credits, used_credits:0 },{onConflict:'user_id'});

    return res.json({ ok: true });
  } catch (err) {
    console.error('link-session error', err);
    return res.status(500).json({ error: 'Failed to link session' });
  }
});

export default router; 