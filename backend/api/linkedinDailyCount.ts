import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Count sent LinkedIn requests today
    const { count, error } = await supabase
      .from('linkedin_outreach_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'sent')
      .gte('sent_at', today.toISOString())
      .lt('sent_at', tomorrow.toISOString());

    if (error) {
      console.error('Error fetching daily LinkedIn count:', error);
      return res.status(500).json({ error: 'Failed to fetch daily count' });
    }

    const dailyLimit = 10;
    const remainingRequests = Math.max(0, dailyLimit - (count || 0));

    res.status(200).json({
      count: count || 0,
      limit: dailyLimit,
      remaining: remainingRequests,
      canSendMore: remainingRequests > 0
    });

  } catch (error) {
    console.error('LinkedIn daily count API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 