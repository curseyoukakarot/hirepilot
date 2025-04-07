// backend/api/saveCampaign.ts

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from 'vercel';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, campaignName, jobReq } = req.body;

  if (!user_id || !campaignName || !jobReq) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { data, error } = await supabase
    .from('campaigns')
    .insert([
      {
        user_id,
        title: campaignName,
        description: jobReq,
        status: 'draft'
      }
    ])
    .select();

  if (error) {
    console.error('[saveCampaign] Error:', error);
    return res.status(500).json({ error: 'Failed to save campaign' });
  }

  return res.status(200).json({ campaign: data?.[0] });
}
