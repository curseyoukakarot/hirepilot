import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function campaignPerformance(req: Request, res: Response) {
  const { id } = req.params;
  // Assume user is authenticated and user id is available (adjust as needed)
  const userId = req.user?.id || req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'Missing user id' });
  if (!id) return res.status(400).json({ error: 'Missing campaign id' });

  try {
    // If id is 'all', aggregate for all messages to leads for this user
    let filter = supabaseDb
      .from('email_events')
      .select('message_id, lead_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'sent');
    if (id !== 'all') {
      filter = filter.eq('campaign_id', id);
    }
    const { count: sent, error: sentError } = await filter;
    if (sentError) {
      console.error('[campaignPerformance] Sent count error:', sentError);
      return res.status(500).json({ error: sentError.message });
    }

    // Opens
    let openFilter = supabaseDb
      .from('email_events')
      .select('message_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'open');
    if (id !== 'all') {
      openFilter = openFilter.eq('campaign_id', id);
    }
    const { count: opens, error: openError } = await openFilter;
    if (openError) {
      console.error('[campaignPerformance] Opens count error:', openError);
      return res.status(500).json({ error: openError.message });
    }

    // Replies
    let replyFilter = supabaseDb
      .from('email_events')
      .select('lead_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'reply');
    if (id !== 'all') {
      replyFilter = replyFilter.eq('campaign_id', id);
    }
    const { count: replies, error: replyError } = await replyFilter;
    if (replyError) {
      console.error('[campaignPerformance] Replies count error:', replyError);
      return res.status(500).json({ error: replyError.message });
    }

    // Calculate rates
    const open_rate = sent ? ((opens || 0) / sent) * 100 : 0;
    const reply_rate = sent ? ((replies || 0) / sent) * 100 : 0;

    return res.json({
      sent: sent || 0,
      opens: opens || 0,
      open_rate,
      replies: replies || 0,
      reply_rate
    });
  } catch (error: any) {
    console.error('[campaignPerformance] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch campaign performance' });
  }
} 