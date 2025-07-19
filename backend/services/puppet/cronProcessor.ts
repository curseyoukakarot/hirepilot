/**
 * CronProcessor - Main orchestrator for automated puppet job batch processing
 * Handles job scheduling, execution, timeout management, and error recovery
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import ConcurrencyManager from './concurrencyManager';
import BatchJobLoader, { PuppetJobBatch, BatchLoadResult } from './batchJobLoader';
import JobExecutor from './jobExecutor';
import { retryManager } from './retryManager';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CronProcessorConfig {
  processorId: string;
  batchSize: number;
  maxConcurrentJobs: number;
  timeoutSeconds: number;
  retryAttempts: number;
  heartbeatIntervalMs: number;
  stuckJobTimeoutMinutes: number;
  enableSlackAlerts: boolean;
  slackWebhookUrl?: string;
  processRetryJobs: boolean; // 🆕 Enable retry job processing
}

export interface ProcessingResult {
  batchId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  timedOutJobs: number;
  retriedJobs: number; // 🆕 Track retried jobs
  skippedJobs: {
    userConcurrencyLimited: number;
    globalConcurrencyLimited: number;
    alreadyExecuting: number;
    errors: number;
  };
  errors: Array<{
    jobId: string;
    error: string;
    type: string;
  }>;
}

export class CronProcessor {
  private config: CronProcessorConfig;
  private concurrencyManager: ConcurrencyManager;
  private batchLoader: BatchJobLoader;
  private jobExecutor: JobExecutor;
  private isRunning: boolean = false;
  private heartbeatInterval?: NodeJS.Timeout;
  private processingStats: {
    totalBatches: number;
    totalJobs: number;
    successRate: number;
    lastProcessedAt: Date | null;
  };

  constructor(config: Partial<CronProcessorConfig> = {}) {
    const hostname = os.hostname();
    const pid = process.pid;
    
    this.config = {
      processorId: config.processorId || `cron-${hostname}-${pid}-${Date.now()}`,
      batchSize: config.batchSize || 20,
      maxConcurrentJobs: config.maxConcurrentJobs || 10,
      timeoutSeconds: config.timeoutSeconds || 120,
      retryAttempts: config.retryAttempts || 3,
      heartbeatIntervalMs: config.heartbeatIntervalMs || 30000, // 30 seconds
      stuckJobTimeoutMinutes: config.stuckJobTimeoutMinutes || 5,
      enableSlackAlerts: config.enableSlackAlerts || false,
      slackWebhookUrl: config.slackWebhookUrl,
      processRetryJobs: config.processRetryJobs || false, // Default to false
      ...config
    };

    // Initialize components
    this.concurrencyManager = new ConcurrencyManager(this.config.processorId, {
      maxGlobalConcurrentJobs: this.config.maxConcurrentJobs,
      maxUserConcurrentJobs: 2,
      defaultLockTimeoutSeconds: this.config.timeoutSeconds + 60
    });

    this.batchLoader = new BatchJobLoader(this.config.processorId, this.concurrencyManager, {
      batchSize: this.config.batchSize,
      timeoutSeconds: this.config.timeoutSeconds
    });

    this.jobExecutor = new JobExecutor(this.config.processorId, {
      timeoutSeconds: this.config.timeoutSeconds,
      retryAttempts: this.config.retryAttempts
    });

    this.processingStats = {
      totalBatches: 0,
      totalJobs: 0,
      successRate: 0,
      lastProcessedAt: null
    };

    console.log(`[CronProcessor] Initialized with ID: ${this.config.processorId}`);
  }

  /**
   * Start the cron processor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log(`[CronProcessor] Already running`);
      return;
    }

    console.log(`[CronProcessor] Starting processor ${this.config.processorId}`);
    this.isRunning = true;

    try {
      // Register processor in database
      await this.registerProcessor();

      // Start heartbeat
      this.startHeartbeat();

      // Reset any stuck jobs from previous runs
      await this.resetStuckJobs();

      console.log(`[CronProcessor] Successfully started`);
    } catch (error) {
      console.error(`[CronProcessor] Failed to start:`, error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the cron processor
   */
  async stop(): Promise<void> {
    console.log(`[CronProcessor] Stopping processor ${this.config.processorId}`);
    this.isRunning = false;

    // Stop heartbeat
    this.stopHeartbeat();

    // Wait for current operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Cleanup resources
    await this.concurrencyManager.destroy();

    // Deregister processor
    await this.deregisterProcessor();

    console.log(`[CronProcessor] Stopped`);
  }

  /**
   * Process a single batch of jobs
   */
  async processBatch(): Promise<ProcessingResult> {
    if (!this.isRunning) {
      throw new Error('Processor is not running');
    }

    const startTime = new Date();
    console.log(`[CronProcessor] Starting batch processing at ${startTime.toISOString()}`);

    const result: ProcessingResult = {
      batchId: '',
      startTime,
      endTime: new Date(),
      duration: 0,
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      timedOutJobs: 0,
      skippedJobs: {
        userConcurrencyLimited: 0,
        globalConcurrencyLimited: 0,
        alreadyExecuting: 0,
        errors: 0
      },
      errors: []
    };

    try {
      // 1. Reset stuck jobs before processing
      const resetCount = await this.resetStuckJobs();
      if (resetCount > 0) {
        console.log(`[CronProcessor] Reset ${resetCount} stuck jobs`);
      }

      // 2. Load batch of jobs
      const batchLoadResult: BatchLoadResult = await this.batchLoader.loadBatch();
      result.batchId = batchLoadResult.batchId;
      result.totalJobs = batchLoadResult.jobs.length;
      result.skippedJobs = batchLoadResult.skippedJobs;

      if (result.totalJobs === 0) {
        console.log(`[CronProcessor] No jobs to process`);
        result.endTime = new Date();
        result.duration = result.endTime.getTime() - startTime.getTime();
        return result;
      }

      console.log(`[CronProcessor] Processing batch ${result.batchId} with ${result.totalJobs} jobs`);

      // 3. Log batch start
      await this.logBatchExecution(result.batchId, 'started', result.totalJobs);

      // 4. Process jobs in parallel with concurrency control
      const jobPromises = batchLoadResult.jobs.map(job => 
        this.processJob(job).catch(error => ({
          jobId: job.id,
          success: false,
          error: error.message,
          type: 'execution_error'
        }))
      );

      // 5. Wait for all jobs to complete or timeout
      const jobResults = await Promise.allSettled(jobPromises);

      // 6. Aggregate results
      for (let i = 0; i < jobResults.length; i++) {
        const jobResult = jobResults[i];
        const job = batchLoadResult.jobs[i];

        if (jobResult.status === 'fulfilled') {
          const executionResult = jobResult.value;
          if (executionResult.success) {
            result.successfulJobs++;
          } else {
            result.failedJobs++;
            result.errors.push({
              jobId: job.id,
              error: executionResult.error || 'Unknown error',
              type: executionResult.type || 'execution_error'
            });
          }
        } else {
          result.failedJobs++;
          result.errors.push({
            jobId: job.id,
            error: jobResult.reason?.message || 'Promise rejected',
            type: 'promise_rejection'
          });
        }
      }

      // 7. Update stats
      this.updateProcessingStats(result);

      // 8. Log batch completion
      await this.logBatchExecution(result.batchId, 'completed', result.totalJobs, {
        successful: result.successfulJobs,
        failed: result.failedJobs,
        timedOut: result.timedOutJobs
      });

      // 9. Send alerts if needed
      if (result.failedJobs > result.successfulJobs && this.config.enableSlackAlerts) {
        await this.sendSlackAlert(result);
      }

    } catch (error) {
      console.error(`[CronProcessor] Batch processing error:`, error);
      result.errors.push({
        jobId: 'batch',
        error: error.message,
        type: 'batch_error'
      });

      // Log batch failure
      await this.logBatchExecution(result.batchId || 'unknown', 'failed', 0, { error: error.message });
    }

    result.endTime = new Date();
    result.duration = result.endTime.getTime() - startTime.getTime();

    console.log(`[CronProcessor] Batch completed in ${result.duration}ms - Success: ${result.successfulJobs}, Failed: ${result.failedJobs}`);
    
    return result;
  }

  /**
   * 🆕 Process jobs that are ready for retry
   */
  async processRetryJobs(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    errors: Array<{ jobId: string; error: string }>;
  }> {
    console.log(`[CronProcessor] Processing retry jobs...`);
    
    const result = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    try {
      // Get jobs ready for retry using the database function
      const { data: retryJobs, error } = await supabase.rpc('get_jobs_ready_for_retry', {
        p_limit: this.config.batchSize
      });

      if (error) {
        console.error(`[CronProcessor] Error fetching retry jobs:`, error);
        return result;
      }

      if (!retryJobs || retryJobs.length === 0) {
        console.log(`[CronProcessor] No retry jobs ready for processing`);
        return result;
      }

      console.log(`[CronProcessor] Found ${retryJobs.length} jobs ready for retry`);
      result.processed = retryJobs.length;

      // Convert retry jobs to job batch format
      const retryJobBatch: PuppetJobBatch[] = retryJobs.map(retryJob => ({
        id: retryJob.job_id,
        user_id: retryJob.user_id,
        job_type: retryJob.job_type || 'unknown',
        job_config: {},
        priority: 5, // Give retry jobs higher priority
        scheduled_at: retryJob.next_retry_at,
        created_at: new Date().toISOString()
      }));

      // Process retry jobs using existing job executor
      const jobExecutor = new JobExecutor(this.config.processorId, {
        timeoutSeconds: this.config.timeoutSeconds,
        retryAttempts: 0 // Don't retry retry jobs immediately
      });

      // Execute retry jobs in parallel with concurrency control
      const retryPromises = retryJobBatch.map(async (job) => {
        try {
          // Check concurrency limits
          const canExecute = await this.concurrencyManager.canExecuteJob(job.user_id);
          if (!canExecute.allowed) {
            console.log(`[CronProcessor] Retry job ${job.id} skipped: ${canExecute.reason}`);
            return { success: false, error: canExecute.reason, jobId: job.id };
          }

          // Execute the retry job
          const executionResult = await jobExecutor.executeJob(job);
          
          if (executionResult.success) {
            console.log(`✅ [CronProcessor] Retry job ${job.id} succeeded`);
            result.successful++;
          } else {
            console.log(`❌ [CronProcessor] Retry job ${job.id} failed again: ${executionResult.error}`);
            result.failed++;
            result.errors.push({
              jobId: job.id,
              error: executionResult.error || 'Unknown error'
            });
          }

          return executionResult;
        } catch (error) {
          console.error(`[CronProcessor] Exception processing retry job ${job.id}:`, error);
          result.failed++;
          result.errors.push({
            jobId: job.id,
            error: error.message
          });
          return { success: false, error: error.message, jobId: job.id };
        }
      });

      // Wait for all retry jobs to complete
      await Promise.allSettled(retryPromises);

      console.log(`[CronProcessor] Retry processing complete - Successful: ${result.successful}, Failed: ${result.failed}`);
      
      return result;

    } catch (error) {
      console.error(`[CronProcessor] Error processing retry jobs:`, error);
      result.errors.push({
        jobId: 'retry_batch',
        error: error.message
      });
      return result;
    }
  }

  /**
   * 🆕 Enhanced batch processing that includes retry jobs
   */
  async processFullBatch(): Promise<ProcessingResult & { retryResults?: any }> {
    const mainBatchResult = await this.processBatch();
    
    // Also process retry jobs if enabled
    let retryResults = null;
    if (this.config.processRetryJobs) {
      try {
        retryResults = await this.processRetryJobs();
        
        // Add retry stats to main result
        mainBatchResult.retriedJobs = retryResults.processed;
        mainBatchResult.successfulJobs += retryResults.successful;
        mainBatchResult.failedJobs += retryResults.failed;
        mainBatchResult.totalJobs += retryResults.processed;
        
        // Merge retry errors
        mainBatchResult.errors.push(...retryResults.errors);
        
        console.log(`[CronProcessor] Combined batch (main + retry) - Total: ${mainBatchResult.totalJobs}, Success: ${mainBatchResult.successfulJobs}, Failed: ${mainBatchResult.failedJobs}, Retried: ${mainBatchResult.retriedJobs}`);
      } catch (error) {
        console.error(`[CronProcessor] Error processing retry jobs:`, error);
      }
    }

    return { ...mainBatchResult, retryResults };
  }

  /**
   * Process a single job
   */
  private async processJob(job: PuppetJobBatch): Promise<{
    jobId: string;
    success: boolean;
    error?: string;
    type?: string;
    duration?: number;
  }> {
    const startTime = Date.now();
    const timeoutMs = this.config.timeoutSeconds * 1000;

    try {
      console.log(`[CronProcessor] Processing job ${job.id} for user ${job.user_id}`);

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Job timeout after ${this.config.timeoutSeconds} seconds`));
        }, timeoutMs);
      });

      // Execute job with timeout
      const executionPromise = this.jobExecutor.executeJob(job);

      const result = await Promise.race([executionPromise, timeoutPromise]);
      const duration = Date.now() - startTime;

      console.log(`[CronProcessor] Job ${job.id} completed successfully in ${duration}ms`);
      
      return {
        jobId: job.id,
        success: true,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const isTimeout = error.message.includes('timeout');
      
      if (isTimeout) {
        // Handle timeout specifically
        await this.handleJobTimeout(job);
        console.log(`[CronProcessor] Job ${job.id} timed out after ${duration}ms`);
        
        return {
          jobId: job.id,
          success: false,
          error: error.message,
          type: 'timeout',
          duration
        };
      }

      console.error(`[CronProcessor] Job ${job.id} failed:`, error);
      
      return {
        jobId: job.id,
        success: false,
        error: error.message,
        type: 'execution_error',
        duration
      };
    }
  }

  /**
   * Handle job timeout
   */
  private async handleJobTimeout(job: PuppetJobBatch): Promise<void> {
    try {
      // Mark job as failed due to timeout
      await supabase.rpc('complete_job_execution', {
        p_job_id: job.id,
        p_outcome: 'timeout',
        p_error_message: `Job timed out after ${this.config.timeoutSeconds} seconds`
      });

      // Schedule retry if retry system is available
      // This would integrate with your existing retry system
      console.log(`[CronProcessor] Job ${job.id} marked as timeout, retry system will handle if enabled`);

    } catch (error) {
      console.error(`[CronProcessor] Error handling timeout for job ${job.id}:`, error);
    }
  }

  /**
   * Reset stuck jobs
   */
  private async resetStuckJobs(): Promise<number> {
    try {
      return await this.batchLoader.resetStuckJobs(this.config.stuckJobTimeoutMinutes);
    } catch (error) {
      console.error(`[CronProcessor] Error resetting stuck jobs:`, error);
      return 0;
    }
  }

  /**
   * Register processor in database
   */
  private async registerProcessor(): Promise<void> {
    const { error } = await supabase
      .from('puppet_cron_processor_state')
      .upsert({
        processor_id: this.config.processorId,
        hostname: os.hostname(),
        process_id: process.pid,
        is_active: true,
        last_heartbeat: new Date().toISOString(),
        max_concurrent_jobs: this.config.maxConcurrentJobs,
        batch_size: this.config.batchSize,
        timeout_seconds: this.config.timeoutSeconds
      });

    if (error) {
      throw new Error(`Failed to register processor: ${error.message}`);
    }
  }

  /**
   * Deregister processor
   */
  private async deregisterProcessor(): Promise<void> {
    const { error } = await supabase
      .from('puppet_cron_processor_state')
      .update({
        is_active: false,
        last_heartbeat: new Date().toISOString()
      })
      .eq('processor_id', this.config.processorId);

    if (error) {
      console.error(`Error deregistering processor:`, error);
    }
  }

  /**
   * Send heartbeat
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      const { error } = await supabase
        .from('puppet_cron_processor_state')
        .update({
          last_heartbeat: new Date().toISOString(),
          total_batches_processed: this.processingStats.totalBatches,
          total_jobs_processed: this.processingStats.totalJobs,
          success_rate_percent: this.processingStats.successRate
        })
        .eq('processor_id', this.config.processorId);

      if (error) {
        console.error(`[CronProcessor] Heartbeat error:`, error);
      }
    } catch (error) {
      console.error(`[CronProcessor] Heartbeat exception:`, error);
    }
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatIntervalMs);

    // Send initial heartbeat
    this.sendHeartbeat();
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  /**
   * Log batch execution
   */
  private async logBatchExecution(
    batchId: string, 
    outcome: string, 
    jobCount: number,
    metadata?: any
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('puppet_job_execution_logs')
        .insert({
          job_id: null, // Batch-level log
          batch_id: batchId,
          executor_id: this.config.processorId,
          outcome,
          execution_context: {
            type: 'batch',
            jobCount,
            processorConfig: {
              batchSize: this.config.batchSize,
              timeoutSeconds: this.config.timeoutSeconds
            },
            ...metadata
          }
        });

      if (error) {
        console.error(`Error logging batch execution:`, error);
      }
    } catch (error) {
      console.error(`Exception logging batch execution:`, error);
    }
  }

  /**
   * Update processing statistics
   */
  private updateProcessingStats(result: ProcessingResult): void {
    this.processingStats.totalBatches++;
    this.processingStats.totalJobs += result.totalJobs;
    this.processingStats.lastProcessedAt = new Date();

    // Calculate success rate
    const totalProcessed = this.processingStats.totalJobs;
    if (totalProcessed > 0) {
      // This is a simplified calculation - in production you'd want to track this more precisely
      const estimatedSuccessful = result.successfulJobs;
      this.processingStats.successRate = Math.round((estimatedSuccessful / result.totalJobs) * 100);
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(result: ProcessingResult): Promise<void> {
    if (!this.config.slackWebhookUrl) {
      return;
    }

    try {
      const message = {
        text: `🚨 Puppet Job Processing Alert`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Batch Processing Alert*\n\n` +
                    `Batch ID: ${result.batchId}\n` +
                    `Processor: ${this.config.processorId}\n` +
                    `Total Jobs: ${result.totalJobs}\n` +
                    `✅ Successful: ${result.successfulJobs}\n` +
                    `❌ Failed: ${result.failedJobs}\n` +
                    `⏱️ Duration: ${Math.round(result.duration / 1000)}s\n\n` +
                    `*Errors:*\n${result.errors.slice(0, 5).map(e => `• ${e.type}: ${e.error}`).join('\n')}`
            }
          }
        ]
      };

      const response = await fetch(this.config.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        console.error(`Failed to send Slack alert: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error sending Slack alert:`, error);
    }
  }

  /**
   * Get current processor status
   */
  async getStatus(): Promise<{
    processorId: string;
    isRunning: boolean;
    stats: typeof this.processingStats;
    queueStats: any;
    executingStats: any;
    concurrencyStats: any;
  }> {
    const queueStats = await this.batchLoader.getJobQueueStats();
    const executingStats = await this.batchLoader.getExecutingJobsStatus();
    const concurrencyStats = await this.concurrencyManager.getConcurrencyStats();

    return {
      processorId: this.config.processorId,
      isRunning: this.isRunning,
      stats: this.processingStats,
      queueStats,
      executingStats,
      concurrencyStats
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    checks: Record<string, boolean>;
    lastProcessed: Date | null;
    uptime: number;
  }> {
    const checks: Record<string, boolean> = {};
    
    // Check database connectivity
    try {
      const { error } = await supabase.from('puppet_jobs').select('id').limit(1);
      checks.database = !error;
    } catch {
      checks.database = false;
    }

    // Check if processor is registered
    try {
      const { data, error } = await supabase
        .from('puppet_cron_processor_state')
        .select('is_active')
        .eq('processor_id', this.config.processorId)
        .single();
      
      checks.registration = !error && data?.is_active === true;
    } catch {
      checks.registration = false;
    }

    // Check concurrency manager
    checks.concurrencyManager = this.concurrencyManager !== null;

    // Check if running
    checks.running = this.isRunning;

    const healthy = Object.values(checks).every(check => check === true);

    return {
      healthy,
      checks,
      lastProcessed: this.processingStats.lastProcessedAt,
      uptime: Date.now() - (this.processingStats.lastProcessedAt?.getTime() || Date.now())
    };
  }
}

export default CronProcessor; 