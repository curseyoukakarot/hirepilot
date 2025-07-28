import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { 
  PuppetJob, 
  PuppetUserSettings, 
  PuppetExecutionConfig, 
  PuppetSecurityError,
  PuppetRateLimitError,
  PUPPET_CONSTANTS
} from '../../types/puppet';
import { executePuppetJob } from '../../services/puppet/puppetAutomation';
import { sendInviteNotification } from '../../lib/notifications';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Process pending Puppet jobs from the queue
 * This endpoint is called by Railway cron jobs or containers
 */
export default async function processPuppetJobs(req: Request, res: Response) {
  const processId = `process-${Date.now()}`;
  console.log(`[${processId}] Starting Puppet job processing...`);

  try {
    // Get pending jobs with rate limiting checks
    const pendingJobs = await getPendingJobs();
    
    if (pendingJobs.length === 0) {
      console.log(`[${processId}] No pending jobs found`);
      return res.json({ 
        success: true, 
        message: 'No pending jobs to process',
        processed: 0
      });
    }

    console.log(`[${processId}] Found ${pendingJobs.length} pending jobs`);

    let processedJobs = 0;
    let successfulJobs = 0;
    let failedJobs = 0;
    let warningJobs = 0;

    // Process jobs sequentially to avoid overloading
    for (const job of pendingJobs) {
      try {
        console.log(`[${processId}] Processing job ${job.id} for user ${job.user_id}`);
        
        // Update job status to running
        await supabase
          .from('puppet_jobs')
          .update({
            status: 'running',
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        // Get user settings and configuration
        const config = await buildExecutionConfig(job);
        
        // Check daily rate limits
        await checkRateLimits(config.user_id);

        // Execute the job
        const result = await executePuppetJob(config);

        // Update job with results
        await supabase
          .from('puppet_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result_data: result,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        // Update daily statistics
        await updateDailyStats(config.user_id, {
          connections_sent: result.connection_sent ? 1 : 0,
          messages_sent: result.message_sent ? 1 : 0,
          jobs_completed: 1
        });

        successfulJobs++;
        console.log(`[${processId}] Job ${job.id} completed successfully`);

        // Notify user
        await sendInviteNotification(job.user_id, job.linkedin_profile_url, true);

      } catch (error) {
        console.error(`[${processId}] Job ${job.id} failed:`, error);

        let status: 'failed' | 'warning' = 'failed';
        let detection_type = undefined;
        let screenshot_url = undefined;

        if (error instanceof PuppetSecurityError) {
          status = 'warning';
          detection_type = error.detection_type;
          screenshot_url = error.screenshot_url;
          warningJobs++;

          // Update security warning stats
          await updateDailyStats(job.user_id, {
            jobs_warned: 1,
            captcha_detections: error.detection_type === 'captcha' ? 1 : 0,
            security_warnings: 1
          });

        } else if (error instanceof PuppetRateLimitError) {
          status = 'failed';
          failedJobs++;
          
          await updateDailyStats(job.user_id, {
            jobs_failed: 1
          });

        } else {
          failedJobs++;
          await updateDailyStats(job.user_id, {
            jobs_failed: 1
          });
          // Failure notification
          await sendInviteNotification(job.user_id, job.linkedin_profile_url, false, error instanceof Error ? error.message : 'unknown');
        }

        // Update job with error details
        await supabase
          .from('puppet_jobs')
          .update({
            status,
            error_message: error instanceof Error ? error.message : 'Unknown error',
            detection_type,
            screenshot_url,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
      }

      processedJobs++;

      // Add delay between jobs to avoid rate limiting
      if (processedJobs < pendingJobs.length) {
        const delay = Math.random() * 10000 + 5000; // 5-15 second delay
        console.log(`[${processId}] Waiting ${Math.round(delay/1000)}s before next job...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log(`[${processId}] Processing complete. Processed: ${processedJobs}, Success: ${successfulJobs}, Failed: ${failedJobs}, Warnings: ${warningJobs}`);

    res.json({
      success: true,
      message: 'Job processing completed',
      processed: processedJobs,
      successful: successfulJobs,
      failed: failedJobs,
      warnings: warningJobs
    });

  } catch (error) {
    console.error(`[${processId}] Process error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get pending jobs that are ready to be processed
 */
async function getPendingJobs(): Promise<PuppetJob[]> {
  const { data: jobs, error } = await supabase
    .from('puppet_jobs')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    throw new Error(`Failed to fetch pending jobs: ${error.message}`);
  }

  return jobs || [];
}

/**
 * Build execution configuration for a job
 */
async function buildExecutionConfig(job: PuppetJob): Promise<PuppetExecutionConfig> {
  // Get user settings
  const { data: userSettings, error: settingsError } = await supabase
    .from('puppet_user_settings')
    .select('*')
    .eq('user_id', job.user_id)
    .single();

  if (settingsError || !userSettings) {
    throw new Error('User Puppet settings not found');
  }

  // Decrypt LinkedIn cookie
  let li_at_cookie = undefined;
  try {
    const { data: cookieResult, error: cookieError } = await supabase
      .rpc('decrypt_li_at_cookie', {
        encrypted_cookie: userSettings.li_at_cookie,
        user_id: job.user_id
      });

    if (cookieError || !cookieResult) {
      throw new Error('Failed to decrypt LinkedIn cookie');
    }
    li_at_cookie = cookieResult;
  } catch (e) {
    console.warn(`[${job.id}] Failed to decrypt LinkedIn cookie for user ${job.user_id}:`, e);
    // Fallback: if decryption fails, try to use the raw cookie if available
    if (userSettings.li_at_cookie) {
      li_at_cookie = userSettings.li_at_cookie;
      console.warn(`[${job.id}] Using raw cookie for user ${job.user_id} due to decryption failure.`);
    } else {
      throw new Error('No valid LinkedIn cookie found for decryption.');
    }
  }

  // Get assigned proxy if available
  let proxy_config = undefined;
  if (userSettings.proxy_id) {
    const { data: proxy, error: proxyError } = await supabase
      .from('puppet_proxies')
      .select('*')
      .eq('id', userSettings.proxy_id)
      .eq('status', 'active')
      .single();

    if (!proxyError && proxy) {
      proxy_config = {
        proxy_endpoint: proxy.proxy_endpoint,
        proxy_port: proxy.proxy_port,
        proxy_username: proxy.proxy_username,
        proxy_password: proxy.proxy_password,
        proxy_location: proxy.proxy_location
      };
    }
  }

  return {
    user_id: job.user_id,
    job_id: job.id,
    linkedin_profile_url: job.linkedin_profile_url,
    message: job.message,
    li_at_cookie: li_at_cookie,
    proxy_config,
    user_settings: {
      min_delay_seconds: userSettings.min_delay_seconds,
      max_delay_seconds: userSettings.max_delay_seconds,
      captcha_detection_enabled: userSettings.captcha_detection_enabled,
      auto_pause_on_warning: userSettings.auto_pause_on_warning
    }
  };
}

/**
 * Check if user has exceeded daily rate limits
 */
async function checkRateLimits(user_id: string): Promise<void> {
  // Get user's daily stats and settings
  const today = new Date().toISOString().split('T')[0];
  
  const { data: stats, error: statsError } = await supabase
    .from('puppet_daily_stats')
    .select('*')
    .eq('user_id', user_id)
    .eq('stat_date', today)
    .single();

  const { data: settings, error: settingsError } = await supabase
    .from('puppet_user_settings')
    .select('daily_connection_limit')
    .eq('user_id', user_id)
    .single();

  if (settingsError || !settings) {
    throw new Error('User settings not found');
  }

  const currentCount = stats?.connections_sent || 0;
  const dailyLimit = settings.daily_connection_limit;

  if (currentCount >= dailyLimit) {
    throw new PuppetRateLimitError(
      `Daily connection limit of ${dailyLimit} exceeded (${currentCount} sent today)`,
      '',
      dailyLimit,
      currentCount
    );
  }
}

/**
 * Update daily statistics for a user
 */
async function updateDailyStats(user_id: string, updates: {
  connections_sent?: number;
  messages_sent?: number;
  jobs_completed?: number;
  jobs_failed?: number;
  jobs_warned?: number;
  captcha_detections?: number;
  security_warnings?: number;
}): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Upsert daily stats record
  const { error } = await supabase
    .from('puppet_daily_stats')
    .upsert({
      user_id,
      stat_date: today,
      connections_sent: updates.connections_sent || 0,
      messages_sent: updates.messages_sent || 0,
      jobs_completed: updates.jobs_completed || 0,
      jobs_failed: updates.jobs_failed || 0,
      jobs_warned: updates.jobs_warned || 0,
      captcha_detections: updates.captcha_detections || 0,
      security_warnings: updates.security_warnings || 0,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,stat_date',
      // Increment existing values instead of replacing
      ignoreDuplicates: false
    });

  if (error) {
    console.error('Failed to update daily stats:', error);
  }
}

/**
 * Endpoint to manually queue a job (for testing or admin use)
 */
export async function queuePuppetJob(req: Request, res: Response) {
  try {
    const { user_id, linkedin_profile_url, message, priority, scheduled_at } = req.body;

    if (!user_id || !linkedin_profile_url) {
      return res.status(400).json({
        success: false,
        error: 'user_id and linkedin_profile_url are required'
      });
    }

    // Validate LinkedIn URL format
    if (!linkedin_profile_url.includes('linkedin.com/in/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid LinkedIn profile URL format'
      });
    }

    // Check if user has Puppet settings configured
    const { data: userSettings, error: settingsError } = await supabase
      .from('puppet_user_settings')
      .select('user_id, li_at_cookie')
      .eq('user_id', user_id)
      .single();

    if (settingsError || !userSettings?.li_at_cookie) {
      return res.status(400).json({
        success: false,
        error: 'User must configure LinkedIn cookie in Puppet settings first'
      });
    }

    // Check rate limits
    try {
      await checkRateLimits(user_id);
    } catch (error) {
      if (error instanceof PuppetRateLimitError) {
        return res.status(429).json({
          success: false,
          error: error.message,
          daily_limit: error.daily_limit,
          current_count: error.current_count
        });
      }
      throw error;
    }

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('puppet_jobs')
      .insert({
        user_id,
        linkedin_profile_url,
        message: message || null,
        priority: priority || 5,
        scheduled_at: scheduled_at || new Date().toISOString(),
        status: 'pending'
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    console.log(`Puppet job queued: ${job.id} for user ${user_id}`);

    res.json({
      success: true,
      job_id: job.id,
      status: job.status,
      message: 'Job queued successfully'
    });

  } catch (error) {
    console.error('Queue job error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 