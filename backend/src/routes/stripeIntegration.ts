import express, { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { requireAuth } from '../middleware/authMiddleware';
import { ensureConnectAccount, connectOnboardingLink } from '../services/stripe';

const router = express.Router();

// GET /api/stripe/status
router.get('/status', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { data, error } = await supabaseDb
      .from('user_integrations')
      .select('stripe_secret_key, stripe_publishable_key, stripe_connected_account_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;

    res.json({
      has_keys: !!(data?.stripe_secret_key && data?.stripe_publishable_key),
      connected_account_id: data?.stripe_connected_account_id || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/save-keys { secret_key, publishable_key }
router.post('/save-keys', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { secret_key, publishable_key } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    if (!secret_key || !publishable_key) return res.status(400).json({ error: 'missing_keys' });

    const { error } = await supabaseDb
      .from('user_integrations')
      .upsert({
        user_id: userId,
        stripe_secret_key: secret_key,
        stripe_publishable_key: publishable_key,
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
    const { data: row, error: readErr } = await supabaseDb
      .from('user_integrations')
      .select('stripe_connected_account_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (readErr) throw readErr;

    const accountId = await ensureConnectAccount(userId, row?.stripe_connected_account_id || undefined);
    if (!row?.stripe_connected_account_id) {
      await supabaseDb
        .from('user_integrations')
        .upsert({ user_id: userId, stripe_connected_account_id: accountId }, { onConflict: 'user_id' });
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

    const { error } = await supabaseDb
      .from('user_integrations')
      .upsert({ user_id: userId, stripe_secret_key: null, stripe_publishable_key: null, stripe_connected_account_id: null }, { onConflict: 'user_id' });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;


