import axios from 'axios';
import { supabaseDb } from '../../lib/supabase';
import { z } from 'zod';

const PHANTOMBUSTER_API_URL = 'https://api.phantombuster.com/api/v2';

interface LinkedInSearchParams {
  searchUrl: string;
  userId: string;
  campaignId: string;
}

interface PhantomResponse {
  id: string;
  status: string;
  message?: string;
}

// Schema for validating PhantomBuster arguments
const phantomArgsSchema = z.object({
  sessionCookie: z.string().min(10),
  searches: z.array(
    z.object({
      url: z.string().url(),
      label: z.string().optional()
    })
  ),
  maxResults: z.number().int().positive()
});

export async function triggerLinkedInSearch({ searchUrl, userId, campaignId }: LinkedInSearchParams): Promise<PhantomResponse> {
  try {
    // Get user's PhantomBuster API key and LinkedIn cookie
    const { data: settings, error: settingsError } = await supabaseDb
      .from('user_settings')
      .select('phantom_buster_api_key, linkedin_cookie')
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings?.phantom_buster_api_key) {
      throw new Error('PhantomBuster API key not found');
    }

    if (!settings?.linkedin_cookie) {
      throw new Error('LinkedIn session cookie not found');
    }

    // Prepare PhantomBuster arguments
    const args = {
      sessionCookie: settings.linkedin_cookie,
      searches: [
        {
          url: searchUrl,
          label: `run-${campaignId.slice(0, 6)}`
        }
      ],
      maxResults: 250
    };

    // Validate arguments before sending
    phantomArgsSchema.parse(args);

    // Launch the LinkedIn Search Export Phantom
    const response = await axios.post(
      `${PHANTOMBUSTER_API_URL}/agents/launch`,
      {
        id: process.env.PHANTOMBUSTER_LINKEDIN_SEARCH_PHANTOM_ID,
        argument: args
      },
      {
        headers: {
          'X-Phantombuster-Key': settings.phantom_buster_api_key,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data || !response.data.id) {
      throw new Error('Failed to launch PhantomBuster agent');
    }

    // Store the PhantomBuster execution ID
    await supabaseDb
      .from('campaign_executions')
      .insert({
        campaign_id: campaignId,
        user_id: userId,
        phantombuster_execution_id: response.data.id,
        status: 'started',
        started_at: new Date().toISOString()
      });

    return {
      id: response.data.id,
      status: 'started'
    };
  } catch (error: any) {
    console.error('[triggerLinkedInSearch] Error:', error);
    throw new Error(error.message || 'Failed to trigger LinkedIn search');
  }
} 