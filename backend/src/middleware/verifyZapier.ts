import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function verifyZapier(req: Request, res: Response, next: NextFunction) {
  try {
    const secret = process.env.ZAPIER_HMAC_SECRET;
    if (!secret) { res.status(500).json({ error: 'Zapier secret not configured' }); return; }

    const signature = String(req.headers['x-hp-signature'] || '');
    const timestamp = String(req.headers['x-hp-timestamp'] || '');
    if (!signature || !timestamp) { res.status(401).json({ error: 'Missing signature headers' }); return; }

    // Replay guard: 5 minutes
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > 300) { res.status(401).json({ error: 'stale request' }); return; }

    const rawBody = typeof (req as any).rawBody === 'string' ? (req as any).rawBody : JSON.stringify(req.body || {});
    const base = `${timestamp}.${rawBody}`;
    const expected = crypto.createHmac('sha256', secret).update(base).digest('hex');

    const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!ok) { res.status(401).json({ error: 'bad signature' }); return; }
    next();
  } catch (e) {
    res.status(401).json({ error: 'verification_failed' });
  }
}


