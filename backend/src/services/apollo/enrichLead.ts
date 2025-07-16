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

    // Prepare search parameters - clean name fields for better Apollo matching
    const searchParams: any = {};
    if (firstName && lastName) {
      // Clean firstName: remove titles, degrees, etc.
      const cleanFirstName = firstName.trim().replace(/\b(Mr|Mrs|Ms|Dr|PhD|MBA|MD)\.?\b/gi, '').trim();
      
      // Clean lastName: remove degrees, titles, suffixes
      const cleanLastName = lastName.trim()
        .replace(/\b(Jr|Sr|III?|IV|PhD|MBA|MD|Esq)\.?\b/gi, '') // Remove suffixes/degrees
        .replace(/,.*$/, '') // Remove everything after comma (like ", MBA")
        .trim();
      
      searchParams.first_name = cleanFirstName;
      searchParams.last_name = cleanLastName;
    }
    if (company) {
      searchParams.organization_name = company;
    }
    if (linkedinUrl) {
      searchParams.linkedin_url = linkedinUrl;
    }

    // Add API key to params (Apollo expects it as query param)
    searchParams.api_key = settings.apollo_api_key;

    console.log('[Apollo] Search parameters:', {
      originalName: `${firstName} ${lastName}`,
      cleanedName: `${searchParams.first_name} ${searchParams.last_name}`,
      company, linkedinUrl,
      searchParams: { ...searchParams, api_key: '***' }
    });

    // Search for person in Apollo
    const response = await axios.get('https://api.apollo.io/v1/people/search', {
      params: searchParams,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('[Apollo] API Response:', {
      status: response.status,
      peopleCount: response.data?.people?.length || 0,
      firstPersonName: response.data?.people?.[0] ? 
        `${response.data.people[0].first_name} ${response.data.people[0].last_name}` : 'None'
    });

    if (!response.data?.people?.[0]) {
      throw new Error('No matching person found in Apollo');
    }

    const person = response.data.people[0];
    
    console.log('[Apollo] Found person:', {
      name: `${person.first_name} ${person.last_name}`,
      email: person.email,
      linkedin: person.linkedin_url,
      searchedFor: `${firstName} ${lastName}`,
      company: person.organization?.name
    });

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