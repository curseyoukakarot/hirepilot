import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export default async function slackToggle(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { userId, enabled } = req.body as { userId?: string; enabled?: boolean };
  if (!userId || enabled === undefined) return res.status(400).json({ error: 'Missing params' });

  const { error } = await supabase
    .from('users')
    .update({ rex_slack_enabled: enabled })
    .eq('id', userId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true, enabled });
} 