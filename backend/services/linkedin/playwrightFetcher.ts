import { chromium, BrowserContext } from 'playwright';
import { HttpsProxyAgent } from 'https-proxy-agent';

export interface SalesNavFetchOptions {
  apiUrl: string;
  fullCookie: string; // raw document.cookie string
  csrfToken: string;
}

export interface SalesNavLead {
  firstName?: string;
  lastName?: string;
  occupation?: string;
  publicIdentifier?: string;
  picture?: string;
  companyName?: string;
  location?: string;
}

// Utility to build proxy args from env
function buildProxyArgs() {
  const host = process.env.DECODO_HOST || 'gate.decodo.com';
  const port = process.env.DECODO_PORT || '10001';
  const user = process.env.DECODO_USER || '';
  const pass = process.env.DECODO_PASS || '';
  if (!user || !pass) return { args: [], creds: null };
  const proxyUrl = `http://${host}:${port}`;
  const creds = { username: user, password: pass };
  return { args: [`--proxy-server=${proxyUrl}`], creds };
}

export async function fetchSalesNavJson(options: SalesNavFetchOptions): Promise<any> {
  const { apiUrl, fullCookie, csrfToken } = options;
  
  // Launch browser with container-optimized settings and anti-detection
  console.log('[Playwright] Launching Chromium browser...');
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-gpu',
      '--disable-web-security',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  
  console.log('[Playwright] Browser version:', await browser.version());
  const context: BrowserContext = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    storageState: undefined  // Clear any previous storage state
  });

  // Set a realistic user agent
  await context.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  // Add cookies with better parsing
  const cookieEntries = fullCookie.split(';').map(part => part.trim()).filter(Boolean);
  const cookies = cookieEntries.map(pair => {
    const equalIdx = pair.indexOf('=');
    if (equalIdx === -1) return null;
    
    let name = pair.substring(0, equalIdx).trim();
    let value = pair.substring(equalIdx + 1).trim();
    
    // Remove quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    
    return { 
      name, 
      value, 
      domain: '.linkedin.com', 
      path: '/', 
      httpOnly: false, 
      secure: true, 
      sameSite: 'Lax' as const
    };
  }).filter(Boolean);
  
  console.log('[Playwright] Adding cookies:', cookies.map(c => c?.name).join(', '));
  
  // Check for critical LinkedIn auth cookies
  const hasLiAt = cookies.some(c => c?.name === 'li_at');
  const hasJSession = cookies.some(c => c?.name === 'JSESSIONID');
  console.log('[Playwright] Has li_at cookie:', hasLiAt);
  console.log('[Playwright] Has JSESSIONID cookie:', hasJSession);
  
  if (!hasLiAt) {
    console.warn('[Playwright] WARNING: Missing li_at cookie - authentication will likely fail');
  }
  
  // Enhanced cookie injection with proper domain/path/secure flags
  const enhancedCookies = cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    domain: '.linkedin.com',  // Crucial for cross-subdomain access
    path: '/',
    httpOnly: cookie.httpOnly || false,
    secure: true,  // Most LinkedIn cookies are secure
    sameSite: cookie.sameSite || 'Lax' as const,
    expires: cookie.expires || -1  // Preserve expiration if set
  }));
  
  await context.addCookies(enhancedCookies);
  
  // Verify cookies were actually set
  const setCookies = await context.cookies();
  console.log('[Playwright] Verified cookies set:', setCookies.length);
  console.log('[Playwright] Critical cookies present:', {
    li_at: setCookies.some(c => c.name === 'li_at'),
    JSESSIONID: setCookies.some(c => c.name === 'JSESSIONID'),
    lidc: setCookies.some(c => c.name === 'lidc')
  });

  const page = await context.newPage();
  
  // Add stealth script to avoid detection
  await page.addInitScript(() => {
    // Remove webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Mock plugins and languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
  });
  
  // Set up request interception to capture headers
  let identity: string | null = null;
  page.on('request', req => {
    if (identity) return;
    const url = req.url();
    if (url.includes('/sales-api/') || url.includes('/voyager/api/') || url.includes('/salesApi')) {
      const hdr = req.headers();
      if (hdr['x-li-identity']) {
        identity = hdr['x-li-identity'];
        console.log('[Playwright] Captured x-li-identity:', identity);
      }
    }
  });

  // Navigate to Sales Navigator to establish proper session and capture headers
  console.log('[Playwright] Navigating to Sales Navigator to capture session headers...');
  
  try {
    // Step 1: Warm up session with LinkedIn feed first (mimics real user flow)
    console.log('[Playwright] Warming up session via LinkedIn feed...');
    await page.goto('https://www.linkedin.com/feed/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    await page.waitForTimeout(1000);
    
    const feedUrl = page.url();
    if (feedUrl.includes('/login')) {
      throw new Error('Session invalid - redirected to login on LinkedIn feed');
    }
    console.log('[Playwright] Feed warmup successful');
    
    // Step 2: Navigate to Sales Navigator home
    console.log('[Playwright] Navigating to Sales Navigator...');
    await page.goto('https://www.linkedin.com/sales/home', { 
      waitUntil: 'domcontentloaded',
      timeout: 20000 
    });
    console.log('[Playwright] Successfully navigated to Sales Nav home');
    
    // Check if we're actually logged in or got redirected to login
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log('[Playwright] After navigation - URL:', currentUrl);
    console.log('[Playwright] After navigation - Title:', pageTitle);
    
    if (currentUrl.includes('/login') || currentUrl.includes('/challenge') || currentUrl.includes('/auth') || pageTitle.includes('Sign In')) {
      console.error('[Playwright] ❌ Redirected to login page - cookies are invalid or expired');
      console.error('[Playwright] Expected: https://www.linkedin.com/sales/home');
      console.error('[Playwright] Actual:', currentUrl);
      throw new Error('LinkedIn session expired during navigation - user needs to refresh cookies from an active Sales Navigator session');
    }
    
    // Wait for the page to fully load and make API calls that will trigger identity capture
    await page.waitForTimeout(3000);
    
  } catch (navError: any) {
    console.warn('[Playwright] Sales home navigation failed, trying search page:', navError.message);
    try {
      // Fallback to a basic sales search page
      await page.goto('https://www.linkedin.com/sales/search/people', { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      console.log('[Playwright] Navigated to Sales search as fallback');
      await page.waitForTimeout(2000);
    } catch (searchError: any) {
      console.warn('[Playwright] All Sales Nav navigation failed, using basic LinkedIn:', searchError.message);
      await page.goto('https://www.linkedin.com/', { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      await page.waitForTimeout(1000);
    }
  }

  // Extract x-li-page-instance from <meta name="pageInstance" ...>
  let pageInstance = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="pageInstance"]');
    if (meta) {
      console.log('[DOM] Found pageInstance meta:', meta.getAttribute('content'));
      return meta.getAttribute('content');
    }
    
    // Also try alternative selectors
    const altMeta = document.querySelector('meta[property="pageInstance"]');
    if (altMeta) {
      console.log('[DOM] Found pageInstance property:', altMeta.getAttribute('content'));
      return altMeta.getAttribute('content');
    }
    
    console.log('[DOM] No pageInstance meta found. Available meta tags:', 
      Array.from(document.querySelectorAll('meta')).map(m => m.name || m.getAttribute('property') || 'unnamed').slice(0, 10)
    );
    return null;
  });
  
  if (!pageInstance) {
    console.warn('[Playwright] Failed to grab pageInstance meta');
  } else {
    console.log('[Playwright] Captured pageInstance:', pageInstance);
  }

  // Try to trigger API calls if identity not captured yet
  if (!identity) {
    console.log('[Playwright] Triggering test API calls to capture identity...');
    try {
      await page.evaluate(() => {
        // Try multiple API endpoints that Sales Navigator uses
        const testEndpoints = [
          '/voyager/api/me',
          '/sales-api/search/blended?count=1',
          '/voyager/api/identity/profiles',
          '/sales-api/profileActions'
        ];
        
        // Fire multiple requests to increase chances of capturing identity
        testEndpoints.forEach(endpoint => {
          fetch(endpoint, { 
            credentials: 'include',
            headers: {
              'accept': 'application/vnd.linkedin.normalized+json+2.1',
              'x-li-lang': 'en_US'
            }
          }).catch(() => {}); // Ignore errors, just want to trigger requests
        });
      });
      await page.waitForTimeout(2000); // Wait longer for multiple requests
    } catch (apiErr) {
      console.warn('[Playwright] Failed to trigger API calls:', apiErr);
    }
  }

  if (!identity) {
    console.warn('[Playwright] x-li-identity not captured, trying fallback...');
    // Use a base64 encoded enterprise account identifier (extracted from the li_at token)
    identity = 'dXJuOmxpOmVudGVycHJpc2VBY2NvdW50OjgwNDIwMDcz'; // Based on the provided li_at token
  }
  
  if (!pageInstance) {
    console.warn('[Playwright] pageInstance not captured, using fallback...');
    // Use a realistic Sales Navigator search page instance
    pageInstance = 'urn:li:page:d_sales2_search_people;/g01A/2QS6qAo8QZvIQx+w==';
  }

  // Log current page state before making the request
  console.log('[Playwright] Current page URL:', page.url());
  console.log('[Playwright] Current page title:', await page.title());

  // Now perform target fetch with assembled headers
  const result = await page.evaluate(async ({ url, csrf, identity, pageInstance }) => {
    const headers: Record<string, string> = {
      'accept': 'application/vnd.linkedin.normalized+json+2.1',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      'csrf-token': csrf,
      'pragma': 'no-cache',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'x-restli-protocol-version': '2.0.0',
      'x-li-lang': 'en_US',
      'x-li-track': '{"clientVersion":"1.13.16462","mpName":"sales-web","osName":"web","usedPremiumFeature":false,"capacity":"sales","webFormFactor":"desktop"}'
    };
    
    if (identity) headers['x-li-identity'] = identity;
    if (pageInstance) headers['x-li-page-instance'] = pageInstance;

    console.log('[Playwright] Making request with headers:', Object.keys(headers).join(', '));
    console.log('[Playwright] CSRF token value:', csrf);
    console.log('[Playwright] Has identity:', !!identity, 'Has pageInstance:', !!pageInstance);
    
    const res = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include'
    });
    
    let json: any = {};
    let responseText = '';
    try {
      responseText = await res.text();
      json = JSON.parse(responseText);
    } catch (parseErr) {
      console.log('[Playwright] JSON parse failed, response text length:', responseText.length);
      json = { error: 'Failed to parse JSON', responseText: responseText.substring(0, 200) };
    }
    
    console.log('[Playwright] Response status:', res.status);
    console.log('[Playwright] Response headers:', Object.fromEntries(res.headers.entries()));
    
    return { status: res.status, ok: res.ok, json, responseText: responseText.substring(0, 1000) };
  }, { url: apiUrl, csrf: csrfToken, identity, pageInstance });

  await browser.close();
  return result;
} 