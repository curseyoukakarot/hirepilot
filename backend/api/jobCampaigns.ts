import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

// Public: Get campaigns attached to a job with lightweight performance
export default async function jobCampaigns(req: Request, res: Response) {
  try {
    const jobId = req.params.id || String(req.query.job_id || '');
    if (!jobId) return res.status(400).json({ error: 'Missing job id' });

    // Find campaigns linked to this job
    const { data: campaigns, error } = await supabaseDb
      .from('campaigns')
      .select('id, name, title, user_id, job_id, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const summaries: any[] = [];
    for (const c of campaigns || []) {
      try {
        const userId = c.user_id;
        // Sent
        const { count: sent } = await supabaseDb
          .from('email_events')
          .select('message_id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('campaign_id', c.id)
          .eq('event_type', 'sent');
        // Replies
        const { count: replies } = await supabaseDb
          .from('email_events')
          .select('message_id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('campaign_id', c.id)
          .eq('event_type', 'reply');
        summaries.push({
          id: c.id,
          name: c.name || c.title || 'Campaign',
          sent: Number(sent || 0),
          replies: Number(replies || 0),
          hires: 0,
        });
      } catch {
        summaries.push({ id: c.id, name: c.name || c.title || 'Campaign', sent: 0, replies: 0, hires: 0 });
      }
    }

    return res.json({ campaigns: summaries });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to fetch job campaigns' });
  }
}


