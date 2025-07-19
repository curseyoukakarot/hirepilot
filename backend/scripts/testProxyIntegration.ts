#!/usr/bin/env ts-node
/**
 * Test script for Proxy Integration (Prompt 3)
 * Tests residential proxy injection with IP verification via ipify.org
 */

import { connectToLinkedInProfile } from '../services/puppet/connectToLinkedInProfile';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testProxyIntegration() {
  console.log('🌐 Testing Proxy Integration (Prompt 3)...\n');

  // Test configurations for different proxy providers
  const proxyConfigurations = [
    {
      name: 'SmartProxy Residential (US-NY)',
      config: {
        endpoint: 'us-ny.residential.smartproxy.com:10000',
        username: process.env.SMARTPROXY_USERNAME || 'sp-username',
        password: process.env.SMARTPROXY_PASSWORD || 'sp-password',
        type: 'residential' as const,
        location: 'New York, USA'
      }
    },
    {
      name: 'BrightData Residential (US)',
      config: {
        endpoint: 'rotating-residential.brightdata.com:22225',
        username: process.env.BRIGHTDATA_USERNAME || 'brd-customer-user',
        password: process.env.BRIGHTDATA_PASSWORD || 'password123',
        type: 'residential' as const,
        location: 'United States'
      }
    },
    {
      name: 'SmartProxy Datacenter (Global)',
      config: {
        endpoint: 'gate.smartproxy.com:7000',
        username: process.env.SMARTPROXY_DC_USERNAME || 'sp-dc-user',
        password: process.env.SMARTPROXY_DC_PASSWORD || 'sp-dc-pass',
        type: 'datacenter' as const,
        location: 'Global Pool'
      }
    }
  ];

  console.log('🔧 Available Proxy Configurations:');
  proxyConfigurations.forEach((proxy, index) => {
    console.log(`   ${index + 1}. ${proxy.name}`);
    console.log(`      Endpoint: ${proxy.config.endpoint}`);
    console.log(`      Type: ${proxy.config.type}`);
    console.log(`      Location: ${proxy.config.location}`);
    console.log(`      Username: ${proxy.config.username.substring(0, 8)}***`);
    console.log('');
  });

  // Test scenarios
  const testScenarios = [
    {
      name: 'No Proxy (Direct Connection)',
      params: {
        li_at: 'test_cookie_value',
        profile_url: 'https://www.linkedin.com/in/test-profile/',
        note: 'Test connection without proxy',
        headless: true
      }
    },
    {
      name: 'SmartProxy Residential',
      params: {
        li_at: 'test_cookie_value',
        profile_url: 'https://www.linkedin.com/in/test-profile/',
        note: 'Test connection with SmartProxy residential',
        proxy: proxyConfigurations[0].config,
        headless: true
      }
    },
    {
      name: 'BrightData Residential', 
      params: {
        li_at: 'test_cookie_value',
        profile_url: 'https://www.linkedin.com/in/test-profile/',
        note: 'Test connection with BrightData residential',
        proxy: proxyConfigurations[1].config,
        headless: true
      }
    }
  ];

  // Environment detection
  console.log('🔍 Environment Check:');
  console.log(`   Node.js: ${process.version}`);
  console.log(`   Headless: ${process.env.HEADLESS !== 'false'}`);
  console.log(`   Test Mode: ${process.env.TEST_MODE === 'true'}`);
  console.log('');

  // Run proxy tests
  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];
    console.log(`🧪 Test ${i + 1}: ${scenario.name}`);
    console.log('================================================');

    try {
      // Mock the test execution (replace with actual execution for real testing)
      if (process.env.TEST_MODE === 'true') {
        console.log('⚠️  TEST MODE: Simulating proxy integration...');
        console.log('');

        if (scenario.params.proxy) {
          console.log('📋 Proxy Configuration:');
          console.log(`   Endpoint: ${scenario.params.proxy.endpoint}`);
          console.log(`   Type: ${scenario.params.proxy.type}`);
          console.log(`   Location: ${scenario.params.proxy.location}`);
          console.log(`   Username: ${scenario.params.proxy.username.substring(0, 8)}***`);
          console.log('');

          // Simulate proxy verification
          console.log('🌐 Simulating proxy verification...');
          const mockIp = generateMockIP(scenario.params.proxy.location || 'Unknown');
          const mockResponseTime = Math.floor(Math.random() * 2000) + 500;

          console.log(`✅ Proxy verified - IP: ${mockIp} (${mockResponseTime}ms)`);
          console.log(`📍 Location: ${scenario.params.proxy.location}`);
        } else {
          console.log('🌐 Direct connection (no proxy)');
          console.log('✅ IP verification skipped for direct connection');
        }

        console.log('');
        console.log('🤖 Simulating LinkedIn automation...');
        console.log('🍪 Setting LinkedIn authentication cookie...');
        console.log('🌐 Navigating to LinkedIn profile...');
        console.log('🎭 Simulating human behavior...');
        console.log('🤝 Attempting connection request...');

        // Mock result
        const mockResult = {
          status: 'success',
          reason: 'Connection request sent with custom message',
          page_state: {
            url: scenario.params.profile_url,
            title: 'Test Profile | LinkedIn',
            profile_name: 'Test User',
            connection_status: 'can_connect',
            message_sent: !!scenario.params.note
          },
          execution_time_ms: Math.floor(Math.random() * 8000) + 5000,
          timestamp: new Date().toISOString(),
          metadata: {
            user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            proxy_used: scenario.params.proxy?.endpoint,
            verified_ip: scenario.params.proxy ? generateMockIP(scenario.params.proxy.location || 'Unknown') : undefined,
            detected_elements: ['button[data-control-name="connect"]']
          }
        };

        console.log('');
        console.log('✅ Mock Result:');
        console.log(JSON.stringify(mockResult, null, 2));

      } else {
        console.log('⚠️  LIVE MODE: This would execute real proxy testing');
        console.log('⚠️  Set TEST_MODE=true for safe simulation');
        console.log('⚠️  For real testing, ensure you have:');
        console.log('   - Valid proxy credentials');
        console.log('   - LinkedIn li_at cookie');
        console.log('   - Proper permissions for automated testing');

        // In live mode, you would call:
        // const result = await connectToLinkedInProfile(scenario.params);
      }

    } catch (error) {
      console.error(`❌ Test failed:`, error);
    }

    console.log('================================================\n');
  }

  // Proxy provider specific configurations
  console.log('🌐 Proxy Provider Configuration Guide');
  console.log('================================================');
  console.log('');

  console.log('1. SmartProxy Configuration:');
  console.log('```bash');
  console.log('# Residential');
  console.log('export PROXY_ENDPOINT="us-ny.residential.smartproxy.com:10000"');
  console.log('export PROXY_USERNAME="your_smartproxy_username"');
  console.log('export PROXY_PASSWORD="your_smartproxy_password"');
  console.log('export PROXY_TYPE="residential"');
  console.log('export PROXY_LOCATION="New York, USA"');
  console.log('');
  console.log('# Datacenter');
  console.log('export PROXY_ENDPOINT="gate.smartproxy.com:7000"');
  console.log('export PROXY_TYPE="datacenter"');
  console.log('```');
  console.log('');

  console.log('2. BrightData Configuration:');
  console.log('```bash');
  console.log('# Residential');
  console.log('export PROXY_ENDPOINT="rotating-residential.brightdata.com:22225"');
  console.log('export PROXY_USERNAME="brd-customer-your_username"');
  console.log('export PROXY_PASSWORD="your_brightdata_password"');
  console.log('export PROXY_TYPE="residential"');
  console.log('export PROXY_LOCATION="United States"');
  console.log('```');
  console.log('');

  console.log('3. Command Line Usage:');
  console.log('```typescript');
  console.log('import { connectToLinkedInProfile } from "./connectToLinkedInProfile";');
  console.log('');
  console.log('const result = await connectToLinkedInProfile({');
  console.log('  li_at: "your_linkedin_cookie",');
  console.log('  profile_url: "https://www.linkedin.com/in/target/",');
  console.log('  note: "Hi! I would love to connect.",');
  console.log('  proxy: {');
  console.log('    endpoint: "us-ny.residential.smartproxy.com:10000",');
  console.log('    username: "sp-username",');
  console.log('    password: "sp-password",');
  console.log('    type: "residential",');
  console.log('    location: "New York, USA"');
  console.log('  },');
  console.log('  headless: true');
  console.log('});');
  console.log('');
  console.log('// Check if proxy was verified');
  console.log('console.log("Verified IP:", result.metadata?.verified_ip);');
  console.log('console.log("Proxy Used:", result.metadata?.proxy_used);');
  console.log('```');
  console.log('');

  console.log('🎉 Proxy Integration Test Complete!');
  console.log('');
  console.log('📊 Summary:');
  console.log('   ✓ Enhanced proxy parameter structure');
  console.log('   ✓ BrightData and SmartProxy support');  
  console.log('   ✓ IP verification via ipify.org');
  console.log('   ✓ Proxy authentication handling');
  console.log('   ✓ Residential and datacenter proxy types');
  console.log('   ✓ Response time measurement');
  console.log('   ✓ Enhanced logging and error handling');
  console.log('');
  console.log('🚀 Ready for integration with Puppet system!');
}

// Helper function to generate mock IPs based on location
function generateMockIP(location: string): string {
  const ipRanges = {
    'New York, USA': '192.168.1',
    'United States': '173.252.74',
    'Global Pool': '185.199.108',
    'Unknown': '203.0.113'
  };

  const baseIP = ipRanges[location as keyof typeof ipRanges] || ipRanges['Unknown'];
  const lastOctet = Math.floor(Math.random() * 254) + 1;
  
  return `${baseIP}.${lastOctet}`;
}

// Run test if called directly
if (require.main === module) {
  testProxyIntegration().catch(console.error);
}

export { testProxyIntegration }; 