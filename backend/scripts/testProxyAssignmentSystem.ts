#!/usr/bin/env ts-node

/**
 * Test Script: Proxy Assignment System
 * Validates the dedicated proxy assignment functionality
 */

import { supabase } from '../lib/supabase';
import { ProxyAssignmentService, assignProxyToUser } from '../services/puppet/proxyAssignmentService';

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testProxyAssignmentSystem() {
  log('\n🧪 Testing Proxy Assignment System\n', colors.bright);
  
  try {
    // Test 1: Create test proxies
    log('📋 Test 1: Setting up test proxies...', colors.cyan);
    
    const testProxies = [
      {
        provider: 'smartproxy',
        endpoint: 'us.smartproxy.com:10000',
        username: 'test-user-cc-us',
        password: 'test-password-1',
        country_code: 'US',
        region: 'North America',
        city: 'New York',
        proxy_type: 'residential',
        max_concurrent_users: 3,
        status: 'active'
      },
      {
        provider: 'smartproxy',
        endpoint: 'uk.smartproxy.com:10001',
        username: 'test-user-cc-uk',
        password: 'test-password-2',
        country_code: 'UK',
        region: 'Europe',
        city: 'London',
        proxy_type: 'residential',
        max_concurrent_users: 2,
        status: 'active'
      },
      {
        provider: 'brightdata',
        endpoint: 'brd-customer-zone.luminati.io:22225',
        username: 'test-brightdata-user',
        password: 'test-password-3',
        country_code: 'CA',
        region: 'North America',
        city: 'Toronto',
        proxy_type: 'residential',
        max_concurrent_users: 5,
        status: 'active'
      }
    ];
    
    const createdProxyIds: string[] = [];
    
    for (const proxy of testProxies) {
      const { data, error } = await supabase
        .from('proxy_pool')
        .insert(proxy)
        .select('id')
        .single();
      
      if (error) {
        log(`❌ Failed to create test proxy: ${error.message}`, colors.red);
        continue;
      }
      
      createdProxyIds.push(data.id);
      log(`✅ Created test proxy: ${proxy.provider} (${proxy.country_code})`, colors.green);
    }
    
    log(`📊 Created ${createdProxyIds.length} test proxies\n`, colors.green);
    
    // Test 2: Create test users
    log('👥 Test 2: Creating test users...', colors.cyan);
    
    const testUsers = [
      { email: 'test-proxy-user-1@example.com', password: 'test123' },
      { email: 'test-proxy-user-2@example.com', password: 'test123' },
      { email: 'test-proxy-user-3@example.com', password: 'test123' }
    ];
    
    const createdUserIds: string[] = [];
    
    for (const user of testUsers) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true
      });
      
      if (error) {
        log(`❌ Failed to create test user: ${error.message}`, colors.red);
        continue;
      }
      
      createdUserIds.push(data.user.id);
      log(`✅ Created test user: ${user.email}`, colors.green);
    }
    
    log(`📊 Created ${createdUserIds.length} test users\n`, colors.green);
    
    // Test 3: Test proxy assignment function
    log('🔄 Test 3: Testing proxy assignment...', colors.cyan);
    
    for (let i = 0; i < createdUserIds.length; i++) {
      const userId = createdUserIds[i];
      const userEmail = testUsers[i].email;
      
      try {
        // Test the main assignProxyToUser function
        const proxyId = await assignProxyToUser(userId);
        log(`✅ Assigned proxy ${proxyId} to user ${userEmail}`, colors.green);
        
        // Test getting the proxy details
        const proxyDetails = await ProxyAssignmentService.getUserProxy(userId);
        if (proxyDetails) {
          log(`   📡 Proxy details: ${proxyDetails.provider} (${proxyDetails.country_code}) - ${proxyDetails.endpoint}`, colors.blue);
        }
        
        // Test assignment retrieval
        const assignment = await ProxyAssignmentService.getUserProxyAssignment(userId);
        if (assignment) {
          log(`   📋 Assignment: ${assignment.assignment_reason} at ${assignment.assigned_at}`, colors.blue);
        }
        
      } catch (error) {
        log(`❌ Failed to assign proxy to ${userEmail}: ${error}`, colors.red);
      }
    }
    
    // Test 4: Test duplicate assignment (should return same proxy)
    log('\n🔄 Test 4: Testing duplicate assignment prevention...', colors.cyan);
    
    if (createdUserIds.length > 0) {
      const userId = createdUserIds[0];
      const userEmail = testUsers[0].email;
      
      const firstProxyId = await assignProxyToUser(userId);
      const secondProxyId = await assignProxyToUser(userId);
      
      if (firstProxyId === secondProxyId) {
        log(`✅ Duplicate assignment prevention works: ${firstProxyId}`, colors.green);
      } else {
        log(`❌ Duplicate assignment prevention failed: ${firstProxyId} vs ${secondProxyId}`, colors.red);
      }
    }
    
    // Test 5: Test performance tracking
    log('\n📊 Test 5: Testing performance tracking...', colors.cyan);
    
    if (createdUserIds.length > 0) {
      const userId = createdUserIds[0];
      
      // Simulate some job outcomes
      await ProxyAssignmentService.updateAssignmentPerformance(userId, true, 1200);
      await ProxyAssignmentService.updateAssignmentPerformance(userId, true, 800);
      await ProxyAssignmentService.updateAssignmentPerformance(userId, false);
      
      const assignment = await ProxyAssignmentService.getUserProxyAssignment(userId);
      if (assignment) {
        log(`✅ Performance updated: ${assignment.successful_jobs} success, ${assignment.failed_jobs} failed`, colors.green);
      }
    }
    
    // Test 6: Test proxy reassignment
    log('\n🔄 Test 6: Testing proxy reassignment...', colors.cyan);
    
    if (createdUserIds.length > 0) {
      const userId = createdUserIds[0];
      const userEmail = testUsers[0].email;
      
      try {
        const oldProxyId = await assignProxyToUser(userId);
        log(`   📡 Current proxy: ${oldProxyId}`, colors.blue);
        
        const newProxyId = await ProxyAssignmentService.reassignUserProxy(userId, 'test_rotation');
        log(`✅ Reassigned ${userEmail} from ${oldProxyId} to ${newProxyId}`, colors.green);
        
      } catch (error) {
        log(`❌ Reassignment failed: ${error}`, colors.red);
      }
    }
    
    // Test 7: Test available proxies view
    log('\n📋 Test 7: Testing available proxies view...', colors.cyan);
    
    const availableProxies = await ProxyAssignmentService.getAvailableProxies();
    log(`✅ Found ${availableProxies.length} available proxies`, colors.green);
    
    for (const proxy of availableProxies.slice(0, 3)) {
      log(`   📡 ${proxy.provider} (${proxy.country_code}): ${proxy.current_assignments}/${proxy.max_concurrent_users} assigned`, colors.blue);
    }
    
    // Test 8: Test all assignments view
    log('\n👥 Test 8: Testing all assignments view...', colors.cyan);
    
    const allAssignments = await ProxyAssignmentService.getAllUserAssignments();
    log(`✅ Found ${allAssignments.length} active assignments`, colors.green);
    
    for (const assignment of allAssignments) {
      log(`   👤 User ${assignment.user_id}: ${assignment.assignment_reason} (${assignment.total_jobs_processed} jobs)`, colors.blue);
    }
    
    // Test 9: Test Puppeteer formatting
    log('\n🎭 Test 9: Testing Puppeteer proxy formatting...', colors.cyan);
    
    if (createdUserIds.length > 0) {
      const userId = createdUserIds[0];
      const proxyDetails = await ProxyAssignmentService.getUserProxy(userId);
      
      if (proxyDetails) {
        const puppeteerConfig = ProxyAssignmentService.formatProxyForPuppeteer(proxyDetails);
        log(`✅ Puppeteer config: ${puppeteerConfig.server}`, colors.green);
        log(`   🔐 Auth: ${puppeteerConfig.username}:${puppeteerConfig.password}`, colors.blue);
      }
    }
    
    // Cleanup
    log('\n🧹 Cleaning up test data...', colors.yellow);
    
    // Delete test users
    for (const userId of createdUserIds) {
      await supabase.auth.admin.deleteUser(userId);
    }
    log(`✅ Deleted ${createdUserIds.length} test users`, colors.green);
    
    // Delete test proxies
    if (createdProxyIds.length > 0) {
      const { error } = await supabase
        .from('proxy_pool')
        .delete()
        .in('id', createdProxyIds);
      
      if (error) {
        log(`❌ Failed to delete test proxies: ${error.message}`, colors.red);
      } else {
        log(`✅ Deleted ${createdProxyIds.length} test proxies`, colors.green);
      }
    }
    
    log('\n🎉 Proxy Assignment System Test Complete!', colors.bright + colors.green);
    
  } catch (error) {
    log(`\n❌ Test failed with error: ${error}`, colors.red);
    console.error(error);
  }
}

// Run the test
if (require.main === module) {
  testProxyAssignmentSystem()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testProxyAssignmentSystem }; 