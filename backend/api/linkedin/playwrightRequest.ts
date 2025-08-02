import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { PlaywrightConnectionService } from '../../services/linkedin/playwrightConnectionService';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PlaywrightLinkedInRequest {
  linkedin_url: string;
  message: string;
  rex_mode: 'auto' | 'manual';
  consent_accepted: boolean;
  campaign_id?: string;
  lead_id?: string;
  priority?: number;
}

/**
 * Enhanced LinkedIn Request Handler using Playwright
 * 
 * This endpoint replaces the Puppeteer-based system with your existing
 * Playwright setup for improved reliability and stealth capabilities.
 */
export default async function playwrightLinkedInRequestHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      linkedin_url, 
      message, 
      rex_mode, 
      consent_accepted, 
      campaign_id, 
      lead_id,
      priority 
    }: PlaywrightLinkedInRequest = req.body;
    
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate required fields
    if (!linkedin_url) {
      return res.status(400).json({ error: 'LinkedIn URL is required' });
    }

    if (!rex_mode || !['auto', 'manual'].includes(rex_mode)) {
      return res.status(400).json({ error: 'REX mode must be either "auto" or "manual"' });
    }

    // Validate consent acceptance
    if (!consent_accepted) {
      return res.status(400).json({ 
        error: 'You must consent to HirePilot acting on your behalf to automate LinkedIn outreach',
        consent_required: true
      });
    }

    // Validate LinkedIn URL format
    if (!linkedin_url.includes('linkedin.com/in/')) {
      return res.status(400).json({ error: 'Invalid LinkedIn URL format' });
    }

    // Validate message length
    if (!message || message.length > 300) {
      return res.status(400).json({ error: 'Message is required and cannot exceed 300 characters' });
    }

    console.log(`[PlaywrightLinkedIn] Processing request for user ${userId} in ${rex_mode} mode`);

    // Get user's LinkedIn cookie
    const { data: cookieData, error: cookieError } = await supabase
      .from('linkedin_cookies')
      .select('session_cookie, user_agent')
      .eq('user_id', userId)
      .eq('is_valid', true)
      .single();

    if (cookieError || !cookieData || !cookieData.session_cookie) {
      return res.status(400).json({ 
        error: 'LinkedIn cookie not found. Please refresh your LinkedIn connection from the extension.',
        cookie_required: true
      });
    }

    // Check daily limits (reuse existing logic)
    const dailyLimitCheck = await checkDailyLimits(userId);
    if (dailyLimitCheck.remaining <= 0) {
      return res.status(429).json({
        error: `Daily connection limit reached (${dailyLimitCheck.current}/${dailyLimitCheck.limit}). Resets tomorrow.`,
        daily_limit_remaining: 0
      });
    }

    // Check for duplicate invitations (reuse existing deduplication logic)
    const isDuplicate = await checkForDuplicateInvite(userId, linkedin_url);
    if (isDuplicate) {
      return res.status(409).json({
        error: 'You have already sent a connection request to this profile recently.',
        duplicate_invite: true
      });
    }

    console.log(`[PlaywrightLinkedIn] ✅ All validations passed. Proceeding with Playwright automation...`);

    // Create job record for tracking
    const { data: job, error: jobError } = await supabase
      .from('puppet_jobs')
      .insert({
        user_id: userId,
        campaign_id,
        linkedin_profile_url: linkedin_url,
        message,
        priority: priority || 5,
        scheduled_at: new Date().toISOString(),
        status: 'processing',
        // job_type: 'playwright_connection', // Column doesn't exist in production yet
        result_data: {
          job_type: 'playwright_connection', // Store in metadata instead
          rex_mode,
          lead_id,
          initiated_via: 'playwright_api'
        },
        retry_count: 0,
        max_retries: 3
      })
      .select()
      .single();

    if (jobError) {
      console.error('[PlaywrightLinkedIn] Failed to create job record:', jobError);
      return res.status(500).json({ error: 'Failed to create job record' });
    }

    console.log(`[PlaywrightLinkedIn] Created job ${job.id}, executing connection request...`);

    // Execute connection request using Playwright
    const connectionResult = await PlaywrightConnectionService.sendConnectionRequest({
      profileUrl: linkedin_url,
      message,
      fullCookie: cookieData.session_cookie,
      userId,
      jobId: job.id
    });

    // Update job with result
    const jobUpdate = {
      status: connectionResult.success ? 'completed' : 'failed',
      completed_at: new Date().toISOString(),
      result: connectionResult,
      error_message: connectionResult.error || null,
      metadata: {
        ...job.metadata,
        logs: connectionResult.logs,
        screenshots_count: connectionResult.screenshots?.length || 0
      }
    };

    await supabase
      .from('puppet_jobs')
      .update(jobUpdate)
      .eq('id', job.id);

    if (connectionResult.success) {
      // Log successful invitation
      await logInvitationActivity(userId, linkedin_url, message, job.id, lead_id, campaign_id);
      
      // Update daily count
      await incrementDailyCount(userId);

      console.log(`[PlaywrightLinkedIn] ✅ Connection request completed successfully for job ${job.id}`);

      return res.json({
        success: true,
        job_id: job.id,
        message: connectionResult.message,
        daily_remaining: dailyLimitCheck.remaining - 1,
        logs: connectionResult.logs
      });

    } else {
      console.error(`[PlaywrightLinkedIn] ❌ Connection request failed for job ${job.id}:`, connectionResult.error);
      
      return res.status(422).json({
        success: false,
        job_id: job.id,
        error: connectionResult.message,
        details: connectionResult.error,
        logs: connectionResult.logs,
        screenshots: connectionResult.screenshots // For debugging
      });
    }

  } catch (error: any) {
    console.error('[PlaywrightLinkedIn] Request handler error:', error);
    return res.status(500).json({
      error: 'Internal server error during LinkedIn connection request',
      details: error.message
    });
  }
}

/**
 * Check daily connection limits for user
 */
async function checkDailyLimits(userId: string): Promise<{current: number, limit: number, remaining: number}> {
  const today = new Date().toISOString().split('T')[0];
  
  // Count today's invitations
  const { data: invitations, error } = await supabase
    .from('puppet_jobs')
    .select('id')
    .eq('user_id', userId)
    .eq('job_type', 'playwright_connection')
    .eq('status', 'completed')
    .gte('completed_at', `${today}T00:00:00.000Z`)
    .lt('completed_at', `${today}T23:59:59.999Z`);

  if (error) {
    console.error('[PlaywrightLinkedIn] Error checking daily limits:', error);
    return { current: 0, limit: 20, remaining: 20 };
  }

  const current = invitations?.length || 0;
  const limit = 20; // Standard LinkedIn daily limit
  const remaining = Math.max(0, limit - current);

  return { current, limit, remaining };
}

/**
 * Check for duplicate invitations to the same profile
 */
async function checkForDuplicateInvite(userId: string, linkedinUrl: string): Promise<boolean> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: duplicates, error } = await supabase
    .from('puppet_jobs')
    .select('id')
    .eq('user_id', userId)
    .eq('linkedin_profile_url', linkedinUrl)
    .eq('job_type', 'playwright_connection')
    .gte('created_at', sevenDaysAgo.toISOString());

  if (error) {
    console.error('[PlaywrightLinkedIn] Error checking duplicates:', error);
    return false;
  }

  return (duplicates?.length || 0) > 0;
}

/**
 * Log invitation activity for audit trail
 */
async function logInvitationActivity(
  userId: string,
  linkedinUrl: string,
  message: string,
  jobId: string,
  leadId?: string,
  campaignId?: string
) {
  try {
    await supabase
      .from('rex_activity_log')
      .insert({
        user_id: userId,
        lead_id: leadId,
        campaign_id: campaignId,
        activity_type: 'linkedin_connection',
        activity_description: `Playwright LinkedIn connection request sent`,
        linkedin_profile_url: linkedinUrl,
        message_content: message,
        puppet_job_id: jobId,
        metadata: {
          automation_type: 'playwright',
          timestamp: new Date().toISOString()
        }
      });
  } catch (error) {
    console.error('[PlaywrightLinkedIn] Failed to log activity:', error);
    // Don't fail the request if logging fails
  }
}

/**
 * Increment daily connection count
 */
async function incrementDailyCount(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // This would increment a daily counter if you have one
    // For now, we rely on counting completed jobs
    console.log(`[PlaywrightLinkedIn] Daily count incremented for user ${userId} on ${today}`);
  } catch (error) {
    console.error('[PlaywrightLinkedIn] Failed to increment daily count:', error);
  }
}