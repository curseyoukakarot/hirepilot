import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface RetryAttempt {
  id: string;
  jobId: string;
  attemptNumber: number;
  attemptedAt: string;
  errorMessage?: string;
  errorType?: string;
  success: boolean;
  delaySeconds: number;
  backoffMultiplier: number;
  jitterSeconds: number;
  retryReason: string;
  executorId: string;
  executionContext: any;
}

export interface RetryAnalytics {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  averageAttemptsToSuccess: number;
  commonErrorTypes: Array<{ errorType: string; count: number }>;
  retryDistribution: Array<{ attemptNumber: number; count: number }>;
  averageDelaySeconds: number;
  jobTypeBreakdown: Array<{ jobType: string; totalRetries: number; successRate: number }>;
}

export interface RetryHistoryFilter {
  jobId?: string;
  jobType?: string;
  success?: boolean;
  errorType?: string;
  attemptNumber?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class RetryHistoryService {
  
  /**
   * Log a retry attempt to the history
   */
  async logRetryAttempt(params: {
    jobId: string;
    attemptNumber: number;
    errorMessage?: string;
    errorType?: string;
    success: boolean;
    delaySeconds: number;
    backoffMultiplier?: number;
    jitterSeconds?: number;
    retryReason?: string;
    executorId?: string;
    executionContext?: any;
  }): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('puppet_job_retry_history')
        .insert({
          job_id: params.jobId,
          attempt_number: params.attemptNumber,
          attempted_at: new Date().toISOString(),
          error_message: params.errorMessage,
          error_type: params.errorType,
          success: params.success,
          delay_seconds: params.delaySeconds,
          backoff_multiplier: params.backoffMultiplier || 2.0,
          jitter_seconds: params.jitterSeconds || 0,
          retry_reason: params.retryReason || 'automatic',
          executor_id: params.executorId || 'unknown',
          execution_context: params.executionContext || {}
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Error logging retry attempt:', error);
        return null;
      }

      console.log(`📝 Logged retry attempt ${params.attemptNumber} for job ${params.jobId}`);
      return data.id;
    } catch (error) {
      console.error('❌ Exception logging retry attempt:', error);
      return null;
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
        .order('attempt_number', { ascending: true });

      if (error) {
        console.error('❌ Error fetching job retry history:', error);
        return [];
      }

      return data.map(this.mapToRetryAttempt);
    } catch (error) {
      console.error('❌ Exception fetching job retry history:', error);
      return [];
    }
  }

  /**
   * Get filtered retry history with pagination
   */
  async getRetryHistory(filter: RetryHistoryFilter = {}): Promise<{
    attempts: RetryAttempt[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      let query = supabase
        .from('puppet_job_retry_history')
        .select(`
          *,
          puppet_jobs!inner(job_type, user_id)
        `, { count: 'exact' });

      // Apply filters
      if (filter.jobId) {
        query = query.eq('job_id', filter.jobId);
      }
      
      if (filter.jobType) {
        query = query.eq('puppet_jobs.job_type', filter.jobType);
      }
      
      if (filter.success !== undefined) {
        query = query.eq('success', filter.success);
      }
      
      if (filter.errorType) {
        query = query.eq('error_type', filter.errorType);
      }
      
      if (filter.attemptNumber) {
        query = query.eq('attempt_number', filter.attemptNumber);
      }
      
      if (filter.startDate) {
        query = query.gte('attempted_at', filter.startDate);
      }
      
      if (filter.endDate) {
        query = query.lte('attempted_at', filter.endDate);
      }

      // Apply pagination
      const limit = filter.limit || 50;
      const offset = filter.offset || 0;
      
      query = query
        .order('attempted_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('❌ Error fetching retry history:', error);
        return { attempts: [], total: 0, hasMore: false };
      }

      const attempts = data.map(this.mapToRetryAttempt);
      const total = count || 0;
      const hasMore = (offset + limit) < total;

      return { attempts, total, hasMore };
    } catch (error) {
      console.error('❌ Exception fetching retry history:', error);
      return { attempts: [], total: 0, hasMore: false };
    }
  }

  /**
   * Get retry analytics and statistics
   */
  async getRetryAnalytics(filter: {
    jobType?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<RetryAnalytics | null> {
    try {
      // Base query for analytics
      let analyticsQuery = supabase
        .from('puppet_job_retry_history')
        .select(`
          *,
          puppet_jobs!inner(job_type)
        `);

      if (filter.jobType) {
        analyticsQuery = analyticsQuery.eq('puppet_jobs.job_type', filter.jobType);
      }
      
      if (filter.startDate) {
        analyticsQuery = analyticsQuery.gte('attempted_at', filter.startDate);
      }
      
      if (filter.endDate) {
        analyticsQuery = analyticsQuery.lte('attempted_at', filter.endDate);
      }

      const { data: retryData, error } = await analyticsQuery;

      if (error) {
        console.error('❌ Error fetching retry analytics:', error);
        return null;
      }

      // Calculate analytics
      const totalRetries = retryData.length;
      const successfulRetries = retryData.filter(r => r.success).length;
      const failedRetries = totalRetries - successfulRetries;

      // Group by job to calculate average attempts to success
      const jobAttempts = new Map<string, { attempts: number; success: boolean }>();
      retryData.forEach(attempt => {
        const current = jobAttempts.get(attempt.job_id) || { attempts: 0, success: false };
        jobAttempts.set(attempt.job_id, {
          attempts: Math.max(current.attempts, attempt.attempt_number),
          success: current.success || attempt.success
        });
      });

      const successfulJobs = Array.from(jobAttempts.values()).filter(j => j.success);
      const averageAttemptsToSuccess = successfulJobs.length > 0
        ? successfulJobs.reduce((sum, j) => sum + j.attempts, 0) / successfulJobs.length
        : 0;

      // Common error types
      const errorTypeCounts = new Map<string, number>();
      retryData.forEach(attempt => {
        if (attempt.error_type) {
          errorTypeCounts.set(attempt.error_type, (errorTypeCounts.get(attempt.error_type) || 0) + 1);
        }
      });
      const commonErrorTypes = Array.from(errorTypeCounts.entries())
        .map(([errorType, count]) => ({ errorType, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Retry distribution by attempt number
      const attemptCounts = new Map<number, number>();
      retryData.forEach(attempt => {
        attemptCounts.set(attempt.attempt_number, (attemptCounts.get(attempt.attempt_number) || 0) + 1);
      });
      const retryDistribution = Array.from(attemptCounts.entries())
        .map(([attemptNumber, count]) => ({ attemptNumber, count }))
        .sort((a, b) => a.attemptNumber - b.attemptNumber);

      // Average delay
      const totalDelay = retryData.reduce((sum, attempt) => sum + (attempt.delay_seconds || 0), 0);
      const averageDelaySeconds = totalRetries > 0 ? totalDelay / totalRetries : 0;

      // Job type breakdown
      const jobTypeStats = new Map<string, { total: number; successful: number }>();
      retryData.forEach(attempt => {
        const jobType = attempt.puppet_jobs?.job_type || 'unknown';
        const current = jobTypeStats.get(jobType) || { total: 0, successful: 0 };
        jobTypeStats.set(jobType, {
          total: current.total + 1,
          successful: current.successful + (attempt.success ? 1 : 0)
        });
      });
      const jobTypeBreakdown = Array.from(jobTypeStats.entries())
        .map(([jobType, stats]) => ({
          jobType,
          totalRetries: stats.total,
          successRate: stats.total > 0 ? (stats.successful / stats.total) * 100 : 0
        }))
        .sort((a, b) => b.totalRetries - a.totalRetries);

      return {
        totalRetries,
        successfulRetries,
        failedRetries,
        averageAttemptsToSuccess,
        commonErrorTypes,
        retryDistribution,
        averageDelaySeconds,
        jobTypeBreakdown
      };
    } catch (error) {
      console.error('❌ Exception calculating retry analytics:', error);
      return null;
    }
  }

  /**
   * Get jobs that have exceeded retry limits and need escalation
   */
  async getJobsNeedingEscalation(): Promise<Array<{
    jobId: string;
    userId: string;
    jobType: string;
    retryCount: number;
    maxRetries: number;
    lastError: string;
    lastAttemptAt: string;
  }>> {
    try {
      const { data, error } = await supabase
        .from('puppet_jobs')
        .select('*')
        .eq('final_status', 'permanently_failed')
        .gte('retry_count', 5) // Jobs that failed after max retries
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching jobs needing escalation:', error);
        return [];
      }

      return data.map(job => ({
        jobId: job.id,
        userId: job.user_id,
        jobType: job.job_type || 'unknown',
        retryCount: job.retry_count || 0,
        maxRetries: job.max_retries || 5,
        lastError: job.last_execution_error || 'No error message',
        lastAttemptAt: job.last_attempt_at || job.updated_at
      }));
    } catch (error) {
      console.error('❌ Exception fetching jobs needing escalation:', error);
      return [];
    }
  }

  /**
   * Clean up old retry history entries
   */
  async cleanupOldRetryHistory(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { count, error } = await supabase
        .from('puppet_job_retry_history')
        .delete()
        .lt('attempted_at', cutoffDate.toISOString());

      if (error) {
        console.error('❌ Error cleaning up retry history:', error);
        return 0;
      }

      console.log(`🧹 Cleaned up ${count} old retry history entries`);
      return count || 0;
    } catch (error) {
      console.error('❌ Exception cleaning up retry history:', error);
      return 0;
    }
  }

  /**
   * Map database row to RetryAttempt interface
   */
  private mapToRetryAttempt(row: any): RetryAttempt {
    return {
      id: row.id,
      jobId: row.job_id,
      attemptNumber: row.attempt_number,
      attemptedAt: row.attempted_at,
      errorMessage: row.error_message,
      errorType: row.error_type,
      success: row.success,
      delaySeconds: row.delay_seconds,
      backoffMultiplier: row.backoff_multiplier,
      jitterSeconds: row.jitter_seconds || 0,
      retryReason: row.retry_reason,
      executorId: row.executor_id,
      executionContext: row.execution_context
    };
  }
}

export const retryHistoryService = new RetryHistoryService(); 