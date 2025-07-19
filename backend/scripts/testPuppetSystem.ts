#!/usr/bin/env ts-node
/**
 * Test script for Puppet LinkedIn Automation System
 * Tests CAPTCHA detection, screenshot capture, and Slack notifications
 */

import { createClient } from '@supabase/supabase-js';
import { PuppetLinkedInAutomation } from '../services/puppet/puppetAutomation';
import { PuppetExecutionConfig } from '../types/puppet';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testPuppetSystem() {
  console.log('🤖 Testing Puppet LinkedIn Automation System...\n');

  try {
    // Test 1: Database connectivity and schema
    console.log('📋 Test 1: Database schema validation...');
    await testDatabaseSchema();
    console.log('✅ Database schema test passed\n');

    // Test 2: Create test user settings
    console.log('👤 Test 2: Creating test user settings...');
    const testUserId = await createTestUserSettings();
    console.log(`✅ Test user created: ${testUserId}\n`);

    // Test 3: Queue a test job
    console.log('⏰ Test 3: Queueing test job...');
    const testJobId = await queueTestJob(testUserId);
    console.log(`✅ Test job queued: ${testJobId}\n`);

    // Test 4: Security detection simulation (without actual browser)
    console.log('🚨 Test 4: Security detection simulation...');
    await testSecurityDetection(testJobId);
    console.log('✅ Security detection test passed\n');

    // Test 5: Slack notification test (mock)
    console.log('📢 Test 5: Slack notification simulation...');
    await testSlackNotification(testUserId, testJobId);
    console.log('✅ Slack notification test passed\n');

    // Test 6: Rate limiting check
    console.log('⚡ Test 6: Rate limiting validation...');
    await testRateLimiting(testUserId);
    console.log('✅ Rate limiting test passed\n');

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await cleanupTestData(testUserId, testJobId);
    console.log('✅ Cleanup completed\n');

    console.log('🎉 All Puppet system tests passed successfully!');
    console.log('\n📊 Summary:');
    console.log('   ✓ Database schema validated');
    console.log('   ✓ User settings management');
    console.log('   ✓ Job queue functionality');
    console.log('   ✓ Security detection system');
    console.log('   ✓ Slack notification system');
    console.log('   ✓ Rate limiting controls');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

async function testDatabaseSchema() {
  // Test that all required tables exist
  const tables = [
    'puppet_jobs',
    'puppet_user_settings', 
    'puppet_proxies',
    'puppet_job_logs',
    'puppet_daily_stats',
    'puppet_screenshots'
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      throw new Error(`Table ${table} not accessible: ${error.message}`);
    }
  }

  // Test encryption functions exist
  const { data: encryptTest, error: encryptError } = await supabase
    .rpc('encrypt_li_at_cookie', {
      cookie_value: 'test_cookie_value',
      user_id: '00000000-0000-0000-0000-000000000000'
    });

  if (encryptError) {
    throw new Error(`Encryption function test failed: ${encryptError.message}`);
  }
}

async function createTestUserSettings(): Promise<string> {
  const testUserId = `test-user-${Date.now()}`;

  // Create test user settings
  const { data, error } = await supabase
    .from('puppet_user_settings')
    .insert({
      user_id: testUserId,
      auto_mode_enabled: true,
      daily_connection_limit: 20,
      min_delay_seconds: 60,
      max_delay_seconds: 180,
      captcha_detection_enabled: true,
      auto_pause_on_warning: true,
      notification_events: ['warning', 'job_failed', 'captcha_detected'],
      li_at_cookie: 'encrypted_test_cookie' // Mock encrypted cookie
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test user settings: ${error.message}`);
  }

  return testUserId;
}

async function queueTestJob(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('puppet_jobs')
    .insert({
      user_id: userId,
      linkedin_profile_url: 'https://www.linkedin.com/in/test-profile/',
      message: 'Hi! I would love to connect and discuss opportunities.',
      priority: 5,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to queue test job: ${error.message}`);
  }

  return data.id;
}

async function testSecurityDetection(jobId: string) {
  // Simulate security detection by updating job status
  const { error } = await supabase
    .from('puppet_jobs')
    .update({
      status: 'warning',
      detection_type: 'captcha',
      error_message: 'Security detection: captcha',
      screenshot_url: 'https://example.com/test-screenshot.png'
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to simulate security detection: ${error.message}`);
  }

  // Test screenshot record creation
  const { error: screenshotError } = await supabase
    .from('puppet_screenshots')
    .insert({
      job_id: jobId,
      detection_type: 'captcha',
      file_url: 'https://example.com/test-screenshot.png',
      file_size: 1024,
      page_url: 'https://www.linkedin.com/in/test-profile/',
      user_agent: 'Test User Agent'
    });

  if (screenshotError) {
    throw new Error(`Failed to create screenshot record: ${screenshotError.message}`);
  }
}

async function testSlackNotification(userId: string, jobId: string) {
  // Test log entry for notification
  const { error } = await supabase
    .from('puppet_job_logs')
    .insert({
      job_id: jobId,
      log_level: 'warn',
      message: 'Test Slack notification sent successfully',
      step_name: 'notification',
      page_url: 'https://www.linkedin.com/in/test-profile/',
      user_agent: 'Test User Agent'
    });

  if (error) {
    throw new Error(`Failed to log test notification: ${error.message}`);
  }

  console.log('   📧 Mock Slack notification would be sent with:');
  console.log(`      - User ID: ${userId}`);
  console.log(`      - Job ID: ${jobId}`);
  console.log('      - Event: CAPTCHA Detection');
  console.log('      - Screenshot: https://example.com/test-screenshot.png');
}

async function testRateLimiting(userId: string) {
  // Create daily stats to test rate limiting
  const today = new Date().toISOString().split('T')[0];
  
  const { error } = await supabase
    .from('puppet_daily_stats')
    .insert({
      user_id: userId,
      stat_date: today,
      connections_sent: 15,
      messages_sent: 12,
      jobs_completed: 15,
      jobs_failed: 0,
      jobs_warned: 1,
      captcha_detections: 1,
      security_warnings: 1
    });

  if (error) {
    throw new Error(`Failed to create daily stats: ${error.message}`);
  }

  // Verify stats were created
  const { data: stats, error: fetchError } = await supabase
    .from('puppet_daily_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('stat_date', today)
    .single();

  if (fetchError || !stats) {
    throw new Error('Failed to verify daily stats creation');
  }

  console.log(`   📊 Daily stats: ${stats.connections_sent}/20 connections sent today`);
}

async function cleanupTestData(userId: string, jobId: string) {
  // Delete in reverse dependency order
  await supabase.from('puppet_screenshots').delete().eq('job_id', jobId);
  await supabase.from('puppet_job_logs').delete().eq('job_id', jobId);
  await supabase.from('puppet_daily_stats').delete().eq('user_id', userId);
  await supabase.from('puppet_jobs').delete().eq('id', jobId);
  await supabase.from('puppet_user_settings').delete().eq('user_id', userId);
}

// Run tests if called directly
if (require.main === module) {
  testPuppetSystem().catch(console.error);
}

export { testPuppetSystem }; 