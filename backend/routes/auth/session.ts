import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { makeRateLimiter } from '../../middleware/rateLimit';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// POST /api/auth/session -> set HttpOnly cookie from provided access token
// CSRF disabled for this specific endpoint to simplify cross-subdomain session sync
router.post('/', makeRateLimiter({ keyPrefix: 'rl:session:set', windowSec: 60, max: 20 }), async (req, res) => {
  try {
    const { access_token } = req.body as { access_token?: string };
    if (!access_token) {
      res.status(400).json({ error: 'Missing access_token' });
      return;
    }

    const { data, error } = await supabase.auth.getUser(access_token);
    if (error || !data?.user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    const baseDomain = process.env.COOKIE_BASE_DOMAIN || '.thehirepilot.com';
    const cookieOpts = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'none' as const, // allow cross-site requests from app → api
      path: '/',
      domain: isProd ? baseDomain : undefined,
      // Optional: align cookie lifetime with token expiry if desired
      // maxAge: 60 * 60 * 24,
    } as const;

    res.cookie('hp_session', access_token, cookieOpts);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set session' });
  }
});

// DELETE /api/auth/session -> clear cookie
router.delete('/', makeRateLimiter({ keyPrefix: 'rl:session:del', windowSec: 60, max: 20 }), async (_req, res) => {
  try {
    const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    const baseDomain = process.env.COOKIE_BASE_DOMAIN || '.thehirepilot.com';
    res.clearCookie('hp_session', { path: '/', domain: isProd ? baseDomain : undefined });
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to clear session' });
  }
});

// GET /api/auth/session -> returns basic user info if cookie is valid
router.get('/', async (req, res) => {
  try {
    const token = (req as any)?.cookies?.hp_session as string | undefined;
    if (!token) {
      res.status(401).json({ error: 'No session' });
      return;
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const user = data.user as any;
    res.json({ id: user.id, email: user.email, user_metadata: user.user_metadata, app_metadata: user.app_metadata });
  } catch {
    res.status(500).json({ error: 'Failed to read session' });
  }
});

export default router;


