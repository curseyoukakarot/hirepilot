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

// Helper to update user credits
async function updateUserCredits(userId: string, planTier: string) {
  const totalCredits = PLAN_CREDITS[planTier as keyof typeof PLAN_CREDITS];
  
  try {
    // Get current credits
    const { data: currentCredits } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (currentCredits) {
      // Update existing record
      await supabase
        .from('user_credits')
        .update({
          total_credits: totalCredits,
          used_credits: 0,
          remaining_credits: totalCredits,
          last_updated: new Date().toISOString()
        })
        .eq('user_id', userId);
    } else {
      // Create new record
      await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          total_credits: totalCredits,
          used_credits: 0,
          remaining_credits: totalCredits
        });
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
          return res.status(400).json({ error: 'Missing session metadata' });
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

        // Initialize user credits
        await updateUserCredits(userId, planTier);
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

        // Handle plan change
        if (subscription.status === 'active') {
          await updateUserCredits(userId, planTier);
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

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: `${process.env.FRONTEND_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/settings/billing?canceled=true`,
      metadata: {
        user_id: userId,
        plan_tier: planTier
      }
    });

    res.json({ sessionId: session.id });
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

export default router; 