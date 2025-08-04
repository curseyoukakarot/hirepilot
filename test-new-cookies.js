const { chromium } = require('playwright');

async function testNewLinkedInCookies() {
  console.log('🔍 Testing New LinkedIn Cookie Combination...\n');

  // Your complete cookie set
  const cookieString = 'li_a=AQJ2PTEmc2FsZXNfY2lkPTMzMTk5Njk1NiUzQSUzQTMzMTk0MzU1NiUzQSUzQXRpZXIxJTNBJTNBODA0MjAwNzP_tG_nu1o6KfnrvhjFsB_cevOE_g; JSESSIONID=ajax:7800495894513966410; bcookie=v=2&e18e2669-187a-4bef-891c-e4441bc34318; lidc=b=TB45:s=T:r=T:a=T:p=T:g=6507:u=1728:x=1:i=1754100429:t=1754102289:v=2:sig=AQHwnNTk7MXRd4PR7EsWhmuBTGp7qiz6';

  console.log('🍪 Cookie Set:');
  console.log('✅ li_a (user session)');
  console.log('✅ JSESSIONID (session ID)');
  console.log('✅ bcookie (browser cookie)');
  console.log('✅ lidc (data center cookie)');
  console.log('');

  const browser = await chromium.launch({ headless: false }); // Non-headless to see what happens
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  // Parse and set all cookies
  const cookies = cookieString.split('; ').map(cookie => {
    const [name, value] = cookie.split('=');
    return {
      name: name.trim(),
      value: value.trim(),
      domain: '.linkedin.com',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax'
    };
  });

  await context.addCookies(cookies);
  console.log(`🔧 Set ${cookies.length} cookies in browser context`);

  const page = await context.newPage();
  
  console.log('🚀 Testing LinkedIn feed access...');
  
  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    const currentUrl = page.url();
    const title = await page.title();
    
    console.log('✅ Navigation completed');
    console.log('📍 Current URL:', currentUrl);
    console.log('📄 Page title:', title);
    
    const isLoggedIn = !currentUrl.includes('/login') && !currentUrl.includes('/authwall');
    console.log('🔍 Authentication Status:', isLoggedIn ? '✅ LOGGED IN' : '❌ NOT LOGGED IN');
    
    if (isLoggedIn) {
      console.log('🎉 SUCCESS! Cookies working - LinkedIn recognizes the session!');
      
      // Test navigation to a profile (our target)
      console.log('\n🎯 Testing profile navigation...');
      await page.goto('https://www.linkedin.com/in/ibcdrew/', { waitUntil: 'domcontentloaded', timeout: 10000 });
      
      const profileUrl = page.url();
      console.log('📍 Profile URL:', profileUrl);
      console.log('🔍 Profile accessible:', !profileUrl.includes('/login') ? '✅ YES' : '❌ NO');
      
      // Look for Connect button
      try {
        const connectButton = await page.waitForSelector('button:has-text("Connect"), button[aria-label*="connect"], button[aria-label*="Connect"]', { timeout: 5000 });
        console.log('🔗 Connect button found:', connectButton ? '✅ YES' : '❌ NO');
      } catch (e) {
        console.log('🔗 Connect button found: ❌ NO (timeout)');
      }
      
    } else {
      console.log('❌ Authentication failed - still redirected to login');
    }
    
    // Take screenshot for analysis
    await page.screenshot({ path: 'linkedin-new-cookies-test.png' });
    console.log('📷 Screenshot saved as linkedin-new-cookies-test.png');
    
  } catch (error) {
    console.error('❌ Navigation failed:', error.message);
  } finally {
    await browser.close();
  }
}

testNewLinkedInCookies().catch(console.error);