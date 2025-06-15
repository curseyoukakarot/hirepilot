import axios from 'axios';
import { supabase } from '../../lib/supabase';

const APOLLO_API_URL = 'https://api.apollo.io/v1';

interface EnrichmentParams {
  leadId: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  linkedinUrl?: string;
}

interface ApolloResponse {
  person: {
    id: string;
    first_name: string;
    last_name: string;
    name: string;
    title: string;
    organization: {
      name: string;
      website_url: string;
    };
    email: string;
    phone: string;
    linkedin_url: string;
    location: {
      city: string;
      state: string;
      country: string;
    };
    seniority: string;
    department: string;
    subdepartments: string[];
    skills: string[];
    languages: string[];
    interests: string[];
    organization_titles: string[];
    twitter_url: string;
    facebook_url: string;
    github_url: string;
    personal_email: string;
    mobile_phone: string;
    work_email: string;
    work_phone: string;
  };
}

export async function enrichLead({ leadId, userId, firstName, lastName, company, linkedinUrl }: EnrichmentParams) {
  try {
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

    // Search for person in Apollo
    const response = await axios.get(`${APOLLO_API_URL}/people/search`, {
      params: searchParams,
      headers: {
        'Api-Key': settings.apollo_api_key,
        'Content-Type': 'application/json'
      }
    });

    if (!response.data?.people?.[0]) {
      throw new Error('No matching person found in Apollo');
    }

    const person = response.data.people[0];

    // Update lead with enrichment data
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        first_name: person.first_name,
        last_name: person.last_name,
        title: person.title,
        company: person.organization?.name,
        email: person.email,
        phone: person.phone,
        linkedin_url: person.linkedin_url,
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
      .eq('id', leadId);

    if (updateError) {
      throw new Error('Failed to update lead with enrichment data');
    }

    return {
      success: true,
      data: person
    };
  } catch (error: any) {
    console.error('[enrichLead] Error:', error);
    throw new Error(error.message || 'Failed to enrich lead data');
  }
} 