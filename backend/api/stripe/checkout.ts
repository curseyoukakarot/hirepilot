import { Request, Response } from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2022-11-15',
});

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { priceId, quantity = 1 } = req.body;

  if (!priceId) {
    res.status(400).json({ error: 'Missing priceId' });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.BASE_URL}/dashboard?success=true`,
      cancel_url: `${process.env.BASE_URL}/pricing?canceled=true`,
    });

    res.status(200).json({ url: session.url });
    return;
  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
    return;
  }
}
