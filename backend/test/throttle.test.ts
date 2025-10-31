import { refillTokens, tryConsume } from '../src/lib/throttle';
import { connection as redis } from '../src/queues/redis';

describe('token-bucket throttle', () => {
  const ctx = { sessionId: 'sess_test', source: 'linkedin' as const, capacityPerDay: 10, activeWorkingSeconds: 10 };

  beforeAll(async () => {
    await (redis as any).del(`tb:${ctx.sessionId}:${ctx.source}:tokens`);
    await (redis as any).del(`tb:${ctx.sessionId}:${ctx.source}:last_refill`);
  });

  it('refills up to capacity and allows consumption', async () => {
    const t1 = await refillTokens(ctx);
    expect(t1).toBeLessThanOrEqual(ctx.capacityPerDay);
    const c1 = await tryConsume(ctx, 1);
    expect(c1.ok).toBe(true);
    const c2 = await tryConsume(ctx, 20); // too many
    expect(c2.ok).toBe(false);
    expect(typeof c2.retryInMs).toBe('number');
  });
});


