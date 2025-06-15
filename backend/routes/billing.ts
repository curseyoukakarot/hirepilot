import express from 'express';
import { BillingController } from '../controllers/billingController';
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
      return res.status(401).json({ error: 'Not authenticated' });
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
      return res.status(401).json({ error: 'Invalid session' });
    }

    console.log('Found user:', user.id);

    // Get user's subscription
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      console.error('Error fetching subscription:', subscriptionError);
      return res.status(500).json({ error: 'Failed to fetch subscription' });
    }

    // Get user's credits
    const { data: creditsData, error: creditsError } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (creditsError && creditsError.code !== 'PGRST116') {
      console.error('Error fetching credits:', creditsError);
      return res.status(500).json({ error: 'Failed to fetch credits' });
    }

    // Get recent credit usage
    const { data: recentUsage, error: usageError } = await supabase
      .from('credit_usage_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (usageError) {
      console.error('Error fetching usage:', usageError);
      return res.status(500).json({ error: 'Failed to fetch usage history' });
    }

    // Get recent invoices if there's a subscription
    let recentInvoices: Stripe.Invoice[] = [];
    if (subscriptionData?.stripe_subscription_id) {
      const invoices = await stripe.invoices.list({
        subscription: subscriptionData.stripe_subscription_id,
        limit: 5,
      });
      recentInvoices = invoices.data;
    }

    res.json({
      subscription: subscriptionData || null,
      credits: creditsData?.balance || 0,
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
router.post('/checkout', BillingController.createCheckoutSession);

// Create a portal session for managing subscription
router.post('/portal', BillingController.createPortalSession);

// Cancel subscription
router.post('/cancel', BillingController.cancelSubscription);

// Get detailed credit usage history
router.get('/credits/history', BillingController.getCreditHistory);

// Get detailed billing history
router.get('/history', BillingController.getBillingHistory);

export default router; 