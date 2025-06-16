// backend/createCheckoutSession.ts
import Stripe from 'stripe';
import { Request, Response } from 'express';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { plan, user_id } = req.body;

    // Basic product lookup (can be dynamic later)
    const productLookup: Record<string, string> = {
      basic: process.env.STRIPE_BASIC_PRICE_ID!,
      pro: process.env.STRIPE_PRO_PRICE_ID!
    };

    const priceId = productLookup[plan as keyof typeof productLookup];
    if (!priceId) {
      res.status(400).json({ error: 'Invalid plan selected' });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: req.body.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: { user_id },
      success_url: `${req.headers.origin}/dashboard?success=true`,
      cancel_url: `${req.headers.origin}/pricing?cancelled=true`,
    });

    res.status(200).json({ sessionId: session.id });
    return;
  } catch (error: any) {
    console.error('[STRIPE ERROR]', error);
    res.status(500).json({ error: 'Internal Server Error' });
    return;
  }
}
