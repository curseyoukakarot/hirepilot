import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export default async function getAdvancedInfo(req: Request, res: Response) {
  const userId = (req.headers['x-user-id'] as string) || (req.query.user_id as string) || req.body?.user_id;
  if (!userId) {
    return res.status(400).json({ error: 'Missing user_id' });
  }

  try {
    const { data: rows, error } = await supabase
      .from('campaigns')
      .select('id, title, created_at, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);
    if (error) throw error;

    const campaigns = (rows || []).map(r => ({
      id: r.id,
      name: r.title,
      created_at: r.created_at,
      status: r.status
    }));

    return res.json({ user_id: userId, campaigns });
  } catch (e: any) {
    console.error('[getAdvancedInfo] error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
} 