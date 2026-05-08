/**
 * v2 — /api/v2/billing
 * Thin wrapper around Stripe Customer Portal for in-app seat / billing
 * management. The portal handles seat add/remove + invoices + payment
 * method updates natively; we just hand the user a one-time URL.
 *
 * GET  /api/v2/billing/portal     → { url } to open Customer Portal
 * GET  /api/v2/billing/summary    → current seats + plan + next charge (read-only)
 */

import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { supabase } from '../../lib/supabase';
import { requireAuth } from '../../../middleware/authMiddleware';
import activeWorkspace from '../../middleware/activeWorkspace';

const router = express.Router();
router.use(requireAuth as any, activeWorkspace as any);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-04-10' as any });

/** Resolve stripe_customer_id for the current user (workspace owner pays). */
async function resolveCustomerId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();
  return (data as any)?.stripe_customer_id || null;
}

router.get('/portal', async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });

    const customerId = await resolveCustomerId(userId);
    if (!customerId) {
      return res.status(409).json({
        error: 'no_stripe_customer',
        message: "You don't have an active subscription yet — start one from Workspaces → Upgrade.",
      });
    }

    const returnUrl = String(req.query.return_url || '').trim() ||
      `${process.env.APP_BASE_URL || process.env.APP_WEB_URL || 'https://app.thehirepilot.com'}/v2/settings/team`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return res.json({ url: session.url });
  } catch (e: any) {
    console.error('[v2/billing/portal]', e);
    return res.status(500).json({ error: e?.message || 'portal_failed' });
  }
});

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });
    const workspaceId = (req as any)?.workspaceId;

    // Pull workspace + active member count for seat usage display.
    const [{ data: workspace }, { count: memberCount }] = await Promise.all([
      supabase.from('workspaces').select('id, name, plan, seat_count').eq('id', workspaceId).maybeSingle(),
      supabase.from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'active'),
    ]);

    const customerId = await resolveCustomerId(userId);

    let stripeMeta: any = null;
    if (customerId) {
      try {
        const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
        const sub = subs.data?.[0];
        if (sub) {
          const item = sub.items?.data?.[0];
          stripeMeta = {
            subscription_id: sub.id,
            status: sub.status,
            current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
            quantity: item?.quantity || 1,
            unit_amount: item?.price?.unit_amount || null,
            currency: item?.price?.currency || 'usd',
            interval: item?.price?.recurring?.interval || 'month',
            cancel_at_period_end: sub.cancel_at_period_end,
          };
        }
      } catch (e: any) {
        console.warn('[v2/billing/summary] stripe lookup failed:', e?.message);
      }
    }

    return res.json({
      workspace: workspace ? {
        id: (workspace as any).id,
        name: (workspace as any).name,
        plan: (workspace as any).plan,
        seat_count: (workspace as any).seat_count || 1,
      } : null,
      members_active: memberCount || 0,
      stripe: stripeMeta,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'summary_failed' });
  }
});

export default router;
