import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export default async function userPerformance(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Missing user id' });

  try {
    // 1. Get all campaign ids for this user
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('user_id', id);
    if (campaignsError) throw campaignsError;
    const campaignIds = (campaigns || []).map(c => c.id);
    if (campaignIds.length === 0) {
      return res.json({ sent: 0, opens: 0, open_rate: 0, replies: 0, reply_rate: 0, conversions: 0 });
    }

    // 2. Query the new view for metrics
    const { data: metrics, error: metricsError } = await supabase
      .from('vw_user_campaign_metrics')
      .select('*')
      .eq('user_id', id)
      .in('campaign_id', campaignIds)
      .order('day', { ascending: false });
    if (metricsError) throw metricsError;

    // Aggregate totals
    let sent = 0, opens = 0, replies = 0;
    metrics.forEach(m => {
      sent += m.sent || 0;
      opens += m.opens || 0;
      replies += m.replies || 0;
    });
    const sentCount = sent;
    const opensCount = opens;
    const repliesCount = replies;
    const open_rate = sentCount ? (opensCount / sentCount) * 100 : 0;
    const reply_rate = sentCount ? (repliesCount / sentCount) * 100 : 0;

    // 3. Count total leads for these campaigns
    let totalLeads = 0;
    try {
      const { count, error } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .in('campaign_id', campaignIds);
      if (error) throw error;
      totalLeads = count || 0;
    } catch (err) { totalLeads = 0; }

    // 4. Count converted candidates for these campaigns (from candidates table)
    let converted = 0;
    try {
      const { count, error } = await supabase
        .from('candidates')
        .select('id', { count: 'exact', head: true })
        .in('campaign_id', campaignIds);
      if (error) throw error;
      converted = count || 0;
    } catch (err) { converted = 0; }

    // 5. Calculate conversion rate
    const conversion_rate = totalLeads ? ((converted || 0) / totalLeads) * 100 : 0;

    return res.json({
      sent: sentCount,
      opens: opensCount,
      open_rate,
      replies: repliesCount,
      reply_rate,
      total_leads: totalLeads || 0,
      converted_candidates: converted || 0,
      conversion_rate
    });
  } catch (error: any) {
    console.error('[userPerformance] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch user performance' });
  }
} 