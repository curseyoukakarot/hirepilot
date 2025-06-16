// backend/api/getCampaigns.ts

import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function getCampaigns(req: Request, res: Response) {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      res.status(400).json({ error: 'Missing user_id' });
      return;
    }

    console.log('Incoming user_id:', user_id);
    const { data: campaigns, error } = await supabaseDb
      .from('campaigns')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });
    console.log('Campaigns returned:', campaigns);

    if (error) {
      console.error('[getCampaigns Error]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ campaigns: campaigns || [] });
    return;
  } catch (error: any) {
    console.error('[getCampaigns Error]', error);
    res.status(500).json({ error: error.message || 'Failed to fetch campaigns' });
    return;
  }
}
