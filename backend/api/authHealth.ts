import { Request, Response } from 'express';
import IORedis from 'ioredis';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../src/services/supabase';
import { notifySlack } from '../lib/slack';

let lastAlertAtMs = 0;
const ALERT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

export default async function authHealth(req: Request, res: Response) {
  const results: any = { items: {} };

  function setItem(key: string, status: 'ok' | 'down' | 'degraded' | 'unknown', details?: any) {
    results.items[key] = { status, details };
  }

  try {
    // Flags
    const flags = {
      session_cookie: String(process.env.ENABLE_SESSION_COOKIE_AUTH || 'false').toLowerCase() === 'true',
      passcode: String(process.env.ENABLE_PASSCODE_AUTH || 'false').toLowerCase() === 'true',
      otp: String(process.env.ENABLE_OTP_AUTH || 'false').toLowerCase() === 'true',
      csrf: String(process.env.ENABLE_CSRF || 'false').toLowerCase() === 'true',
      rate_limit: String(process.env.ENABLE_RATE_LIMITING || 'false').toLowerCase() === 'true',
    };
    setItem('session_cookie', flags.session_cookie ? 'ok' : 'down');
    setItem('passcode', flags.passcode ? 'ok' : 'down');
    setItem('otp', flags.otp ? 'ok' : 'down');
    setItem('csrf', flags.csrf ? 'ok' : 'down');
    setItem('rate_limit', flags.rate_limit ? 'ok' : 'down');

    // SendGrid config check
    const sgKey = process.env.SENDGRID_API_KEY || '';
    setItem('sendgrid', sgKey ? 'ok' : 'down');

    // Redis ping (if configured)
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL || '';
    if (redisUrl) {
      try {
        const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: true });
        await Promise.race([
          redis.connect(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('redis-timeout-connect')), 1500))
        ]);
        const pong = await Promise.race([
          redis.ping(),
          new Promise<string>((_, rej) => setTimeout(() => rej(new Error('redis-timeout-ping')), 1500))
        ]);
        await redis.quit().catch(() => {});
        setItem('redis', pong ? 'ok' : 'down');
      } catch (e) {
        setItem('redis', 'down', { error: (e as any)?.message || String(e) });
      }
    } else {
      setItem('redis', 'unknown');
    }

    // Supabase auth/admin sanity check
    try {
      const t0 = Date.now();
      const { error } = await supabase
        .from('users')
        .select('id', { head: true, count: 'exact' })
        .limit(1);
      const latencyMs = Date.now() - t0;
      const hasAdminKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
      setItem('supabase_auth', !error && hasAdminKey ? 'ok' : 'down', { latencyMs, hasAdminKey });
    } catch (e) {
      setItem('supabase_auth', 'down', { error: (e as any)?.message || String(e) });
    }

    // Aggregate status & optionally alert
    const failedKeys = Object.entries(results.items)
      .filter(([, v]: any) => v.status === 'down')
      .map(([k]) => k);
    results.status = failedKeys.length > 0 ? 'degraded' : 'ok';
    results.failed = failedKeys;

    // Slack alert with cooldown when something is down (avoid spamming)
    if (failedKeys.length > 0) {
      const now = Date.now();
      if (now - lastAlertAtMs > ALERT_COOLDOWN_MS) {
        lastAlertAtMs = now;
        const msg = `🔴 Auth Health Alert: ${failedKeys.join(', ')} down. Flags: ${JSON.stringify(flags)}`;
        notifySlack(msg).catch(() => {});
      }
    }

    res.json(results);
  } catch (err) {
    try { await notifySlack(`🔴 Auth Health endpoint crashed: ${(err as any)?.message || err}`); } catch {}
    res.status(500).json({ error: 'auth health error' });
  }
}


