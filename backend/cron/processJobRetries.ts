#!/usr/bin/env ts-node
/**
 * Job Retry Processor Cron Script
 * 
 * Automatically processes failed jobs that are ready for retry based on
 * exponential backoff schedules. Integrates with the JobRetryService to
 * handle intelligent retry logic and failure management.
 * 
 * Features:
 * - Processes retry_pending jobs based on scheduled retry times
 * - Respects exponential backoff and jitter timing
 * - Integrates with existing LinkedIn automation pipeline
 * - Comprehensive logging and monitoring
 * - Graceful error handling and recovery
 * - Batch processing for optimal performance
 */

import { jobRetryService } from '../services/puppet/jobRetryService';
import { createClient } from '@supabase/supabase-js';
import { PuppetLinkedInAutomation } from '../services/puppet/puppetAutomation';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CronConfig {
  batchSize: number;
  maxConcurrentJobs: number;
  timeoutMinutes: number;
  enableDetailedLogging: boolean;
  enableHealthMonitoring: boolean;
}

class JobRetryCronProcessor {
  private config: CronConfig;
  private isRunning: boolean = false;
  private startTime: number = 0;

  constructor(config: Partial<CronConfig> = {}) {
    this.config = {
      batchSize: parseInt(process.env.RETRY_BATCH_SIZE || '5'),
      maxConcurrentJobs: parseInt(process.env.RETRY_MAX_CONCURRENT || '3'),
      timeoutMinutes: parseInt(process.env.RETRY_TIMEOUT_MINUTES || '30'),
      enableDetailedLogging: process.env.RETRY_DETAILED_LOGGING === 'true',
      enableHealthMonitoring: process.env.RETRY_HEALTH_MONITORING !== 'false',
      ...config
    };
  }

  /**
   * Main cron execution method
   */
  async execute(): Promise<{ success: boolean; processed: number; successful: number; failed: number; message: string }> {
    if (this.isRunning) {
      const message = 'Job retry processor is already running, skipping this execution';
      console.log(`⚠️ [RetryProcessor] ${message}`);
      return { success: false, processed: 0, successful: 0, failed: 0, message };
    }

    this.isRunning = true;
    this.startTime = Date.now();

    try {
      console.log(`🔄 [RetryProcessor] Starting job retry processing at ${new Date().toISOString()}`);
      console.log(`📋 [RetryProcessor] Config: batchSize=${this.config.batchSize}, maxConcurrent=${this.config.maxConcurrentJobs}, timeout=${this.config.timeoutMinutes}min`);

      // Log system health before processing
      if (this.config.enableHealthMonitoring) {
        await this.logSystemHealth('before');
      }

      // Get jobs ready for retry
      const retryJobs = await jobRetryService.getJobsReadyForRetry(this.config.batchSize);
      
      if (retryJobs.length === 0) {
        console.log(`📭 [RetryProcessor] No jobs ready for retry`);
        return { success: true, processed: 0, successful: 0, failed: 0, message: 'No jobs ready for retry' };
      }

      console.log(`📋 [RetryProcessor] Found ${retryJobs.length} jobs ready for retry:`);
      retryJobs.forEach(job => {
        console.log(`   • Job ${job.job_id}: attempt ${job.attempt_number}, delayed ${job.minutes_delayed} minutes`);
      });

      // Process jobs with concurrency control
      const results = await this.processJobsBatch(retryJobs);

      // Log system health after processing
      if (this.config.enableHealthMonitoring) {
        await this.logSystemHealth('after');
      }

      const executionTime = Date.now() - this.startTime;
      const message = `Processed ${results.processed} jobs: ${results.successful} successful, ${results.failed} failed in ${executionTime}ms`;
      
      console.log(`✅ [RetryProcessor] ${message}`);

      return {
        success: true,
        processed: results.processed,
        successful: results.successful,
        failed: results.failed,
        message
      };

    } catch (error) {
      const executionTime = Date.now() - this.startTime;
      const message = `Job retry processing failed after ${executionTime}ms: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      console.error(`❌ [RetryProcessor] ${message}`);
      console.error('Stack trace:', error);

      return {
        success: false,
        processed: 0,
        successful: 0,
        failed: 0,
        message
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process a batch of retry jobs with concurrency control
   */
  private async processJobsBatch(jobs: any[]): Promise<{
    processed: number;
    successful: number;
    failed: number;
    results: Array<{ job_id: string; success: boolean; message: string; duration_ms: number }>;
  }> {
    const results: Array<{ job_id: string; success: boolean; message: string; duration_ms: number }> = [];
    
    // Process jobs in batches to control concurrency
    for (let i = 0; i < jobs.length; i += this.config.maxConcurrentJobs) {
      const batch = jobs.slice(i, i + this.config.maxConcurrentJobs);
      
      console.log(`🔄 [RetryProcessor] Processing batch ${Math.floor(i / this.config.maxConcurrentJobs) + 1} (${batch.length} jobs)`);

      const batchPromises = batch.map(job => this.processRetryJobWithTimeout(job));
      const batchResults = await Promise.allSettled(batchPromises);

      // Process batch results
      batchResults.forEach((result, index) => {
        const job = batch[index];
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`❌ [RetryProcessor] Failed to process job ${job.job_id}:`, result.reason);
          results.push({
            job_id: job.job_id,
            success: false,
            message: `Processing failed: ${result.reason}`,
            duration_ms: 0
          });
        }
      });

      // Add delay between batches to avoid overwhelming the system
      if (i + this.config.maxConcurrentJobs < jobs.length) {
        await this.sleep(1000); // 1 second delay between batches
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    return {
      processed: results.length,
      successful,
      failed,
      results
    };
  }

  /**
   * Process a single retry job with timeout protection
   */
  private async processRetryJobWithTimeout(job: any): Promise<{ job_id: string; success: boolean; message: string; duration_ms: number }> {
    const startTime = Date.now();
    const timeoutMs = this.config.timeoutMinutes * 60 * 1000;

    try {
      console.log(`🚀 [RetryProcessor] Processing job ${job.job_id} (attempt ${job.attempt_number})`);

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Job processing timeout after ${this.config.timeoutMinutes} minutes`)), timeoutMs);
      });

      // Process job with timeout
      const processingPromise = this.executeRetryJob(job);
      const result = await Promise.race([processingPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      
      if (result.success) {
        console.log(`✅ [RetryProcessor] Job ${job.job_id} completed successfully in ${duration}ms`);
      } else {
        console.log(`❌ [RetryProcessor] Job ${job.job_id} failed in ${duration}ms: ${result.message}`);
      }

      return {
        job_id: job.job_id,
        success: result.success,
        message: result.message,
        duration_ms: duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`❌ [RetryProcessor] Job ${job.job_id} failed after ${duration}ms:`, error);

      // Mark job as failed in database
      await this.markJobAsFailed(job.job_id, message);

      return {
        job_id: job.job_id,
        success: false,
        message: `Job execution failed: ${message}`,
        duration_ms: duration
      };
    }
  }

  /**
   * Execute the actual retry job using PuppetLinkedInAutomation
   */
  private async executeRetryJob(job: any): Promise<{ success: boolean; message: string }> {
    try {
      // Get job details from database
      const { data: jobDetails, error: jobError } = await supabase
        .from('puppet_jobs')
        .select('*')
        .eq('id', job.job_id)
        .single();

      if (jobError || !jobDetails) {
        throw new Error(`Failed to fetch job details: ${jobError?.message || 'Job not found'}`);
      }

      // Get user's LinkedIn cookie and settings
      const { data: userSettings, error: settingsError } = await supabase
        .from('puppet_user_settings')
        .select('*')
        .eq('user_id', jobDetails.user_id)
        .single();

      if (settingsError || !userSettings) {
        throw new Error(`Failed to fetch user settings: ${settingsError?.message || 'Settings not found'}`);
      }

      if (!userSettings.li_at_cookie) {
        throw new Error('LinkedIn cookie not configured for user');
      }

      // Create Puppet automation configuration
      const puppetConfig = {
        job_id: jobDetails.id,
        user_id: jobDetails.user_id,
        linkedin_profile_url: jobDetails.linkedin_profile_url,
        message: jobDetails.message,
        li_at_cookie: userSettings.li_at_cookie,
        user_agent: userSettings.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        proxy_config: null, // Will be assigned by proxy health service
        timeout_ms: 60000,
        enable_screenshots: true,
        screenshot_path: '/tmp/retry-screenshots',
        user_settings: userSettings // Include user settings for config compatibility
      };

      // Execute the automation
      console.log(`🎯 [RetryProcessor] Executing LinkedIn automation for ${jobDetails.linkedin_profile_url}`);
      
      const automation = new PuppetLinkedInAutomation(puppetConfig);
      const result = await automation.execute();

      if (result.success) {
        // Update job status to completed
        await supabase
          .from('puppet_jobs')
          .update({
            status: 'completed',
            result_data: result,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', job.job_id);

        return {
          success: true,
          message: `Job completed: connection=${result.connection_sent}, message=${result.message_sent}`
        };
      } else {
        // Job failed, let the retry service handle it
        const retryResult = await jobRetryService.markJobForRetry(
          job.job_id,
          result.error_message || 'Job execution failed'
        );

        return {
          success: false,
          message: `Job failed: ${retryResult.action} (${retryResult.attempts}/${retryResult.max_attempts} attempts)`
        };
      }

    } catch (error) {
      console.error(`❌ [RetryProcessor] Job execution error:`, error);
      
      // Mark job for retry due to execution error
      const retryResult = await jobRetryService.markJobForRetry(
        job.job_id,
        error instanceof Error ? error.message : 'Unknown execution error'
      );

      return {
        success: false,
        message: `Execution error: ${retryResult.action} (${retryResult.attempts}/${retryResult.max_attempts} attempts)`
      };
    }
  }

  /**
   * Mark job as failed in database
   */
  private async markJobAsFailed(jobId: string, failureReason: string): Promise<void> {
    try {
      await supabase
        .from('puppet_jobs')
        .update({
          status: 'failed',
          failure_reason: failureReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
    } catch (error) {
      console.error(`❌ [RetryProcessor] Failed to mark job as failed:`, error);
    }
  }

  /**
   * Log system health metrics
   */
  private async logSystemHealth(phase: 'before' | 'after'): Promise<void> {
    try {
      const dashboard = await jobRetryService.getFailureDashboard();
      if (dashboard) {
        console.log(`📊 [RetryProcessor] System health ${phase} processing:`);
        console.log(`   • Status: ${dashboard.system_health_status}`);
        console.log(`   • Pending retry: ${dashboard.pending_retry}`);
        console.log(`   • Failures (1h): ${dashboard.failures_last_hour}`);
        console.log(`   • Retry success rate: ${dashboard.retry_success_rate_percent}%`);
      }
    } catch (error) {
      console.error(`❌ [RetryProcessor] Failed to log system health:`, error);
    }
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Main execution function for cron
 */
async function main() {
  console.log(`🔄 [RetryProcessor] Job Retry Processor starting at ${new Date().toISOString()}`);
  
  const processor = new JobRetryCronProcessor();
  const result = await processor.execute();

  // Log execution summary
  console.log(`📋 [RetryProcessor] Execution Summary:`);
  console.log(`   • Success: ${result.success}`);
  console.log(`   • Processed: ${result.processed} jobs`);
  console.log(`   • Successful: ${result.successful} jobs`);
  console.log(`   • Failed: ${result.failed} jobs`);
  console.log(`   • Message: ${result.message}`);

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Export for testing
export { JobRetryCronProcessor };

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ [RetryProcessor] Fatal error:', error);
    process.exit(1);
  });
} 