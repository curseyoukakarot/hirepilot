import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { EmailEventService } from '../services/emailEventService';

export default async function testConversion(req: Request, res: Response) {
  const { user_id } = req.query;
  
  if (!user_id) {
    res.status(400).json({ error: 'Missing user_id' });
    return;
  }

  try {
    // 1. Check recent leads and their campaign_id values
    const { data: recentLeads, error: leadsError } = await supabaseDb
      .from('leads')
      .select('id, campaign_id, first_name, last_name, email')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
    }

    // 2. Check recent conversion events
    const { data: conversionEvents, error: eventsError } = await supabaseDb
      .from('email_events')
      .select('*')
      .eq('user_id', user_id)
      .eq('event_type', 'conversion')
      .order('created_at', { ascending: false })
      .limit(5);

    if (eventsError) {
      console.error('Error fetching conversion events:', eventsError);
    }

    // 3. Test recording a conversion event
    let testEventResult = null;
    try {
      // Use a real campaign_id from recent leads if available
      const testCampaignId = recentLeads && recentLeads.length > 0 
        ? recentLeads[0].campaign_id 
        : '0cc1f62b-3eb0-4c23-b4a8-da1dfd5af725'; // fallback to known campaign ID
      
      const testLeadId = recentLeads && recentLeads.length > 0 
        ? recentLeads[0].id 
        : '1943812a-35b1-4170-9d75-998bf94203bf'; // fallback to known lead ID
      
      testEventResult = await EmailEventService.storeEvent({
        user_id: user_id as string,
        campaign_id: testCampaignId,
        lead_id: testLeadId,
        provider: 'system',
        message_id: `test_conversion_${Date.now()}`,
        event_type: 'conversion',
        metadata: {
          test: true,
          timestamp: new Date().toISOString()
        }
      });
    } catch (testError) {
      console.error('Error storing test event:', testError);
      testEventResult = { error: testError.message };
    }

    // 4. Check campaign performance calculation
    const { data: allEvents, error: allEventsError } = await supabaseDb
      .from('email_events')
      .select('event_type, campaign_id')
      .eq('user_id', user_id);

    const eventsSummary = {
      total: allEvents?.length || 0,
      by_type: {},
      by_campaign: {},
      conversions_with_campaign: 0,
      conversions_without_campaign: 0
    };

    if (allEvents) {
      allEvents.forEach(event => {
        eventsSummary.by_type[event.event_type] = (eventsSummary.by_type[event.event_type] || 0) + 1;
        
        if (event.campaign_id) {
          eventsSummary.by_campaign[event.campaign_id] = (eventsSummary.by_campaign[event.campaign_id] || 0) + 1;
        }

        if (event.event_type === 'conversion') {
          if (event.campaign_id) {
            eventsSummary.conversions_with_campaign++;
          } else {
            eventsSummary.conversions_without_campaign++;
          }
        }
      });
    }

    res.json({
      debug: {
        user_id,
        timestamp: new Date().toISOString()
      },
      recent_leads: {
        count: recentLeads?.length || 0,
        data: recentLeads || [],
        error: leadsError?.message
      },
      conversion_events: {
        count: conversionEvents?.length || 0,
        data: conversionEvents || [],
        error: eventsError?.message
      },
      test_event_creation: testEventResult,
      events_summary: eventsSummary,
      all_events_error: allEventsError?.message
    });

  } catch (error: any) {
    console.error('[testConversion] Error:', error);
    res.status(500).json({ error: error.message || 'Test conversion failed' });
  }
} 