// backend/api/saveMessage.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, campaign_id, lead_name, lead_email, message_content, status } = req.body;

  if (!user_id || !message_content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { data, error } = await supabase.from('campaign_messages').insert([
      {
        user_id,
        campaign_id: campaign_id || null,
        lead_name: lead_name || 'N/A',
        lead_email: lead_email || 'N/A',
        message_content,
        status: status || 'draft'
      }
    ]).select();

    if (error) throw error;

    res.status(200).json({ message: data[0] });
  } catch (err) {
    console.error('[saveMessage Error]', err);
    res.status(500).json({ error: 'Failed to save message' });
  }
}
