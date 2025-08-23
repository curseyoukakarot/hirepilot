#!/usr/bin/env ts-node

/**
 * Test script for Notifications API endpoints
 * Tests the complete notification and interaction flow
 */

import fetch from 'node-fetch';
import { config } from 'dotenv';

// Load environment variables
config();

const API_BASE = process.env.BACKEND_BASE_URL || 'http://localhost:8080';
const AUTH_TOKEN = process.env.AGENTS_API_TOKEN || '';

// Test user ID (replace with actual user ID in production)
const TEST_USER_ID = 'test-user-123';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  data?: any;
}

async function apiCall(endpoint: string, options: any = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'x-user-id': TEST_USER_ID, // For testing without full auth
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type');
  let data;
  
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

async function testNotificationsHealth(): Promise<TestResult> {
  try {
    const response = await apiCall('/api/notifications/health');
    
    return {
      name: 'Notifications Health Check',
      success: response.ok,
      data: response.data,
      error: response.ok ? undefined : `HTTP ${response.status}: ${JSON.stringify(response.data)}`
    };
  } catch (error: any) {
    return {
      name: 'Notifications Health Check',
      success: false,
      error: error.message
    };
  }
}

async function testCreateNotification(): Promise<TestResult> {
  try {
    const notification = {
      user_id: TEST_USER_ID,
      source: 'inapp',
      thread_key: 'test:campaign:123',
      title: 'Test Notification',
      body_md: '**Test notification** created by API test script',
      type: 'test',
      actions: [
        {
          id: 'test_button',
          type: 'button',
          label: 'Test Action',
          style: 'primary'
        },
        {
          id: 'test_input',
          type: 'input',
          label: 'Test Input',
          placeholder: 'Enter test value'
        }
      ]
    };

    const response = await apiCall('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(notification)
    });

    return {
      name: 'Create Notification',
      success: response.ok,
      data: response.data,
      error: response.ok ? undefined : `HTTP ${response.status}: ${JSON.stringify(response.data)}`
    };
  } catch (error: any) {
    return {
      name: 'Create Notification',
      success: false,
      error: error.message
    };
  }
}

async function testGetNotifications(): Promise<TestResult> {
  try {
    const response = await apiCall('/api/notifications?limit=10');
    
    return {
      name: 'Get Notifications',
      success: response.ok,
      data: response.data,
      error: response.ok ? undefined : `HTTP ${response.status}: ${JSON.stringify(response.data)}`
    };
  } catch (error: any) {
    return {
      name: 'Get Notifications',
      success: false,
      error: error.message
    };
  }
}

async function testNotificationStats(): Promise<TestResult> {
  try {
    const response = await apiCall('/api/notifications/stats');
    
    return {
      name: 'Notification Statistics',
      success: response.ok,
      data: response.data,
      error: response.ok ? undefined : `HTTP ${response.status}: ${JSON.stringify(response.data)}`
    };
  } catch (error: any) {
    return {
      name: 'Notification Statistics',
      success: false,
      error: error.message
    };
  }
}

async function testRecordInteraction(): Promise<TestResult> {
  try {
    const interaction = {
      user_id: TEST_USER_ID,
      source: 'inapp',
      thread_key: 'test:campaign:123',
      action_type: 'button',
      action_id: 'test_button',
      data: {
        clicked_at: new Date().toISOString(),
        test_value: 'API test interaction'
      }
    };

    const response = await apiCall('/api/agent-interactions', {
      method: 'POST',
      body: JSON.stringify(interaction)
    });

    return {
      name: 'Record Interaction',
      success: response.ok,
      data: response.data,
      error: response.ok ? undefined : `HTTP ${response.status}: ${JSON.stringify(response.data)}`
    };
  } catch (error: any) {
    return {
      name: 'Record Interaction',
      success: false,
      error: error.message
    };
  }
}

async function testGetInteractions(): Promise<TestResult> {
  try {
    const response = await apiCall('/api/agent-interactions?limit=10');
    
    return {
      name: 'Get Interactions',
      success: response.ok,
      data: response.data,
      error: response.ok ? undefined : `HTTP ${response.status}: ${JSON.stringify(response.data)}`
    };
  } catch (error: any) {
    return {
      name: 'Get Interactions',
      success: false,
      error: error.message
    };
  }
}

async function testSourcingNotification(): Promise<TestResult> {
  try {
    const notification = {
      user_id: TEST_USER_ID,
      source: 'inapp',
      thread_key: 'sourcing:test-campaign:test-lead',
      title: 'New positive reply',
      body_md: '**From:** test@example.com\n**Subject:** Re: Your outreach\n\nThanks for reaching out! I\'d love to learn more about HirePilot.',
      type: 'sourcing_reply',
      actions: [
        {
          id: 'draft_reply',
          type: 'button',
          label: '🤖 Draft with REX',
          style: 'primary'
        },
        {
          id: 'book_demo',
          type: 'button',
          label: '📅 Book Demo',
          style: 'primary'
        },
        {
          id: 'disqualify',
          type: 'button',
          label: '❌ Disqualify',
          style: 'danger'
        }
      ],
      metadata: {
        campaign_id: 'test-campaign',
        lead_id: 'test-lead',
        reply_id: 'test-reply',
        classification: 'positive'
      }
    };

    const response = await apiCall('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(notification)
    });

    return {
      name: 'Sourcing Reply Notification',
      success: response.ok,
      data: response.data,
      error: response.ok ? undefined : `HTTP ${response.status}: ${JSON.stringify(response.data)}`
    };
  } catch (error: any) {
    return {
      name: 'Sourcing Reply Notification',
      success: false,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('🧪 Starting Notifications API Tests');
  console.log(`📡 API Base: ${API_BASE}`);
  console.log(`👤 Test User: ${TEST_USER_ID}`);
  console.log('');

  const tests = [
    testNotificationsHealth,
    testCreateNotification,
    testGetNotifications,
    testNotificationStats,
    testRecordInteraction,
    testGetInteractions,
    testSourcingNotification
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    console.log(`🔄 Running: ${test.name}...`);
    const result = await test();
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${result.name}: PASSED`);
      if (result.data && typeof result.data === 'object') {
        console.log(`   Data: ${JSON.stringify(result.data, null, 2).substring(0, 200)}...`);
      }
    } else {
      console.log(`❌ ${result.name}: FAILED`);
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  }

  // Summary
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log('📊 Test Summary:');
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Notifications API is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { runTests };
