// backend/api/getApiKeys.ts

import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  const user_id = req.query.user_id;

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' });
  }

  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching API keys:', error);
    return res.status(500).json({ error: 'Error fetching API keys' });
  }

  return res.status(200).json({ keys: data });
}
