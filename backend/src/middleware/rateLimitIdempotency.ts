import type { Request, Response, NextFunction } from 'express';

// Very light in-memory token bucket per user (process-local; suitable for single instance or low load)
const buckets = new Map<string, { tokens: number; lastRefill: number }>();

export function perUserRateLimit({ limitPerMin = 60 }: { limitPerMin?: number } = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any)?.user?.id || (req.headers['x-user-id'] as string) || 'anon';
    const now = Date.now();
    const minute = 60 * 1000;
    const cap = limitPerMin;

    const bucket = buckets.get(userId) || { tokens: cap, lastRefill: now };
    // Refill proportional to elapsed time
    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
      const refill = Math.floor((elapsed / minute) * cap);
      if (refill > 0) {
        bucket.tokens = Math.min(cap, bucket.tokens + refill);
        bucket.lastRefill = now;
      }
    }
    if (bucket.tokens <= 0) {
      res.status(429).json({ error: 'rate_limited', retry_in_ms: minute - (now - bucket.lastRefill) });
      return;
    }
    bucket.tokens -= 1;
    buckets.set(userId, bucket);
    next();
  };
}

// Simple Idempotency-Key cache (process-local) with short TTL
const idemCache = new Map<string, number>();
const IDEM_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function idempotencyGuard(req: Request, res: Response, next: NextFunction) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const key = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string | undefined;
  if (!key) return next();
  const now = Date.now();
  // Cleanup expired entries occasionally
  if (Math.random() < 0.01) {
    for (const [k, ts] of idemCache.entries()) {
      if (now - ts > IDEM_TTL_MS) idemCache.delete(k);
    }
  }
  if (idemCache.has(key)) {
    res.status(409).json({ error: 'idempotency_conflict' });
    return;
  }
  idemCache.set(key, now);
  next();
}
