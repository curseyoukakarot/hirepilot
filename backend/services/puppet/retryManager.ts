/**
 * RetryManager - Implements intelligent retry logic with exponential backoff
 * Handles automatic retry scheduling, failure escalation, and retry configuration
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface RetryConfig {
  jobType: string;
  maxRetries: number;
  baseDelaySeconds: number;
  backoffMultiplier: number;
  maxDelaySeconds: number;
  jitterEnabled: boolean;
  maxJitterSeconds: number;
  escalationEnabled: boolean;
  escalationThreshold: number;
  retryOnErrorTypes: string[];
  doNotRetryOn: string[];
  enabled: boolean;
}

export interface RetryAttempt {
  jobId: string;
  attemptNumber: number;
  attemptedAt: Date;
  errorMessage: string;
  errorType: string;
  success: boolean;
  delaySeconds: number;
  backoffMultiplier: number;
  jitterSeconds: number;
  retryReason: string;
  executorId: string;
}

export interface JobRetryInfo {
  jobId: string;
  userId: string;
  jobType: string;
  retryCount: number;
  nextRetryAt: Date | null;
  lastError: string | null;
  finalStatus: string;
  retryEnabled: boolean;
  maxRetries: number;
}

export interface RetryStats {
  totalJobsWithRetries: number;
  averageRetryCount: number;
  successfulAfterRetry: number;
  permanentlyFailed: number;
  pendingRetry: number;
  retrySuccessRate: number;
  topErrorTypes: Array<{ errorType: string; count: number }>;
}

export class RetryManager {
  private executorId: string;
  private defaultConfig: Partial<RetryConfig>;

  constructor(executorId: string, defaultConfig: Partial<RetryConfig> = {}) {
    this.executorId = executorId;
    this.defaultConfig = {
      maxRetries: 5,
      baseDelaySeconds: 7200, // 2 hours
      backoffMultiplier: 2.0,
      maxDelaySeconds: 86400, // 24 hours
      jitterEnabled: true,
      maxJitterSeconds: 300, // 5 minutes
      escalationEnabled: true,
      escalationThreshold: 3,
      retryOnErrorTypes: ['timeout', 'network', 'rate_limit', 'temporary_error'],
      doNotRetryOn: ['authentication', 'permission', 'validation_error'],
      enabled: true,
      ...defaultConfig
    };
  }

  /**
   * Get retry configuration for a specific job type
   */
  async getRetryConfig(jobType: string): Promise<RetryConfig | null> {
    try {
      const { data, error } = await supabase.rpc('get_retry_config', {
        p_job_type: jobType
      });

      if (error) {
        console.error('Error getting retry config:', error);
        return null;
      }

      if (!data) {
        // Return default config if no specific config found
        return {
          jobType: 'default',
          ...this.defaultConfig
        } as RetryConfig;
      }

      return {
        jobType: data.job_type,
        maxRetries: data.max_retries,
        baseDelaySeconds: data.base_delay_seconds,
        backoffMultiplier: data.backoff_multiplier,
        maxDelaySeconds: data.max_delay_seconds,
        jitterEnabled: data.jitter_enabled,
        maxJitterSeconds: data.max_jitter_seconds,
        escalationEnabled: data.escalation_enabled,
        escalationThreshold: data.escalation_threshold,
        retryOnErrorTypes: data.retry_on_error_types || [],
        doNotRetryOn: data.do_not_retry_on || [],
        enabled: data.enabled
      };
    } catch (error) {
      console.error('Error in getRetryConfig:', error);
      return null;
    }
  }

  /**
   * Calculate next retry delay with exponential backoff and jitter
   */
  calculateRetryDelay(
    retryCount: number,
    config: RetryConfig
  ): { delaySeconds: number; jitterSeconds: number } {
    // Calculate exponential backoff
    let delaySeconds = config.baseDelaySeconds * Math.pow(config.backoffMultiplier, retryCount);
    
    // Cap at maximum delay
    delaySeconds = Math.min(delaySeconds, config.maxDelaySeconds);
    
    // Add jitter to avoid thundering herd
    let jitterSeconds = 0;
    if (config.jitterEnabled) {
      jitterSeconds = Math.floor(Math.random() * config.maxJitterSeconds);
      delaySeconds += jitterSeconds;
    }
    
    return {
      delaySeconds: Math.floor(delaySeconds),
      jitterSeconds
    };
  }

  /**
   * Determine if a job should be retried based on error type and configuration
   */
  shouldRetryJob(
    jobRetryInfo: JobRetryInfo,
    errorType: string,
    config: RetryConfig
  ): boolean {
    // Check if retry is globally enabled
    if (!config.enabled || !jobRetryInfo.retryEnabled) {
      return false;
    }

    // Check if we've exceeded max retries
    if (jobRetryInfo.retryCount >= config.maxRetries) {
      return false;
    }

    // Check if error type is in the "do not retry" list
    if (config.doNotRetryOn.includes(errorType)) {
      return false;
    }

    // Check if error type is in the "retry on" list
    if (config.retryOnErrorTypes.length > 0 && !config.retryOnErrorTypes.includes(errorType)) {
      return false;
    }

    return true;
  }

  /**
   * Schedule a job for retry or mark as permanently failed
   */
  async scheduleJobRetry(
    jobId: string,
    errorMessage: string,
    errorType: string = 'execution_error'
  ): Promise<{ scheduled: boolean; nextRetryAt: Date | null; reason: string }> {
    try {
      console.log(`[RetryManager] Scheduling retry for job ${jobId} with error: ${errorType}`);

      const { data: scheduled, error } = await supabase.rpc('schedule_job_retry', {
        p_job_id: jobId,
        p_error_message: errorMessage,
        p_error_type: errorType,
        p_executor_id: this.executorId
      });

      if (error) {
        console.error('Error scheduling job retry:', error);
        return {
          scheduled: false,
          nextRetryAt: null,
          reason: `Database error: ${error.message}`
        };
      }

      if (scheduled) {
        // Get the updated job info to return next retry time
        const jobInfo = await this.getJobRetryInfo(jobId);
        return {
          scheduled: true,
          nextRetryAt: jobInfo?.nextRetryAt || null,
          reason: 'Job scheduled for retry with exponential backoff'
        };
      } else {
        return {
          scheduled: false,
          nextRetryAt: null,
          reason: 'Job marked as permanently failed - max retries exceeded or error type not retryable'
        };
      }
    } catch (error) {
      console.error('Error in scheduleJobRetry:', error);
      return {
        scheduled: false,
        nextRetryAt: null,
        reason: `Exception: ${error.message}`
      };
    }
  }

  /**
   * Get jobs that are ready for retry
   */
  async getJobsReadyForRetry(limit: number = 50): Promise<JobRetryInfo[]> {
    try {
      const { data, error } = await supabase.rpc('get_jobs_ready_for_retry', {
        p_limit: limit
      });

      if (error) {
        console.error('Error getting jobs ready for retry:', error);
        return [];
      }

      return (data || []).map((job: any) => ({
        jobId: job.job_id,
        userId: job.user_id,
        jobType: job.job_type,
        retryCount: job.retry_count,
        nextRetryAt: job.next_retry_at ? new Date(job.next_retry_at) : null,
        lastError: job.last_error,
        finalStatus: 'failed', // These are all failed jobs ready for retry
        retryEnabled: true,
        maxRetries: 5 // Will be fetched from config when needed
      }));
    } catch (error) {
      console.error('Error in getJobsReadyForRetry:', error);
      return [];
    }
  }

  /**
   * Get retry information for a specific job
   */
  async getJobRetryInfo(jobId: string): Promise<JobRetryInfo | null> {
    try {
      const { data, error } = await supabase
        .from('puppet_jobs')
        .select(`
          id,
          user_id,
          job_type,
          retry_count,
          next_retry_at,
          last_execution_error,
          final_status,
          retry_enabled,
          max_retries
        `)
        .eq('id', jobId)
        .single();

      if (error || !data) {
        console.error('Error getting job retry info:', error);
        return null;
      }

      return {
        jobId: data.id,
        userId: data.user_id,
        jobType: data.job_type,
        retryCount: data.retry_count || 0,
        nextRetryAt: data.next_retry_at ? new Date(data.next_retry_at) : null,
        lastError: data.last_execution_error,
        finalStatus: data.final_status,
        retryEnabled: data.retry_enabled,
        maxRetries: data.max_retries || 5
      };
    } catch (error) {
      console.error('Error in getJobRetryInfo:', error);
      return null;
    }
  }

  /**
   * Mark a retry attempt as successful
   */
  async markRetrySuccess(jobId: string): Promise<boolean> {
    try {
      // Update the retry history to mark the latest attempt as successful
      const { error } = await supabase
        .from('puppet_job_retry_history')
        .update({
          success: true,
          error_message: null
        })
        .eq('job_id', jobId)
        .order('attempted_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error marking retry success:', error);
        return false;
      }

      console.log(`[RetryManager] Marked retry as successful for job ${jobId}`);
      return true;
    } catch (error) {
      console.error('Error in markRetrySuccess:', error);
      return false;
    }
  }

  /**
   * Get retry statistics for monitoring
   */
  async getRetryStats(timeframe: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<RetryStats> {
    try {
      const intervalMap = {
        hour: '1 hour',
        day: '1 day',
        week: '1 week',
        month: '1 month'
      };

      const interval = intervalMap[timeframe];

      // Get retry statistics
      const { data: stats, error: statsError } = await supabase
        .from('puppet_jobs')
        .select('retry_count, final_status')
        .gte('created_at', `now() - interval '${interval}'`);

      if (statsError) {
        console.error('Error getting retry stats:', statsError);
        return this.getEmptyRetryStats();
      }

      // Get error type breakdown
      const { data: errorStats, error: errorStatsError } = await supabase
        .from('puppet_job_retry_history')
        .select('error_type')
        .gte('attempted_at', `now() - interval '${interval}'`)
        .eq('success', false);

      if (errorStatsError) {
        console.error('Error getting error stats:', errorStatsError);
      }

      // Calculate statistics
      const jobs = stats || [];
      const totalJobs = jobs.length;
      const jobsWithRetries = jobs.filter(job => (job.retry_count || 0) > 0).length;
      const successfulAfterRetry = jobs.filter(job => 
        job.final_status === 'completed' && (job.retry_count || 0) > 0
      ).length;
      const permanentlyFailed = jobs.filter(job => 
        job.final_status === 'permanently_failed'
      ).length;
      const pendingRetry = jobs.filter(job => 
        job.final_status === 'failed'
      ).length;

      const averageRetryCount = totalJobs > 0 ? 
        jobs.reduce((sum, job) => sum + (job.retry_count || 0), 0) / totalJobs : 0;

      const retrySuccessRate = jobsWithRetries > 0 ? 
        (successfulAfterRetry / jobsWithRetries) * 100 : 0;

      // Process error type breakdown
      const errorTypeMap: Record<string, number> = {};
      (errorStats || []).forEach(stat => {
        if (stat.error_type) {
          errorTypeMap[stat.error_type] = (errorTypeMap[stat.error_type] || 0) + 1;
        }
      });

      const topErrorTypes = Object.entries(errorTypeMap)
        .map(([errorType, count]) => ({ errorType, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalJobsWithRetries: jobsWithRetries,
        averageRetryCount: Math.round(averageRetryCount * 100) / 100,
        successfulAfterRetry,
        permanentlyFailed,
        pendingRetry,
        retrySuccessRate: Math.round(retrySuccessRate * 100) / 100,
        topErrorTypes
      };
    } catch (error) {
      console.error('Error in getRetryStats:', error);
      return this.getEmptyRetryStats();
    }
  }

  /**
   * Get retry history for a specific job
   */
  async getJobRetryHistory(jobId: string): Promise<RetryAttempt[]> {
    try {
      const { data, error } = await supabase
        .from('puppet_job_retry_history')
        .select('*')
        .eq('job_id', jobId)
        .order('attempted_at', { ascending: false });

      if (error) {
        console.error('Error getting job retry history:', error);
        return [];
      }

      return (data || []).map(attempt => ({
        jobId: attempt.job_id,
        attemptNumber: attempt.attempt_number,
        attemptedAt: new Date(attempt.attempted_at),
        errorMessage: attempt.error_message || '',
        errorType: attempt.error_type || '',
        success: attempt.success,
        delaySeconds: attempt.delay_seconds,
        backoffMultiplier: attempt.backoff_multiplier,
        jitterSeconds: attempt.jitter_seconds || 0,
        retryReason: attempt.retry_reason || 'automatic',
        executorId: attempt.executor_id || 'unknown'
      }));
    } catch (error) {
      console.error('Error in getJobRetryHistory:', error);
      return [];
    }
  }

  /**
   * Update retry configuration for a job type
   */
  async updateRetryConfig(jobType: string, config: Partial<RetryConfig>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('puppet_job_retry_config')
        .upsert({
          job_type: jobType,
          max_retries: config.maxRetries,
          base_delay_seconds: config.baseDelaySeconds,
          backoff_multiplier: config.backoffMultiplier,
          max_delay_seconds: config.maxDelaySeconds,
          jitter_enabled: config.jitterEnabled,
          max_jitter_seconds: config.maxJitterSeconds,
          escalation_enabled: config.escalationEnabled,
          escalation_threshold: config.escalationThreshold,
          retry_on_error_types: config.retryOnErrorTypes,
          do_not_retry_on: config.doNotRetryOn,
          enabled: config.enabled,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error updating retry config:', error);
        return false;
      }

      console.log(`[RetryManager] Updated retry config for job type: ${jobType}`);
      return true;
    } catch (error) {
      console.error('Error in updateRetryConfig:', error);
      return false;
    }
  }

  /**
   * Manually retry a permanently failed job
   */
  async manualRetry(jobId: string, reason: string = 'manual_admin_retry'): Promise<boolean> {
    try {
      // Reset the job status and clear retry scheduling
      const { error } = await supabase
        .from('puppet_jobs')
        .update({
          status: 'queued',
          final_status: null,
          next_retry_at: null,
          executing_at: null,
          executing_by: null,
          execution_timeout_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) {
        console.error('Error manually retrying job:', error);
        return false;
      }

      // Log the manual retry
      const jobInfo = await this.getJobRetryInfo(jobId);
      if (jobInfo) {
        await supabase
          .from('puppet_job_retry_history')
          .insert({
            job_id: jobId,
            attempt_number: (jobInfo.retryCount || 0) + 1,
            attempted_at: new Date().toISOString(),
            error_message: null,
            error_type: 'manual_retry',
            success: false,
            delay_seconds: 0,
            retry_reason: reason,
            executor_id: this.executorId
          });
      }

      console.log(`[RetryManager] Manually retried job ${jobId} with reason: ${reason}`);
      return true;
    } catch (error) {
      console.error('Error in manualRetry:', error);
      return false;
    }
  }

  /**
   * Get empty retry stats for error cases
   */
  private getEmptyRetryStats(): RetryStats {
    return {
      totalJobsWithRetries: 0,
      averageRetryCount: 0,
      successfulAfterRetry: 0,
      permanentlyFailed: 0,
      pendingRetry: 0,
      retrySuccessRate: 0,
      topErrorTypes: []
    };
  }

  /**
   * Clean up old retry history records
   */
  async cleanupOldRetryHistory(olderThanDays: number = 90): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('puppet_job_retry_history')
        .delete()
        .lt('attempted_at', new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString())
        .select('id');

      if (error) {
        console.error('Error cleaning up retry history:', error);
        return 0;
      }

      const cleanedCount = data?.length || 0;
      if (cleanedCount > 0) {
        console.log(`[RetryManager] Cleaned up ${cleanedCount} old retry history records`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('Error in cleanupOldRetryHistory:', error);
      return 0;
    }
  }
}

export default RetryManager; 