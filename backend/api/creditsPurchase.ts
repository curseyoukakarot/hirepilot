import { Request, Response } from 'express';
import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const stripe = new Stripe(stripeSecret, { apiVersion: '2022-11-15' });

type CreditPack = { id: string; name: string; credits: number; amountUsd: number; description?: string };

// Supported à la carte packs
const SMALL_PACKS: Record<string, CreditPack> = {
  'light-boost': { id: 'light-boost', name: '100 Credits', credits: 100, amountUsd: 25, description: '100 credits pack' },
  'power-pack': { id: 'power-pack', name: '300 Credits', credits: 300, amountUsd: 75, description: '300 credits pack' },
  'growth-bundle': { id: 'growth-bundle', name: '600 Credits', credits: 600, amountUsd: 150, description: '600 credits pack' },
};

const LARGE_PACKS: Record<string, CreditPack> = {
  '1000': { id: '1000', name: '1000 Credits', credits: 1000, amountUsd: 220, description: 'Large 1000 credits pack' },
  '2500': { id: '2500', name: '2500 Credits', credits: 2500, amountUsd: 500, description: 'Large 2500 credits pack' },
  '5000': { id: '5000', name: '5000 Credits', credits: 5000, amountUsd: 900, description: 'Large 5000 credits pack' },
};

export default async function creditsPurchase(req: Request, res: Response) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    if (!stripeSecret) {
      res.status(500).json({ error: 'Stripe secret key is not configured' });
      return;
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { packageId } = req.body as { packageId?: string };
    if (!packageId) {
      res.status(400).json({ error: 'packageId required' });
      return;
    }

    const pack: CreditPack | undefined = SMALL_PACKS[packageId] || LARGE_PACKS[packageId];
    if (!pack) {
      res.status(400).json({ error: 'Invalid packageId' });
      return;
    }

    const successUrlBase = process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.BASE_URL || 'https://app.thehirepilot.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(pack.amountUsd * 100),
            product_data: {
              name: pack.name,
              description: `${pack.credits} credits` + (pack.description ? ` – ${pack.description}` : ''),
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        packageId: pack.id,
        credits: String(pack.credits),
      },
      success_url: `${successUrlBase}/settings/credits?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${successUrlBase}/settings/credits?purchase=canceled`,
    });

    res.json({ sessionId: session.id, url: session.url, livemode: session.livemode });
  } catch (e: any) {
    console.error('[creditsPurchase] error:', e);
    res.status(500).json({ error: e.message || 'Failed to create checkout session' });
  }
}


