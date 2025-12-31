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

    // Resolve Apollo API key with fallback: personal -> super admin -> platform
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', user_id)
      .single();

    if (settingsError) throw settingsError;

    const personalKey = settings?.apollo_api_key;
    const superAdminKey = process.env.SUPER_ADMIN_APOLLO_API_KEY;
    const platformKey = process.env.HIREPILOT_APOLLO_API_KEY;
    const apolloApiKey = personalKey || superAdminKey || platformKey;
    const hasOwnApolloKey = !!personalKey;

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
    const firstName = String(lead.first_name || lead.firstName || '').trim();
    const lastName = String(lead.last_name || lead.lastName || '').trim();
    const fullName = String(lead.name || '').trim() || [firstName, lastName].filter(Boolean).join(' ');
    const company = String(lead.company || '').trim();
    const linkedinUrl = String(lead.linkedin_url || lead.linkedin || lead.linkedinUrl || '').trim();

    // Apollo Match API is more reliable than legacy people/search and supports linkedin_url matching.
    // This also avoids Apollo returning 422 for unknown/unsupported query params.
    const matchBody: any = {
      reveal_personal_emails: true
    };
    if (firstName) matchBody.first_name = firstName;
    if (lastName) matchBody.last_name = lastName;
    if (!firstName && !lastName && fullName) matchBody.person_name = fullName;
    if (company) matchBody.organization_name = company;
    if (linkedinUrl) matchBody.linkedin_url = linkedinUrl;
    if (lead.email) matchBody.email = String(lead.email).trim().toLowerCase();

    // Require at least one strong identifier; otherwise Apollo will (rightfully) fail.
    if (!matchBody.linkedin_url && !matchBody.email && !matchBody.person_name && !(matchBody.first_name && matchBody.last_name)) {
      return res.status(400).json({
        error: 'Lead is missing required fields for enrichment (need linkedin_url, email, or name)'
      });
    }

    const response = await axios.post(
      // NOTE: Apollo’s newer endpoints often live under /api/v1
      'https://api.apollo.io/api/v1/people/match',
      matchBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apolloApiKey
        },
        timeout: 15000
      }
    );

    const person = response.data?.person || null;
    if (!person) {
      res.status(404).json({ error: 'No enrichment data found' });
      return;
    }

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
    const patch: any = {
      updated_at: new Date().toISOString()
    };

    // Only set email if Apollo returned a real one
    if (person.email && !String(person.email).startsWith('email_not_unlocked')) {
      patch.email = person.email;
    }
    // Prefer sanitized_number when available
    const phone = person.phone_numbers?.[0]?.sanitized_number || person.phone || null;
    if (phone) patch.phone = phone;
    if (person.linkedin_url) patch.linkedin_url = person.linkedin_url;

    // Preserve existing enrichment_data shape; store Apollo payload under enrichment_data.apollo
    patch.enrichment_data = {
      ...(lead.enrichment_data || {}),
      apollo: {
        person_id: person.id,
        organization: person.organization || null,
        location: person.location || null,
        seniority: person.seniority || null,
        department: person.department || null,
        subdepartments: person.subdepartments || null,
        skills: person.skills || null,
        linkedin_url: person.linkedin_url || null,
        enriched_at: new Date().toISOString()
      }
    };
    patch.enriched_at = new Date().toISOString();

    const { data: updatedLead, error: updateLeadError } = await supabase
      .from('leads')
      .update(patch)
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
      enrichment_data: patch.enrichment_data,
      apollo_person: person,
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