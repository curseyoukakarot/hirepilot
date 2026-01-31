import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { requireApiKeyScopes } from '../middleware/requireApiKeyScopes';
import { supabaseDb } from '../lib/supabase';

const router = express.Router();
router.use(requireApiKeyScopes(['webhooks:manage']));

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const { data, error } = await supabaseDb
      .from('webhooks')
      .select('id,url,event,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ webhooks: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'webhooks_fetch_failed' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const url = String(req.body?.url || '').trim();
    const event = String(req.body?.event || '').trim();
    if (!url || !event) return res.status(400).json({ error: 'missing_url_or_event' });
    const secret = String(req.body?.secret || crypto.randomBytes(16).toString('hex'));
    const { data, error } = await supabaseDb
      .from('webhooks')
      .insert({ user_id: userId, url, event, secret })
      .select('id,url,event,created_at')
      .single();
    if (error) throw error;
    return res.status(201).json({ webhook: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'webhook_create_failed' });
  }
});

router.delete('/:webhookId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const { error } = await supabaseDb
      .from('webhooks')
      .delete()
      .eq('id', req.params.webhookId)
      .eq('user_id', userId);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'webhook_delete_failed' });
  }
});

export default router;
