import express from 'express';
import Stripe from 'stripe';
import { BillingService } from '../services/billingService';
import { CreditService } from '../services/creditService';
import { PRICING_CONFIG, A_LA_CARTE_PACKAGES, SUBSCRIPTION_PLANS } from '../config/pricing';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15'
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Stripe webhook handler
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    res.status(400).send('Missing stripe-signature header');
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    // Log webhook event
    await BillingService.logWebhookEvent(event.id, event.type, event.data.object);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;
        const planId = subscription.metadata.planId;

        if (!userId || !planId) {
          throw new Error('Missing userId or planId in subscription metadata');
        }

        await CreditService.handleSubscriptionChange(userId, planId);
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Handle à la carte credit purchases
        if (session.metadata?.packageId) {
          const packageId = session.metadata.packageId;
          const userId = session.metadata.userId;
          const package_ = Object.values(A_LA_CARTE_PACKAGES).find(p => p.id === packageId);

          if (!package_) {
            throw new Error(`Invalid package ID: ${packageId}`);
          }

          await CreditService.addCredits(userId, package_.credits);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        // Optional: Handle subscription cancellation
        // You might want to mark the user's status as inactive or take other actions
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        
        const userId = await BillingService.getUserIdFromCustomerId(customerId);
        if (!userId) {
          throw new Error(`No user found for customer ${customerId}`);
        }

        // Record successful payment
        await BillingService.recordPayment(userId, {
          stripeInvoiceId: invoice.id,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: 'paid',
          paidAt: new Date(invoice.status_transitions.paid_at! * 1000)
        });

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        
        const userId = await BillingService.getUserIdFromCustomerId(customerId);
        if (!userId) {
          throw new Error(`No user found for customer ${customerId}`);
        }

        // Record failed payment
        await BillingService.recordPayment(userId, {
          stripeInvoiceId: invoice.id,
          amount: invoice.amount_due,
          currency: invoice.currency,
          status: 'failed',
          failedAt: new Date()
        });

        break;
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    res.status(500).send(`Webhook Error: ${error.message}`);
  }
});

export default router; 