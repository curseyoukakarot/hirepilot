import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function debugCampaignMetrics(req: Request, res: Response) {
  try {
    const userId = req.query.user_id as string;
    const campaignId = req.query.campaign_id as string;

    if (!userId) {
      return res.status(400).json({ error: 'user_id required' });
    }

    console.log('[debugCampaignMetrics] Debugging for user:', userId, 'campaign:', campaignId);

    // 1. Get user's campaigns
    const { data: campaigns, error: campaignsError } = await supabaseDb
      .from('campaigns')
      .select('id, title, status, created_at, total_leads, enriched_leads')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (campaignsError) {
      console.error('[debugCampaignMetrics] Error getting campaigns:', campaignsError);
      return res.status(500).json({ error: 'Failed to get campaigns' });
    }

    // 2. Get recent messages for user
    const { data: messages, error: messagesError } = await supabaseDb
      .from('messages')
      .select('id, campaign_id, lead_id, to_email, subject, provider, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error('[debugCampaignMetrics] Error getting messages:', messagesError);
    }

    // 3. Get email_events for user
    const { data: emailEvents, error: eventsError } = await supabaseDb
      .from('email_events')
      .select('id, campaign_id, lead_id, message_id, event_type, event_timestamp, provider')
      .eq('user_id', userId)
      .order('event_timestamp', { ascending: false })
      .limit(10);

    if (eventsError) {
      console.error('[debugCampaignMetrics] Error getting email events:', eventsError);
    }

    // 4. Get campaign metrics from the debug view
    let campaignMetrics = null;
    if (campaignId) {
      const { data: metrics, error: metricsError } = await supabaseDb
        .from('vw_campaign_metrics_debug')
        .select('*')
        .eq('campaign_id', campaignId)
        .maybeSingle();

      if (metricsError) {
        console.error('[debugCampaignMetrics] Error getting campaign metrics:', metricsError);
      } else {
        campaignMetrics = metrics;
      }
    }

    // 5. Count messages by campaign attribution
    const messagesByCampaign = (messages || []).reduce((acc: any, msg: any) => {
      const key = msg.campaign_id || 'null';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    // 6. Count email_events by campaign attribution
    const eventsByCampaign = (emailEvents || []).reduce((acc: any, event: any) => {
      const key = event.campaign_id || 'null';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    // 7. Check for messages without corresponding email_events
    const messageIds = new Set((messages || []).map(m => m.id.toString()));
    const eventMessageIds = new Set((emailEvents || []).map(e => e.message_id));
    const missingEvents = Array.from(messageIds).filter(id => !eventMessageIds.has(id));

    // 8. Get REX context for latest campaign
    const { data: rexContext, error: rexError } = await supabaseDb
      .from('rex_user_context')
      .select('latest_campaign_id')
      .eq('supabase_user_id', userId)
      .maybeSingle();

    if (rexError) {
      console.error('[debugCampaignMetrics] Error getting REX context:', rexError);
    }

    const result = {
      user_id: userId,
      debug_info: {
        campaigns: campaigns || [],
        recent_messages: messages || [],
        recent_email_events: emailEvents || [],
        campaign_metrics: campaignMetrics,
        rex_latest_campaign: rexContext?.latest_campaign_id || null
      },
      analysis: {
        total_campaigns: campaigns?.length || 0,
        total_messages: messages?.length || 0,
        total_email_events: emailEvents?.length || 0,
        messages_by_campaign: messagesByCampaign,
        events_by_campaign: eventsByCampaign,
        messages_without_email_events: missingEvents,
        potential_issues: []
      }
    };

    // Add analysis of potential issues
    if (result.analysis.messages_without_email_events.length > 0) {
      result.analysis.potential_issues.push({
        issue: 'Messages without email_events',
        description: `${result.analysis.messages_without_email_events.length} messages don't have corresponding email_events`,
        impact: 'These messages won\'t show up in campaign metrics',
        message_ids: result.analysis.messages_without_email_events
      });
    }

    if (messagesByCampaign.null > 0) {
      result.analysis.potential_issues.push({
        issue: 'Messages without campaign attribution',
        description: `${messagesByCampaign.null} messages have null campaign_id`,
        impact: 'These messages won\'t be attributed to any campaign',
        solution: 'Need to backfill campaign_id based on lead.campaign_id'
      });
    }

    if (eventsByCampaign.null > 0) {
      result.analysis.potential_issues.push({
        issue: 'Email events without campaign attribution',
        description: `${eventsByCampaign.null} email events have null campaign_id`,
        impact: 'These events won\'t show up in campaign metrics',
        solution: 'Need to backfill campaign_id from corresponding messages'
      });
    }

    return res.json(result);

  } catch (error) {
    console.error('[debugCampaignMetrics] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 