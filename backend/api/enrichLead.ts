import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const APOLLO_API_URL = 'https://api.apollo.io/v1';

export default async function enrichLead(req: Request, res: Response) {
  const { lead_id, user_id } = req.body;

  if (!lead_id || !user_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get the lead data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadError) throw leadError;

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
    if (!hasOwnApolloKey && (!userCredits || userCredits.balance < 1)) {
      return res.status(402).json({ 
        error: 'Insufficient credits',
        requiredCredits: 1,
        currentBalance: userCredits?.balance || 0
      });
    }

    // Prepare Apollo API request
    const searchParams = {
      api_key: apolloApiKey,
      q_organization_domains: lead.company ? [lead.company.toLowerCase()] : [],
      q_organization_titles: lead.title ? [lead.title.toLowerCase()] : [],
      q_organization_name: lead.company ? [lead.company.toLowerCase()] : [],
      q_people_name: lead.name ? [lead.name.toLowerCase()] : [],
      q_people_email: lead.email ? [lead.email.toLowerCase()] : []
    };

    // Call Apollo API
    const response = await axios.get(`${APOLLO_API_URL}/people/search`, {
      params: searchParams
    });

    if (!response.data || !response.data.people || response.data.people.length === 0) {
      return res.status(404).json({ error: 'No enrichment data found' });
    }

    const enrichmentData = response.data.people[0];

    // If user doesn't have their own Apollo key, deduct credits
    if (!hasOwnApolloKey) {
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({ 
          balance: userCredits.balance - 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user_id);

      if (updateError) throw updateError;
    }

    // Update lead with enrichment data
    const { error: updateLeadError } = await supabase
      .from('leads')
      .update({
        enrichment_data: enrichmentData,
        updated_at: new Date().toISOString()
      })
      .eq('id', lead_id);

    if (updateLeadError) throw updateLeadError;

    return res.status(200).json({ 
      enrichment_data: enrichmentData,
      credits_used: hasOwnApolloKey ? 0 : 1,
      remaining_credits: hasOwnApolloKey ? userCredits?.balance : userCredits.balance - 1
    });
  } catch (err: any) {
    console.error('[enrichLead] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
} 