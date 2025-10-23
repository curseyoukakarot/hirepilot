import express from 'express';
import { CreditService } from '../services/creditService';
import { A_LA_CARTE_PACKAGES } from '../config/pricing';
import Stripe from 'stripe';
import { createZapEvent, EVENT_TYPES } from '../src/lib/events';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15'
});

// Supabase service client for auth and DB operations
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUserIdFromAuthHeader(req: express.Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

// Get user's credit status
router.get('/status', async (req, res) => {
  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Ensure monthly reset for Free tier before reporting
    try { await (CreditService as any).ensureMonthlyFreeReset?.(userId); } catch {}
    const creditStatus = await CreditService.checkCreditStatus(userId);
    if (!creditStatus) {
      res.status(404).json({ error: 'No credit record found' });
      return;
    }

    res.json(creditStatus);
  } catch (error: any) {
    console.error('Error fetching credit status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create checkout session for à la carte credit purchase
router.post('/purchase', async (req, res) => {
  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Block purchases for Free plan users
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan_tier')
      .eq('user_id', userId)
      .maybeSingle();
    const planTier = (sub?.plan_tier || '').toLowerCase();
    if (planTier === 'free') {
      return res.status(403).json({ error: 'Free plan cannot purchase credits. Upgrade to Pro.' });
    }

    const { packageId } = req.body;
    // Map known small packs to requested pricing per UI spec
    const SMALL_PACK_OVERRIDES: Record<string, { name: string; credits: number; price: number; description: string }> = {
      'light-boost': { name: '100 Credits', credits: 100, price: 25, description: '100 credits pack' },
      'power-pack': { name: '300 Credits', credits: 300, price: 75, description: '300 credits pack' },
      'growth-bundle': { name: '600 Credits', credits: 600, price: 150, description: '600 credits pack' },
    };
    const LARGE_PACKS: Record<string, { name: string; credits: number; price: number; description: string }> = {
      '1000': { name: '1000 Credits', credits: 1000, price: 220, description: 'Large 1000 credits pack' },
      '2500': { name: '2500 Credits', credits: 2500, price: 500, description: 'Large 2500 credits pack' },
      '5000': { name: '5000 Credits', credits: 5000, price: 900, description: 'Large 5000 credits pack' },
    };

    let creditPackage = Object.values(A_LA_CARTE_PACKAGES).find(p => p.id === packageId) as any;
    // Override with UI pricing if small pack
    if (SMALL_PACK_OVERRIDES[packageId]) {
      creditPackage = SMALL_PACK_OVERRIDES[packageId];
    }
    // Or support large packs
    if (!creditPackage && LARGE_PACKS[packageId]) {
      creditPackage = LARGE_PACKS[packageId];
    }

    if (!creditPackage) {
      return res.status(400).json({ error: 'Invalid package ID' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: creditPackage.name,
              description: `${creditPackage.credits} credits - ${creditPackage.description}`
            },
            unit_amount: creditPackage.price * 100 // in cents
          },
          quantity: 1
        }
      ],
      metadata: {
        userId,
        packageId
      },
      success_url: `${process.env.FRONTEND_URL || process.env.CLIENT_URL}/settings/credits?purchase=success`,
      cancel_url: `${process.env.FRONTEND_URL || process.env.CLIENT_URL}/settings/credits?purchase=canceled`
    });

    try {
      await createZapEvent({ event_type: EVENT_TYPES.credits_purchased, user_id: userId, entity: 'credits', entity_id: String(packageId), payload: { credits: creditPackage.credits } });
    } catch {}
    res.json({ sessionId: session.id });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if user has sufficient credits
router.post('/check', async (req, res) => {
  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { requiredCredits } = req.body;
    if (typeof requiredCredits !== 'number' || requiredCredits <= 0) {
      res.status(400).json({ error: 'Invalid credit amount' });
      return;
    }

    const remainingCredits = await CreditService.getRemainingCredits(userId);
    const hasEnoughCredits = remainingCredits >= requiredCredits;

    res.json({
      hasEnoughCredits,
      remainingCredits,
      requiredCredits
    });
  } catch (error: any) {
    console.error('Error checking credits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Use credits for a service
router.post('/use', async (req, res) => {
  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { credits } = req.body;
    if (typeof credits !== 'number' || credits <= 0) {
      res.status(400).json({ error: 'Invalid credit amount' });
      return;
    }

    const success = await CreditService.useCredits(userId, credits);
    if (!success) {
      res.status(400).json({ error: 'Insufficient credits' });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error using credits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Team admin credit sharing endpoints

// Get team members sharing credits with the current team admin
router.get('/team-members', async (req, res) => {
  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const teamMembers = await CreditService.getTeamMembersForAdmin(userId);
    res.json(teamMembers);
  } catch (error: any) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a team member to credit sharing
router.post('/team-members', async (req, res) => {
  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { teamMemberId } = req.body;
    if (!teamMemberId) {
      res.status(400).json({ error: 'Team member ID is required' });
      return;
    }

    const success = await CreditService.addTeamMemberToCreditSharing(userId, teamMemberId);
    if (!success) {
      res.status(400).json({ error: 'Failed to add team member to credit sharing' });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error adding team member to credit sharing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove a team member from credit sharing
router.delete('/team-members/:teamMemberId', async (req, res) => {
  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { teamMemberId } = req.params;
    const success = await CreditService.removeTeamMemberFromCreditSharing(userId, teamMemberId);
    if (!success) {
      res.status(400).json({ error: 'Failed to remove team member from credit sharing' });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing team member from credit sharing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 