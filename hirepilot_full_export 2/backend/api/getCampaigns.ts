// backend/api/getCampaigns.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' });
  }

  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return res.status(200).json({ campaigns: data });
  } catch (error) {
    console.error('[getCampaigns Error]', error);
    return res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
}
