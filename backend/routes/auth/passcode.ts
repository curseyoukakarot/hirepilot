import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../../src/services/supabase';
import { readFileSync } from 'fs';
import path from 'path';
import { csrfGuard } from '../../middleware/csrfGuard';
import { makeRateLimiter } from '../../middleware/rateLimit';

const router = Router();

const requestSchema = z.object({ email: z.string().email() });
const verifySchema = z.object({ token: z.string().min(6) });

// POST /api/auth/passcode/request  { email }
router.post('/request', makeRateLimiter({ keyPrefix: 'rl:passcode:req', windowSec: 60, max: 10 }), csrfGuard, async (req, res) => {
  try {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid email' });
      return;
    }
    const email = parsed.data.email;
    // Use Supabase magic link email delivery (passwordless) for simplicity
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        // Prefer explicit app web URL if set
        redirectTo: process.env.APP_WEB_URL || process.env.FRONTEND_URL
      }
    } as any);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    // Compose email using stored template and send via SendGrid if configured
    try {
      const sgKey = process.env.SENDGRID_API_KEY;
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'no-reply@thehirepilot.com';
      const magicLink: string | undefined = (data as any)?.properties?.action_link;
      const hasKey = Boolean(sgKey);
      const hasLink = Boolean(magicLink);
      console.log('[Passcode][MagicLink] send attempt', { to: email, fromEmail, hasKey, hasLink });
      if (hasKey && hasLink) {
        // Lazy import to avoid hard dependency when not configured
        const sgMod: any = await import('@sendgrid/mail');
        const sg = sgMod.default || sgMod;
        sg.setApiKey(sgKey as string);
        // Resolve from backend root (process.cwd() when server starts inside /backend)
        const tplPath = path.resolve(process.cwd(), 'emails/auth/magic-link.html');
        const htmlBase = readFileSync(tplPath, 'utf8');
        const html = htmlBase
          .replace(/\{\{MAGIC_LINK\}\}/g, magicLink as string)
          .replace(/\{\{YEAR\}\}/g, String(new Date().getFullYear()));
        const [resp] = await sg.send({ to: email, from: fromEmail, subject: 'Sign in to HirePilot', html });
        console.log('[Passcode][MagicLink] sendgrid response', { statusCode: resp?.statusCode, headers: resp?.headers });
      } else {
        if (!hasKey) console.warn('[Passcode][MagicLink] SENDGRID_API_KEY not set');
        if (!hasLink) console.warn('[Passcode][MagicLink] magic link missing from Supabase generateLink response');
      }
    } catch (e: any) {
      console.error('[Passcode][MagicLink] sendgrid error', e?.response?.body || e?.message || e);
    }
    res.json({ ok: true, hashed_token: (data as any)?.properties?.hashed_token || null });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to request passcode' });
  }
});

// POST /api/auth/passcode/verify  { token }
// Note: In magic link flow, verification occurs via redirect; this endpoint is a placeholder for OTP variants.
router.post('/verify', async (req, res) => {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid token' });
      return;
    }
    // Client should complete magic link; for now return ok
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to verify passcode' });
  }
});

export default router;


