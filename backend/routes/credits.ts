import express from 'express';
import { CreditService } from '../services/creditService';
import { A_LA_CARTE_PACKAGES } from '../config/pricing';
import Stripe from 'stripe';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15'
});

// Get user's credit status
router.get('/status', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

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
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { packageId } = req.body;
    const creditPackage = Object.values(A_LA_CARTE_PACKAGES).find(p => p.id === packageId);

    if (!creditPackage) {
      res.status(400).json({ error: 'Invalid package ID' });
      return;
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
            unit_amount: creditPackage.price * 100 // Convert to cents
          },
          quantity: 1
        }
      ],
      metadata: {
        userId,
        packageId
      },
      success_url: `${process.env.CLIENT_URL}/dashboard?success=true`,
      cancel_url: `${process.env.CLIENT_URL}/dashboard?canceled=true`
    });

    res.json({ sessionId: session.id });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if user has sufficient credits
router.post('/check', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

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
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

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
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

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
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

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
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

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