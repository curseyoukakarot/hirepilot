import { Request, Response } from 'express';
import { supabase } from '../../lib/supabase';

export default async function slackDisconnect(req: Request, res: Response) {
  const { userId } = req.body as { userId?: string };
  if (!userId) return res.status(400).json({ error: 'missing userId' });

  await supabase.from('slack_accounts').delete().eq('user_id', userId);
  await supabase.from('users').update({ rex_slack_enabled: false }).eq('id', userId);
  res.json({ success: true });
} 