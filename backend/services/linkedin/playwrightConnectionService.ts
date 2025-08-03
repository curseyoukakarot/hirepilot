import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as crypto from 'crypto';
import { Browser, Page } from 'puppeteer';

// Enable stealth plugin for maximum anti-detection
puppeteer.use(StealthPlugin());

interface ConnectionRequest {
  profileUrl: string;
  message: string;
  fullCookie: string;
  userId: string;
  jobId?: string;
}

interface ConnectionResult {
  success: boolean;
  message: string;
  error?: string;
  screenshots?: string[];
  logs?: string[];
}

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
 * Enhanced Playwright LinkedIn Connection Service
 * 
 * Uses your existing proxy + stealth setup for reliable LinkedIn connection requests
 * Includes comprehensive error handling, detection avoidance, and detailed logging
 */
export class PlaywrightConnectionService {
  
  /**
   * Send LinkedIn connection request using Playwright with proxy and stealth
   */
  static async sendConnectionRequest(options: ConnectionRequest): Promise<ConnectionResult> {
    const { profileUrl, message, fullCookie, userId, jobId } = options;
    const logs: string[] = [];
    const screenshots: string[] = [];
    
    console.log(`[PlaywrightConnection] Starting connection request for job ${jobId || 'standalone'}`);
    logs.push(`Starting connection to: ${profileUrl}`);
    
    // Handle both encrypted and plain text cookies
    let decryptedCookie: string;
    
    // Enhanced cookie handling with debugging
    console.log('[PlaywrightConnection] Cookie analysis:');
    console.log('- Cookie length:', fullCookie.length);
    console.log('- Contains li_at=:', fullCookie.includes('li_at='));
    console.log('- Contains semicolons:', fullCookie.includes(';'));
    console.log('- First 100 chars:', fullCookie.substring(0, 100));
    console.log('- Encryption key configured:', !!process.env.COOKIE_ENCRYPTION_KEY);
    
    // Check if cookie looks like it's already decrypted (contains recognizable cookie names)
    if (fullCookie.includes('li_at=') || fullCookie.includes('JSESSIONID=') || fullCookie.includes(';')) {
      // Cookie is already in plain text format
      decryptedCookie = fullCookie;
      console.log('[PlaywrightConnection] Using plain text cookie (already decrypted)');
      logs.push('Using plain text LinkedIn cookie');
    } else {
      // Cookie needs decryption (from database)
      try {
        console.log('[PlaywrightConnection] Attempting cookie decryption...');
        decryptedCookie = decrypt(fullCookie);
        console.log('[PlaywrightConnection] Cookie decrypted successfully');
        console.log('- Decrypted length:', decryptedCookie.length);
        console.log('- Decrypted contains li_at:', decryptedCookie.includes('li_at='));
        logs.push('LinkedIn cookie decrypted successfully');
      } catch (decryptError: any) {
        console.error('[PlaywrightConnection] Cookie decryption failed:', decryptError.message);
        console.error('[PlaywrightConnection] Full error:', decryptError);
        console.error('[PlaywrightConnection] Trying fallback: treating as plain text');
        
        // Fallback: try using the cookie as-is (might be already decrypted)
        if (fullCookie.length > 50) { // Reasonable cookie length
          console.log('[PlaywrightConnection] Using fallback: treating encrypted cookie as plain text');
          
          // Check if this looks like an encrypted string vs actual cookies
          if (fullCookie.includes('li_at=') || fullCookie.includes('JSESSIONID=') || fullCookie.includes(';')) {
            // Looks like actual cookies
            decryptedCookie = fullCookie;
            logs.push('⚠️ Cookie decryption failed, using as plain text (fallback)');
          } else {
            // Looks like encrypted data, not actual cookies
            console.error('[PlaywrightConnection] Cookie decryption failed - missing COOKIE_ENCRYPTION_KEY on Railway');
            console.error('[PlaywrightConnection] Encryption key available:', !!process.env.COOKIE_ENCRYPTION_KEY);
            logs.push('❌ Missing COOKIE_ENCRYPTION_KEY environment variable on Railway');
            return {
              success: false,
              message: 'Missing encryption key on Railway - cannot decrypt LinkedIn cookies',
              error: `Add COOKIE_ENCRYPTION_KEY environment variable to Railway. Cookie is encrypted (${fullCookie.length} chars). Encryption key available: ${!!process.env.COOKIE_ENCRYPTION_KEY}`,
              logs
            };
          }
        } else {
          logs.push(`❌ Cookie decryption failed: ${decryptError.message}`);
          return {
            success: false,
            message: 'Failed to decrypt LinkedIn cookie',
            error: `Decryption failed: ${decryptError.message}. Cookie length: ${fullCookie.length}. Encryption key available: ${!!process.env.COOKIE_ENCRYPTION_KEY}`,
            logs
          };
        }
      }
    }
    
    let browser: Browser;
    let page: Page;

    
    try {
      // Use Browserless.io /unblock API for enhanced LinkedIn anti-detection
      console.log('[PlaywrightConnection] Using Browserless.io /unblock API for LinkedIn...');
      logs.push('Using Browserless.io /unblock API for enterprise anti-detection');
      
      if (!process.env.BROWSERLESS_TOKEN) {
        throw new Error('BROWSERLESS_TOKEN environment variable is required');
      }

      // Step 1: Unblock the feed for warmup using /unblock API
      console.log('[PlaywrightConnection] Unblocking LinkedIn feed via /unblock API...');
      // Convert WebSocket URL to HTTP URL for /unblock API
      let baseUrl = process.env.BROWSERLESS_URL || 'https://production-sfo.browserless.io';
      if (baseUrl.startsWith('wss://')) {
        baseUrl = baseUrl.replace('wss://', 'https://');
        console.log('[PlaywrightConnection] Converted WebSocket URL to HTTP for /unblock API');
      }
      const unblockUrl = `${baseUrl}/chromium/unblock?token=${process.env.BROWSERLESS_TOKEN}&proxy=residential&captcha=true&timeout=300000&waitForTimeout=10000`; // Increased timeout to 5min, wait 10s after load
      
      console.log(`[PlaywrightConnection] Unblock URL: ${baseUrl}`);
      logs.push(`Using unblock endpoint: ${baseUrl}`);

      console.log('[PlaywrightConnection] Making /unblock API request...');
      console.log('[PlaywrightConnection] Request URL:', unblockUrl);
      logs.push(`Making /unblock API request to: ${unblockUrl}`);

      // Create AbortController for fetch timeout
      const feedController = new AbortController();
      const feedTimeoutId = setTimeout(() => feedController.abort(), 330000); // 5.5min to be safe
      
      let unblockResponse;
      try {
        unblockResponse = await fetch(unblockUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: feedController.signal,
          body: JSON.stringify({
            url: 'https://www.linkedin.com/feed/',
            browserWSEndpoint: true,  // Get WS for Puppeteer control
            cookies: true,             // Return any new cookies
            content: false,            // No need for HTML yet
            screenshot: false,
            ttl: 30000                  // Increased TTL to 30s for warmup
          })
        });
      } catch (fetchError: any) {
        clearTimeout(feedTimeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Feed unblock request timed out after 5.5 minutes');
        }
        console.error('[PlaywrightConnection] Fetch request failed:', fetchError.message);
        logs.push(`❌ Fetch request failed: ${fetchError.message}`);
        throw new Error(`Fetch request failed: ${fetchError.message}`);
      } finally {
        clearTimeout(feedTimeoutId);
      }

      if (!unblockResponse.ok) {
        const errText = await unblockResponse.text();
        console.error('[PlaywrightConnection] Unblock failed:', errText);
        logs.push(`❌ Unblock failed: ${unblockResponse.status} - ${errText}`);
        throw new Error(`Unblock failed: ${unblockResponse.status} - ${errText}`);
      }

      const unblockResult = await unblockResponse.json();
      const { browserWSEndpoint } = unblockResult;
      
      if (!browserWSEndpoint) {
        console.error('[PlaywrightConnection] No browserWSEndpoint from /unblock:', unblockResult);
        throw new Error('No browserWSEndpoint from /unblock API');
      }

      logs.push('✅ Unblocked feed - got clean browser endpoint');
      console.log('[PlaywrightConnection] Got unblocked browserWSEndpoint:', browserWSEndpoint.substring(0, 50) + '...');

      // Connect Puppeteer to the unblocked endpoint
      try {
        browser = await puppeteer.connect({ 
          browserWSEndpoint,
          defaultViewport: { width: 1920, height: 1080 }
        });
        
        console.log('[PlaywrightConnection] Connected to unblocked browser successfully');
        logs.push('Connected to unblocked browser session');
      } catch (connectionError: any) {
        console.error('[PlaywrightConnection] Failed to connect to unblocked endpoint:', connectionError.message);
        logs.push(`❌ Failed to connect to unblocked endpoint: ${connectionError.message}`);
        throw new Error(`Failed to connect to unblocked endpoint: ${connectionError.message}`);
      }
      
      // Create new page with enhanced stealth
      page = await browser.newPage();
      
      // Enhanced user agents rotation (2025 realistic)
      const userAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      ];
      const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
      
      // Set enhanced browser properties
      await page.setUserAgent(randomUA);
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Add extra headers for realism
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1'
      });

      logs.push(`Browserless browser configured with stealth UA: ${randomUA.substring(0, 50)}...`);
      
      // Parse cookies once for use in both unblocked sessions
      console.log('[PlaywrightConnection] Parsing cookies for unblocked sessions...');
      console.log('- Decrypted cookie length:', decryptedCookie.length);
      console.log('- First 200 chars of decrypted cookie:', decryptedCookie.substring(0, 200));
      
      const cookies = this.parseCookiesForPlaywright(decryptedCookie);
      console.log('[PlaywrightConnection] Parsed cookies for Puppeteer:', cookies.length);
      console.log('[PlaywrightConnection] Cookie names:', cookies.map(c => c.name).join(', '));
      logs.push(`Parsed ${cookies.length} LinkedIn cookies for unblocked sessions`);
      
      // Enhanced redirect loop detection and anti-bot monitoring
      let redirectCount = 0;
      const redirectLoop = new Set<string>();
      page.on('response', response => {
        if (response.status() >= 300 && response.status() < 400) {
          redirectCount++;
          const location = response.headers()['location'] || 'unknown';
          
          console.log(`[PlaywrightConnection] Redirect ${redirectCount}: ${response.status()} from ${response.url()} to ${location}`);
          logs.push(`Redirect: ${response.status()} → ${location}`);
          
          // Detect redirect loops (same URL redirecting multiple times)
          if (redirectLoop.has(location)) {
            console.warn(`[PlaywrightConnection] ⚠️ Redirect loop detected to: ${location}`);
            logs.push(`⚠️ Redirect loop detected to: ${location}`);
          }
          redirectLoop.add(location);
          
          // Break infinite redirect loops (LinkedIn anti-bot behavior)
          if (redirectCount > 15) {
            console.error(`[PlaywrightConnection] ❌ Breaking redirect loop after ${redirectCount} redirects - LinkedIn bot detection active`);
            logs.push(`❌ Breaking redirect loop after ${redirectCount} redirects - LinkedIn bot detection active`);
          }
        }
        if (response.url().includes('challenge') || response.url().includes('checkpoint')) {
          console.warn(`[PlaywrightConnection] Challenge/Checkpoint detected: ${response.url()}`);
          logs.push(`⚠️ LinkedIn challenge detected: ${response.url()}`);
        }
      });
      
      // Session already unblocked via /unblock API - proceed with cookie injection and warmup
      
      // Inject cookies into the unblocked session
      console.log('[PlaywrightConnection] Injecting cookies into unblocked session...');
      await page.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded', timeout: 30000 }); // Enable domain
      await page.setCookie(...cookies);
      logs.push('Cookies injected into unblocked session');
      
      // Step 1: Warmup via unblocked feed (already accessible without redirects)
      console.log('[PlaywrightConnection] Warming up via unblocked LinkedIn feed...');
      logs.push('Warming up session via unblocked LinkedIn feed');
      
      await page.goto('https://www.linkedin.com/feed/', { 
        waitUntil: 'networkidle0',
        timeout: 90000 // The unblocked session should load cleanly
      });
      logs.push('Unblocked feed navigation successful');
      
      // Enhanced human-like behavior on feed
      await page.waitForTimeout(3000 + Math.random() * 2000); // Extended delay 3-5s
      
      // Multiple human-like interactions
      await page.evaluate(() => {
        // Random scroll pattern
        window.scrollTo(0, 150 + Math.random() * 300);
        setTimeout(() => window.scrollTo(0, 50 + Math.random() * 100), 500);
      });
      
      await page.waitForTimeout(1000 + Math.random() * 1000); // Additional delay
      
      const feedUrl = page.url();
      if (feedUrl.includes('/login') || feedUrl.includes('/challenge')) {
        throw new Error('Session invalid - redirected to login during warmup');
      }
      
      // Small delay between unblock calls to prevent rate limiting
      await page.waitForTimeout(2000);
      
      // Step 2: Unblock the target profile using second /unblock API call
      console.log(`[PlaywrightConnection] Unblocking target profile: ${profileUrl}`);
      logs.push(`Unblocking target profile via /unblock API`);
      
      const profileUnblockUrl = `${baseUrl}/chromium/unblock?token=${process.env.BROWSERLESS_TOKEN}&proxy=residential&captcha=true&timeout=300000&waitForSelector=button%5Baria-label%3D%22More%20actions%22%5D&waitForTimeout=10000`; // Wait for More button
      
      // Create AbortController for fetch timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 330000); // 5.5min to be safe
      
      let profileUnblockResponse;
      try {
        profileUnblockResponse = await fetch(profileUnblockUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            url: profileUrl,
            browserWSEndpoint: true,  // Get WS for Puppeteer control
            cookies: true,             // Return any new cookies
            content: false,            // No need for HTML yet
            screenshot: false,
            ttl: 30000                  // Increased TTL for profile interactions
          })
        });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Profile unblock request timed out after 5.5 minutes');
        }
        throw new Error(`Profile unblock fetch failed: ${fetchError.message}`);
      } finally {
        clearTimeout(timeoutId);
      }

      if (!profileUnblockResponse.ok) {
        const errText = await profileUnblockResponse.text();
        console.error('[PlaywrightConnection] Profile unblock failed:', errText);
        logs.push(`❌ Profile unblock failed: ${profileUnblockResponse.status} - ${errText}`);
        throw new Error(`Profile unblock failed: ${profileUnblockResponse.status} - ${errText}`);
      }

      const profileUnblockResult = await profileUnblockResponse.json();
      const { browserWSEndpoint: profileEndpoint } = profileUnblockResult;
      
      if (!profileEndpoint) {
        console.error('[PlaywrightConnection] No profile browserWSEndpoint from /unblock:', profileUnblockResult);
        throw new Error('No profile browserWSEndpoint from /unblock API');
      }

      logs.push('✅ Unblocked profile - got clean browser endpoint');
      console.log('[PlaywrightConnection] Got profile unblocked browserWSEndpoint:', profileEndpoint.substring(0, 50) + '...');

      // Close previous browser, connect to new one for profile
      await browser.close();
      browser = await puppeteer.connect({ 
        browserWSEndpoint: profileEndpoint,
        defaultViewport: { width: 1920, height: 1080 }
      });

      page = await browser.newPage();
      
      // Re-inject cookies into the new unblocked profile session
      await page.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.setCookie(...cookies);
      logs.push('Cookies re-injected into profile session');
      
      // Set referer to look more natural  
      await page.setExtraHTTPHeaders({ 'Referer': 'https://www.linkedin.com/feed/' });
      
      // Navigate to the unblocked profile (should load without redirects)
      await page.goto(profileUrl, { 
        waitUntil: 'networkidle0',
        timeout: 120000 // The unblocked profile should load cleanly
      });
      logs.push('Unblocked profile navigation successful');
      
      // Check for auth redirects
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/authwall') || currentUrl.includes('/challenge')) {
        throw new Error(`Redirected to ${currentUrl} - profile requires authentication or blocked by LinkedIn`);
      }
      
      // Step 3: Human-like behavior on profile page
      console.log('[PlaywrightConnection] Waiting for profile to load...');
      await page.waitForTimeout(1000 + Math.random() * 1000); // Random delay 1-2s
      
      // Enhanced scrolling to find buttons that appear lower on the page
      await page.evaluate(() => {
        // First scroll to the profile actions area
        window.scrollTo(0, 300 + Math.random() * 200);
      });
      await page.waitForTimeout(1000);
      
      // More aggressive scrolling to reveal More button
      await page.evaluate(() => {
        window.scrollTo(0, 600 + Math.random() * 300); // Scroll further
      });
      await page.waitForTimeout(1500);
      
      // Additional scroll if needed to reveal hidden buttons
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight * 0.3); // Scroll to 30% of page
      });
      await page.waitForTimeout(1000);
      await page.waitForTimeout(500 + Math.random() * 500); // Random delay
      
      // Take screenshot for debugging
      const initialScreenshotBuffer = await page.screenshot();
      screenshots.push(initialScreenshotBuffer.toString('base64'));
      
      // Step 4: Attempt to find and click connect button
      const connectionResult = await this.performConnectionFlow(page, message, logs);
      
      if (connectionResult.success) {
        // Take success screenshot
        const successScreenshotBuffer = await page.screenshot();
        screenshots.push(successScreenshotBuffer.toString('base64'));
        
        console.log('[PlaywrightConnection] ✅ Connection request sent successfully');
        logs.push('✅ Connection request sent successfully');
        
        return {
          success: true,
          message: connectionResult.message,
          screenshots,
          logs
        };
      } else {
        // Take failure screenshot
        const failureScreenshotBuffer = await page.screenshot();
        screenshots.push(failureScreenshotBuffer.toString('base64'));
        
        return {
          success: false,
          message: connectionResult.message,
          error: connectionResult.error,
          screenshots,
          logs
        };
      }
      
    } catch (error: any) {
      console.error('[PlaywrightConnection] Connection request failed:', error.message);
      logs.push(`❌ Error: ${error.message}`);
      
      // Take error screenshot if page exists
      if (page) {
        try {
          const errorScreenshotBuffer = await page.screenshot();
          screenshots.push(errorScreenshotBuffer.toString('base64'));
        } catch (screenshotError) {
          console.warn('[PlaywrightConnection] Could not capture error screenshot');
        }
      }
      
      return {
        success: false,
        message: 'Connection request failed',
        error: error.message,
        screenshots,
        logs
      };
      
    } finally {
      // Cleanup
      if (browser) {
        await browser.close();
        console.log('[PlaywrightConnection] Browser closed');
      }
    }
  }
  

  
  /**
   * Parse cookie string for Playwright format
   */
  private static parseCookiesForPlaywright(fullCookie: string) {
    const cookieEntries = fullCookie.split(';').map(part => part.trim()).filter(Boolean);
    return cookieEntries.map(pair => {
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
    }).filter(Boolean) as any[];
  }
  
  /**
   * Perform the actual connection flow on the profile page with enhanced 2025 detection
   */
  private static async performConnectionFlow(page: Page, message: string, logs: string[]): Promise<{success: boolean, message: string, error?: string}> {
    try {
      // Check if already connected first (if Message button exists but no Connect) - Fixed for Puppeteer
      const messageButton = await page.$('button[aria-label*="Message"]');
      if (messageButton) {
        logs.push('Found Message button - checking if already connected...');
      }

      let connectButton = null;
      let usedSelector = '';
      
      // Enhanced selectors for 2025 LinkedIn UI - Fixed for Puppeteer compatibility
      const directConnectSelectors = [
        'button[aria-label*="Invite"][aria-label*="connect"]',
        'button[aria-label*="Invite"][aria-label*="Connect"]', 
        'button[data-control-name="connect"]',
        'button[aria-label*="Connect"]',
        '.pv-s-profile-actions button[aria-label*="Connect"]',
        '[data-tracking-control-name="connect"] button',
        'button.artdeco-button--secondary[aria-label*="Connect"]'
      ];
      
      // First try direct connect buttons (older UI or already visible)
      logs.push('Searching for direct Connect button...');
      for (const selector of directConnectSelectors) {
        try {
          connectButton = await page.waitForSelector(selector, { timeout: 3000 });
          if (connectButton && await connectButton.isVisible()) {
            usedSelector = selector;
            logs.push(`✅ Found direct connect button using: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // Fallback: use page.evaluate to find buttons by text content (Puppeteer-compatible)
      if (!connectButton) {
        logs.push('Trying text-based Connect button detection...');
        try {
          const textBasedConnect = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(btn => {
              const text = btn.textContent?.trim().toLowerCase() || '';
              const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
              return text.includes('connect') || ariaLabel.includes('connect');
            });
          });
          
          if (textBasedConnect) {
            // Get a selector for this button
            const buttonSelector = await page.evaluate((btn: Element) => {
              // Try to create a unique selector
              if (btn.id) return `#${btn.id}`;
              if (btn.className) return `button.${btn.className.split(' ')[0]}`;
              const index = Array.from(document.querySelectorAll('button')).indexOf(btn as HTMLButtonElement);
              return `button:nth-of-type(${index + 1})`;
            }, textBasedConnect);
            
            connectButton = await page.$(buttonSelector);
            usedSelector = 'text-based-detection';
            logs.push(`✅ Found Connect button via text detection: ${buttonSelector}`);
          }
        } catch (evalError: any) {
          logs.push(`Text-based detection failed: ${evalError.message}`);
        }
      }
      
      // If no direct Connect button found, try the "More" dropdown (2025 UI)
      if (!connectButton) {
        logs.push('No direct Connect button found, trying "More" dropdown...');
        
        // Enhanced debugging: log all visible buttons before searching for More
        try {
          const allButtonsInfo = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button:visible, [role="button"]:visible'));
            return buttons.slice(0, 10).map(btn => {
              const text = btn.textContent?.trim() || '';
              const ariaLabel = btn.getAttribute('aria-label') || '';
              const className = btn.className || '';
              return `"${text.substring(0, 20)}" [aria-label="${ariaLabel.substring(0, 30)}"] [class="${className.substring(0, 30)}"]`;
            });
          });
          logs.push(`Available buttons on page: ${allButtonsInfo.join(' | ')}`);
        } catch (debugError: any) {
          logs.push(`Could not analyze available buttons: ${debugError.message}`);
        }
        
        // Additional scrolling specifically to reveal More button (user feedback: appears after scrolling)
        logs.push('Scrolling to reveal More button...');
        await page.evaluate(() => {
          // Scroll to the bottom of the main profile section
          window.scrollTo(0, document.body.scrollHeight * 0.4); // Scroll to 40% of page
        });
        await page.waitForTimeout(1500);
        
        // Enhanced More button selectors for 2025 - Fixed for Puppeteer
        const moreSelectors = [
          'button[aria-label="More actions"]',
          'button[aria-label*="More"]',
          'button.artdeco-dropdown-trigger',
          '[data-control-name="overflow_menu"]',
          'button[aria-expanded="false"]'
        ];
        
        let moreButton = null;
        for (const selector of moreSelectors) {
          try {
            moreButton = await page.waitForSelector(selector, { timeout: 5000, visible: true }); // Increased timeout
            if (moreButton && await moreButton.isVisible()) {
              logs.push(`✅ Found More button using: ${selector}`);
              break;
            }
          } catch (e) {
            logs.push(`More button selector failed: ${selector}`);
            // Continue to next selector
          }
        }
        
        // Fallback: text-based More button detection
        if (!moreButton) {
          logs.push('Trying text-based More button detection...');
          try {
            const textBasedMore = await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              return buttons.find(btn => {
                const text = btn.textContent?.trim().toLowerCase() || '';
                const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
                return text.includes('more') || ariaLabel.includes('more');
              });
            });
            
            if (textBasedMore) {
              const buttonSelector = await page.evaluate((btn: Element) => {
                if (btn.id) return `#${btn.id}`;
                if (btn.className) return `button.${btn.className.split(' ')[0]}`;
                const index = Array.from(document.querySelectorAll('button')).indexOf(btn as HTMLButtonElement);
                return `button:nth-of-type(${index + 1})`;
              }, textBasedMore);
              
              moreButton = await page.$(buttonSelector);
              logs.push(`✅ Found More button via text detection: ${buttonSelector}`);
            }
          } catch (evalError: any) {
            logs.push(`Text-based More detection failed: ${evalError.message}`);
          }
        }
        
        if (moreButton) {
          // Human-like interaction: hover before click
          logs.push('Hovering over More button...');
          await page.hover(moreButton.selector!);
          await page.waitForTimeout(300 + Math.random() * 200); // Random hover delay
          
          // Click the More button to open dropdown
          logs.push('Clicking More button to open dropdown...');
          await moreButton.click();
          
          // Wait for dropdown to appear with animation
          await page.waitForTimeout(800 + Math.random() * 400);
          
          // Enhanced dropdown selectors for 2025 - Fixed for Puppeteer
          const dropdownConnectSelectors = [
            'li[aria-label*="Invite"]',
            '[data-control-name="connect"]',
            'button[aria-label*="connect" i]:visible',
            'button[aria-label*="Connect"]',
            '[role="menu"] button[aria-label*="Connect"]',
            '.artdeco-dropdown__content button[aria-label*="Connect"]'
          ];
          
          for (const selector of dropdownConnectSelectors) {
            try {
              connectButton = await page.waitForSelector(selector, { timeout: 2000 });
              if (connectButton && await connectButton.isVisible()) {
                usedSelector = `More dropdown -> ${selector}`;
                logs.push(`Found Connect button in dropdown using selector: ${selector}`);
                break;
              }
            } catch (e) {
              // Continue to next selector
            }
          }
          
          // Fallback: text-based dropdown Connect detection
          if (!connectButton) {
            logs.push('Trying text-based dropdown Connect detection...');
            try {
              const textBasedDropdownConnect = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('[role="menu"] *, .artdeco-dropdown__content *, li *, div[role="menuitem"] *'));
                return elements.find(el => {
                  const text = el.textContent?.trim().toLowerCase() || '';
                  const ariaLabel = el.getAttribute?.('aria-label')?.toLowerCase() || '';
                  return (text.includes('connect') || ariaLabel.includes('connect')) && 
                         (el.tagName === 'BUTTON' || el.closest('button') || el.getAttribute('role') === 'button');
                });
              });
              
              if (textBasedDropdownConnect) {
                const elementSelector = await page.evaluate((el: Element) => {
                  if (el.tagName === 'BUTTON') return `button:nth-of-type(${Array.from(document.querySelectorAll('button')).indexOf(el as HTMLButtonElement) + 1})`;
                  const button = el.closest('button');
                  if (button) return `button:nth-of-type(${Array.from(document.querySelectorAll('button')).indexOf(button) + 1})`;
                  if (el.id) return `#${el.id}`;
                  return `*:nth-child(${Array.from(el.parentNode?.children || []).indexOf(el) + 1})`;
                }, textBasedDropdownConnect);
                
                connectButton = await page.$(elementSelector);
                usedSelector = `More dropdown -> text-based-detection`;
                logs.push(`✅ Found Connect in dropdown via text detection: ${elementSelector}`);
              }
            } catch (evalError: any) {
              logs.push(`Text-based dropdown Connect detection failed: ${evalError.message}`);
            }
          }
        }
      }
      
      if (!connectButton) {
        // Enhanced fallback: check if already connected
        if (messageButton) {
          logs.push('No Connect button found but Message button exists - likely already connected');
          return {
            success: false,
            message: 'Already connected to this profile',
            error: 'ALREADY_CONNECTED'
          };
        }
        
        // Log page content for debugging (with context destruction handling)
        try {
          const pageContent = await page.content();
          logs.push(`Page HTML length: ${pageContent.length} chars`);
          
          // Handle potential context destruction during button analysis
          try {
            const buttonInfo = await page.$$eval('button', buttons => 
              buttons.slice(0, 10).map(b => b.textContent?.trim() || b.getAttribute('aria-label') || 'unnamed').join(', ')
            );
            logs.push('Available buttons: ' + buttonInfo);
          } catch (evalError: any) {
            if (evalError.message.includes('context') || evalError.message.includes('destroyed')) {
              logs.push('⚠️ Page context destroyed during button analysis - LinkedIn SPA navigation detected');
              // Attempt to wait and retry
              await page.waitForTimeout(2000);
              const retryButtonInfo = await page.$$eval('button', buttons => 
                buttons.slice(0, 5).map(b => b.textContent?.trim() || 'unnamed').join(', ')
              ).catch(() => 'Unable to analyze buttons due to context issues');
              logs.push('Available buttons (retry): ' + retryButtonInfo);
            } else {
              logs.push('Could not analyze buttons: ' + evalError.message);
            }
          }
        } catch (e: any) {
          logs.push('Could not analyze page content: ' + e.message);
        }
        
        return {
          success: false,
          message: 'Connect button not found - may already be connected or profile not accessible',
          error: 'NO_CONNECT_BUTTON'
        };
      }
      
      // Enhanced human-like connect button interaction with context destruction handling
      logs.push(`Preparing to click Connect button (${usedSelector})...`);
      
      try {
        // Hover before clicking (human-like)
        await page.hover(connectButton.selector!);
        await page.waitForTimeout(400 + Math.random() * 300); // Random hover delay
        logs.push('Hovering over Connect button...');
        
        // Click with human-like delay
        logs.push('Clicking Connect button...');
        await page.waitForTimeout(500 + Math.random() * 500); // Random delay before click
        await connectButton.click();
        
      } catch (interactionError: any) {
        if (interactionError.message.includes('context') || interactionError.message.includes('destroyed')) {
          logs.push('⚠️ Context destroyed during button interaction - attempting recovery...');
          // Wait for page to stabilize
          await page.waitForTimeout(3000);
          
          // Try to find and click connect button again - Fixed for Puppeteer
          try {
            const newConnectButton = await page.waitForSelector('button[aria-label*="Connect"]', { timeout: 5000 });
            if (newConnectButton) {
              await newConnectButton.click();
              logs.push('✅ Successfully clicked Connect button after context recovery');
            } else {
              throw new Error('Connect button not found after context recovery');
            }
          } catch (recoveryError) {
            throw new Error(`Context destruction recovery failed: ${recoveryError.message}`);
          }
        } else {
          throw interactionError;
        }
      }
      
      // Wait for modal or direct send
      await page.waitForTimeout(2000);
      
      // Check if we have a modal for adding a note
      const modalSelectors = [
        '[data-test-modal] textarea',
        '.send-invite textarea',
        'textarea[name="message"]',
        '.artdeco-modal textarea',
        '#custom-message'
      ];
      
      let messageTextarea = null;
      for (const selector of modalSelectors) {
        try {
          messageTextarea = await page.waitForSelector(selector, { timeout: 2000 });
          if (messageTextarea && await messageTextarea.isVisible()) {
            logs.push(`Found message textarea using selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // If we have a message textarea, fill it
      if (messageTextarea && message.trim()) {
        logs.push('Adding personal message to connection request');
        await messageTextarea.fill(message);
        await page.waitForTimeout(500);
      }
      
      // Find and click send button - Fixed for Puppeteer compatibility
      const sendSelectors = [
        'button[aria-label*="Send now"]',
        'button[aria-label*="Send invitation"]',
        'button[data-control-name="send_invitation"]',
        '.send-invite button[type="submit"]',
        '.artdeco-modal button[type="submit"]',
        'button[aria-label*="Send"]'
      ];
      
      let sendButton = null;
      for (const selector of sendSelectors) {
        try {
          sendButton = await page.waitForSelector(selector, { timeout: 2000 });
          if (sendButton && await sendButton.isVisible() && await sendButton.isEnabled()) {
            logs.push(`Found send button using selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // Fallback: text-based Send button detection
      if (!sendButton) {
        logs.push('Trying text-based Send button detection...');
        try {
          const textBasedSend = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(btn => {
              const text = btn.textContent?.trim().toLowerCase() || '';
              const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
              return text.includes('send') || ariaLabel.includes('send');
            });
          });
          
          if (textBasedSend) {
            const buttonSelector = await page.evaluate((btn: Element) => {
              if (btn.id) return `#${btn.id}`;
              if (btn.className) return `button.${btn.className.split(' ')[0]}`;
              const index = Array.from(document.querySelectorAll('button')).indexOf(btn as HTMLButtonElement);
              return `button:nth-of-type(${index + 1})`;
            }, textBasedSend);
            
            sendButton = await page.$(buttonSelector);
            logs.push(`✅ Found Send button via text detection: ${buttonSelector}`);
          }
        } catch (evalError: any) {
          logs.push(`Text-based Send detection failed: ${evalError.message}`);
        }
      }
      
      if (!sendButton) {
        return {
          success: false,
          message: 'Send button not found after clicking connect',
          error: 'NO_SEND_BUTTON'
        };
      }
      
      // Click send with human delay
      await page.waitForTimeout(500 + Math.random() * 500);
      await sendButton.click();
      
      // Wait for success/error indicators
      await page.waitForTimeout(3000);
      
      // Check for success indicators (with context destruction handling) - Fixed for Puppeteer
      const successSelectors = [
        '.artdeco-toast-message',
        '.artdeco-toast',
        '[data-test-toast-message]',
        '.mercado-confirmation'
      ];
      
      for (const selector of successSelectors) {
        try {
          const successElement = await page.waitForSelector(selector, { timeout: 2000 });
          if (successElement) {
            try {
              const text = await successElement.evaluate(el => el.textContent);
              if (text && (text.includes('sent') || text.includes('Invitation'))) {
                return {
                  success: true,
                  message: message ? 'Connection request sent with personal message' : 'Connection request sent'
                };
              }
            } catch (textError: any) {
              if (textError.message.includes('context') || textError.message.includes('destroyed')) {
                logs.push('⚠️ Context destroyed while reading success message - assuming success');
                return {
                  success: true,
                  message: 'Connection request likely sent (context destroyed during verification)'
                };
              }
            }
          }
        } catch (e) {
          // Continue checking
        }
      }
      
      // Check for error indicators
      const errorSelectors = [
        '.artdeco-toast--error',
        '.mercado-error',
        '[data-test-toast-message*="error"]'
      ];
      
      for (const selector of errorSelectors) {
        try {
          const errorElement = await page.waitForSelector(selector, { timeout: 1000 });
          if (errorElement) {
            const errorText = await errorElement.evaluate(el => el.textContent);
            return {
              success: false,
              message: 'LinkedIn returned an error',
              error: errorText || 'Unknown error from LinkedIn'
            };
          }
        } catch (e) {
          // Continue checking
        }
      }
      
      // If no clear success/error indicator, assume success
      return {
        success: true,
        message: 'Connection request likely sent (no error indicators found)'
      };
      
    } catch (error: any) {
      return {
        success: false,
        message: 'Error during connection flow',
        error: error.message
      };
    }
  }
}