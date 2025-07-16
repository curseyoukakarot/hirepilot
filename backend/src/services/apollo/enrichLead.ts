import axios from 'axios';
import { supabase } from '../../lib/supabase';

interface EnrichmentParams {
  leadId: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  linkedinUrl?: string;
}

export async function enrichWithApollo({ leadId, userId, firstName, lastName, company, linkedinUrl }: EnrichmentParams) {
  try {
    // Get the current lead data to preserve original information
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('user_id', userId)
      .single();

    if (leadError || !lead) {
      throw new Error('Lead not found');
    }

    // Get user's Apollo API key
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings?.apollo_api_key) {
      throw new Error('Apollo API key not found');
    }

    // Prepare search parameters
    const searchParams: any = {};
    if (firstName && lastName) {
      searchParams.first_name = firstName;
      searchParams.last_name = lastName;
    }
    if (company) {
      searchParams.organization_name = company;
    }
    if (linkedinUrl) {
      searchParams.linkedin_url = linkedinUrl;
    }

    // Add API key to params (Apollo expects it as query param)
    searchParams.api_key = settings.apollo_api_key;

    // Search for person in Apollo
    const response = await axios.get('https://api.apollo.io/v1/people/search', {
      params: searchParams,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.data?.people?.[0]) {
      throw new Error('No matching person found in Apollo');
    }

    const person = response.data.people[0];

    // Update lead with enrichment data - ONLY add contact info, preserve original identity
    const updateData: any = {};
    
    // Only add email if we found a valid one and lead doesn't already have one
    if (person.email && !person.email.startsWith('email_not_unlocked') && !lead.email) {
      updateData.email = person.email;
    }
    
    // Only add phone if we found one and lead doesn't already have one  
    if (person.phone && !lead.phone) {
      updateData.phone = person.phone;
    }
    
    // Always update enrichment data but preserve original lead identity
    updateData.enrichment_data = {
      ...(lead.enrichment_data || {}),
      apollo: {
        person_id: person.id,
        organization: person.organization,
        location: person.location,
        seniority: person.seniority,
        department: person.department,
        subdepartments: person.subdepartments,
        skills: person.skills,
        // Store Apollo's suggestions without overwriting original data
        apollo_suggested_name: `${person.first_name} ${person.last_name}`,
        apollo_suggested_title: person.title,
        apollo_suggested_company: person.organization?.name
      }
    };
    
    updateData.enriched_at = new Date().toISOString();
    
    let { error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      // Handle duplicate linkedin URL within campaign gracefully
      if (updateError.code === '23505') {
        console.warn('Duplicate linkedin_url within campaign; retrying update without linkedin_url');
        const { error: secondError } = await supabase
          .from('leads')
          .update({
            first_name: person.first_name,
            last_name: person.last_name,
            title: person.title,
            company: person.organization?.name,
            ...(person.email && !person.email.startsWith('email_not_unlocked') && { email: person.email }),
            phone: person.phone,
            enrichment_data: {
              apollo: {
                person_id: person.id,
                organization: person.organization,
                location: person.location,
                seniority: person.seniority,
                department: person.department,
                subdepartments: person.subdepartments,
                skills: person.skills,
                languages: person.languages,
                interests: person.interests,
                organization_titles: person.organization_titles,
                social_profiles: {
                  twitter: person.twitter_url,
                  facebook: person.facebook_url,
                  github: person.github_url
                },
                contact_info: {
                  personal_email: person.personal_email,
                  mobile_phone: person.mobile_phone,
                  work_email: person.work_email,
                  work_phone: person.work_phone
                }
              }
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', leadId)
          .eq('user_id', userId);

        if (secondError) {
          console.error('Second update error:', secondError);
          throw new Error(secondError.message || 'Failed to update lead after duplicate');
        }
      } else {
        throw new Error(updateError.message || 'Failed to update lead with enrichment data');
      }
    }

    return {
      success: true,
      data: person
    };
  } catch (error: any) {
    console.error('[enrichWithApollo] Error:', error);
    throw new Error(error.message || 'Failed to enrich lead data');
  }
} 