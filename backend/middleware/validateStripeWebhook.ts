import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

export const validateStripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  try {
    // Get the raw body from the request
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      throw new Error('Missing raw body');
    }

    // Verify the event
    req.body = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    next();
  } catch (err) {
    if (err instanceof Error) {
      console.error('⚠️ Webhook signature verification failed:', err.message);
    } else {
      console.error('⚠️ Webhook signature verification failed:', err);
    }
    return res.status(400).json({ error: 'Invalid signature' });
  }
}; 