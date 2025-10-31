import IORedis from 'ioredis';
import { connection as redis } from '../queues/redis';

export type Source = 'linkedin';

export interface TokenBucketContext {
  sessionId: string;
  source: Source;
  capacityPerDay: number; // maximum tokens per day after warmup
  activeWorkingSeconds: number; // seconds per day allowed to run (e.g., 8h = 28800)
}

function keysFor(ctx: { sessionId: string; source: string }) {
  const base = `tb:${ctx.sessionId}:${ctx.source}`;
  return {
    tokens: `${base}:tokens`,
    lastRefill: `${base}:last_refill`,
    concurrency: `concurrency:${ctx.sessionId}:${ctx.source}`
  } as const;
}

function nowSeconds() { return Math.floor(Date.now() / 1000); }

function ratePerSecond(capacityPerDay: number, activeWorkingSeconds: number) {
  const secs = Math.max(1, activeWorkingSeconds);
  return capacityPerDay / secs;
}

async function getFloat(r: IORedis, key: string, def = 0): Promise<number> {
  const val = await r.get(key);
  if (!val) return def;
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
}

export async function refillTokens(ctx: TokenBucketContext) {
  const r = redis as unknown as IORedis;
  const keys = keysFor(ctx);
  const rate = ratePerSecond(ctx.capacityPerDay, ctx.activeWorkingSeconds);
  const [last, current] = await Promise.all([
    getFloat(r, keys.lastRefill, nowSeconds()),
    getFloat(r, keys.tokens, ctx.capacityPerDay)
  ]);
  const now = nowSeconds();
  const elapsed = Math.max(0, now - last);
  let next = current + elapsed * rate;
  if (next > ctx.capacityPerDay) next = ctx.capacityPerDay;
  await r.mset({ [keys.tokens]: String(next), [keys.lastRefill]: String(now) });
  return next;
}

export async function tryConsume(ctx: TokenBucketContext, cost = 1): Promise<{ ok: boolean; remaining: number; retryInMs?: number }> {
  const r = redis as unknown as IORedis;
  const keys = keysFor(ctx);
  await refillTokens(ctx);
  const current = await getFloat(r, keys.tokens, ctx.capacityPerDay);
  if (current < cost) {
    const rate = ratePerSecond(ctx.capacityPerDay, ctx.activeWorkingSeconds);
    const deficit = cost - current;
    const retryInMs = Math.ceil((deficit / rate) * 1000);
    return { ok: false, remaining: current, retryInMs };
  }
  await r.decrbyfloat(keys.tokens, cost as any); // ioredis supports INCRBYFLOAT via custom; use eval fallback if unavailable
  const remaining = await getFloat(r, keys.tokens, 0);
  return { ok: true, remaining };
}

export async function incrementConcurrency(sessionId: string, source: Source, maxConcurrency: number, ttlSec = 60): Promise<boolean> {
  const r = redis as unknown as IORedis;
  const key = keysFor({ sessionId, source }).concurrency;
  const v = await r.incr(key);
  if (v === 1) await r.expire(key, ttlSec);
  if (v > maxConcurrency) {
    await r.decr(key);
    return false;
  }
  return true;
}

export async function decrementConcurrency(sessionId: string, source: Source) {
  const r = redis as unknown as IORedis;
  const key = keysFor({ sessionId, source }).concurrency;
  try { await r.decr(key); } catch {}
}


