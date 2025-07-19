#!/usr/bin/env node

/**
 * Test script for Cron Processor System
 * Demonstrates the functionality and API usage
 */

import CronProcessor from '../services/puppet/cronProcessor';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createTestJobs(count: number = 5) {
  console.log(`🎯 Creating ${count} test jobs...`);
  
  const testJobs = Array.from({ length: count }, (_, i) => ({
    job_type: 'test_job',
    job_config: {
      test_data: `Test job ${i + 1}`,
      delay_ms: Math.floor(Math.random() * 5000) + 1000 // 1-6 seconds
    },
    priority: Math.floor(Math.random() * 10),
    scheduled_at: new Date().toISOString(),
    status: 'pending'
  }));

  const { data, error } = await supabase
    .from('puppet_jobs')
    .insert(testJobs)
    .select('id');

  if (error) {
    console.error('❌ Error creating test jobs:', error);
    return [];
  }

  console.log(`✅ Created ${data?.length || 0} test jobs`);
  return data || [];
}

async function testCronProcessor() {
  console.log('🚀 Starting Cron Processor Test');
  console.log('================================');

  try {
    // 1. Create test jobs
    const testJobs = await createTestJobs(10);
    
    if (testJobs.length === 0) {
      console.log('❌ No test jobs created, exiting');
      return;
    }

    // 2. Initialize cron processor
    console.log('\n📦 Initializing Cron Processor...');
    const processor = new CronProcessor({
      batchSize: 5,
      maxConcurrentJobs: 3,
      timeoutSeconds: 30,
      enableSlackAlerts: false
    });

    // 3. Start processor
    console.log('🎯 Starting processor...');
    await processor.start();

    // 4. Check initial status
    console.log('\n📊 Initial Status:');
    const initialStatus = await processor.getStatus();
    console.log('- Processor ID:', initialStatus.processorId);
    console.log('- Queue Stats:', initialStatus.queueStats);
    console.log('- Concurrency Stats:', initialStatus.concurrencyStats);

    // 5. Process first batch
    console.log('\n🔄 Processing first batch...');
    const result1 = await processor.processBatch();
    console.log('Batch Result:', {
      batchId: result1.batchId,
      totalJobs: result1.totalJobs,
      successfulJobs: result1.successfulJobs,
      failedJobs: result1.failedJobs,
      duration: `${result1.duration}ms`,
      skippedJobs: result1.skippedJobs
    });

    if (result1.errors.length > 0) {
      console.log('⚠️ Errors encountered:');
      result1.errors.forEach(error => {
        console.log(`  - Job ${error.jobId}: ${error.error} (${error.type})`);
      });
    }

    // 6. Wait a bit and process another batch
    console.log('\n⏱️ Waiting 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🔄 Processing second batch...');
    const result2 = await processor.processBatch();
    console.log('Batch Result:', {
      batchId: result2.batchId,
      totalJobs: result2.totalJobs,
      successfulJobs: result2.successfulJobs,
      failedJobs: result2.failedJobs,
      duration: `${result2.duration}ms`
    });

    // 7. Get final status
    console.log('\n📊 Final Status:');
    const finalStatus = await processor.getStatus();
    console.log('- Processing Stats:', finalStatus.stats);
    console.log('- Queue Stats:', finalStatus.queueStats);

    // 8. Health check
    console.log('\n🏥 Health Check:');
    const health = await processor.healthCheck();
    console.log('- Healthy:', health.healthy);
    console.log('- Checks:', health.checks);

    // 9. Stop processor
    console.log('\n🛑 Stopping processor...');
    await processor.stop();

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testAPIEndpoints() {
  console.log('\n🌐 Testing API Endpoints');
  console.log('========================');

  const baseUrl = process.env.API_BASE_URL || 'http://localhost:8080';

  try {
    // Test health endpoint
    console.log('🏥 Testing health endpoint...');
    const healthResponse = await fetch(`${baseUrl}/api/cron/health`);
    const healthData = await healthResponse.json();
    console.log('Health:', healthData);

    // Test webhook endpoint (requires secret)
    console.log('\n🪝 Testing webhook endpoint...');
    const webhookResponse = await fetch(`${baseUrl}/api/cron/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.CRON_WEBHOOK_SECRET || 'test-secret'
      }
    });
    const webhookData = await webhookResponse.json();
    console.log('Webhook:', webhookData);

  } catch (error) {
    console.log('⚠️ API endpoints not available (server may not be running)');
    console.log('To test API endpoints, start the server and set API_BASE_URL');
  }
}

async function demonstrateMetrics() {
  console.log('\n📈 Demonstrating Analytics');
  console.log('==========================');

  const { ExecutionHistoryService } = await import('../services/puppet/executionHistoryService');
  const historyService = new ExecutionHistoryService();

  try {
    // Get recent execution history
    console.log('📊 Recent execution history...');
    const history = await historyService.getExecutionHistory({
      limit: 10
    });
    console.log(`Found ${history.total} total executions, showing ${history.executions.length}`);

    // Get execution metrics
    console.log('\n📊 Execution metrics...');
    const metrics = await historyService.getExecutionMetrics({
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    });
    console.log('Metrics:', {
      totalExecutions: metrics.totalExecutions,
      successRate: `${metrics.successRate}%`,
      averageDuration: `${metrics.averageDuration}ms`,
      errorBreakdown: metrics.errorBreakdown
    });

    // Get performance insights
    console.log('\n💡 Performance insights...');
    const insights = await historyService.getPerformanceInsights();
    console.log('Recommendations:');
    insights.recommendations.forEach(rec => {
      console.log(`  - ${rec}`);
    });

  } catch (error) {
    console.log('⚠️ Analytics not available (may need data or database functions)');
  }
}

// Main execution
async function main() {
  console.log('🎯 Cron Processor System Test Suite');
  console.log('====================================\n');

  // Check environment
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('  - SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const testType = process.argv[2] || 'all';

  switch (testType) {
    case 'processor':
      await testCronProcessor();
      break;
    case 'api':
      await testAPIEndpoints();
      break;
    case 'metrics':
      await demonstrateMetrics();
      break;
    case 'all':
    default:
      await testCronProcessor();
      await testAPIEndpoints();
      await demonstrateMetrics();
      break;
  }

  console.log('\n🎉 All tests completed!');
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, exiting gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, exiting gracefully...');
  process.exit(0);
});

// Run the test
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

export { testCronProcessor, testAPIEndpoints, demonstrateMetrics }; 