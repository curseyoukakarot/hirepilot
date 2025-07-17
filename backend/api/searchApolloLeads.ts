import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { searchAndEnrichPeople, ApolloSearchParams } from '../utils/apolloApi';

const APOLLO_API_URL = 'https://api.apollo.io/v1';

export default async function searchApolloLeads(req: Request, res: Response) {
  const { user_id, job_title, location, keywords } = req.body;

  if (!user_id) {
    res.status(400).json({ error: 'Missing user_id' });
    return;
  }

  try {
    // Get account type for the user
    const { data: userRecord, error: userErr } = await supabase
      .from('users') // adjust if account_type lives elsewhere
      .select('account_type')
      .eq('id', user_id)
      .single();

    if (userErr) throw userErr;

    const privilegedTypes = ['RecruitPro', 'TeamAdmin', 'admin', 'member'];
    const isRecruitPro = privilegedTypes.includes(userRecord?.account_type);

    // Get user settings to check Apollo API key
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (settingsError) throw settingsError;

    // Determine which API key to use
    let apolloApiKey: string | undefined;

    if (isRecruitPro) {
      apolloApiKey = process.env.SUPER_ADMIN_APOLLO_API_KEY;
    } else if (settings?.apollo_api_key) {
      apolloApiKey = settings.apollo_api_key;
    } else {
      apolloApiKey = process.env.HIREPILOT_APOLLO_API_KEY;
    }

    if (!apolloApiKey) {
      res.status(400).json({ error: 'No Apollo API key found' });
      return;
    }

    // Use the correct Apollo API format (same as the main implementation)  
    const searchParams: ApolloSearchParams = {
      api_key: apolloApiKey,
      page: 1,
      per_page: 25
    };

    if (job_title) {
      searchParams.person_titles = [job_title]; // ✅ Search person titles, not organization titles
    }
    if (keywords) {
      searchParams.q_keywords = keywords;
    }
    if (location) {
      searchParams.person_locations = [location];
    }

    // Use the same searchAndEnrichPeople function for consistency
    const { leads: apolloLeads } = await searchAndEnrichPeople(searchParams);

    if (!apolloLeads || apolloLeads.length === 0) {
      res.status(404).json({ error: 'No leads found' });
      return;
    }

    // Transform leads to our format (apolloLeads already have the right structure from searchAndEnrichPeople)
    const leads = apolloLeads.map((lead: any) => ({
      first_name: lead.firstName,
      last_name: lead.lastName,
      title: lead.title,
      company: lead.company,
      email: lead.email,
      linkedin_url: lead.linkedinUrl,
      phone: lead.phone,
      enrichment_data: {
        apollo_id: lead.id,
        organization_id: lead.organization?.id,
        organization_website: lead.organization?.website_url,
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

    // Deduct credits for RecruitPro users
    try {
      if (isRecruitPro && leads.length) {
        const { CreditService } = await import('../services/creditService');
        await CreditService.deductCredits(user_id, leads.length, 'api_usage', `Apollo search pulled ${leads.length} leads`);
      }
    } catch (deductErr) {
      console.warn('Credit deduction failed:', deductErr);
    }

    res.status(200).json({ leads });
    return;
  } catch (err: any) {
    console.error('[searchApolloLeads] Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
    return;
  }
} 