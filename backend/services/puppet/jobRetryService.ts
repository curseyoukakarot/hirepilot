/**
 * Job Retry Management Service
 * 
 * Handles intelligent retry logic for failed LinkedIn automation jobs with
 * exponential backoff, configurable retry policies, and comprehensive failure
 * analysis. Integrates with cron systems for automated retry processing.
 * 
 * Features:
 * - Exponential backoff with jitter to prevent thundering herd
 * - Configurable retry policies per job type and error type
 * - Comprehensive failure tracking and analysis
 * - Integration with existing warm-up and deduplication systems
 * - Admin dashboard for monitoring retry health
 * - Automatic escalation for persistent failures
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Type definitions
export type RetryStrategy = 'exponential' | 'linear' | 'fixed';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retry_pending' | 'permanently_failed' | 'cancelled';

export interface RetryableJob {
  job_id: string;
  user_id: string;
  linkedin_profile_url: string;
  message?: string;
  attempt_number: number;
  failure_reason?: string;
  scheduled_retry_time: string;
  minutes_delayed: number;
}

export interface RetryConfig {
  id: string;
  config_name: string;
  is_active: boolean;
  priority: number;
  applies_to_job_types?: string[];
  applies_to_error_types?: string[];
  applies_to_user_types?: string[];
  max_attempts: number;
  retry_strategy: RetryStrategy;
  base_delay_minutes: number;
  max_delay_hours: number;
  jitter_enabled: boolean;
  retry_on_security_detection: boolean;
  retry_on_captcha: boolean;
  retry_on_network_error: boolean;
  retry_on_rate_limit: boolean;
  retry_on_proxy_error: boolean;
  retry_on_unknown_error: boolean;
  escalate_after_attempts: number;
  escalate_to_admin: boolean;
  send_user_notification: boolean;
  created_at: string;
  updated_at: string;
}

export interface RetryHistory {
  id: string;
  job_id: string;
  user_id: string;
  attempt_number: number;
  status: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  was_successful: boolean;
  failure_reason?: string;
  error_details?: any;
  retry_trigger: string;
  backoff_delay_minutes?: number;
  next_retry_scheduled_at?: string;
  created_at: string;
}

export interface FailureDashboard {
  failures_last_hour: number;
  failures_last_24h: number;
  failures_last_week: number;
  currently_failed: number;
  pending_retry: number;
  permanently_failed: number;
  retry_success_rate_percent: number;
  avg_attempts_to_success: number;
  avg_attempts_to_permanent_failure: number;
  most_common_failure_reason?: string;
  avg_retry_delay_minutes: number;
  system_health_status: 'Healthy' | 'Warning' | 'Critical';
  dashboard_updated_at: string;
}

export interface RetryResult {
  success: boolean;
  action: 'scheduled_for_retry' | 'permanently_failed' | 'no_action_needed';
  attempts: number;
  max_attempts: number;
  next_retry_at?: string;
  delay_minutes?: number;
  failure_reason?: string;
  error?: string;
}

/**
 * Main service class for job retry management
 */
export class JobRetryService {

  /**
   * Mark a job for retry or permanent failure based on retry policy
   */
  async markJobForRetry(
    jobId: string,
    failureReason: string,
    errorDetails?: any
  ): Promise<RetryResult> {
    try {
      console.log(`🔄 [JobRetry] Marking job ${jobId} for retry: ${failureReason}`);

      // Use database function to handle retry logic
      const { data, error } = await supabase.rpc('mark_job_for_retry', {
        p_job_id: jobId,
        p_failure_reason: failureReason,
        p_error_details: errorDetails
      });

      if (error) {
        throw new Error(`Failed to mark job for retry: ${error.message}`);
      }

      const result = data as RetryResult;
      
      if (result.action === 'scheduled_for_retry') {
        console.log(`⏰ [JobRetry] Job ${jobId} scheduled for retry ${result.attempts}/${result.max_attempts} in ${result.delay_minutes} minutes`);
      } else if (result.action === 'permanently_failed') {
        console.log(`❌ [JobRetry] Job ${jobId} permanently failed after ${result.attempts} attempts`);
      }

      return result;

    } catch (error) {
      console.error(`❌ [JobRetry] Failed to mark job for retry:`, error);
      return {
        success: false,
        action: 'no_action_needed',
        attempts: 0,
        max_attempts: 3,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get jobs ready for retry processing
   */
  async getJobsReadyForRetry(limit: number = 10): Promise<RetryableJob[]> {
    try {
      console.log(`🔍 [JobRetry] Fetching up to ${limit} jobs ready for retry`);

      const { data, error } = await supabase.rpc('get_jobs_ready_for_retry', {
        p_limit: limit
      });

      if (error) {
        throw new Error(`Failed to get retry jobs: ${error.message}`);
      }

      const jobs = (data || []) as RetryableJob[];
      console.log(`📋 [JobRetry] Found ${jobs.length} jobs ready for retry`);

      return jobs;

    } catch (error) {
      console.error(`❌ [JobRetry] Failed to get retry jobs:`, error);
      return [];
    }
  }

  /**
   * Process a single retry job
   */
  async processRetryJob(job: RetryableJob): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🚀 [JobRetry] Processing retry job ${job.job_id} (attempt ${job.attempt_number})`);

      // Update job status to running
      await this.updateJobStatus(job.job_id, 'running');

      // Record retry attempt start
      const retryHistoryId = await this.recordRetryAttempt(
        job.job_id,
        job.user_id,
        job.attempt_number,
        'started',
        'cron'
      );

      // Here we would integrate with the existing PuppetLinkedInAutomation
      // For now, we'll simulate the job processing
      const processingResult = await this.executeJobRetry(job);

      // Update retry history with result
      await this.updateRetryAttempt(
        retryHistoryId,
        processingResult.success ? 'completed' : 'failed',
        processingResult.success,
        processingResult.failure_reason,
        processingResult.duration_ms
      );

      if (processingResult.success) {
        // Mark job as completed
        await this.updateJobStatus(job.job_id, 'completed');
        console.log(`✅ [JobRetry] Retry job ${job.job_id} completed successfully`);
        
        return {
          success: true,
          message: `Job ${job.job_id} completed successfully on retry attempt ${job.attempt_number}`
        };
      } else {
        // Job failed again, mark for further retry or permanent failure
        const retryResult = await this.markJobForRetry(
          job.job_id,
          processingResult.failure_reason || 'Retry attempt failed'
        );

        console.log(`🔄 [JobRetry] Retry job ${job.job_id} failed: ${retryResult.action}`);
        
        return {
          success: false,
          message: `Job ${job.job_id} failed on retry: ${retryResult.action}`
        };
      }

    } catch (error) {
      console.error(`❌ [JobRetry] Failed to process retry job ${job.job_id}:`, error);
      
      // Mark job as failed
      await this.updateJobStatus(job.job_id, 'failed');
      
      return {
        success: false,
        message: `Failed to process retry job: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Process all jobs ready for retry (called by cron)
   */
  async processRetryQueue(batchSize: number = 5): Promise<{
    processed: number;
    successful: number;
    failed: number;
    results: Array<{ job_id: string; success: boolean; message: string }>;
  }> {
    try {
      console.log(`🔄 [JobRetry] Starting retry queue processing (batch size: ${batchSize})`);

      const retryJobs = await this.getJobsReadyForRetry(batchSize);
      
      if (retryJobs.length === 0) {
        console.log(`📭 [JobRetry] No jobs ready for retry`);
        return { processed: 0, successful: 0, failed: 0, results: [] };
      }

      const results = await Promise.all(
        retryJobs.map(async (job) => {
          const result = await this.processRetryJob(job);
          return {
            job_id: job.job_id,
            success: result.success,
            message: result.message
          };
        })
      );

      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      console.log(`✅ [JobRetry] Retry queue processing complete: ${successful} successful, ${failed} failed`);

      return {
        processed: results.length,
        successful,
        failed,
        results
      };

    } catch (error) {
      console.error(`❌ [JobRetry] Failed to process retry queue:`, error);
      return { processed: 0, successful: 0, failed: 0, results: [] };
    }
  }

  /**
   * Get failure dashboard statistics
   */
  async getFailureDashboard(): Promise<FailureDashboard | null> {
    try {
      const { data, error } = await supabase
        .from('job_failure_dashboard')
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to get failure dashboard: ${error.message}`);
      }

      return data as FailureDashboard;

    } catch (error) {
      console.error(`❌ [JobRetry] Failed to get failure dashboard:`, error);
      return null;
    }
  }

  /**
   * Get retry history for a job
   */
  async getJobRetryHistory(jobId: string): Promise<RetryHistory[]> {
    try {
      const { data, error } = await supabase
        .from('puppet_job_retry_history')
        .select('*')
        .eq('job_id', jobId)
        .order('attempt_number', { ascending: true });

      if (error) {
        throw new Error(`Failed to get retry history: ${error.message}`);
      }

      return (data || []) as RetryHistory[];

    } catch (error) {
      console.error(`❌ [JobRetry] Failed to get retry history:`, error);
      return [];
    }
  }

  /**
   * Get or create retry configuration
   */
  async getRetryConfig(
    jobType: string = 'linkedin_connection',
    errorType?: string,
    userType?: string
  ): Promise<RetryConfig | null> {
    try {
      const { data, error } = await supabase
        .from('puppet_job_retry_config')
        .select('*')
        .eq('is_active', true)
        .or(`applies_to_job_types.cs.{${jobType}},applies_to_job_types.is.null`)
        .order('priority', { ascending: false })
        .limit(1);

      if (error) {
        throw new Error(`Failed to get retry config: ${error.message}`);
      }

      return data?.[0] as RetryConfig || null;

    } catch (error) {
      console.error(`❌ [JobRetry] Failed to get retry config:`, error);
      return null;
    }
  }

  /**
   * Create or update retry configuration
   */
  async upsertRetryConfig(config: Partial<RetryConfig>): Promise<{ success: boolean; config_id?: string; message: string }> {
    try {
      console.log(`⚙️ [JobRetry] Upserting retry config: ${config.config_name}`);

      const { data, error } = await supabase
        .from('puppet_job_retry_config')
        .upsert({
          ...config,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to upsert retry config: ${error.message}`);
      }

      console.log(`✅ [JobRetry] Retry config upserted: ${data.id}`);

      return {
        success: true,
        config_id: data.id,
        message: `Retry config saved successfully: ${config.config_name}`
      };

    } catch (error) {
      console.error(`❌ [JobRetry] Failed to upsert retry config:`, error);
      return {
        success: false,
        message: `Failed to save retry config: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Calculate next retry time with strategy and jitter
   */
  calculateNextRetryTime(
    attempts: number,
    strategy: RetryStrategy = 'exponential',
    baseDelayMinutes: number = 120,
    maxDelayHours: number = 24,
    enableJitter: boolean = true
  ): Date {
    let delayMinutes: number;

    // Calculate base delay based on strategy
    switch (strategy) {
      case 'exponential':
        delayMinutes = baseDelayMinutes * Math.pow(2, attempts);
        break;
      case 'linear':
        delayMinutes = baseDelayMinutes * (attempts + 1);
        break;
      case 'fixed':
        delayMinutes = baseDelayMinutes;
        break;
      default:
        delayMinutes = baseDelayMinutes;
    }

    // Apply maximum delay cap
    const maxDelayMinutes = maxDelayHours * 60;
    delayMinutes = Math.min(delayMinutes, maxDelayMinutes);

    // Add jitter to prevent thundering herd
    if (enableJitter) {
      const jitterMinutes = Math.floor(Math.random() * (delayMinutes * 0.1)); // 10% jitter
      delayMinutes += jitterMinutes;
    }

    // Return next retry time
    return new Date(Date.now() + delayMinutes * 60 * 1000);
  }

  /**
   * Private method to execute job retry (placeholder for actual job execution)
   */
  private async executeJobRetry(job: RetryableJob): Promise<{
    success: boolean;
    failure_reason?: string;
    duration_ms: number;
  }> {
    const startTime = Date.now();

    try {
      // Here we would integrate with the existing PuppetLinkedInAutomation class
      // For testing purposes, we'll simulate job execution
      console.log(`🎯 [JobRetry] Executing retry for LinkedIn profile: ${job.linkedin_profile_url}`);

      // Simulate job processing delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      // Simulate success/failure based on attempt number (higher attempts have higher success rate)
      const successProbability = Math.min(0.3 + (job.attempt_number * 0.2), 0.9);
      const isSuccessful = Math.random() < successProbability;

      const duration = Date.now() - startTime;

      if (isSuccessful) {
        console.log(`✅ [JobRetry] Simulated job execution successful in ${duration}ms`);
        return { success: true, duration_ms: duration };
      } else {
        const failureReasons = [
          'Network timeout',
          'CAPTCHA detected',
          'Rate limit exceeded',
          'Proxy error',
          'LinkedIn security detection'
        ];
        const failureReason = failureReasons[Math.floor(Math.random() * failureReasons.length)];
        
        console.log(`❌ [JobRetry] Simulated job execution failed: ${failureReason}`);
        return { success: false, failure_reason: failureReason, duration_ms: duration };
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        failure_reason: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: duration
      };
    }
  }

  /**
   * Private method to update job status
   */
  private async updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
    try {
      const { error } = await supabase
        .from('puppet_jobs')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) {
        throw new Error(`Failed to update job status: ${error.message}`);
      }

    } catch (error) {
      console.error(`❌ [JobRetry] Failed to update job status:`, error);
    }
  }

  /**
   * Private method to record retry attempt
   */
  private async recordRetryAttempt(
    jobId: string,
    userId: string,
    attemptNumber: number,
    status: string,
    retryTrigger: string
  ): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('puppet_job_retry_history')
        .insert({
          job_id: jobId,
          user_id: userId,
          attempt_number: attemptNumber,
          status: status,
          retry_trigger: retryTrigger,
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to record retry attempt: ${error.message}`);
      }

      return data.id;

    } catch (error) {
      console.error(`❌ [JobRetry] Failed to record retry attempt:`, error);
      return '';
    }
  }

  /**
   * Private method to update retry attempt result
   */
  private async updateRetryAttempt(
    retryHistoryId: string,
    status: string,
    wasSuccessful: boolean,
    failureReason?: string,
    durationMs?: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('puppet_job_retry_history')
        .update({
          status: status,
          completed_at: new Date().toISOString(),
          was_successful: wasSuccessful,
          failure_reason: failureReason,
          duration_ms: durationMs
        })
        .eq('id', retryHistoryId);

      if (error) {
        throw new Error(`Failed to update retry attempt: ${error.message}`);
      }

    } catch (error) {
      console.error(`❌ [JobRetry] Failed to update retry attempt:`, error);
    }
  }
}

/**
 * Export singleton instance
 */
export const jobRetryService = new JobRetryService(); 