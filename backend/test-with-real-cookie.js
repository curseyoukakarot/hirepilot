require('dotenv/config');
const { PlaywrightConnectionService } = require('./services/linkedin/playwrightConnectionService');

/**
 * Temporary test with real li_at cookie
 */
async function testWithRealCookie() {
  console.log('🧪 Testing Playwright with Real LinkedIn Cookie...\n');

  // Your real li_at cookie
  const liAtCookie = 'AQEFAQ4BAAAAABcrUtYAAAGYORluVwAAAZiBUCeLVgAAsXVybjpsaTplbnRlcnByaXNlQXV0aFRva2VuOmVKeGpaQUFDbHRNeUwwRTBXNzFHTDRnV1BubGZoaEhFK045a1hRWm1SRDJhLzRlQkVRQzVKUW1iXnVybjpsaTplbnRlcnByaXNlUHJvZmlsZToodXJuOmxpOmVudGVycHJpc2VBY2NvdW50OjgwNDIwMDczLDEwODk5Njc0OSledXJuOmxpOm1lbWJlcjo1MjE1NDA0NUDypg17N-RzRV6hYx7aP0MYw1RGzI-r2tqVJeXtDNylF-XmQTEOY8tILBqlpA5Z29-oPR02aLinT-EAQvZReI_JQCESzNLt8vET929U5PVs6f9_tkm72yUWf0K02yYMNATtPHdVtqKpwtqoz3_EN8nYmB1EW7XP_FJalyEE719bFlAu-HZPlWe5kT3wJTQdjBRNtGI';

  // Create a proper cookie string with li_at and other essential cookies
  const fullCookieString = `li_at=${liAtCookie}; JSESSIONID="ajax:7800495894513966410"; li_theme=light; lidc="b=OB45:s=O:r=O:a=O:p=O:g=5523:u=1727:x=1:i=1754088328:t=1754148740:v=2:sig=AQEOdOPc5bY3-CkO5UvzLzdiDBInjJhy"`;

  const testConfig = {
    profileUrl: 'https://www.linkedin.com/in/ibcdrew/',
    message: 'Hi Drew! I came across your profile and would love to connect. Looking forward to networking with fellow professionals in our industry.',
    fullCookie: fullCookieString,
    userId: '02a42d5c-0f65-4c58-8175-8304610c2ddc',
    jobId: 'test-real-cookie-' + Date.now()
  };

  console.log('📋 Test Configuration:');
  console.log(`   🔗 Profile URL: ${testConfig.profileUrl}`);
  console.log(`   💬 Message: ${testConfig.message.substring(0, 50)}...`);
  console.log(`   🍪 Cookie has li_at: ${fullCookieString.includes('li_at') ? 'Yes' : 'No'}`);
  console.log(`   🍪 Cookie length: ${fullCookieString.length} chars\n`);

  console.log('🚀 Testing Playwright Connection Service with Real Cookie...\n');

  try {
    const startTime = Date.now();
    const result = await PlaywrightConnectionService.sendConnectionRequest(testConfig);
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
      console.log('   ✅ LinkedIn authentication successful');
      console.log('   ✅ Connection request flow executed without errors');
    } else {
      console.log('\n⚠️  FAILURE: Connection request did not complete');
      console.log('   💡 Check the logs above for specific error details');
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }

  console.log('\n🏁 Real Cookie Test Complete!');
}

// Run the test
testWithRealCookie().catch(console.error);