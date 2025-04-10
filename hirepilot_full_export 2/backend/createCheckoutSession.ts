// backend/createCheckoutSession.ts
import Stripe from 'stripe';
import { NextApiRequest, NextApiResponse } from 'next';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-08-16',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, user_id } = req.body;

    // Basic product lookup (can be dynamic later)
    const productLookup = {
      basic: 'price_1OXzpGAMuJmulDbpXYZ123ABC', // Replace with your real Price ID from Stripe
      pro: 'price_1OXzpGAMuJmulDbpABC456XYZ',   // Replace with another Price ID
    };

    const priceId = productLookup[plan];
    if (!priceId) return res.status(400).json({ error: 'Invalid plan selected' });

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

    return res.status(200).json({ sessionId: session.id });
  } catch (error: any) {
    console.error('[STRIPE ERROR]', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
