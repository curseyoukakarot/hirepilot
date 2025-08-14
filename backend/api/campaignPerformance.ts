import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function campaignPerformance(req: Request, res: Response) {
  const { id } = req.params;
  // Assume user is authenticated and user id is available (adjust as needed)
  const userId = req.user?.id || req.query.user_id;
  if (!userId) {
    res.status(400).json({ error: 'Missing user id' });
    return;
  }
  if (!id) {
    res.status(400).json({ error: 'Missing campaign id' });
    return;
  }

  try {
    // For 'all' campaigns, count ALL sent messages (including non-campaign messages)
    // For specific campaigns, only count that campaign's messages
    let filter = supabaseDb
      .from('email_events')
      .select('message_id, lead_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'sent');
    
    if (id !== 'all') {
      // For specific campaign, only count messages with that campaign_id
      filter = filter.eq('campaign_id', id);
    }
    // For 'all', we don't filter by campaign_id - this includes ALL user messages
    
    const { count: sent, error: sentError } = await filter;
    if (sentError) {
      console.error('[campaignPerformance] Sent count error:', sentError);
      res.status(500).json({ error: sentError.message });
      return;
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
    // For 'all', count opens from ALL messages, not just campaign messages
    const { count: opens, error: openError } = await openFilter;
    if (openError) {
      console.error('[campaignPerformance] Opens count error:', openError);
      res.status(500).json({ error: openError.message });
      return;
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
    // For 'all', count replies from ALL messages, not just campaign messages
    const { count: replies, error: replyError } = await replyFilter;
    if (replyError) {
      console.error('[campaignPerformance] Replies count error:', replyError);
      res.status(500).json({ error: replyError.message });
      return;
    }

    // Conversions
    let conversionFilter = supabaseDb
      .from('email_events')
      .select('lead_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'conversion');
    if (id !== 'all') {
      conversionFilter = conversionFilter.eq('campaign_id', id);
    }
    const { count: conversions, error: conversionError } = await conversionFilter;
    if (conversionError) {
      console.error('[campaignPerformance] Conversions count error:', conversionError);
      res.status(500).json({ error: conversionError.message });
      return;
    }

    // Lead counts (overall or per campaign)
    let total_leads = 0;
    let converted_candidates = 0;

    if (id === 'all') {
      // All campaigns: all user leads and candidates
      try {
        const { count } = await supabaseDb
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);
        total_leads = count || 0;
      } catch {}

      try {
        const { count } = await supabaseDb
          .from('candidates')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);
        converted_candidates = count || 0;
      } catch {}
    } else {
      // Specific campaign: leads under this campaign and their converted candidates
      try {
        const { data: leadRows, error: leadsErr } = await supabaseDb
          .from('leads')
          .select('id')
          .eq('user_id', userId)
          .eq('campaign_id', id);
        if (!leadsErr) {
          total_leads = (leadRows || []).length;
          const leadIds = (leadRows || []).map((l: any) => l.id);
          if (leadIds.length) {
            const { count } = await supabaseDb
              .from('candidates')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .in('lead_id', leadIds);
            converted_candidates = count || 0;
          }
        }
      } catch {}
    }
    if (conversionError) {
      console.error('[campaignPerformance] Conversions count error:', conversionError);
      res.status(500).json({ error: conversionError.message });
      return;
    }

    // Calculate rates
    const open_rate = sent ? ((opens || 0) / sent) * 100 : 0;
    const reply_rate = sent ? ((replies || 0) / sent) * 100 : 0;
    const conversion_rate = sent ? ((conversions || 0) / sent) * 100 : 0;

    return res.json({
      sent: sent || 0,
      opens: opens || 0,
      open_rate,
      replies: replies || 0,
      reply_rate,
      conversions: conversions || 0,
      conversion_rate,
      total_leads,
      converted_candidates
    });
  } catch (error: any) {
    console.error('[campaignPerformance] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch campaign performance' });
    return;
  }
} 