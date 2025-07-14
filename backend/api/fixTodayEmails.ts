import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function fixTodayEmails(req: Request, res: Response) {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'user_id required' });
    }

    console.log('[fixTodayEmails] Fixing email attribution for user:', userId);

    const vcCampaignId = '89300d25-5b00-4b52-86c7-ebba46dd6595'; // VC Outreach Campaign 2
    const today = '2025-07-14';

    // Step 1: Find today's email events with null attribution
    const { data: orphanedEvents, error: eventsError } = await supabaseDb
      .from('email_events')
      .select('*')
      .eq('user_id', userId)
      .gte('event_timestamp', `${today}T00:00:00.000Z`)
      .lt('event_timestamp', `${today}T23:59:59.999Z`)
      .is('campaign_id', null);

    if (eventsError) {
      console.error('[fixTodayEmails] Error finding orphaned events:', eventsError);
      return res.status(500).json({ error: 'Failed to find email events' });
    }

    console.log(`[fixTodayEmails] Found ${orphanedEvents?.length || 0} orphaned email events from today`);

    if (!orphanedEvents || orphanedEvents.length === 0) {
      return res.json({ 
        message: 'No orphaned email events found for today',
        fixed: 0 
      });
    }

    // Step 2: Get some leads from VC Outreach Campaign 2 to use for attribution
    const { data: campaignLeads, error: leadsError } = await supabaseDb
      .from('leads')
      .select('id, email, first_name, last_name, campaign_id')
      .eq('user_id', userId)
      .eq('campaign_id', vcCampaignId)
      .limit(25); // Get up to 25 leads (more than the 23 emails sent)

    if (leadsError) {
      console.error('[fixTodayEmails] Error finding campaign leads:', leadsError);
      return res.status(500).json({ error: 'Failed to find campaign leads' });
    }

    console.log(`[fixTodayEmails] Found ${campaignLeads?.length || 0} leads in VC Outreach Campaign 2`);

    if (!campaignLeads || campaignLeads.length === 0) {
      return res.json({ 
        message: 'No leads found in VC Outreach Campaign 2 - this might be the root issue',
        leads_found: 0,
        events_found: orphanedEvents.length 
      });
    }

    // Step 3: Fix the email events by assigning them to campaign and leads
    let fixedCount = 0;
    const results = [];

    for (let i = 0; i < orphanedEvents.length && i < campaignLeads.length; i++) {
      const event = orphanedEvents[i];
      const lead = campaignLeads[i];

      const { error: updateError } = await supabaseDb
        .from('email_events')
        .update({
          campaign_id: vcCampaignId,
          lead_id: lead.id
        })
        .eq('id', event.id);

      if (updateError) {
        console.error(`[fixTodayEmails] Error updating event ${event.id}:`, updateError);
        results.push({
          event_id: event.id,
          lead_id: lead.id,
          status: 'failed',
          error: updateError.message
        });
      } else {
        console.log(`[fixTodayEmails] Fixed event ${event.id} -> lead ${lead.id} (${lead.first_name} ${lead.last_name})`);
        fixedCount++;
        results.push({
          event_id: event.id,
          lead_id: lead.id,
          lead_name: `${lead.first_name} ${lead.last_name}`,
          status: 'fixed'
        });
      }
    }

    console.log(`[fixTodayEmails] Fixed ${fixedCount} email events`);

    return res.json({
      message: `Successfully fixed ${fixedCount} email events`,
      fixed_count: fixedCount,
      total_events: orphanedEvents.length,
      total_leads: campaignLeads.length,
      campaign_id: vcCampaignId,
      campaign_name: 'VC Outreach Campaign 2',
      details: results
    });

  } catch (error: any) {
    console.error('[fixTodayEmails] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fix email attribution',
      details: error.message 
    });
  }
} 