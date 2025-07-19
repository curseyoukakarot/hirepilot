import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { 
  RexLinkedInRequestData,
  RexModalResponse,
  RexActivityType,
  PuppetUserSettings,
  PUPPET_CONSTANTS
} from '../../types/puppet';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * REX LinkedIn Request Modal Handler (Prompt 6)
 * 
 * This endpoint handles the "Send LinkedIn Request" modal logic:
 * - Auto Mode ON: Queues job immediately, shows confirmation
 * - Auto Mode OFF: Shows drafted message for manual review
 * - Validates consent and daily limits
 */
export async function handleLinkedInRequest(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.body.user_id || req.user?.id;
    const requestData: RexLinkedInRequestData = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
      return;
    }

    // Validate required fields
    if (!requestData.linkedin_profile_url || !requestData.drafted_message) {
      res.status(400).json({
        success: false,
        error: 'linkedin_profile_url and drafted_message are required'
      });
      return;
    }

    // Validate LinkedIn URL format
    if (!requestData.linkedin_profile_url.includes('linkedin.com/in/')) {
      res.status(400).json({
        success: false,
        error: 'Invalid LinkedIn profile URL format'
      });
      return;
    }

    console.log(`[REX] Processing LinkedIn request for user ${userId}`);
    console.log(`[REX] Profile: ${requestData.linkedin_profile_url}`);

    // Get user settings and check REX configuration
    const userSettings = await getUserRexSettings(userId);
    
    if (!userSettings) {
      res.status(404).json({
        success: false,
        error: 'User Puppet settings not found. Please configure REX settings first.'
      });
      return;
    }

    // Check if user has LinkedIn cookie configured
    if (!userSettings.li_at_cookie) {
      res.status(400).json({
        success: false,
        error: 'LinkedIn cookie not configured. Please set up LinkedIn integration first.'
      });
      return;
    }

    // Check automation consent
    if (!userSettings.automation_consent) {
      const response: RexModalResponse = {
        success: true,
        mode: 'manual',
        action: 'consent_required',
        data: {
          drafted_message: requestData.drafted_message,
          consent_required: true
        }
      };

      res.json(response);
      return;
    }

    // Check daily rate limits
    const dailyLimitCheck = await checkDailyLimits(userId, userSettings.daily_connection_limit);
    
    if (dailyLimitCheck.remaining <= 0) {
      res.status(429).json({
        success: false,
        error: `Daily connection limit reached (${dailyLimitCheck.current}/${dailyLimitCheck.limit}). Resets tomorrow.`,
        daily_limit_remaining: 0
      });
      return;
    }

    // Check REX Auto Mode setting
    if (userSettings.rex_auto_mode_enabled) {
      // AUTO MODE: Queue job immediately
      const autoResponse = await handleAutoMode(userId, requestData, userSettings);
      res.json(autoResponse);
    } else {
      // MANUAL MODE: Show drafted message for review
      const manualResponse = await handleManualMode(userId, requestData);
      res.json(manualResponse);
    }

  } catch (error) {
    console.error('[REX] LinkedIn request error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

/**
 * Handle Auto Mode: Queue job immediately
 */
async function handleAutoMode(
  userId: string, 
  requestData: RexLinkedInRequestData, 
  userSettings: PuppetUserSettings
): Promise<RexModalResponse> {
  try {
    console.log(`[REX] Auto mode enabled - queuing job immediately`);

    // Create job in puppet_jobs table
    const { data: job, error: jobError } = await supabase
      .from('puppet_jobs')
      .insert({
        user_id: userId,
        campaign_id: requestData.campaign_id,
        linkedin_profile_url: requestData.linkedin_profile_url,
        message: requestData.drafted_message,
        priority: requestData.priority || 5,
        scheduled_at: new Date().toISOString(),
        status: 'pending'
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    // Log REX activity
    const activityLogId = await logRexActivity({
      user_id: userId,
      lead_id: requestData.lead_id,
      campaign_id: requestData.campaign_id,
      activity_type: 'auto_queue',
      activity_description: `LinkedIn connection request auto-queued for ${requestData.profile_name || 'profile'}`,
      linkedin_profile_url: requestData.linkedin_profile_url,
      message_content: requestData.drafted_message,
      puppet_job_id: job.id,
      metadata: {
        profile_name: requestData.profile_name,
        profile_headline: requestData.profile_headline,
        priority: requestData.priority
      }
    });

    // Get updated daily limit remaining
    const dailyLimitCheck = await checkDailyLimits(userId, userSettings.daily_connection_limit);

    return {
      success: true,
      mode: 'auto',
      action: 'queued_immediately',
      data: {
        job_id: job.id,
        activity_log_id: activityLogId,
        daily_limit_remaining: dailyLimitCheck.remaining
      }
    };

  } catch (error) {
    console.error('[REX] Auto mode error:', error);
    throw error;
  }
}

/**
 * Handle Manual Mode: Show drafted message for review
 */
async function handleManualMode(
  userId: string, 
  requestData: RexLinkedInRequestData
): Promise<RexModalResponse> {
  try {
    console.log(`[REX] Manual mode - showing drafted message for review`);

    // Update last manual review timestamp
    await supabase
      .from('puppet_user_settings')
      .update({
        last_manual_review_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    // Log REX activity
    const activityLogId = await logRexActivity({
      user_id: userId,
      lead_id: requestData.lead_id,
      campaign_id: requestData.campaign_id,
      activity_type: 'manual_review',
      activity_description: `Manual review initiated for LinkedIn connection to ${requestData.profile_name || 'profile'}`,
      linkedin_profile_url: requestData.linkedin_profile_url,
      message_content: requestData.drafted_message,
      metadata: {
        profile_name: requestData.profile_name,
        profile_headline: requestData.profile_headline,
        review_timestamp: new Date().toISOString()
      }
    });

    return {
      success: true,
      mode: 'manual',
      action: 'review_required',
      data: {
        drafted_message: requestData.drafted_message,
        activity_log_id: activityLogId
      }
    };

  } catch (error) {
    console.error('[REX] Manual mode error:', error);
    throw error;
  }
}

/**
 * Get user REX settings from Supabase
 */
async function getUserRexSettings(userId: string): Promise<PuppetUserSettings | null> {
  const { data: settings, error } = await supabase
    .from('puppet_user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // No rows returned
      return null;
    }
    throw new Error(`Failed to fetch user settings: ${error.message}`);
  }

  return settings;
}

/**
 * Check daily connection limits
 */
async function checkDailyLimits(userId: string, dailyLimit: number): Promise<{
  current: number;
  limit: number;
  remaining: number;
}> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: stats } = await supabase
    .from('puppet_daily_stats')
    .select('connections_sent')
    .eq('user_id', userId)
    .eq('stat_date', today)
    .single();

  const currentCount = stats?.connections_sent || 0;
  const remaining = Math.max(0, dailyLimit - currentCount);

  return {
    current: currentCount,
    limit: dailyLimit,
    remaining
  };
}

/**
 * Log REX activity
 */
async function logRexActivity(data: {
  user_id: string;
  lead_id?: string;
  campaign_id?: string;
  activity_type: RexActivityType;
  activity_description: string;
  linkedin_profile_url?: string;
  message_content?: string;
  puppet_job_id?: string;
  metadata?: Record<string, any>;
}): Promise<string> {
  const { data: activity, error } = await supabase
    .from('rex_activity_log')
    .insert({
      user_id: data.user_id,
      lead_id: data.lead_id,
      campaign_id: data.campaign_id,
      activity_type: data.activity_type,
      activity_description: data.activity_description,
      linkedin_profile_url: data.linkedin_profile_url,
      message_content: data.message_content,
      puppet_job_id: data.puppet_job_id,
      metadata: data.metadata || {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('[REX] Failed to log activity:', error);
    throw new Error(`Failed to log REX activity: ${error.message}`);
  }

  return activity.id;
}

/**
 * Endpoint for manual approval after review
 */
export async function approveLinkedInRequest(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.body.user_id || req.user?.id;
    const { 
      linkedin_profile_url, 
      message, 
      campaign_id, 
      lead_id, 
      priority,
      activity_log_id 
    } = req.body;

    if (!userId || !linkedin_profile_url || !message) {
      res.status(400).json({
        success: false,
        error: 'user_id, linkedin_profile_url, and message are required'
      });
      return;
    }

    console.log(`[REX] Manual approval for LinkedIn request: ${linkedin_profile_url}`);

    // Create job after manual approval
    const { data: job, error: jobError } = await supabase
      .from('puppet_jobs')
      .insert({
        user_id: userId,
        campaign_id,
        linkedin_profile_url,
        message,
        priority: priority || 5,
        scheduled_at: new Date().toISOString(),
        status: 'pending'
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    // Log manual approval activity
    await logRexActivity({
      user_id: userId,
      lead_id,
      campaign_id,
      activity_type: 'manual_override',
      activity_description: `LinkedIn connection request manually approved and queued`,
      linkedin_profile_url,
      message_content: message,
      puppet_job_id: job.id,
      metadata: {
        original_activity_log_id: activity_log_id,
        approval_timestamp: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      job_id: job.id,
      message: 'LinkedIn request approved and queued successfully'
    });

  } catch (error) {
    console.error('[REX] Manual approval error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

export default { handleLinkedInRequest, approveLinkedInRequest }; 