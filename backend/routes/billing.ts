import express from 'express';
import { BillingController } from '../controllers/billingController';
import { createZapEvent, EVENT_TYPES } from '../src/lib/events';
import { requireAuth } from '../middleware/authMiddleware';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15'
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Get billing overview
router.get('/overview', async (req, res) => {
  try {
    // Get auth token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No auth token found in headers:', req.headers);
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const token = authHeader.split(' ')[1];
    console.log('Found auth token:', token.substring(0, 20) + '...');

    // Set the auth token for this request
    supabase.auth.setSession({
      access_token: token,
      refresh_token: ''
    });

    // Get user from Supabase auth
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.log('User error:', userError);
      res.status(401).json({ error: 'Invalid session' });
      return;
    }

    console.log('Found user:', user.id);

    // Get user's subscription
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Convert subscription to camelCase + derive additional fields
    let subscription: any = null;
    if (subscriptionData) {
      subscription = {
        id: subscriptionData.id,
        planTier: subscriptionData.plan_tier,
        interval: subscriptionData.interval,
        status: subscriptionData.status,
        currentPeriodStart: subscriptionData.current_period_start,
        currentPeriodEnd: subscriptionData.current_period_end,
        includedSeats: subscriptionData.included_seats,
        seatCount: subscriptionData.seat_count,
        stripeCustomerId: subscriptionData.stripe_customer_id,
        stripeSubscriptionId: subscriptionData.stripe_subscription_id
      };
    }

    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      console.error('Error fetching subscription:', subscriptionError);
      res.status(500).json({ error: 'Failed to fetch subscription' });
      return;
    }

    // Also read the user's plan to normalize free accounts
    let userPlan: string | null = null;
    try {
      const { data: planRow } = await supabase
        .from('users')
        .select('plan')
        .eq('id', user.id)
        .maybeSingle();
      userPlan = (planRow as any)?.plan || null;
    } catch {}

    // If plan is free or subscription is canceled/expired, treat as no subscription
    const planIsFree = String(userPlan || '').toLowerCase() === 'free';
    const inactiveStatuses = new Set(['canceled','incomplete_expired','paused','unpaid']);
    if (subscription && (planIsFree || inactiveStatuses.has(String(subscription.status || '').toLowerCase()))) {
      subscription = null;
    }

    // Get user's credits
    const { data: creditsRow, error: creditsError } = await supabase
      .from('user_credits')
      .select('remaining_credits, total_credits, used_credits')
      .eq('user_id', user.id)
      .single();

    if (creditsError && creditsError.code !== 'PGRST116') {
      console.error('Error fetching credits:', creditsError);
      res.status(500).json({ error: 'Failed to fetch credits' });
      return;
    }

    const remainingCredits = creditsRow?.remaining_credits || 0;

    // Get recent credit usage
    const { data: recentUsage, error: usageError } = await supabase
      .from('credit_usage_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (usageError) {
      console.error('Error fetching usage:', usageError);
      res.status(500).json({ error: 'Failed to fetch usage history' });
      return;
    }

    // Get recent invoices if there's a subscription
    let recentInvoices: Stripe.Invoice[] = [];
    let nextInvoiceDate: string | null = null;
    if (subscription?.stripeSubscriptionId) {
      const invoices = await stripe.invoices.list({
        subscription: subscription.stripeSubscriptionId,
        limit: 5,
      });
      recentInvoices = invoices.data;

      // The soonest upcoming invoice can also be determined via stripe.invoices.retrieveUpcoming
      try {
        const upcoming = await stripe.invoices.retrieveUpcoming({ subscription: subscription.stripeSubscriptionId });
        nextInvoiceDate = upcoming?.next_payment_attempt ? new Date(upcoming.next_payment_attempt * 1000).toISOString() : null;
      } catch (e) {
        // Fallback to current period end if no upcoming invoice (trial etc.)
        nextInvoiceDate = subscription.currentPeriodEnd;
      }
    }

    res.json({
      subscription: subscription || null,
      credits: remainingCredits,
      seatUsage: subscription ? { used: subscription.seatCount, included: subscription.includedSeats } : null,
      nextInvoice: nextInvoiceDate,
      recentUsage: recentUsage || [],
      recentInvoices
    });

  } catch (error) {
    console.error('Error in billing overview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available plans and pricing
router.get('/plans', BillingController.getPlans);

// Create a checkout session for new subscription
router.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    await (BillingController as any).createCheckoutSession(req, res);
    try {
      const uid = (req as any)?.user?.id;
      if (uid) {
        await createZapEvent({ event_type: EVENT_TYPES.subscription_checkout_started, user_id: uid, entity: 'subscription', entity_id: undefined, payload: {} });
      }
    } catch {}
  } catch (e) { next(e); }
});

// Create a portal session for managing subscription
router.post('/portal', requireAuth, BillingController.createPortalSession);

// Cancel subscription
router.post('/cancel', requireAuth, async (req, res, next) => {
  try {
    await (BillingController as any).cancelSubscription(req, res);
    try {
      const uid = (req as any)?.user?.id;
      if (uid) {
        await createZapEvent({ event_type: EVENT_TYPES.subscription_cancelled, user_id: uid, entity: 'subscription', entity_id: undefined, payload: {} });
      }
    } catch {}
  } catch (e) { next(e); }
});

// Get detailed credit usage history
router.get('/credits/history', requireAuth, BillingController.getCreditHistory);

// Get detailed billing history
router.get('/history', requireAuth, BillingController.getBillingHistory);

export default router; 