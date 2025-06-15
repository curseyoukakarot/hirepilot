import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const APOLLO_API_URL = 'https://api.apollo.io/v1';

export default async function searchApolloLeads(req: Request, res: Response) {
  const { user_id, job_title, location, keywords } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' });
  }

  try {
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

    if (!apolloApiKey) {
      return res.status(400).json({ error: 'No Apollo API key found' });
    }

    // Prepare Apollo API request
    const searchParams = {
      api_key: apolloApiKey,
      q_organization_titles: job_title ? [job_title.toLowerCase()] : [],
      q_organization_locations: location ? [location.toLowerCase()] : [],
      q_organization_keywords: keywords ? keywords.split(',').map((k: string) => k.trim().toLowerCase()) : [],
      page: 1,
      per_page: 25
    };

    // Call Apollo API
    const response = await axios.get(`${APOLLO_API_URL}/people/search`, {
      params: searchParams
    });

    if (!response.data || !response.data.people) {
      return res.status(404).json({ error: 'No leads found' });
    }

    // Transform Apollo response to our lead format
    const leads = response.data.people.map((person: any) => ({
      first_name: person.first_name,
      last_name: person.last_name,
      title: person.title,
      company: person.organization?.name,
      email: person.email,
      linkedin_url: person.linkedin_url,
      phone: person.phone,
      enrichment_data: {
        apollo_id: person.id,
        organization_id: person.organization?.id,
        organization_website: person.organization?.website_url,
        organization_linkedin: person.organization?.linkedin_url,
        organization_twitter: person.organization?.twitter_url,
        organization_facebook: person.organization?.facebook_url,
        organization_industry: person.organization?.industry,
        organization_size: person.organization?.estimated_num_employees,
        organization_founded: person.organization?.founded_year,
        organization_headquarters: person.organization?.headquarters_location,
        organization_revenue: person.organization?.estimated_annual_revenue,
        person_seniority: person.seniority,
        person_departments: person.departments,
        person_subdepartments: person.subdepartments,
        person_skills: person.skills,
        person_technologies: person.technologies,
        person_languages: person.languages,
        person_education: person.education,
        person_experience: person.experience,
        person_contact_email_status: person.contact_email_status,
        person_contact_phone_status: person.contact_phone_status,
        person_contact_linkedin_status: person.contact_linkedin_status,
        person_contact_twitter_status: person.contact_twitter_status,
        person_contact_facebook_status: person.contact_facebook_status,
        person_contact_github_status: person.contact_github_status,
        person_contact_angellist_status: person.contact_angellist_status,
        person_contact_quora_status: person.contact_quora_status,
        person_contact_medium_status: person.contact_medium_status,
        person_contact_instagram_status: person.contact_instagram_status,
        person_contact_youtube_status: person.contact_youtube_status,
        person_contact_pinterest_status: person.contact_pinterest_status,
        person_contact_snapchat_status: person.contact_snapchat_status,
        person_contact_tiktok_status: person.contact_tiktok_status,
        person_contact_reddit_status: person.contact_reddit_status,
        person_contact_twitch_status: person.contact_twitch_status,
        person_contact_spotify_status: person.contact_spotify_status,
        person_contact_soundcloud_status: person.contact_soundcloud_status,
        organization_facebook_url: person.organization?.facebook_url,
        organization_twitter_url: person.organization?.twitter_url,
        organization_linkedin_url: person.organization?.linkedin_url,
        organization_website_url: person.organization?.website_url
      }
    }));

    return res.status(200).json({ leads });
  } catch (err: any) {
    console.error('[searchApolloLeads] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
} 