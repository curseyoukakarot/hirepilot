import { Router } from 'express';
import { z } from 'zod';
import IORedis from 'ioredis';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { csrfGuard } from '../../middleware/csrfGuard';
import { makeRateLimiter } from '../../middleware/rateLimit';

const router = Router();
const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL || 'redis://127.0.0.1:6379';
const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const requestSchema = z.object({ email: z.string().email() });
const verifySchema = z.object({ email: z.string().email(), code: z.string().regex(/^[0-9]{6}$/) });

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function otpKeys(email: string) {
  const key = email.toLowerCase();
  return {
    code: `otp:${key}:code`,
    attempts: `otp:${key}:attempts`,
    sendWindow: `otp:${key}:send_window`,
  };
}

// POST /api/auth/otp/request { email }
router.post('/request', makeRateLimiter({ keyPrefix: 'rl:otp:req', windowSec: 60, max: 5 }), csrfGuard, async (req, res) => {
  try {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid email' }); return; }
    const email = parsed.data.email.toLowerCase();

    // Rate limit: max 5 per hour per email
    const { sendWindow } = otpKeys(email);
    const sentCount = Number(await redis.incr(sendWindow));
    if (sentCount === 1) await redis.expire(sendWindow, 60 * 60);
    if (sentCount > 5) { res.status(429).json({ error: 'Too many requests. Try again later.' }); return; }

    const code = generateCode();
    const { code: codeKey, attempts } = otpKeys(email);
    await redis.set(codeKey, code, 'EX', 10 * 60); // 10 minutes
    await redis.del(attempts);

    // Send email via SendGrid if configured
    try {
      const sgKey = process.env.SENDGRID_API_KEY;
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'no-reply@thehirepilot.com';
      const hasKey = Boolean(sgKey);
      console.log('[OTP] send attempt', { to: email, fromEmail, hasKey });
      if (hasKey) {
        const sgMod: any = await import('@sendgrid/mail');
        const sg = sgMod.default || sgMod;
        sg.setApiKey(sgKey as string);
        // Resolve from backend root
        const tplPath = path.resolve(process.cwd(), 'emails/auth/passcode.html');
        const htmlBase = readFileSync(tplPath, 'utf8');
        const html = htmlBase
          .replace(/\{\{CODE\}\}/g, code)
          .replace(/\{\{YEAR\}\}/g, String(new Date().getFullYear()));
        const [resp] = await sg.send({ to: email, from: fromEmail, subject: 'Your HirePilot Sign-in Code', html });
        console.log('[OTP] sendgrid response', { statusCode: resp?.statusCode, headers: resp?.headers });
      } else {
        console.warn('[OTP] SENDGRID_API_KEY not set');
      }
    } catch (e: any) {
      console.error('[OTP] sendgrid error', e?.response?.body || e?.message || e);
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to request code' });
  }
});

// POST /api/auth/otp/verify { email, code }
router.post('/verify', makeRateLimiter({ keyPrefix: 'rl:otp:verify', windowSec: 60, max: 30 }), csrfGuard, async (req, res) => {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
    const { email, code } = parsed.data;
    const { code: codeKey, attempts } = otpKeys(email);

    // Brute-force protection: 10 attempts max per code lifetime
    const tries = Number(await redis.incr(attempts));
    if (tries === 1) await redis.expire(attempts, 10 * 60);
    if (tries > 10) { res.status(429).json({ error: 'Too many attempts. Try again later.' }); return; }

    const stored = await redis.get(codeKey);
    if (!stored || stored !== code) { res.status(400).json({ error: 'Invalid code' }); return; }

    // In a full flow we’d create a session (supabase sign-in via OTP), but here we just acknowledge ok.
    await redis.del(codeKey);
    await redis.del(attempts);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to verify code' });
  }
});

export default router;


