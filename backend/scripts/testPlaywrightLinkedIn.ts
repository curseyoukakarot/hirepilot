import { PlaywrightConnectionService } from '../services/linkedin/playwrightConnectionService';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cookie decryption (matches linkedinSaveCookie.ts format)
const ENCRYPTION_KEY = process.env.COOKIE_ENCRYPTION_KEY?.slice(0, 32) || 'default_key_32_bytes_long_123456';

function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

/**
 * Test script for Playwright LinkedIn Connection Service
 * 
 * This script helps validate your new Playwright-based LinkedIn connection
 * automation without going through the full UI flow.
 */
async function testPlaywrightLinkedInConnection() {
  console.log('🧪 Testing Playwright LinkedIn Connection Service...\n');

  try {
    // Test configuration - using your UUID and target profile
    const testConfig = {
      userId: '02a42d5c-0f65-4c58-8175-8304610c2ddc', // Your user UUID
      profileUrl: 'https://www.linkedin.com/in/jalonniweaver/', // Target LinkedIn profile
      message: 'Hi Jalonni! I came across your profile and would love to connect. Looking forward to networking with professionals in our industry.',
      testCookies: 'li_at=test; JSESSIONID=test' // Will be loaded from database
    };

    console.log('📋 Test Configuration:');
    console.log(`   👤 User ID: ${testConfig.userId}`);
    console.log(`   🔗 Profile URL: ${testConfig.profileUrl}`);
    console.log(`   💬 Message: ${testConfig.message.substring(0, 50)}...`);
    console.log(`   🍪 Has cookies: ${testConfig.testCookies.includes('li_at')}\n`);

    // Validate environment
    console.log('🔍 Environment Check:');
    console.log(`   ✅ Supabase URL: ${process.env.SUPABASE_URL ? 'Configured' : '❌ Missing'}`);
    console.log(`   ✅ Supabase Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configured' : '❌ Missing'}`);
    console.log(`   ✅ Proxy URL: ${process.env.DECODO_PROXY_URL || 'Not configured (optional)'}`);
    console.log('');

    // Check if user has valid LinkedIn cookies in database
    console.log('🍪 Checking LinkedIn cookies in database...');
    const { data: cookieData, error: cookieError } = await supabase
      .from('linkedin_cookies')
      .select('session_cookie, user_agent, is_valid, updated_at')
      .eq('user_id', testConfig.userId)
      .eq('is_valid', true)
      .single();

    if (cookieError || !cookieData) {
      console.log('   ❌ No valid LinkedIn cookies found in database');
      console.log('   💡 Please refresh your LinkedIn connection using the Chrome extension first');
      return;
    }

    console.log(`   ✅ Found valid cookies (updated: ${cookieData.updated_at})`);
    console.log(`   🔑 Encrypted cookie length: ${cookieData.session_cookie?.length || 0} chars`);
    
    // Try to decrypt and analyze the cookie
    try {
      const decryptedCookie = decrypt(cookieData.session_cookie);
      console.log(`   🔓 Decrypted cookie length: ${decryptedCookie.length} chars`);
      console.log(`   🍪 Contains li_at: ${decryptedCookie.includes('li_at') ? 'Yes' : 'No'}`);
      console.log(`   🍪 Contains JSESSIONID: ${decryptedCookie.includes('JSESSIONID') ? 'Yes' : 'No'}`);
      console.log(`   🔍 Sample cookie preview: ${decryptedCookie.substring(0, 100)}...\n`);
    } catch (decryptError: any) {
      console.log(`   ❌ Cookie decryption failed: ${decryptError.message}\n`);
      return;
    }

    // Test the Playwright connection service
    console.log('🚀 Testing Playwright Connection Service...\n');
    
    const startTime = Date.now();
    const result = await PlaywrightConnectionService.sendConnectionRequest({
      profileUrl: testConfig.profileUrl,
      message: testConfig.message,
      fullCookie: cookieData.session_cookie,
      userId: testConfig.userId,
      jobId: 'test-' + Date.now()
    });
    const duration = Date.now() - startTime;

    console.log('\n📊 Test Results:');
    console.log(`   ⏱️  Duration: ${duration}ms`);
    console.log(`   ✅ Success: ${result.success}`);
    console.log(`   💬 Message: ${result.message}`);
    
    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    }

    if (result.logs && result.logs.length > 0) {
      console.log('\n📝 Execution Logs:');
      result.logs.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log}`);
      });
    }

    if (result.screenshots && result.screenshots.length > 0) {
      console.log(`\n📷 Screenshots captured: ${result.screenshots.length}`);
      console.log('   💡 Screenshots contain base64 data for debugging');
    }

    if (result.success) {
      console.log('\n🎉 SUCCESS: LinkedIn connection request completed!');
      console.log('   ✅ Your Playwright setup is working correctly');
      console.log('   ✅ Cookies are valid and authentication successful');
      console.log('   ✅ Connection request flow executed without errors');
    } else {
      console.log('\n⚠️  FAILURE: Connection request did not complete');
      console.log('   💡 Check the logs above for specific error details');
      console.log('   💡 Common issues:');
      console.log('      - Expired LinkedIn cookies');
      console.log('      - Rate limiting from LinkedIn');
      console.log('      - Profile requires premium access');
      console.log('      - Already connected to this profile');
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Verify your environment variables are set');
    console.log('   2. Check that Playwright dependencies are installed');
    console.log('   3. Ensure your LinkedIn cookies are fresh and valid');
    console.log('   4. Test with a different LinkedIn profile URL');
  }

  console.log('\n🏁 Playwright LinkedIn Connection Test Complete!');
}

// Allow running directly or importing
if (require.main === module) {
  testPlaywrightLinkedInConnection().catch(console.error);
}

export { testPlaywrightLinkedInConnection };