import express, { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { requireAuth } from '../../middleware/authMiddleware';
import { ensureConnectAccount, connectOnboardingLink } from '../services/stripe';
import { stripe as platformStripe } from '../services/stripe';

const router = express.Router();

// GET /api/stripe/status
router.get('/status', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { data, error } = await supabase
      .from('user_integrations')
      .select('stripe_secret_key, stripe_publishable_key, stripe_connected_account_id, stripe_mode')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;

    const platformKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
    res.json({
      has_keys: !!(data?.stripe_secret_key && data?.stripe_publishable_key),
      connected_account_id: data?.stripe_connected_account_id || null,
      mode: data?.stripe_mode || 'connect',
      // Non-sensitive hints to debug key mismatches in production.
      // We never return full keys; only last4.
      secret_key_last4: data?.stripe_secret_key ? String(data.stripe_secret_key).slice(-4) : null,
      publishable_key_last4: data?.stripe_publishable_key ? String(data.stripe_publishable_key).slice(-4) : null,
      platform_secret_last4: platformKey ? platformKey.slice(-4) : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/save-keys { secret_key, publishable_key }
router.post('/save-keys', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { secret_key, publishable_key, mode } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const sk = String(secret_key || '').trim();
    const pk = String(publishable_key || '').trim();
    if (!sk || !pk) return res.status(400).json({ error: 'missing_keys' });
    if (!/^sk_(test|live)_/.test(sk)) return res.status(400).json({ error: 'invalid_secret_key' });
    if (!/^pk_(test|live)_/.test(pk)) return res.status(400).json({ error: 'invalid_publishable_key' });

    const { error } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: userId,
        stripe_secret_key: sk,
        stripe_publishable_key: pk,
        stripe_mode: mode === 'keys' ? 'keys' : 'connect',
      }, { onConflict: 'user_id' });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/connect/init -> returns onboarding link URL
router.post('/connect/init', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    // Read existing account id if present
    const { data: row, error: readErr } = await supabase
      .from('user_integrations')
      .select('stripe_connected_account_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (readErr) throw readErr;

    // Set mode to connect
    const accountId = await ensureConnectAccount(userId, row?.stripe_connected_account_id || undefined);
    if (!row?.stripe_connected_account_id) {
      await supabase
        .from('user_integrations')
        .upsert({ user_id: userId, stripe_connected_account_id: accountId, stripe_mode: 'connect' }, { onConflict: 'user_id' });
    }

    const link = await connectOnboardingLink(accountId);
    res.json({ url: link.url, account_id: accountId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/disconnect -> clears keys/account id
router.post('/disconnect', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { error } = await supabase
      .from('user_integrations')
      .upsert({ user_id: userId, stripe_secret_key: null, stripe_publishable_key: null, stripe_connected_account_id: null, stripe_mode: null }, { onConflict: 'user_id' });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

// OAuth (Standard/Express) — init
router.get('/oauth/init', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID!;
    const redirectUri = process.env.STRIPE_CONNECT_REDIRECT_URL!; // e.g. https://app.yourdomain.com/api/stripe/oauth/callback
    const url = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&scope=read_write&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(userId)}`;
    res.json({ url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// OAuth callback
router.get('/oauth/callback', async (req: Request, res: Response) => {
  try {
    const code = String(req.query.code || '');
    const stateUserId = String(req.query.state || '');
    if (!code || !stateUserId) {
      return res.status(400).json({ error: 'missing_code_or_state' });
    }
    const tokenResp = await platformStripe.oauth.token({ grant_type: 'authorization_code', code });
    const connectedId = (tokenResp as any)?.stripe_user_id as string;
    if (connectedId) {
      await supabase
        .from('user_integrations')
        .upsert({ user_id: stateUserId, stripe_connected_account_id: connectedId, stripe_mode: 'connect' }, { onConflict: 'user_id' });
    }
    const redirect = process.env.APP_SETTINGS_URL || `${process.env.APP_BASE_URL || ''}/settings/integrations`;
    res.redirect(redirect);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'oauth_failed' });
  }
});


