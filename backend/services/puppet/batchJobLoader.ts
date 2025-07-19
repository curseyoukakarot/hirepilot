/**
 * BatchJobLoader - Safely fetches and loads pending puppet jobs for batch processing
 * Handles job selection, prioritization, and concurrency-safe locking
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import ConcurrencyManager from './concurrencyManager';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface PuppetJobBatch {
  id: string;
  user_id: string;
  job_type: string;
  job_config: any;
  priority: number;
  scheduled_at: string;
  created_at: string;
  batch_id: string;
  executing_at: string;
  executing_by: string;
  execution_timeout_at: string;
}

export interface BatchLoadResult {
  batchId: string;
  jobs: PuppetJobBatch[];
  skippedJobs: {
    userConcurrencyLimited: number;
    globalConcurrencyLimited: number;
    alreadyExecuting: number;
    errors: number;
  };
  metadata: {
    requestedSize: number;
    actualSize: number;
    processingTime: number;
    selectionCriteria: any;
  };
}

export interface BatchLoadConfig {
  batchSize: number;
  maxUserConcurrentJobs: number;
  concurrencyGroup: string;
  timeoutSeconds: number;
  priorityWeighting: boolean;
  includeJobTypes?: string[];
  excludeJobTypes?: string[];
  userIdFilter?: string[];
}

export class BatchJobLoader {
  private processorId: string;
  private concurrencyManager: ConcurrencyManager;
  private defaultConfig: BatchLoadConfig;

  constructor(
    processorId: string, 
    concurrencyManager: ConcurrencyManager,
    defaultConfig: Partial<BatchLoadConfig> = {}
  ) {
    this.processorId = processorId;
    this.concurrencyManager = concurrencyManager;
    this.defaultConfig = {
      batchSize: 20,
      maxUserConcurrentJobs: 2,
      concurrencyGroup: 'default',
      timeoutSeconds: 120,
      priorityWeighting: true,
      ...defaultConfig
    };
  }

  /**
   * Load a batch of jobs for processing
   */
  async loadBatch(config: Partial<BatchLoadConfig> = {}): Promise<BatchLoadResult> {
    const startTime = Date.now();
    const finalConfig = { ...this.defaultConfig, ...config };
    const batchId = uuidv4();

    console.log(`[BatchLoader] Starting batch load - batchId: ${batchId}, size: ${finalConfig.batchSize}`);

    const result: BatchLoadResult = {
      batchId,
      jobs: [],
      skippedJobs: {
        userConcurrencyLimited: 0,
        globalConcurrencyLimited: 0,
        alreadyExecuting: 0,
        errors: 0
      },
      metadata: {
        requestedSize: finalConfig.batchSize,
        actualSize: 0,
        processingTime: 0,
        selectionCriteria: finalConfig
      }
    };

    try {
      // 1. Check global concurrency limits
      const canProcessGlobally = await this.concurrencyManager.canSystemExecuteMoreJobs();
      if (!canProcessGlobally) {
        console.log(`[BatchLoader] Global concurrency limit reached, skipping batch`);
        result.skippedJobs.globalConcurrencyLimited = finalConfig.batchSize;
        result.metadata.processingTime = Date.now() - startTime;
        return result;
      }

      // 2. Acquire batch processing lock
      const lockAcquired = await this.concurrencyManager.acquireBatchLock(batchId, finalConfig.batchSize);
      if (!lockAcquired) {
        console.log(`[BatchLoader] Could not acquire batch lock for ${batchId}`);
        result.skippedJobs.errors = finalConfig.batchSize;
        result.metadata.processingTime = Date.now() - startTime;
        return result;
      }

      try {
        // 3. Fetch candidate jobs
        const candidateJobs = await this.fetchCandidateJobs(finalConfig);
        console.log(`[BatchLoader] Found ${candidateJobs.length} candidate jobs`);

        // 4. Filter jobs by user concurrency limits
        const filteredJobs = await this.filterJobsByUserConcurrency(candidateJobs, finalConfig);
        console.log(`[BatchLoader] ${filteredJobs.length} jobs passed concurrency filtering`);

        // 5. Select and lock jobs for processing
        const selectedJobs = await this.selectAndLockJobs(
          filteredJobs.slice(0, finalConfig.batchSize),
          batchId,
          finalConfig
        );

        result.jobs = selectedJobs;
        result.metadata.actualSize = selectedJobs.length;

        // Calculate skipped job counts
        result.skippedJobs.userConcurrencyLimited = candidateJobs.length - filteredJobs.length;
        result.skippedJobs.alreadyExecuting = filteredJobs.length - selectedJobs.length;

        console.log(`[BatchLoader] Successfully loaded batch ${batchId} with ${selectedJobs.length} jobs`);

      } finally {
        // Release batch lock
        await this.concurrencyManager.releaseBatchLock(batchId);
      }

    } catch (error) {
      console.error(`[BatchLoader] Error loading batch ${batchId}:`, error);
      result.skippedJobs.errors = finalConfig.batchSize;
    }

    result.metadata.processingTime = Date.now() - startTime;
    return result;
  }

  /**
   * Fetch candidate jobs from the database
   */
  private async fetchCandidateJobs(config: BatchLoadConfig): Promise<any[]> {
    let query = supabase
      .from('puppet_jobs')
      .select(`
        id,
        user_id,
        job_type,
        job_config,
        priority,
        scheduled_at,
        created_at,
        concurrency_group
      `)
      .eq('status', 'pending')
      .is('final_status', null)
      .is('executing_at', null)
      .lte('scheduled_at', new Date().toISOString());

    // Apply job type filters
    if (config.includeJobTypes && config.includeJobTypes.length > 0) {
      query = query.in('job_type', config.includeJobTypes);
    }

    if (config.excludeJobTypes && config.excludeJobTypes.length > 0) {
      query = query.not('job_type', 'in', `(${config.excludeJobTypes.join(',')})`);
    }

    // Apply user filter
    if (config.userIdFilter && config.userIdFilter.length > 0) {
      query = query.in('user_id', config.userIdFilter);
    }

    // Apply concurrency group filter
    if (config.concurrencyGroup !== 'default') {
      query = query.eq('concurrency_group', config.concurrencyGroup);
    }

    // Order by priority and scheduled time
    if (config.priorityWeighting) {
      query = query.order('priority', { ascending: false });
    }
    query = query.order('scheduled_at', { ascending: true });

    // Fetch more than needed for filtering
    query = query.limit(config.batchSize * 3);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching candidate jobs:', error);
      throw new Error(`Failed to fetch candidate jobs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Filter jobs by user concurrency limits
   */
  private async filterJobsByUserConcurrency(
    jobs: any[], 
    config: BatchLoadConfig
  ): Promise<any[]> {
    // Group jobs by user
    const jobsByUser: Record<string, any[]> = {};
    jobs.forEach(job => {
      if (!jobsByUser[job.user_id]) {
        jobsByUser[job.user_id] = [];
      }
      jobsByUser[job.user_id].push(job);
    });

    // Check concurrency for each user
    const userIds = Object.keys(jobsByUser);
    const concurrencyCheck = await this.concurrencyManager.checkConcurrencyLimits(userIds);

    const filteredJobs: any[] = [];

    // Add jobs from users that can execute more jobs
    for (const userId of concurrencyCheck.allowedUserIds) {
      const userJobs = jobsByUser[userId] || [];
      
      // Limit jobs per user in this batch
      const availableSlots = config.maxUserConcurrentJobs;
      const jobsToAdd = userJobs.slice(0, availableSlots);
      
      filteredJobs.push(...jobsToAdd);
    }

    // Sort filtered jobs by priority and scheduled time again
    filteredJobs.sort((a, b) => {
      if (config.priorityWeighting && a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
    });

    return filteredJobs;
  }

  /**
   * Select and atomically lock jobs for processing
   */
  private async selectAndLockJobs(
    jobs: any[],
    batchId: string,
    config: BatchLoadConfig
  ): Promise<PuppetJobBatch[]> {
    if (jobs.length === 0) {
      return [];
    }

    const jobIds = jobs.map(job => job.id);
    const executingAt = new Date();
    const timeoutAt = new Date(Date.now() + config.timeoutSeconds * 1000);

    // Use database function for atomic locking
    const { data, error } = await supabase.rpc('lock_jobs_for_batch_processing', {
      p_job_ids: jobIds,
      p_batch_id: batchId,
      p_processor_id: this.processorId,
      p_executing_at: executingAt.toISOString(),
      p_timeout_at: timeoutAt.toISOString()
    });

    if (error) {
      console.error('Error locking jobs for batch processing:', error);
      throw new Error(`Failed to lock jobs: ${error.message}`);
    }

    console.log(`[BatchLoader] Successfully locked ${data?.length || 0} jobs for processing`);
    
    return data || [];
  }

  /**
   * Get pending job statistics
   */
  async getJobQueueStats(): Promise<{
    totalPending: number;
    pendingByType: Record<string, number>;
    pendingByUser: Record<string, number>;
    oldestPendingJob: string | null;
    averageWaitTime: number;
  }> {
    try {
      const { data: pendingJobs, error } = await supabase
        .from('puppet_jobs')
        .select('id, job_type, user_id, scheduled_at, created_at')
        .eq('status', 'pending')
        .is('final_status', null)
        .is('executing_at', null);

      if (error) {
        console.error('Error fetching job queue stats:', error);
        return {
          totalPending: 0,
          pendingByType: {},
          pendingByUser: {},
          oldestPendingJob: null,
          averageWaitTime: 0
        };
      }

      const jobs = pendingJobs || [];
      const now = Date.now();

      // Calculate statistics
      const pendingByType: Record<string, number> = {};
      const pendingByUser: Record<string, number> = {};
      let totalWaitTime = 0;
      let oldestJobTime = Infinity;
      let oldestJobId: string | null = null;

      jobs.forEach(job => {
        // Count by type
        pendingByType[job.job_type] = (pendingByType[job.job_type] || 0) + 1;
        
        // Count by user
        pendingByUser[job.user_id] = (pendingByUser[job.user_id] || 0) + 1;
        
        // Calculate wait time
        const jobTime = new Date(job.scheduled_at).getTime();
        const waitTime = now - jobTime;
        totalWaitTime += waitTime;
        
        // Track oldest job
        if (jobTime < oldestJobTime) {
          oldestJobTime = jobTime;
          oldestJobId = job.id;
        }
      });

      const averageWaitTime = jobs.length > 0 ? totalWaitTime / jobs.length : 0;

      return {
        totalPending: jobs.length,
        pendingByType,
        pendingByUser,
        oldestPendingJob: oldestJobId,
        averageWaitTime: Math.round(averageWaitTime / 1000) // Convert to seconds
      };

    } catch (error) {
      console.error('Error in getJobQueueStats:', error);
      return {
        totalPending: 0,
        pendingByType: {},
        pendingByUser: {},
        oldestPendingJob: null,
        averageWaitTime: 0
      };
    }
  }

  /**
   * Reset jobs that have been stuck in executing state
   */
  async resetStuckJobs(timeoutMinutes: number = 5): Promise<number> {
    try {
      const { data } = await supabase.rpc('reset_stuck_jobs', {
        p_timeout_minutes: timeoutMinutes
      });

      const resetCount = data || 0;
      if (resetCount > 0) {
        console.log(`[BatchLoader] Reset ${resetCount} stuck jobs`);
      }

      return resetCount;
    } catch (error) {
      console.error('Error resetting stuck jobs:', error);
      return 0;
    }
  }

  /**
   * Get current executing jobs status
   */
  async getExecutingJobsStatus(): Promise<{
    totalExecuting: number;
    executingByProcessor: Record<string, number>;
    executingByUser: Record<string, number>;
    timeoutWarnings: Array<{ jobId: string; userId: string; executingFor: number }>;
  }> {
    try {
      const { data: executingJobs, error } = await supabase
        .from('puppet_jobs')
        .select('id, user_id, executing_by, executing_at, execution_timeout_at')
        .eq('status', 'in_progress')
        .not('executing_at', 'is', null);

      if (error) {
        console.error('Error fetching executing jobs status:', error);
        return {
          totalExecuting: 0,
          executingByProcessor: {},
          executingByUser: {},
          timeoutWarnings: []
        };
      }

      const jobs = executingJobs || [];
      const now = Date.now();

      const executingByProcessor: Record<string, number> = {};
      const executingByUser: Record<string, number> = {};
      const timeoutWarnings: Array<{ jobId: string; userId: string; executingFor: number }> = [];

      jobs.forEach(job => {
        // Count by processor
        const processor = job.executing_by || 'unknown';
        executingByProcessor[processor] = (executingByProcessor[processor] || 0) + 1;
        
        // Count by user
        executingByUser[job.user_id] = (executingByUser[job.user_id] || 0) + 1;
        
        // Check for timeout warnings
        const executingAt = new Date(job.executing_at).getTime();
        const timeoutAt = new Date(job.execution_timeout_at).getTime();
        const executingFor = Math.round((now - executingAt) / 1000);
        
        if (now > timeoutAt - 30000) { // Warn 30 seconds before timeout
          timeoutWarnings.push({
            jobId: job.id,
            userId: job.user_id,
            executingFor
          });
        }
      });

      return {
        totalExecuting: jobs.length,
        executingByProcessor,
        executingByUser,
        timeoutWarnings
      };

    } catch (error) {
      console.error('Error in getExecutingJobsStatus:', error);
      return {
        totalExecuting: 0,
        executingByProcessor: {},
        executingByUser: {},
        timeoutWarnings: []
      };
    }
  }
}

// Database function for atomic job locking (add to migration)
export const LOCK_JOBS_FUNCTION = `
CREATE OR REPLACE FUNCTION lock_jobs_for_batch_processing(
  p_job_ids UUID[],
  p_batch_id UUID,
  p_processor_id TEXT,
  p_executing_at TIMESTAMPTZ,
  p_timeout_at TIMESTAMPTZ
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  job_type TEXT,
  job_config JSONB,
  priority INTEGER,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  batch_id UUID,
  executing_at TIMESTAMPTZ,
  executing_by TEXT,
  execution_timeout_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Atomically update and return successfully locked jobs
  RETURN QUERY
  UPDATE puppet_jobs 
  SET 
    status = 'in_progress',
    executing_at = p_executing_at,
    executing_by = p_processor_id,
    execution_timeout_at = p_timeout_at,
    batch_id = p_batch_id,
    updated_at = NOW()
  WHERE puppet_jobs.id = ANY(p_job_ids)
    AND puppet_jobs.status = 'pending'
    AND puppet_jobs.final_status IS NULL
    AND puppet_jobs.executing_at IS NULL
  RETURNING 
    puppet_jobs.id,
    puppet_jobs.user_id,
    puppet_jobs.job_type,
    puppet_jobs.job_config,
    puppet_jobs.priority,
    puppet_jobs.scheduled_at,
    puppet_jobs.created_at,
    puppet_jobs.batch_id,
    puppet_jobs.executing_at,
    puppet_jobs.executing_by,
    puppet_jobs.execution_timeout_at;
END;
$$ LANGUAGE plpgsql;
`;

export default BatchJobLoader; 