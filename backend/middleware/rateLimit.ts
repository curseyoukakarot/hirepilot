import type { Request, Response, NextFunction } from 'express';
import IORedis from 'ioredis';

export function makeRateLimiter(options: { keyPrefix: string; windowSec: number; max: number }) {
  const { keyPrefix, windowSec, max } = options;
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL || 'redis://127.0.0.1:6379';
  const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  return async function rateLimiter(req: Request, res: Response, next: NextFunction) {
    try {
      const enabled = String(process.env.ENABLE_RATE_LIMITING || 'false').toLowerCase() === 'true';
      if (!enabled) return next();

      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
      const key = `${keyPrefix}:${ip}`;
      const now = Math.floor(Date.now() / 1000);
      const ttlKey = `${key}:ttl`;

      const [[, count], [, ttl]] = (await redis.multi()
        .incr(key)
        .ttl(key)
        .exec()) as any;

      if (ttl === -1) {
        await redis.expire(key, windowSec);
      }

      if (Number(count) > max) {
        const remaining = await redis.ttl(key);
        res.status(429).json({ error: 'Too many requests', retry_after_sec: remaining >= 0 ? remaining : windowSec });
        return;
      }

      next();
    } catch (e) {
      // Fail-open on rate limiter errors
      next();
    }
  };
}


