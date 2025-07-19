/**
 * Test Script for Retry + Backoff System
 * Tests all retry functionality including database functions, services, and integration
 */

import { createClient } from '@supabase/supabase-js';
import { retryManager } from './services/puppet/retryManager';
import { retryHistoryService } from './services/puppet/retryHistoryService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TestResult {
  test: string;
  passed: boolean;
  details: string;
  duration: number;
}

class RetrySystemTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Retry System Tests...\n');

    // Test 1: Database schema and functions
    await this.testDatabaseSchema();
    await this.testRetryFunctions();
    
    // Test 2: Create test job for retry testing
    const testJobId = await this.createTestJob();
    if (!testJobId) {
      console.log('❌ Failed to create test job, stopping tests');
      return;
    }
    
    // Test 3: Retry manager functionality
    await this.testRetryScheduling(testJobId);
    await this.testRetryConfiguration();
    
    // Test 4: Retry history service
    await this.testRetryHistoryLogging(testJobId);
    await this.testRetryAnalytics();
    
    // Test 5: End-to-end retry flow
    await this.testEndToEndRetryFlow();
    
    // Test 6: Cleanup
    await this.cleanup(testJobId);
    
    // Show results
    this.showResults();
  }

  private async testDatabaseSchema(): Promise<void> {
    const start = Date.now();
    
    try {
      // Test that retry tables exist and are accessible
      const { data: retryHistory, error: historyError } = await supabase
        .from('puppet_job_retry_history')
        .select('count')
        .limit(1);

      const { data: retryConfig, error: configError } = await supabase
        .from('puppet_job_retry_config')
        .select('count')
        .limit(1);

      const { data: puppetJobs, error: jobsError } = await supabase
        .from('puppet_jobs')
        .select('retry_count, next_retry_at, last_attempt_at')
        .limit(1);

      if (historyError || configError || jobsError) {
        throw new Error(`Schema errors: ${historyError?.message || configError?.message || jobsError?.message}`);
      }

      this.results.push({
        test: 'Database Schema',
        passed: true,
        details: 'All retry tables and columns exist',
        duration: Date.now() - start
      });
    } catch (error) {
      this.results.push({
        test: 'Database Schema',
        passed: false,
        details: error.message,
        duration: Date.now() - start
      });
    }
  }

  private async testRetryFunctions(): Promise<void> {
    const start = Date.now();
    
    try {
      // Test calculate_retry_delay function
      const { data: delayResult, error: delayError } = await supabase.rpc('calculate_retry_delay', {
        p_retry_count: 2,
        p_base_delay_seconds: 10,
        p_backoff_multiplier: 2.0,
        p_max_delay_seconds: 3600
      });

      if (delayError) {
        throw new Error(`calculate_retry_delay error: ${delayError.message}`);
      }

      // Test get_retry_config function
      const { data: configResult, error: configError } = await supabase.rpc('get_retry_config', {
        p_job_type: 'default'
      });

      if (configError) {
        throw new Error(`get_retry_config error: ${configError.message}`);
      }

      // Test get_jobs_ready_for_retry function
      const { data: retryJobsResult, error: retryJobsError } = await supabase.rpc('get_jobs_ready_for_retry', {
        p_limit: 10
      });

      if (retryJobsError) {
        throw new Error(`get_jobs_ready_for_retry error: ${retryJobsError.message}`);
      }

      this.results.push({
        test: 'Database Functions',
        passed: true,
        details: `Functions working: delay=${delayResult}s, config=${configResult?.job_type}, retry_jobs=${retryJobsResult?.length || 0}`,
        duration: Date.now() - start
      });
    } catch (error) {
      this.results.push({
        test: 'Database Functions',
        passed: false,
        details: error.message,
        duration: Date.now() - start
      });
    }
  }

  private async createTestJob(): Promise<string | null> {
    const start = Date.now();
    
    try {
      const { data, error } = await supabase
        .from('puppet_jobs')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000', // Test user ID
          job_type: 'test_retry_job',
          job_config: { test: true, description: 'Test job for retry system' },
          priority: 1,
          status: 'queued',
          scheduled_at: new Date().toISOString(),
          retry_enabled: true,
          max_retries: 3
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Create test job error: ${error.message}`);
      }

      this.results.push({
        test: 'Create Test Job',
        passed: true,
        details: `Test job created: ${data.id}`,
        duration: Date.now() - start
      });

      return data.id;
    } catch (error) {
      this.results.push({
        test: 'Create Test Job',
        passed: false,
        details: error.message,
        duration: Date.now() - start
      });
      return null;
    }
  }

  private async testRetryScheduling(jobId: string): Promise<void> {
    const start = Date.now();
    
    try {
      // Test scheduling a retry for network error (should retry)
      const retryScheduled = await retryManager.scheduleRetry(
        jobId,
        'Network timeout occurred',
        'network',
        'test-executor'
      );

      if (!retryScheduled) {
        throw new Error('Retry should have been scheduled for network error');
      }

      // Verify job was updated with retry info
      const { data: updatedJob, error } = await supabase
        .from('puppet_jobs')
        .select('retry_count, next_retry_at, last_attempt_at, final_status')
        .eq('id', jobId)
        .single();

      if (error) {
        throw new Error(`Error fetching updated job: ${error.message}`);
      }

      if (updatedJob.retry_count !== 1 || !updatedJob.next_retry_at) {
        throw new Error(`Job not properly updated: retry_count=${updatedJob.retry_count}, next_retry_at=${updatedJob.next_retry_at}`);
      }

      this.results.push({
        test: 'Retry Scheduling',
        passed: true,
        details: `Retry scheduled successfully: retry_count=${updatedJob.retry_count}, next_retry_at=${updatedJob.next_retry_at}`,
        duration: Date.now() - start
      });
    } catch (error) {
      this.results.push({
        test: 'Retry Scheduling',
        passed: false,
        details: error.message,
        duration: Date.now() - start
      });
    }
  }

  private async testRetryConfiguration(): Promise<void> {
    const start = Date.now();
    
    try {
      // Test getting retry configuration
      const config = await retryManager.getRetryConfig('test_retry_job');
      
      if (!config) {
        throw new Error('No retry configuration found');
      }

      if (config.maxRetries <= 0 || config.baseDelaySeconds <= 0) {
        throw new Error(`Invalid config: maxRetries=${config.maxRetries}, baseDelaySeconds=${config.baseDelaySeconds}`);
      }

      this.results.push({
        test: 'Retry Configuration',
        passed: true,
        details: `Config loaded: maxRetries=${config.maxRetries}, baseDelay=${config.baseDelaySeconds}s`,
        duration: Date.now() - start
      });
    } catch (error) {
      this.results.push({
        test: 'Retry Configuration',
        passed: false,
        details: error.message,
        duration: Date.now() - start
      });
    }
  }

  private async testRetryHistoryLogging(jobId: string): Promise<void> {
    const start = Date.now();
    
    try {
      // Log a retry attempt
      const historyId = await retryHistoryService.logRetryAttempt({
        jobId,
        attemptNumber: 1,
        errorMessage: 'Test error for retry system',
        errorType: 'test_error',
        success: false,
        delaySeconds: 3600,
        backoffMultiplier: 2.0,
        retryReason: 'test',
        executorId: 'test-executor'
      });

      if (!historyId) {
        throw new Error('Failed to log retry attempt');
      }

      // Verify history was logged
      const history = await retryHistoryService.getJobRetryHistory(jobId);
      
      if (history.length === 0) {
        throw new Error('No retry history found after logging');
      }

      this.results.push({
        test: 'Retry History Logging',
        passed: true,
        details: `History logged: ${history.length} attempts, latest attempt=${history[0].attemptNumber}`,
        duration: Date.now() - start
      });
    } catch (error) {
      this.results.push({
        test: 'Retry History Logging',
        passed: false,
        details: error.message,
        duration: Date.now() - start
      });
    }
  }

  private async testRetryAnalytics(): Promise<void> {
    const start = Date.now();
    
    try {
      // Get retry analytics
      const analytics = await retryHistoryService.getRetryAnalytics({
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Last 24 hours
      });

      if (!analytics) {
        throw new Error('Failed to get retry analytics');
      }

      this.results.push({
        test: 'Retry Analytics',
        passed: true,
        details: `Analytics: ${analytics.totalRetries} total retries, ${analytics.successfulRetries} successful, ${analytics.commonErrorTypes.length} error types`,
        duration: Date.now() - start
      });
    } catch (error) {
      this.results.push({
        test: 'Retry Analytics',
        passed: false,
        details: error.message,
        duration: Date.now() - start
      });
    }
  }

  private async testEndToEndRetryFlow(): Promise<void> {
    const start = Date.now();
    
    try {
      // Create a job that will fail and test the full retry flow
      const { data: failJob, error } = await supabase
        .from('puppet_jobs')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000',
          job_type: 'test_fail_job',
          job_config: { test: true, shouldFail: true },
          priority: 1,
          status: 'queued',
          scheduled_at: new Date().toISOString(),
          retry_enabled: true,
          max_retries: 2
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Error creating fail job: ${error.message}`);
      }

      // Simulate job failure and retry scheduling
      const retryScheduled = await retryManager.scheduleRetry(
        failJob.id,
        'Simulated failure for testing',
        'timeout',
        'test-executor'
      );

      // Test fetching jobs ready for retry
      const { data: retryJobs, error: retryError } = await supabase.rpc('get_jobs_ready_for_retry', {
        p_limit: 10
      });

      if (retryError) {
        throw new Error(`Error fetching retry jobs: ${retryError.message}`);
      }

      // Clean up the test job
      await supabase.from('puppet_jobs').delete().eq('id', failJob.id);

      this.results.push({
        test: 'End-to-End Retry Flow',
        passed: true,
        details: `Flow completed: retry_scheduled=${retryScheduled}, retry_jobs_found=${retryJobs?.length || 0}`,
        duration: Date.now() - start
      });
    } catch (error) {
      this.results.push({
        test: 'End-to-End Retry Flow',
        passed: false,
        details: error.message,
        duration: Date.now() - start
      });
    }
  }

  private async cleanup(testJobId: string): Promise<void> {
    const start = Date.now();
    
    try {
      // Clean up test data
      await supabase.from('puppet_job_retry_history').delete().eq('job_id', testJobId);
      await supabase.from('puppet_jobs').delete().eq('id', testJobId);

      this.results.push({
        test: 'Cleanup',
        passed: true,
        details: 'Test data cleaned up successfully',
        duration: Date.now() - start
      });
    } catch (error) {
      this.results.push({
        test: 'Cleanup',
        passed: false,
        details: error.message,
        duration: Date.now() - start
      });
    }
  }

  private showResults(): void {
    console.log('\n📊 Test Results:');
    console.log('================');
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.test} (${result.duration}ms)`);
      console.log(`   ${result.details}\n`);
    });
    
    console.log(`📋 Summary: ${passed}/${total} tests passed (${failed} failed)`);
    
    if (failed === 0) {
      console.log('🎉 All retry system tests passed! The retry system is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please review the errors above.');
    }
  }
}

// Run the tests
async function runRetrySystemTests() {
  const tester = new RetrySystemTester();
  await tester.runAllTests();
}

// Export for use
export { runRetrySystemTests };

// Run if called directly
if (require.main === module) {
  runRetrySystemTests().catch(console.error);
} 