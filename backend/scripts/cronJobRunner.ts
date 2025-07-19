#!/usr/bin/env ts-node
/**
 * Railway CRON Job Runner for Puppet LinkedIn Automation (Prompt 5)
 * 
 * A production-ready TypeScript script that:
 * 1. Queries Supabase for pending puppet_jobs with scheduled_at <= now()
 * 2. Processes each job using connectToLinkedInProfile()
 * 3. Updates job statuses (pending -> running -> completed/failed/warning)
 * 4. Enforces concurrency limits (1 job per user)
 * 5. Limits total jobs per run (10 max)
 * 6. Adds safety delays between job launches
 * 
 * Designed for Railway deployment with environment-based configuration
 */

import { createClient } from '@supabase/supabase-js';
import { connectToLinkedInProfile } from '../services/puppet/connectToLinkedInProfile';
import { 
  PuppetJob, 
  PuppetJobStatus, 
  PuppetJobResult,
  PuppetExecutionConfig,
  PUPPET_CONSTANTS 
} from '../types/puppet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration constants
const CRON_CONFIG = {
  MAX_JOBS_PER_RUN: 10,
  CONCURRENT_JOBS_PER_USER: 1,
  JOB_DELAY_MS: 1000, // 1 second delay between job launches
  JOB_TIMEOUT_MS: 120000, // 2 minutes per job timeout
  HEALTH_CHECK_TIMEOUT_MS: 5000,
  LOG_PREFIX: '[PuppetCron]'
} as const;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Track running jobs per user for concurrency control
const runningJobsByUser = new Map<string, Set<string>>();

/**
 * Main CRON job execution function
 */
async function runCronJob(): Promise<void> {
  const runId = `run-${Date.now()}`;
  const startTime = Date.now();

  console.log(`${CRON_CONFIG.LOG_PREFIX} [${runId}] Starting job runner...`);
  console.log(`${CRON_CONFIG.LOG_PREFIX} Max jobs per run: ${CRON_CONFIG.MAX_JOBS_PER_RUN}`);
  console.log(`${CRON_CONFIG.LOG_PREFIX} Job delay: ${CRON_CONFIG.JOB_DELAY_MS}ms`);
  console.log('');

  try {
    // 1. Health check
    await performHealthCheck();

    // 2. Get pending jobs
    const pendingJobs = await getPendingJobs();
    
    if (pendingJobs.length === 0) {
      console.log(`${CRON_CONFIG.LOG_PREFIX} [${runId}] No pending jobs found`);
      return;
    }

    console.log(`${CRON_CONFIG.LOG_PREFIX} [${runId}] Found ${pendingJobs.length} pending jobs`);

    // 3. Filter jobs for concurrency limits
    const eligibleJobs = filterJobsForConcurrency(pendingJobs);
    console.log(`${CRON_CONFIG.LOG_PREFIX} [${runId}] ${eligibleJobs.length} jobs eligible after concurrency filtering`);

    // 4. Limit to max jobs per run
    const jobsToProcess = eligibleJobs.slice(0, CRON_CONFIG.MAX_JOBS_PER_RUN);
    
    if (jobsToProcess.length < eligibleJobs.length) {
      console.log(`${CRON_CONFIG.LOG_PREFIX} [${runId}] Limited to ${jobsToProcess.length} jobs (max per run: ${CRON_CONFIG.MAX_JOBS_PER_RUN})`);
    }

    // 5. Process jobs sequentially with delays
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let warningCount = 0;

    for (const job of jobsToProcess) {
      try {
        console.log(`${CRON_CONFIG.LOG_PREFIX} [${runId}] Processing job ${job.id} for user ${job.user_id}`);
        console.log(`${CRON_CONFIG.LOG_PREFIX} [${runId}] Profile: ${job.linkedin_profile_url}`);

        // Mark user as having a running job
        addRunningJob(job.user_id, job.id);

        // Process the job
        const result = await processJob(job, runId);

        // Remove from running jobs
        removeRunningJob(job.user_id, job.id);

        // Count results
        if (result.success) {
          successCount++;
        } else if (result.detection_type) {
          warningCount++;
        } else {
          failedCount++;
        }

        processedCount++;
        console.log(`${CRON_CONFIG.LOG_PREFIX} [${runId}] Job ${job.id} completed with status: ${result.success ? 'success' : 'failed'}`);

        // Delay between jobs (except for last job)
        if (processedCount < jobsToProcess.length) {
          console.log(`${CRON_CONFIG.LOG_PREFIX} [${runId}] Waiting ${CRON_CONFIG.JOB_DELAY_MS}ms before next job...`);
          await delay(CRON_CONFIG.JOB_DELAY_MS);
        }

      } catch (error) {
        console.error(`${CRON_CONFIG.LOG_PREFIX} [${runId}] Job ${job.id} failed with error:`, error);
        
        // Remove from running jobs on error
        removeRunningJob(job.user_id, job.id);
        
        // Update job status to failed
        await updateJobStatus(job.id, 'failed', {
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString()
        });

        failedCount++;
        processedCount++;
      }
    }

    const executionTime = Date.now() - startTime;
    console.log('');
    console.log(`${CRON_CONFIG.LOG_PREFIX} [${runId}] Job run completed`);
    console.log(`${CRON_CONFIG.LOG_PREFIX} [${runId}] Processed: ${processedCount}/${jobsToProcess.length}`);
    console.log(`${CRON_CONFIG.LOG_PREFIX} [${runId}] Success: ${successCount}, Failed: ${failedCount}, Warnings: ${warningCount}`);
    console.log(`${CRON_CONFIG.LOG_PREFIX} [${runId}] Total execution time: ${executionTime}ms`);

  } catch (error) {
    console.error(`${CRON_CONFIG.LOG_PREFIX} [${runId}] CRON job failed:`, error);
    throw error;
  } finally {
    // Clear all running jobs tracking
    runningJobsByUser.clear();
  }
}

/**
 * Perform health check to ensure system is ready
 */
async function performHealthCheck(): Promise<void> {
  const healthCheckTimeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Health check timeout')), CRON_CONFIG.HEALTH_CHECK_TIMEOUT_MS);
  });

  try {
    const healthCheckPromise = supabase
      .from('puppet_jobs')
      .select('count')
      .limit(1);

    await Promise.race([healthCheckPromise, healthCheckTimeout]);
    console.log(`${CRON_CONFIG.LOG_PREFIX} Health check passed - Supabase connection OK`);
  } catch (error) {
    console.error(`${CRON_CONFIG.LOG_PREFIX} Health check failed:`, error);
    throw new Error('System health check failed');
  }
}

/**
 * Get pending jobs from Supabase that are ready to run
 */
async function getPendingJobs(): Promise<PuppetJob[]> {
  const { data: jobs, error } = await supabase
    .from('puppet_jobs')
    .select(`
      *,
      puppet_user_settings!inner(
        user_id,
        auto_mode_enabled,
        li_at_cookie,
        daily_connection_limit
      )
    `)
    .eq('status', 'pending')
    .eq('puppet_user_settings.auto_mode_enabled', true)
    .not('puppet_user_settings.li_at_cookie', 'is', null)
    .lte('scheduled_at', new Date().toISOString())
    .order('priority', { ascending: false }) // Higher priority first
    .order('created_at', { ascending: true }) // Older jobs first within same priority
    .limit(50); // Get more than we need for filtering

  if (error) {
    throw new Error(`Failed to fetch pending jobs: ${error.message}`);
  }

  return jobs || [];
}

/**
 * Filter jobs to respect concurrency limits (1 job per user)
 */
function filterJobsForConcurrency(jobs: PuppetJob[]): PuppetJob[] {
  const eligibleJobs: PuppetJob[] = [];
  const usersWithJobs = new Set<string>();

  for (const job of jobs) {
    // Skip if user already has a running job
    if (runningJobsByUser.has(job.user_id) || usersWithJobs.has(job.user_id)) {
      console.log(`${CRON_CONFIG.LOG_PREFIX} Skipping job ${job.id} - user ${job.user_id} already has running job`);
      continue;
    }

    eligibleJobs.push(job);
    usersWithJobs.add(job.user_id);
  }

  return eligibleJobs;
}

/**
 * Process a single job
 */
async function processJob(job: PuppetJob, runId: string): Promise<PuppetJobResult> {
  const jobStartTime = Date.now();

  try {
    // 1. Update job status to running
    await updateJobStatus(job.id, 'running', {
      started_at: new Date().toISOString(),
      retry_count: job.retry_count + 1
    });

    console.log(`${CRON_CONFIG.LOG_PREFIX} [${runId}] Job ${job.id} marked as running (attempt ${job.retry_count + 1})`);

    // 2. Build execution configuration
    const config = await buildExecutionConfig(job);

    // 3. Execute LinkedIn automation with timeout
    const jobPromise = connectToLinkedInProfile({
      li_at: config.li_at_cookie,
      profile_url: config.linkedin_profile_url,
      note: config.message,
      proxy: config.proxy_config ? {
        endpoint: `${config.proxy_config.proxy_endpoint}:${config.proxy_config.proxy_port}`,
        username: config.proxy_config.proxy_username,
        password: config.proxy_config.proxy_password,
        type: 'residential',
        location: config.proxy_config.proxy_location
      } : undefined,
      user_id: config.user_id,
      job_id: config.job_id,
      headless: true
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Job execution timeout')), CRON_CONFIG.JOB_TIMEOUT_MS);
    });

    const automationResult = await Promise.race([jobPromise, timeoutPromise]);

    const executionTime = Date.now() - jobStartTime;
    console.log(`${CRON_CONFIG.LOG_PREFIX} [${runId}] Job ${job.id} automation completed in ${executionTime}ms`);

    // 4. Process results and update job status
    const result = await processJobResult(job, automationResult, executionTime);

    return result;

  } catch (error) {
    const executionTime = Date.now() - jobStartTime;
    console.error(`${CRON_CONFIG.LOG_PREFIX} [${runId}] Job ${job.id} execution failed:`, error);

    // Update job status to failed
    await updateJobStatus(job.id, 'failed', {
      error_message: error instanceof Error ? error.message : 'Unknown execution error',
      completed_at: new Date().toISOString()
    });

    return {
      success: false,
      connection_sent: false,
      message_sent: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      execution_time_ms: executionTime,
      page_url: job.linkedin_profile_url
    };
  }
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
    throw new Error(`User Puppet settings not found for user ${job.user_id}`);
  }

  // Decrypt LinkedIn cookie
  const { data: cookieResult, error: cookieError } = await supabase
    .rpc('decrypt_li_at_cookie', {
      encrypted_cookie: userSettings.li_at_cookie,
      user_id: job.user_id
    });

  if (cookieError || !cookieResult) {
    throw new Error(`Failed to decrypt LinkedIn cookie for user ${job.user_id}`);
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
    li_at_cookie: cookieResult,
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
 * Process job automation result and update database
 */
async function processJobResult(job: PuppetJob, automationResult: any, executionTime: number): Promise<PuppetJobResult> {
  const result: PuppetJobResult = {
    success: false,
    connection_sent: false,
    message_sent: false,
    execution_time_ms: executionTime,
    page_url: job.linkedin_profile_url
  };

  try {
    // Determine job status based on automation result
    let jobStatus: PuppetJobStatus = 'failed';
    let detectionType = undefined;
    let screenshotUrl = undefined;

    if (automationResult.status === 'success') {
      jobStatus = 'completed';
      result.success = true;
      result.connection_sent = true;
      result.message_sent = !!automationResult.page_state?.message_sent;
    } else if (automationResult.status === 'rate_limited') {
      jobStatus = 'rate_limited';
      result.error_message = automationResult.reason;
    } else if (['captcha_detected', 'security_checkpoint'].includes(automationResult.status)) {
      jobStatus = 'warning';
      detectionType = automationResult.status === 'captcha_detected' ? 'captcha' : 'security_checkpoint';
      screenshotUrl = automationResult.page_state?.screenshot_url;
      result.detection_type = detectionType;
      result.screenshot_url = screenshotUrl;
    } else {
      jobStatus = 'failed';
      result.error_message = automationResult.reason || 'Job execution failed';
    }

    // Update job in database
    await updateJobStatus(job.id, jobStatus, {
      completed_at: new Date().toISOString(),
      result_data: automationResult,
      error_message: result.error_message,
      detection_type: detectionType,
      screenshot_url: screenshotUrl
    });

    // Update daily statistics
    await updateDailyStats(job.user_id, {
      connections_sent: result.connection_sent ? 1 : 0,
      messages_sent: result.message_sent ? 1 : 0,
      jobs_completed: result.success ? 1 : 0,
      jobs_failed: !result.success && !result.detection_type ? 1 : 0,
      jobs_warned: result.detection_type ? 1 : 0,
      captcha_detections: detectionType === 'captcha' ? 1 : 0,
      security_warnings: result.detection_type ? 1 : 0
    });

    console.log(`${CRON_CONFIG.LOG_PREFIX} Job ${job.id} updated to status: ${jobStatus}`);

    return result;

  } catch (error) {
    console.error(`${CRON_CONFIG.LOG_PREFIX} Failed to process job result for ${job.id}:`, error);
    
    // Fallback - mark as failed
    await updateJobStatus(job.id, 'failed', {
      completed_at: new Date().toISOString(),
      error_message: `Result processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    result.error_message = 'Failed to process job result';
    return result;
  }
}

/**
 * Update job status in database
 */
async function updateJobStatus(jobId: string, status: PuppetJobStatus, updates: Record<string, any> = {}): Promise<void> {
  const { error } = await supabase
    .from('puppet_jobs')
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...updates
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update job ${jobId} status: ${error.message}`);
  }
}

/**
 * Update daily statistics for a user
 */
async function updateDailyStats(user_id: string, updates: Record<string, number>): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  try {
    // Get current stats
    const { data: currentStats } = await supabase
      .from('puppet_daily_stats')
      .select('*')
      .eq('user_id', user_id)
      .eq('stat_date', today)
      .single();

    // Prepare incremental updates
    const statsUpdate = {
      user_id,
      stat_date: today,
      connections_sent: (currentStats?.connections_sent || 0) + (updates.connections_sent || 0),
      messages_sent: (currentStats?.messages_sent || 0) + (updates.messages_sent || 0),
      jobs_completed: (currentStats?.jobs_completed || 0) + (updates.jobs_completed || 0),
      jobs_failed: (currentStats?.jobs_failed || 0) + (updates.jobs_failed || 0),
      jobs_warned: (currentStats?.jobs_warned || 0) + (updates.jobs_warned || 0),
      captcha_detections: (currentStats?.captcha_detections || 0) + (updates.captcha_detections || 0),
      security_warnings: (currentStats?.security_warnings || 0) + (updates.security_warnings || 0),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('puppet_daily_stats')
      .upsert(statsUpdate, {
        onConflict: 'user_id,stat_date'
      });

    if (error) {
      console.error(`Failed to update daily stats for user ${user_id}:`, error);
    }
  } catch (error) {
    console.error(`Daily stats update error for user ${user_id}:`, error);
  }
}

/**
 * Concurrency control helpers
 */
function addRunningJob(userId: string, jobId: string): void {
  if (!runningJobsByUser.has(userId)) {
    runningJobsByUser.set(userId, new Set());
  }
  runningJobsByUser.get(userId)!.add(jobId);
}

function removeRunningJob(userId: string, jobId: string): void {
  const userJobs = runningJobsByUser.get(userId);
  if (userJobs) {
    userJobs.delete(jobId);
    if (userJobs.size === 0) {
      runningJobsByUser.delete(userId);
    }
  }
}

/**
 * Utility delay function
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Signal handlers for graceful shutdown
 */
function setupSignalHandlers(): void {
  const signals = ['SIGTERM', 'SIGINT'];
  
  signals.forEach(signal => {
    process.on(signal, async () => {
      console.log(`${CRON_CONFIG.LOG_PREFIX} Received ${signal}, shutting down gracefully...`);
      
      // Clear running jobs tracking
      runningJobsByUser.clear();
      
      console.log(`${CRON_CONFIG.LOG_PREFIX} Shutdown complete`);
      process.exit(0);
    });
  });
}

/**
 * Main execution when run directly
 */
async function main(): Promise<void> {
  // Environment validation
  const requiredEnvVars = [
    'SUPABASE_URL', 
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length > 0) {
    console.error(`${CRON_CONFIG.LOG_PREFIX} Missing required environment variables:`, missingEnvVars);
    process.exit(1);
  }

  console.log(`${CRON_CONFIG.LOG_PREFIX} Starting Railway CRON Job Runner`);
  console.log(`${CRON_CONFIG.LOG_PREFIX} Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`${CRON_CONFIG.LOG_PREFIX} Supabase URL: ${process.env.SUPABASE_URL}`);
  console.log('');

  // Setup signal handlers
  setupSignalHandlers();

  try {
    await runCronJob();
    console.log(`${CRON_CONFIG.LOG_PREFIX} CRON job completed successfully`);
    process.exit(0);
  } catch (error) {
    console.error(`${CRON_CONFIG.LOG_PREFIX} CRON job failed:`, error);
    process.exit(1);
  }
}

// Export for testing
export { 
  runCronJob, 
  getPendingJobs, 
  processJob, 
  buildExecutionConfig,
  CRON_CONFIG 
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
} 