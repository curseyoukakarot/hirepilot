/**
 * ExecutionHistoryService - Comprehensive tracking and analytics for job execution history
 * Provides detailed insights into job performance, error patterns, and system health
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ExecutionHistoryQuery {
  startDate?: Date;
  endDate?: Date;
  jobType?: string;
  userId?: string;
  batchId?: string;
  outcome?: string;
  executorId?: string;
  limit?: number;
  offset?: number;
}

export interface ExecutionMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  timeoutExecutions: number;
  averageDuration: number;
  medianDuration: number;
  p95Duration: number;
  successRate: number;
  errorBreakdown: Record<string, number>;
  dailyTrends: Array<{
    date: string;
    executions: number;
    successRate: number;
    averageDuration: number;
  }>;
}

export interface BatchMetrics {
  totalBatches: number;
  averageBatchSize: number;
  averageBatchDuration: number;
  batchSuccessRate: number;
  processorPerformance: Record<string, {
    batches: number;
    totalJobs: number;
    successRate: number;
    averageDuration: number;
  }>;
}

export interface ErrorAnalysis {
  topErrors: Array<{
    error: string;
    count: number;
    percentage: number;
    firstSeen: Date;
    lastSeen: Date;
  }>;
  errorTrends: Array<{
    date: string;
    errorType: string;
    count: number;
  }>;
  errorsByJobType: Record<string, Record<string, number>>;
  errorsByUser: Record<string, number>;
}

export class ExecutionHistoryService {

  /**
   * Get execution history with filtering and pagination
   */
  async getExecutionHistory(query: ExecutionHistoryQuery = {}): Promise<{
    executions: any[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      let dbQuery = supabase
        .from('puppet_job_execution_logs')
        .select(`
          id,
          job_id,
          batch_id,
          executor_id,
          start_time,
          end_time,
          duration_ms,
          outcome,
          error_message,
          error_type,
          execution_context,
          puppet_jobs!inner (
            user_id,
            job_type,
            priority
          )
        `, { count: 'exact' });

      // Apply filters
      if (query.startDate) {
        dbQuery = dbQuery.gte('start_time', query.startDate.toISOString());
      }

      if (query.endDate) {
        dbQuery = dbQuery.lte('start_time', query.endDate.toISOString());
      }

      if (query.jobType) {
        dbQuery = dbQuery.eq('puppet_jobs.job_type', query.jobType);
      }

      if (query.userId) {
        dbQuery = dbQuery.eq('puppet_jobs.user_id', query.userId);
      }

      if (query.batchId) {
        dbQuery = dbQuery.eq('batch_id', query.batchId);
      }

      if (query.outcome) {
        dbQuery = dbQuery.eq('outcome', query.outcome);
      }

      if (query.executorId) {
        dbQuery = dbQuery.eq('executor_id', query.executorId);
      }

      // Apply pagination
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      
      dbQuery = dbQuery
        .order('start_time', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await dbQuery;

      if (error) {
        console.error('Error fetching execution history:', error);
        throw new Error(`Failed to fetch execution history: ${error.message}`);
      }

      return {
        executions: data || [],
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      };

    } catch (error) {
      console.error('Error in getExecutionHistory:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive execution metrics
   */
  async getExecutionMetrics(query: ExecutionHistoryQuery = {}): Promise<ExecutionMetrics> {
    try {
      const startDate = query.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to last 7 days
      const endDate = query.endDate || new Date();

      // Get detailed metrics using SQL views and functions
      const { data: metricsData, error: metricsError } = await supabase
        .rpc('get_execution_metrics', {
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString(),
          p_job_type: query.jobType,
          p_user_id: query.userId
        });

      if (metricsError) {
        console.error('Error fetching execution metrics:', metricsError);
        throw new Error(`Failed to fetch execution metrics: ${metricsError.message}`);
      }

      // Get daily trends
      const dailyTrends = await this.getDailyTrends(startDate, endDate, query);

      // Get error breakdown
      const errorBreakdown = await this.getErrorBreakdown(startDate, endDate, query);

      return {
        totalExecutions: metricsData?.total_executions || 0,
        successfulExecutions: metricsData?.successful_executions || 0,
        failedExecutions: metricsData?.failed_executions || 0,
        timeoutExecutions: metricsData?.timeout_executions || 0,
        averageDuration: metricsData?.avg_duration_ms || 0,
        medianDuration: metricsData?.median_duration_ms || 0,
        p95Duration: metricsData?.p95_duration_ms || 0,
        successRate: metricsData?.success_rate_percent || 0,
        errorBreakdown,
        dailyTrends
      };

    } catch (error) {
      console.error('Error in getExecutionMetrics:', error);
      throw error;
    }
  }

  /**
   * Get batch-level metrics
   */
  async getBatchMetrics(query: ExecutionHistoryQuery = {}): Promise<BatchMetrics> {
    try {
      const startDate = query.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate || new Date();

      // Get batch metrics
      const { data: batchData, error: batchError } = await supabase
        .rpc('get_batch_metrics', {
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString()
        });

      if (batchError) {
        console.error('Error fetching batch metrics:', batchError);
        throw new Error(`Failed to fetch batch metrics: ${batchError.message}`);
      }

      // Get processor performance
      const processorPerformance = await this.getProcessorPerformance(startDate, endDate);

      return {
        totalBatches: batchData?.total_batches || 0,
        averageBatchSize: batchData?.avg_batch_size || 0,
        averageBatchDuration: batchData?.avg_batch_duration_ms || 0,
        batchSuccessRate: batchData?.batch_success_rate || 0,
        processorPerformance
      };

    } catch (error) {
      console.error('Error in getBatchMetrics:', error);
      throw error;
    }
  }

  /**
   * Get detailed error analysis
   */
  async getErrorAnalysis(query: ExecutionHistoryQuery = {}): Promise<ErrorAnalysis> {
    try {
      const startDate = query.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate || new Date();

      // Get top errors
      const topErrors = await this.getTopErrors(startDate, endDate, query);
      
      // Get error trends
      const errorTrends = await this.getErrorTrends(startDate, endDate, query);
      
      // Get errors by job type
      const errorsByJobType = await this.getErrorsByJobType(startDate, endDate, query);
      
      // Get errors by user
      const errorsByUser = await this.getErrorsByUser(startDate, endDate, query);

      return {
        topErrors,
        errorTrends,
        errorsByJobType,
        errorsByUser
      };

    } catch (error) {
      console.error('Error in getErrorAnalysis:', error);
      throw error;
    }
  }

  /**
   * Get performance insights for optimization
   */
  async getPerformanceInsights(query: ExecutionHistoryQuery = {}): Promise<{
    slowestJobTypes: Array<{ jobType: string; avgDuration: number; count: number }>;
    peakHours: Array<{ hour: number; avgDuration: number; jobCount: number }>;
    userPerformance: Array<{ userId: string; avgDuration: number; successRate: number; jobCount: number }>;
    recommendations: string[];
  }> {
    try {
      const startDate = query.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate || new Date();

      // Get slowest job types
      const { data: slowestJobs } = await supabase
        .from('puppet_job_execution_logs')
        .select(`
          outcome,
          duration_ms,
          puppet_jobs!inner (job_type)
        `)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .eq('outcome', 'completed')
        .not('duration_ms', 'is', null);

      // Process slowest job types
      const jobTypeStats: Record<string, { total: number; count: number }> = {};
      (slowestJobs || []).forEach((job: any) => {
        const jobType = job.puppet_jobs?.job_type;
        if (jobType && !jobTypeStats[jobType]) {
          jobTypeStats[jobType] = { total: 0, count: 0 };
        }
        if (jobType) {
          jobTypeStats[jobType].total += job.duration_ms;
          jobTypeStats[jobType].count += 1;
        }
      });

      const slowestJobTypes = Object.entries(jobTypeStats)
        .map(([jobType, stats]) => ({
          jobType,
          avgDuration: Math.round(stats.total / stats.count),
          count: stats.count
        }))
        .sort((a, b) => b.avgDuration - a.avgDuration)
        .slice(0, 10);

      // Get peak hours analysis
      const peakHours = await this.getPeakHoursAnalysis(startDate, endDate);

      // Get user performance
      const userPerformance = await this.getUserPerformance(startDate, endDate);

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        slowestJobTypes,
        peakHours,
        userPerformance
      });

      return {
        slowestJobTypes,
        peakHours,
        userPerformance,
        recommendations
      };

    } catch (error) {
      console.error('Error in getPerformanceInsights:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async getDailyTrends(
    startDate: Date, 
    endDate: Date, 
    query: ExecutionHistoryQuery
  ): Promise<Array<{ date: string; executions: number; successRate: number; averageDuration: number }>> {
    const { data } = await supabase
      .rpc('get_daily_execution_trends', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
        p_job_type: query.jobType,
        p_user_id: query.userId
      });

    return data || [];
  }

  private async getErrorBreakdown(
    startDate: Date, 
    endDate: Date, 
    query: ExecutionHistoryQuery
  ): Promise<Record<string, number>> {
    const { data } = await supabase
      .from('puppet_job_execution_logs')
      .select('error_type')
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .eq('outcome', 'failed')
      .not('error_type', 'is', null);

    const breakdown: Record<string, number> = {};
    (data || []).forEach(row => {
      breakdown[row.error_type] = (breakdown[row.error_type] || 0) + 1;
    });

    return breakdown;
  }

  private async getTopErrors(
    startDate: Date, 
    endDate: Date, 
    query: ExecutionHistoryQuery
  ): Promise<Array<{ error: string; count: number; percentage: number; firstSeen: Date; lastSeen: Date }>> {
    const { data } = await supabase
      .from('puppet_job_execution_logs')
      .select('error_message, start_time')
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .eq('outcome', 'failed')
      .not('error_message', 'is', null);

    const errorStats: Record<string, { count: number; firstSeen: Date; lastSeen: Date }> = {};
    const totalErrors = data?.length || 0;

    (data || []).forEach(row => {
      const error = row.error_message;
      const date = new Date(row.start_time);
      
      if (!errorStats[error]) {
        errorStats[error] = { count: 0, firstSeen: date, lastSeen: date };
      }
      
      errorStats[error].count++;
      if (date < errorStats[error].firstSeen) errorStats[error].firstSeen = date;
      if (date > errorStats[error].lastSeen) errorStats[error].lastSeen = date;
    });

    return Object.entries(errorStats)
      .map(([error, stats]) => ({
        error,
        count: stats.count,
        percentage: totalErrors > 0 ? (stats.count / totalErrors) * 100 : 0,
        firstSeen: stats.firstSeen,
        lastSeen: stats.lastSeen
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  private async getErrorTrends(
    startDate: Date, 
    endDate: Date, 
    query: ExecutionHistoryQuery
  ): Promise<Array<{ date: string; errorType: string; count: number }>> {
    const { data } = await supabase
      .rpc('get_error_trends', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
        p_job_type: query.jobType
      });

    return data || [];
  }

  private async getErrorsByJobType(
    startDate: Date, 
    endDate: Date, 
    query: ExecutionHistoryQuery
  ): Promise<Record<string, Record<string, number>>> {
    const { data } = await supabase
      .from('puppet_job_execution_logs')
      .select(`
        error_type,
        puppet_jobs!inner (job_type)
      `)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .eq('outcome', 'failed')
      .not('error_type', 'is', null);

    const breakdown: Record<string, Record<string, number>> = {};
    (data || []).forEach(row => {
      const jobType = row.puppet_jobs.job_type;
      const errorType = row.error_type;
      
      if (!breakdown[jobType]) breakdown[jobType] = {};
      breakdown[jobType][errorType] = (breakdown[jobType][errorType] || 0) + 1;
    });

    return breakdown;
  }

  private async getErrorsByUser(
    startDate: Date, 
    endDate: Date, 
    query: ExecutionHistoryQuery
  ): Promise<Record<string, number>> {
    const { data } = await supabase
      .from('puppet_job_execution_logs')
      .select(`
        puppet_jobs!inner (user_id)
      `)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .eq('outcome', 'failed');

    const breakdown: Record<string, number> = {};
    (data || []).forEach(row => {
      const userId = row.puppet_jobs.user_id;
      breakdown[userId] = (breakdown[userId] || 0) + 1;
    });

    return breakdown;
  }

  private async getProcessorPerformance(
    startDate: Date, 
    endDate: Date
  ): Promise<Record<string, { batches: number; totalJobs: number; successRate: number; averageDuration: number }>> {
    const { data } = await supabase
      .rpc('get_processor_performance', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      });

    const performance: Record<string, any> = {};
    (data || []).forEach(row => {
      performance[row.executor_id] = {
        batches: row.batch_count,
        totalJobs: row.job_count,
        successRate: row.success_rate,
        averageDuration: row.avg_duration
      };
    });

    return performance;
  }

  private async getPeakHoursAnalysis(
    startDate: Date, 
    endDate: Date
  ): Promise<Array<{ hour: number; avgDuration: number; jobCount: number }>> {
    const { data } = await supabase
      .rpc('get_peak_hours_analysis', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      });

    return data || [];
  }

  private async getUserPerformance(
    startDate: Date, 
    endDate: Date
  ): Promise<Array<{ userId: string; avgDuration: number; successRate: number; jobCount: number }>> {
    const { data } = await supabase
      .rpc('get_user_performance', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      });

    return data || [];
  }

  private generateRecommendations(insights: {
    slowestJobTypes: any[];
    peakHours: any[];
    userPerformance: any[];
  }): string[] {
    const recommendations: string[] = [];

    // Job type recommendations
    if (insights.slowestJobTypes.length > 0) {
      const slowest = insights.slowestJobTypes[0];
      if (slowest.avgDuration > 60000) { // > 1 minute
        recommendations.push(`Consider optimizing ${slowest.jobType} jobs - averaging ${Math.round(slowest.avgDuration/1000)}s execution time`);
      }
    }

    // Peak hours recommendations
    const highLoadHours = insights.peakHours.filter(h => h.jobCount > 100);
    if (highLoadHours.length > 0) {
      recommendations.push(`Consider load balancing during peak hours: ${highLoadHours.map(h => `${h.hour}:00`).join(', ')}`);
    }

    // User performance recommendations
    const lowPerformanceUsers = insights.userPerformance.filter(u => u.successRate < 80);
    if (lowPerformanceUsers.length > 0) {
      recommendations.push(`${lowPerformanceUsers.length} users have success rates below 80% - consider reviewing their job configurations`);
    }

    if (recommendations.length === 0) {
      recommendations.push('System performance looks good! No immediate optimizations needed.');
    }

    return recommendations;
  }
}

export default ExecutionHistoryService; 