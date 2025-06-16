import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      jobId,
      campaignId,
    } = req.query;

    const userId = req.headers['x-user-id'];
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let query = supabase
      .from('candidates')
      .select(`
        *,
        candidate_jobs (
          status,
          job_requisitions (
            title,
            department
          )
        ),
        leads (
          campaign_id,
          campaigns (
            name
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (jobId && jobId !== 'all') {
      query = query.eq('candidate_jobs.job_id', jobId);
    }

    if (campaignId && campaignId !== 'all') {
      query = query.eq('leads.campaign_id', campaignId);
    }

    // Get total count for pagination
    const { count } = await query.count();

    // Apply pagination
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;
    query = query.range(from, to);

    const { data: candidates, error } = await query;

    if (error) {
      throw error;
    }

    res.status(200).json({
      candidates,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(count / Number(limit)),
      },
    });
    return;
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
} 