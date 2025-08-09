import { Request, Response } from 'express';
import { ApiRequest } from '../../types/api';
import { supabase as supabaseDb } from '../../lib/supabase';
import axios from 'axios';

interface SendLinkedInConnectRequest {
  linkedin_url: string;
  message: string;
  lead_id?: string;
  campaign_id?: string;
}

interface N8nWebhookPayload {
  profileUrl: string;
  user_id: string;
  message: string;
}

/**
 * Send LinkedIn Connect Request via n8n Automation
 * This endpoint is called by the frontend to initiate LinkedIn connection requests
 */
export default async function sendLinkedInConnectHandler(req: ApiRequest, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { linkedin_url, message, lead_id, campaign_id }: SendLinkedInConnectRequest = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate required fields
    if (!linkedin_url || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: linkedin_url and message are required' 
      });
    }

    // Convert and validate LinkedIn URL format
    let profileUrl = linkedin_url;
    
    // Check if it's a Sales Navigator URL (incompatible with connection requests)
    if (linkedin_url.includes('/sales/lead/') || linkedin_url.includes('linkedin.com/sales/')) {
      return res.status(400).json({ 
        error: 'Sales Navigator URLs are not supported for connection requests. Please use a regular LinkedIn profile URL (linkedin.com/in/username).',
        action_required: 'use_regular_linkedin_url',
        provided_url: linkedin_url
      });
    }
    
    // Validate it's a regular LinkedIn profile URL
    if (!linkedin_url.includes('linkedin.com/in/')) {
      return res.status(400).json({ 
        error: 'Invalid LinkedIn URL format. Must be a LinkedIn profile URL (linkedin.com/in/username).',
        provided_url: linkedin_url
      });
    }

    // Validate message length
    if (message.length > 300) {
      return res.status(400).json({ error: 'Message cannot exceed 300 characters' });
    }

    console.log(`[SendLinkedInConnect] Processing request for user ${userId}`);
    console.log(`[SendLinkedInConnect] Profile: ${linkedin_url}`);

    // Check if user has valid LinkedIn cookies
    const hasValidCookies = await checkUserLinkedInCookies(userId);
    if (!hasValidCookies) {
      return res.status(400).json({
        error: 'LinkedIn authentication required. Please refresh your LinkedIn session.',
        action_required: 'refresh_linkedin_cookies',
        redirect_url: '/settings#linkedin-integration'
      });
    }

    // Check daily rate limits (optional - you can implement this based on your business rules)
    const rateLimitCheck = await checkDailyRateLimit(userId);
    if (rateLimitCheck && rateLimitCheck.remaining <= 0) {
      return res.status(429).json({
        error: `Daily connection limit reached (${rateLimitCheck.current}/${rateLimitCheck.limit}). Resets tomorrow.`,
        daily_limit_remaining: 0,
        reset_time: rateLimitCheck.reset_time
      });
    }

    // Trigger n8n webhook
    const n8nResult = await triggerN8nWorkflow({
      profileUrl: linkedin_url,
      user_id: userId,
      message
    });

    if (!n8nResult.success) {
      return res.status(500).json({
        error: 'Failed to trigger automation workflow',
        details: n8nResult.error
      });
    }

    // Update lead status if lead_id provided
    if (lead_id) {
      await updateLeadStatus(lead_id, 'connection_requested');
    }

    // Track the request for analytics
    await trackConnectionRequest({
      user_id: userId,
      lead_id,
      campaign_id,
      profile_url: linkedin_url,
      message,
      workflow_id: n8nResult.workflow_id
    });

    return res.json({
      success: true,
      message: 'LinkedIn connection request queued for automation',
      workflow_id: n8nResult.workflow_id,
      estimated_completion: '30-60 seconds',
      status: 'queued'
    });

  } catch (error) {
    console.error('[SendLinkedInConnect] Error:', error);
    
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

/**
 * Check if user has valid LinkedIn cookies
 */
async function checkUserLinkedInCookies(userId: string): Promise<boolean> {
  try {
    const { data: cookieData, error } = await supabaseDb
      .from('linkedin_cookies')
      .select('is_valid, status, expires_at')
      .eq('user_id', userId)
      .single();

    if (error || !cookieData) {
      return false;
    }

    // Check validity flag
    if (cookieData.is_valid === false || (cookieData.status && cookieData.status !== 'valid')) {
      return false;
    }

    // Check expiration
    if (cookieData.expires_at) {
      const expiresAt = new Date(cookieData.expires_at);
      if (expiresAt < new Date()) {
        return false;
      }
    }

    return true;

  } catch (error) {
    console.error('[SendLinkedInConnect] Error checking cookies:', error);
    return false;
  }
}

/**
 * Check daily rate limits for LinkedIn connections
 */
async function checkDailyRateLimit(userId: string): Promise<{
  current: number;
  limit: number;
  remaining: number;
  reset_time: string;
} | null> {
  try {
    // Get user's daily limit setting (default 20 per day)
    const { data: userSettings } = await supabaseDb
      .from('users')
      .select('daily_connection_limit')
      .eq('id', userId)
      .single();

    const dailyLimit = userSettings?.daily_connection_limit || 20;

    // Count today's connections
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // You might want to create a connections tracking table for this
    // For now, this is a placeholder - implement based on your tracking needs
    const currentCount = 0; // TODO: Implement actual counting logic

    return {
      current: currentCount,
      limit: dailyLimit,
      remaining: dailyLimit - currentCount,
      reset_time: tomorrow.toISOString()
    };

  } catch (error) {
    console.error('[SendLinkedInConnect] Error checking rate limit:', error);
    return null;
  }
}

/**
 * Trigger n8n webhook workflow
 */
async function triggerN8nWorkflow(payload: N8nWebhookPayload): Promise<{
  success: boolean;
  workflow_id?: string;
  error?: string;
}> {
  try {
    const n8nWebhookUrl = process.env.N8N_LINKEDIN_CONNECT_WEBHOOK_URL;
    
    if (!n8nWebhookUrl) {
      throw new Error('N8N_LINKEDIN_CONNECT_WEBHOOK_URL environment variable is required');
    }

    console.log('[SendLinkedInConnect] Triggering n8n webhook...');
    
    const response = await axios.post(n8nWebhookUrl, payload, {
      timeout: 10000, // 10 second timeout for webhook trigger
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'HirePilot-Backend/1.0'
      }
    });

    // n8n webhooks typically return execution information
    const workflowId = response.data?.execution_id || response.data?.id || `n8n-${Date.now()}`;

    console.log('[SendLinkedInConnect] n8n webhook triggered successfully:', workflowId);

    return {
      success: true,
      workflow_id: workflowId
    };

  } catch (error) {
    console.error('[SendLinkedInConnect] n8n webhook trigger error:', error);
    
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        error: `n8n webhook failed: ${error.response?.status} ${error.response?.statusText || error.message}`
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown n8n webhook error'
    };
  }
}

/**
 * Update lead status after connection request
 */
async function updateLeadStatus(leadId: string, status: string): Promise<void> {
  try {
    await supabaseDb
      .from('leads')
      .update({ 
        status,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', leadId);

    console.log(`[SendLinkedInConnect] Updated lead ${leadId} status to ${status}`);

  } catch (error) {
    console.warn('[SendLinkedInConnect] Failed to update lead status:', error);
  }
}

/**
 * Track connection request for analytics
 */
async function trackConnectionRequest(data: {
  user_id: string;
  lead_id?: string;
  campaign_id?: string;
  profile_url: string;
  message: string;
  workflow_id?: string;
}): Promise<void> {
  try {
    // Log for analytics - you may want to store this in a specific table
    console.log('[SendLinkedInConnect] Connection request tracked:', {
      user_id: data.user_id,
      linkedin_url: data.profile_url,
      workflow_id: data.workflow_id,
      timestamp: new Date().toISOString()
    });

    // TODO: Consider storing in a dedicated tracking table
    // await supabaseDb.from('linkedin_connection_requests').insert(data);

  } catch (error) {
    console.warn('[SendLinkedInConnect] Failed to track connection request:', error);
  }
}