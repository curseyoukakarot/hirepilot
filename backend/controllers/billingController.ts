import { Request, Response } from 'express';
import { BillingService } from '../services/billingService';
import { supabaseAdmin } from '../src/services/supabase';
import { CreditService } from '../services/creditService';
import { PRICING_CONFIG } from '../config/pricing';

type BillingInterval = 'monthly' | 'annual';

export class BillingController {
  /**
   * Get billing overview including subscription, credits, and recent history
   */
  static async getBillingOverview(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      
      // Get all billing information in parallel
      const [billingDetails, creditBalance, creditHistory, billingHistory] = await Promise.all([
        BillingService.getBillingDetails(userId),
        CreditService.getCreditBalance(userId),
        CreditService.getCreditUsageHistory(userId, 5),
        BillingService.getBillingHistory(userId, 5)
      ]);

      // Get plan details from config
      const planConfig = billingDetails.plan ? PRICING_CONFIG[billingDetails.plan] : null;

      res.json({
        subscription: {
          ...billingDetails,
          planDetails: planConfig
        },
        credits: creditBalance,
        recentUsage: creditHistory,
        recentInvoices: billingHistory
      });
    } catch (error) {
      console.error('Error getting billing overview:', error);
      res.status(500).json({ error: 'Failed to get billing overview' });
    }
  }

  /**
   * Get available plans and pricing
   */
  static async getPlans(req: Request, res: Response) {
    try {
      res.json(PRICING_CONFIG);
    } catch (error) {
      console.error('Error getting plans:', error);
      res.status(500).json({ error: 'Failed to get plans' });
    }
  }

  /**
   * Create a checkout session for subscription
   */
  static async createCheckoutSession(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { planId, interval, priceId: priceIdFromClient } = req.body;

      if (!planId || !interval || !PRICING_CONFIG[planId]) {
        res.status(400).json({ error: 'Invalid plan or interval' });
        return;
      }

      if (interval !== 'monthly' && interval !== 'annual') {
        res.status(400).json({ error: 'Invalid interval. Must be monthly or annual.' });
        return;
      }

      // Prefer explicit priceId from client (frontend holds VITE_ values). Fallback to server config.
      const resolvedPriceId = (typeof priceIdFromClient === 'string' && priceIdFromClient.startsWith('price_'))
        ? priceIdFromClient
        : PRICING_CONFIG[planId].priceIds[interval as BillingInterval];
      if (!resolvedPriceId) {
        res.status(400).json({ error: 'Price ID not configured' });
        return;
      }

      // Build affiliate metadata from hp_ref cookie (if present)
      let affiliateMeta: Record<string, any> | undefined = undefined;
      const refCode = (req as any).cookies?.hp_ref as string | undefined;
      if (refCode) {
        const { data: aff } = await supabaseAdmin
          .from('affiliates')
          .select('id, referral_code')
          .eq('referral_code', refCode)
          .maybeSingle();
        if (aff) {
          affiliateMeta = {
            affiliate_id: aff.id,
            referral_code: aff.referral_code,
            plan_type: 'DIY'
          };
        }
      }

      const session = await BillingService.createCheckoutSession(
        userId,
        resolvedPriceId,
        planId,
        {
          metadata: {
            user_id: userId,
            plan_tier: planId,
            plan_type: 'DIY',
            price_id: resolvedPriceId,
            ...(affiliateMeta || {})
          },
          clientReferenceId: userId
        }
      );
      res.json({ sessionId: session.id });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }

  /**
   * Create a portal session for managing subscription
   */
  static async createPortalSession(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const session = await BillingService.createPortalSession(userId);
      res.json({ url: session.url });
    } catch (error) {
      console.error('Error creating portal session:', error);
      res.status(500).json({ error: 'Failed to create portal session' });
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      await BillingService.cancelSubscription(userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error canceling subscription:', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  }

  /**
   * Get detailed credit usage history
   */
  static async getCreditHistory(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const history = await CreditService.getCreditUsageHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error('Error getting credit history:', error);
      res.status(500).json({ error: 'Failed to get credit history' });
    }
  }

  /**
   * Get detailed billing history
   */
  static async getBillingHistory(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const history = await BillingService.getBillingHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error('Error getting billing history:', error);
      res.status(500).json({ error: 'Failed to get billing history' });
    }
  }
} 