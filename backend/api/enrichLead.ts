import { Request, Response } from 'express';
import { supabaseDb as supabase } from '../lib/supabase';
import axios from 'axios';
import { ApiRequest } from '../types/api';

const APOLLO_API_URL = 'https://api.apollo.io/v1';

export default async function enrichLead(req: Request, res: Response) {
  // Support deriving user from API key auth; allow lead selection by id or email
  const body: any = req.body || {};
  let { lead_id, user_id, email } = body as { lead_id?: string; user_id?: string; email?: string };
  const apiUserId = (req as any)?.user?.id as string | undefined;
  user_id = user_id || apiUserId;

  if (!user_id) {
    res.status(401).json({ error: 'Unauthorized: missing user context' });
    return;
  }

  if (!lead_id && !email) {
    res.status(400).json({ error: 'Missing required fields: provide lead_id or email' });
    return;
  }

  try {
    // Resolve the lead by id or email (scoped to user)
    let lead: any = null;
    if (lead_id) {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', lead_id)
        .single();
      if (error) throw error;
      lead = data;
    } else if (email) {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user_id)
        .eq('email', email)
        .single();
      if (error) throw error;
      lead = data;
      lead_id = lead.id;
    }

    // Get user settings to check Apollo API key
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (settingsError) throw settingsError;

    // Check if user has their own Apollo API key
    const hasOwnApolloKey = !!settings?.apollo_api_key;
    const apolloApiKey = hasOwnApolloKey ? settings.apollo_api_key : process.env.HIREPILOT_APOLLO_API_KEY;

    // Get user's credit balance
    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (creditsError) throw creditsError;

    // If user doesn't have their own Apollo key, check credits
    if (!hasOwnApolloKey && (!userCredits || userCredits.remaining_credits < 1)) {
      res.status(402).json({ 
        error: 'Insufficient credits',
        requiredCredits: 1,
        currentBalance: userCredits?.remaining_credits || 0
      });
      return;
    }

    // Prepare Apollo API request (use strings for fields Apollo expects as strings)
    const searchParams: any = { api_key: apolloApiKey };
    if (lead.email) searchParams.q_people_email = String(lead.email).toLowerCase();
    const firstName = lead.first_name || lead.firstName;
    const lastName = lead.last_name || lead.lastName;
    const fullName = lead.name || [firstName, lastName].filter(Boolean).join(' ');
    if (fullName) searchParams.q_people_name = String(fullName).toLowerCase();
    if (lead.title) searchParams.q_organization_titles = String(lead.title).toLowerCase();
    if (lead.company) searchParams.q_organization_name = String(lead.company).toLowerCase();

    // Call Apollo API
    const response = await axios.get(`${APOLLO_API_URL}/people/search`, {
      params: searchParams
    });

    if (!response.data || !response.data.people || response.data.people.length === 0) {
      res.status(404).json({ error: 'No enrichment data found' });
      return;
    }

    const enrichmentData = response.data.people[0];

    // If user doesn't have their own Apollo key, deduct credits
    if (!hasOwnApolloKey) {
      const newUsed = userCredits.used_credits + 1;
      const newRemaining = userCredits.remaining_credits - 1;
      
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({ 
          used_credits: newUsed,
          remaining_credits: newRemaining,
          last_updated: new Date().toISOString()
        })
        .eq('user_id', user_id);

      if (updateError) throw updateError;
    }

    // Update lead with enrichment data
    const { data: updatedLead, error: updateLeadError } = await supabase
      .from('leads')
      .update({
        enrichment_data: enrichmentData,
        enriched_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', lead_id)
      .select()
      .single();

    if (updateLeadError) throw updateLeadError;

    // Emit lead enriched event
    await import('../lib/zapEventEmitter').then(({ emitZapEvent, ZAP_EVENT_TYPES, createLeadEventData }) => {
      emitZapEvent({
        userId: user_id,
        eventType: ZAP_EVENT_TYPES.LEAD_ENRICHED,
        eventData: createLeadEventData(updatedLead, { 
          enrichment_source: hasOwnApolloKey ? 'apollo_user_key' : 'apollo_shared',
          credits_used: hasOwnApolloKey ? 0 : 1 
        }),
        sourceTable: 'leads',
        sourceId: lead_id
      });
    });

    res.status(200).json({ 
      enrichment_data: enrichmentData,
      credits_used: hasOwnApolloKey ? 0 : 1,
      remaining_credits: hasOwnApolloKey ? userCredits?.remaining_credits : userCredits.remaining_credits - 1
    });
    return;
  } catch (err: any) {
    console.error('[enrichLead] Error:', err?.response?.data || err);
    if (axios.isAxiosError(err)) {
      return res.status(err.response?.status || 500).json({
        error: err.message,
        details: err.response?.data
      });
    }
    res.status(500).json({ error: err.message || 'Internal Server Error' });
    return;
  }
} 