import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { PRICING_CONFIG } from '../config/pricing';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15'
});

interface SubscriptionUpdate {
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  planTier?: string;
  status?: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

interface PaymentRecord {
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: 'paid' | 'failed';
  paidAt?: Date;
  failedAt?: Date;
}

export class BillingService {
  /**
   * Log Stripe webhook events
   */
  static async logWebhookEvent(eventId: string, eventType: string, eventData: any) {
    const { error } = await supabase
      .from('webhook_logs')
      .insert({
        event_id: eventId,
        event_type: eventType,
        event_data: eventData
      });

    if (error) {
      console.error('Error logging webhook event:', error);
      throw error;
    }
  }

  /**
   * Get user ID from Stripe customer ID
   */
  static async getUserIdFromCustomerId(customerId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (error) {
      console.error('Error getting user ID from customer ID:', error);
      throw error;
    }

    return data?.id || null;
  }

  /**
   * Get plan tier from Stripe price ID
   */
  static async getPlanTierFromPriceId(priceId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan_tier')
      .eq('stripe_price_id', priceId)
      .single();

    if (error) {
      console.error('Error getting plan tier from price ID:', error);
      throw error;
    }

    return data?.plan_tier || null;
  }

  /**
   * Update user subscription
   */
  static async updateSubscription(userId: string, update: SubscriptionUpdate) {
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        stripe_subscription_id: update.stripeSubscriptionId,
        stripe_price_id: update.stripePriceId,
        plan_tier: update.planTier,
        status: update.status,
        current_period_end: update.currentPeriodEnd,
        cancel_at_period_end: update.cancelAtPeriodEnd,
        updated_at: new Date()
      });

    if (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Record payment
   */
  static async recordPayment(userId: string, payment: PaymentRecord) {
    const { error } = await supabase
      .from('billing_history')
      .insert({
        user_id: userId,
        stripe_invoice_id: payment.stripeInvoiceId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paid_at: payment.paidAt,
        failed_at: payment.failedAt
      });

    if (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  }

  /**
   * Get billing details
   */
  static async getBillingDetails(userId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error getting billing details:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get billing history
   */
  static async getBillingHistory(userId: string, limit: number = 10) {
    const { data, error } = await supabase
      .from('billing_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error getting billing history:', error);
      throw error;
    }

    return data;
  }

  /**
   * Create Stripe checkout session
   */
  static async createCheckoutSession(
    userId: string,
    priceId: string,
    planTier: string,
    opts?: { metadata?: Record<string, any>; clientReferenceId?: string }
  ) {
    // Get or create Stripe customer
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', userId)
      .single();

    if (!userData) {
      throw new Error('User not found');
    }

    let customerId = userData.stripe_customer_id;

    // If no customer ID in our database, search Stripe by email first
    if (!customerId && userData.email) {
      console.log(`[BILLING] No customer ID found for user ${userId}, searching Stripe by email: ${userData.email}`);
      
      const existingCustomers = await stripe.customers.list({
        email: userData.email,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        // Found existing customer - link it to our user record
        customerId = existingCustomers.data[0].id;
        console.log(`[BILLING] Found existing Stripe customer ${customerId} for email ${userData.email}`);
        
        await supabase
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId);
        
        console.log(`[BILLING] Linked customer ${customerId} to user ${userId}`);
      } else {
        // No existing customer found - create a new one
        console.log(`[BILLING] No existing Stripe customer found for ${userData.email}, creating new customer`);
        
        const customer = await stripe.customers.create({
          email: userData.email,
          metadata: { userId }
        });
        customerId = customer.id;

        // Save customer ID
        await supabase
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId);
        
        console.log(`[BILLING] Created new Stripe customer ${customerId} for user ${userId}`);
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/billing/success`,
      cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`,
      metadata: { userId, planTier, ...(opts?.metadata || {}) },
      client_reference_id: opts?.clientReferenceId || userId
    });

    return session;
  }

  /**
   * Create Stripe portal session
   */
  static async createPortalSession(userId: string) {
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', userId)
      .single();

    if (!userData) {
      throw new Error('User not found');
    }

    let customerId = userData.stripe_customer_id;

    // If no customer ID in our database, search Stripe by email
    if (!customerId && userData.email) {
      console.log(`[BILLING] No customer ID found for user ${userId}, searching Stripe by email: ${userData.email}`);
      
      const existingCustomers = await stripe.customers.list({
        email: userData.email,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        // Found existing customer - link it to our user record
        customerId = existingCustomers.data[0].id;
        console.log(`[BILLING] Found existing Stripe customer ${customerId} for email ${userData.email}`);
        
        await supabase
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId);
        
        console.log(`[BILLING] Linked customer ${customerId} to user ${userId}`);
      } else {
        // No existing customer found - create a new one
        console.log(`[BILLING] No existing Stripe customer found for ${userData.email}, creating new customer`);
        
        const customer = await stripe.customers.create({
          email: userData.email,
          metadata: { userId }
        });
        customerId = customer.id;

        // Save customer ID
        await supabase
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId);
        
        console.log(`[BILLING] Created new Stripe customer ${customerId} for user ${userId}`);
      }
    }

    if (!customerId) {
      throw new Error('Unable to create or find Stripe customer');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL}/billing`
    });

    return session;
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(userId: string) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .single();

    if (!subscription?.stripe_subscription_id) {
      throw new Error('No active subscription found');
    }

    await stripe.subscriptions.cancel(subscription.stripe_subscription_id);

    await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        cancel_at_period_end: false,
        updated_at: new Date()
      })
      .eq('user_id', userId);
  }
} 