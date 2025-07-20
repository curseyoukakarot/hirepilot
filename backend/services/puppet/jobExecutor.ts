/**
 * JobExecutor - Wraps puppet job execution with status tracking and retry integration
 * Handles individual job execution with proper logging and error handling
 */

import { createClient } from '@supabase/supabase-js';
import { PuppetJobBatch } from './batchJobLoader';
import { retryManager } from './retryManager';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface JobExecutorConfig {
  timeoutSeconds: number;
  retryAttempts: number;
  enableDebugging: boolean;
}

export interface JobExecutionResult {
  success: boolean;
  jobId: string;
  duration: number;
  outcome: string;
  error?: string;
  errorType?: string;
  metadata?: any;
  retryScheduled?: boolean;
}

export class JobExecutor {
  private executorId: string;
  private config: JobExecutorConfig;

  constructor(executorId: string, config: Partial<JobExecutorConfig> = {}) {
    this.executorId = executorId;
    this.config = {
      timeoutSeconds: config.timeoutSeconds || 120,
      retryAttempts: config.retryAttempts || 3,
      enableDebugging: config.enableDebugging || false,
      ...config
    };
  }

  /**
   * Execute a puppet job with full tracking and error handling
   */
  async executeJob(job: PuppetJobBatch): Promise<JobExecutionResult> {
    const startTime = Date.now();
    
    console.log(`[JobExecutor] Starting execution of job ${job.id} (type: ${job.job_type})`);

    try {
      // Execute the actual puppet job
      const result = await this.executePuppetJob(job);
      
      const duration = Date.now() - startTime;
      
      // Mark job as completed
      await this.completeJobExecution(job.id, 'completed', null, duration, null);
      
      console.log(`[JobExecutor] Job ${job.id} completed successfully in ${duration}ms`);
      
      return {
        success: true,
        jobId: job.id,
        duration,
        outcome: 'completed',
        metadata: result
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error';
      const errorType = this.determineErrorType(error);
      
      console.error(`[JobExecutor] Job ${job.id} failed after ${duration}ms:`, error);
      
      // 🆕 Try to schedule retry using the retry manager
      let retryScheduled = false;
      try {
        console.log(`[JobExecutor] Attempting to schedule retry for job ${job.id} (error: ${errorType})`);
        const retryResult = await retryManager.scheduleJobRetry(job.id, errorMessage, errorType);
        retryScheduled = retryResult.scheduled;
        
        if (retryScheduled) {
          console.log(`✅ [JobExecutor] Retry scheduled for job ${job.id}`);
        } else {
          console.log(`❌ [JobExecutor] Job ${job.id} marked as permanently failed (no retry scheduled)`);
        }
      } catch (retryError) {
        console.error(`[JobExecutor] Error scheduling retry for job ${job.id}:`, retryError);
        // Fallback: mark as failed without retry
        await this.completeJobExecution(job.id, 'failed', errorMessage, duration, errorType);
      }
      
      // If retry was not scheduled, mark job as failed
      if (!retryScheduled) {
        await this.completeJobExecution(job.id, 'failed', errorMessage, duration, errorType);
      }
      
      return {
        success: false,
        jobId: job.id,
        duration,
        outcome: retryScheduled ? 'failed_retry_scheduled' : 'failed',
        error: errorMessage,
        errorType,
        retryScheduled,
        metadata: { originalError: error }
      };
    }
  }

  /**
   * Execute the actual puppet job logic
   */
  private async executePuppetJob(job: PuppetJobBatch): Promise<any> {
    // Import the existing puppet execution logic
    // This assumes you have an existing puppet execution system
    const { EnhancedPuppetJobRunner } = await import('./enhancedPuppetJobRunner');
    
    // Create puppet runner instance
    const puppetRunner = new EnhancedPuppetJobRunner();
    
    // Convert our job format to the expected puppet job format
    const puppetJob = {
      id: job.id,
      user_id: job.user_id,
      job_type: job.job_type,
      job_config: job.job_config,
      priority: job.priority,
      scheduled_at: job.scheduled_at,
      created_at: job.created_at
    };

    // Create proper context for EnhancedPuppetJobRunner
    const jobContext = {
      jobId: puppetJob.id,
      userId: puppetJob.user_id,
      linkedinProfileUrl: puppetJob.job_config?.linkedin_url || '',
      maxRetries: 3,
      priority: puppetJob.priority || 1,
      messageText: puppetJob.job_config?.message || '',
      proxyId: puppetJob.job_config?.proxy_id,
      executorId: this.executorId
    };

    // Execute the job using your existing puppet system
    const result = await EnhancedPuppetJobRunner.executeLinkedInJob(jobContext);
    
    return result;
  }

  /**
   * Determine error type from error object
   */
  private determineErrorType(error: any): string {
    if (error.message?.includes('timeout')) {
      return 'timeout';
    }
    
    if (error.message?.includes('network')) {
      return 'network';
    }
    
    if (error.message?.includes('authentication') || error.message?.includes('auth')) {
      return 'authentication';
    }
    
    if (error.message?.includes('proxy')) {
      return 'proxy';
    }
    
    if (error.message?.includes('linkedin')) {
      return 'linkedin_error';
    }
    
    if (error.message?.includes('rate limit') || error.message?.includes('throttle')) {
      return 'rate_limit';
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      return 'connection';
    }
    
    return 'execution_error';
  }

  /**
   * Log job execution start
   */
  private async logJobExecution(
    jobId: string, 
    outcome: string, 
    batchId: string,
    metadata?: any
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('puppet_job_execution_logs')
        .insert({
          job_id: jobId,
          batch_id: batchId,
          executor_id: this.executorId,
          outcome,
          execution_context: {
            type: 'job',
            executorConfig: this.config,
            ...metadata
          }
        });

      if (error) {
        console.error(`Error logging job execution start:`, error);
      }
    } catch (error) {
      console.error(`Exception logging job execution:`, error);
    }
  }

  /**
   * Complete job execution and update all tracking
   */
  private async completeJobExecution(
    jobId: string,
    outcome: string,
    errorMessage: string | null,
    durationMs: number,
    errorType?: string
  ): Promise<void> {
    try {
      // Use the database function to complete job execution
      const { error } = await supabase.rpc('complete_job_execution', {
        p_job_id: jobId,
        p_outcome: outcome,
        p_error_message: errorMessage,
        p_duration_ms: durationMs
      });

      if (error) {
        console.error(`Error completing job execution:`, error);
      }

      // Also update the execution log
      await this.updateExecutionLog(jobId, outcome, errorMessage, durationMs, errorType);

    } catch (error) {
      console.error(`Exception completing job execution:`, error);
    }
  }

  /**
   * Update execution log with completion details
   */
  private async updateExecutionLog(
    jobId: string,
    outcome: string,
    errorMessage: string | null,
    durationMs: number,
    errorType?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('puppet_job_execution_logs')
        .update({
          end_time: new Date().toISOString(),
          duration_ms: durationMs,
          outcome,
          error_message: errorMessage,
          error_type: errorType,
          updated_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .eq('executor_id', this.executorId)
        .is('end_time', null);

      if (error) {
        console.error(`Error updating execution log:`, error);
      }
    } catch (error) {
      console.error(`Exception updating execution log:`, error);
    }
  }

  /**
   * Handle job timeout specifically
   */
  async handleTimeout(jobId: string, batchId: string): Promise<void> {
    console.log(`[JobExecutor] Handling timeout for job ${jobId}`);
    
    try {
      await this.completeJobExecution(
        jobId,
        'timeout',
        `Job timed out after ${this.config.timeoutSeconds} seconds`,
        this.config.timeoutSeconds * 1000,
        'timeout'
      );
    } catch (error) {
      console.error(`Error handling timeout for job ${jobId}:`, error);
    }
  }

  /**
   * Get execution statistics for this executor
   */
  async getExecutionStats(): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
    successRate: number;
    errorBreakdown: Record<string, number>;
  }> {
    try {
      const { data: executions, error } = await supabase
        .from('puppet_job_execution_logs')
        .select('outcome, duration_ms, error_type, end_time')
        .eq('executor_id', this.executorId)
        .not('end_time', 'is', null)
        .gte('start_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

      if (error) {
        console.error('Error fetching execution stats:', error);
        return this.getEmptyStats();
      }

      const logs = executions || [];
      const totalExecutions = logs.length;
      
      if (totalExecutions === 0) {
        return this.getEmptyStats();
      }

      const successfulExecutions = logs.filter(log => log.outcome === 'completed').length;
      const failedExecutions = logs.filter(log => log.outcome === 'failed').length;
      
      const totalDuration = logs
        .filter(log => log.duration_ms)
        .reduce((sum, log) => sum + log.duration_ms, 0);
      
      const averageDuration = totalDuration / logs.filter(log => log.duration_ms).length || 0;
      const successRate = (successfulExecutions / totalExecutions) * 100;

      // Error breakdown
      const errorBreakdown: Record<string, number> = {};
      logs
        .filter(log => log.outcome === 'failed' && log.error_type)
        .forEach(log => {
          errorBreakdown[log.error_type] = (errorBreakdown[log.error_type] || 0) + 1;
        });

      return {
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        averageDuration: Math.round(averageDuration),
        successRate: Math.round(successRate * 100) / 100,
        errorBreakdown
      };

    } catch (error) {
      console.error('Error in getExecutionStats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Get empty stats object
   */
  private getEmptyStats() {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
      successRate: 0,
      errorBreakdown: {}
    };
  }

  /**
   * Validate job before execution
   */
  private validateJob(job: PuppetJobBatch): boolean {
    // Basic validation
    if (!job.id || !job.user_id || !job.job_type) {
      console.error(`[JobExecutor] Invalid job structure:`, job);
      return false;
    }

    // Check if job config is valid
    if (!job.job_config || typeof job.job_config !== 'object') {
      console.error(`[JobExecutor] Invalid job config for job ${job.id}`);
      return false;
    }

    // Job type specific validation
    switch (job.job_type) {
      case 'linkedin_outreach':
        if (!job.job_config.linkedin_url || !job.job_config.message) {
          console.error(`[JobExecutor] Missing required fields for linkedin_outreach job ${job.id}`);
          return false;
        }
        break;
      
      case 'email_campaign':
        if (!job.job_config.email || !job.job_config.template) {
          console.error(`[JobExecutor] Missing required fields for email_campaign job ${job.id}`);
          return false;
        }
        break;
      
      // Add other job type validations as needed
      default:
        console.warn(`[JobExecutor] Unknown job type ${job.job_type} for job ${job.id}`);
        break;
    }

    return true;
  }

  /**
   * Enhanced execute job with validation and error recovery
   */
  async executeJobWithValidation(job: PuppetJobBatch): Promise<JobExecutionResult> {
    // Validate job before execution
    if (!this.validateJob(job)) {
      const duration = 0;
      const errorMessage = 'Job validation failed';
      
      await this.completeJobExecution(job.id, 'failed', errorMessage, duration, 'validation_error');
      
      return {
        success: false,
        jobId: job.id,
        duration,
        outcome: 'failed',
        error: errorMessage,
        errorType: 'validation_error'
      };
    }

    // Execute with validation
    return await this.executeJob(job);
  }
}

export default JobExecutor; 