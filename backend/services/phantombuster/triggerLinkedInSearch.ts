import axios from 'axios';
import { supabaseDb } from '../../lib/supabase';
import { z } from 'zod';

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

// Schema for validating Zapier payload
const zapierPayloadSchema = z.object({
  phantomId: z.string().min(1),
  sessionCookie: z.string().min(10),
  searchUrl: z.string().url(),
  campaignId: z.string().min(1),
  userId: z.string().min(1)
});

export async function triggerLinkedInSearch({ searchUrl, userId, campaignId }: LinkedInSearchParams): Promise<PhantomResponse> {
  try {
    // Validate environment variables
    const zapierWebhookUrl = process.env.ZAPIER_PHANTOM_WEBHOOK_URL;
    if (!zapierWebhookUrl) {
      throw new Error('Zapier webhook URL is not set in environment variables.');
    }

    const phantomId = process.env.PHANTOMBUSTER_LINKEDIN_SEARCH_PHANTOM_ID;
    if (!phantomId) {
      throw new Error('PhantomBuster LinkedIn search phantom ID is not set in environment variables.');
    }

    // Get user's LinkedIn cookie (PhantomBuster API key no longer needed for Zapier)
    const { data: settings, error: settingsError } = await supabaseDb
      .from('user_settings')
      .select('linkedin_cookie')
      .eq('user_id', userId)
      .single();

    if (settingsError) {
      throw new Error('Failed to fetch user settings');
    }

    if (!settings?.linkedin_cookie) {
      throw new Error('LinkedIn session cookie not found');
    }

    // Prepare Zapier payload
    const zapierPayload = {
      phantomId,
      sessionCookie: settings.linkedin_cookie,
      searchUrl,
      campaignId,
      userId
    };

    // Validate payload before sending
    zapierPayloadSchema.parse(zapierPayload);

    // Call Zapier webhook instead of PhantomBuster directly
    const response = await axios.post(zapierWebhookUrl, zapierPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout for Zapier webhook
    });

    // Handle Zapier response
    let executionId: string;
    let status = 'started';

    if (response.data && response.data.executionId) {
      // If Zapier returns the executionId, use it
      executionId = response.data.executionId;
    } else {
      // Fallback: generate a temporary ID for tracking
      // We'll need to poll PhantomBuster API later to get the actual execution ID
      executionId = `zapier-${Date.now()}-${campaignId.slice(0, 6)}`;
      status = 'pending'; // Mark as pending until we can confirm with PhantomBuster
      console.log('[triggerLinkedInSearch] Zapier did not return executionId, using temporary ID:', executionId);
    }

    // Store the execution record
    await supabaseDb
      .from('campaign_executions')
      .insert({
        campaign_id: campaignId,
        user_id: userId,
        phantombuster_execution_id: executionId,
        status,
        started_at: new Date().toISOString()
      });

    return {
      id: executionId,
      status
    };
  } catch (error: any) {
    console.error('[triggerLinkedInSearch] Error:', error);
    
    // Provide more specific error messages
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('Zapier webhook request timed out. Please try again.');
    } else if (error.response?.status === 404) {
      throw new Error('Zapier webhook URL not found. Please check configuration.');
    } else if (error.response?.status >= 500) {
      throw new Error('Zapier service is temporarily unavailable. Please try again later.');
    }
    
    throw new Error(error.message || 'Failed to trigger LinkedIn search via Zapier');
  }
} 