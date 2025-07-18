import { Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { ApiRequest } from '../types/api';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: ApiRequest, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Fetch user credits from user_credits table using service role key
    const { data: userCredits, error } = await supabase
      .from('user_credits')
      .select('remaining_credits, total_credits, used_credits')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user credits:', error);
      return res.status(500).json({ error: 'Failed to fetch user credits' });
    }

    if (!userCredits) {
      return res.status(404).json({ error: 'User credits not found' });
    }

    res.status(200).json({
      credits: userCredits.remaining_credits || 0,
      totalCredits: userCredits.total_credits || 0,
      usedCredits: userCredits.used_credits || 0,
      remainingCredits: userCredits.remaining_credits || 0,
      userId: userId
    });

  } catch (error) {
    console.error('Get user credits API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 