import { Router, Response } from 'express';
import { ApiRequest } from '../types/api';
import { supabaseDb } from '../lib/supabase';
import { requireAuth } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get webhooks for current user
router.get('/', requireAuth, async (req: ApiRequest, res: Response) => {
  const userId = req.user!.id;
  const { data, error } = await supabaseDb.from('webhooks').select('*').eq('user_id', userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ webhooks: data });
});

// Create webhook
router.post('/', requireAuth, async (req: ApiRequest, res: Response) => {
  const userId = req.user!.id;
  const { url, event } = req.body;
  if (!url || !event) return res.status(400).json({ error: 'url and event required' });
  const secret = uuidv4();
  const { data, error } = await supabaseDb.from('webhooks').insert({ user_id: userId, url, event, secret }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ webhook: data });
});

// Delete webhook
router.delete('/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { error } = await supabaseDb.from('webhooks').delete().eq('id', id).eq('user_id', userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router; 