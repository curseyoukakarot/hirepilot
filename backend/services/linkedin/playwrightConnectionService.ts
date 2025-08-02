import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { BrowserContext, Page } from 'playwright';
import * as crypto from 'crypto';

// Enable stealth plugin for maximum anti-detection
chromium.use(stealth());

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
            console.error('[PlaywrightConnection] Fallback failed: cookie string looks encrypted, not like cookies');
            logs.push('❌ Cookie decryption failed and fallback failed - cookie appears encrypted');
            return {
              success: false,
              message: 'Failed to decrypt LinkedIn cookie and fallback failed',
              error: `Cookie appears to be encrypted data, not plain text cookies. Length: ${fullCookie.length}. Sample: ${fullCookie.substring(0, 100)}`,
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
    
    // Build proxy configuration (using your existing proxy setup)
    const proxyConfig = this.buildProxyConfig();
    
    let browser;
    let context: BrowserContext;
    let page: Page;
    
    try {
      // Launch browser with maximum stealth + proxy for 2025 LinkedIn anti-bot detection
      console.log('[PlaywrightConnection] Launching Chromium with enhanced stealth configuration...');
      
      // Auto-detect environment for headless mode
      const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT_NAME || !process.env.DISPLAY;
      const headlessMode = isProduction;
      
      console.log(`[PlaywrightConnection] Environment: ${isProduction ? 'Production/Server' : 'Development'}, Headless: ${headlessMode}`);
      
      const launchOptions: any = {
        headless: headlessMode,  // Auto-detect: true for production/Railway, false for local dev
        slowMo: headlessMode ? 50 : 100,     // Faster in headless mode
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor',
          // Enhanced stealth args for 2025 LinkedIn detection  
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          '--window-size=1920,1080',
          '--start-maximized',
          // Add proxy if available
          ...(proxyConfig.args || [])
        ]
      };

      // Add Decodo proxy if configured
      if (proxyConfig.creds) {
        const host = process.env.DECODO_HOST || 'gate.decodo.com';
        const port = process.env.DECODO_PORT || '10001';
        launchOptions.proxy = { 
          server: `http://${host}:${port}`,
          username: proxyConfig.creds.username,
          password: proxyConfig.creds.password
        };
        console.log(`[PlaywrightConnection] Using Decodo proxy: ${host}:${port}`);
        logs.push('Using Decodo residential proxy for anti-detection');
      }

      browser = await chromium.launch(launchOptions);
      
      console.log('[PlaywrightConnection] Browser version:', await browser.version());
      
      // Create context with enhanced realistic fingerprinting for 2025
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        storageState: undefined,
        extraHTTPHeaders: { 
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
        },
        bypassCSP: true, // Bypass LinkedIn CSP if blocking
        // Add proxy credentials if available
        ...(proxyConfig.creds && { 
          httpCredentials: proxyConfig.creds 
        })
      });
      
      // Enhanced cookie injection with proper parsing (using decrypted cookie)
      console.log('[PlaywrightConnection] About to parse cookies...');
      console.log('- Decrypted cookie length:', decryptedCookie.length);
      console.log('- First 200 chars of decrypted cookie:', decryptedCookie.substring(0, 200));
      console.log('- Cookie contains semicolons:', decryptedCookie.includes(';'));
      console.log('- Cookie contains equals:', decryptedCookie.includes('='));
      
      const cookies = this.parseCookiesForPlaywright(decryptedCookie);
      console.log('[PlaywrightConnection] Parsed cookies:', cookies.length);
      console.log('[PlaywrightConnection] Cookie names:', cookies.map(c => c.name).join(', '));
      logs.push(`Injecting ${cookies.length} cookies for authentication`);
      
      if (cookies.length === 0) {
        console.error('[PlaywrightConnection] ❌ CRITICAL: No cookies parsed!');
        console.error('[PlaywrightConnection] Raw cookie string (full):', decryptedCookie);
        logs.push('❌ CRITICAL: Cookie parsing failed - no cookies extracted from string');
      }
      
      await context.addCookies(cookies);
      
      // Verify critical LinkedIn auth cookies
      const setCookies = await context.cookies();
      const hasLiAt = setCookies.some(c => c.name === 'li_at');
      const hasJSession = setCookies.some(c => c.name === 'JSESSIONID');
      const hasLiap = setCookies.some(c => c.name === 'liap');
      
      console.log('[PlaywrightConnection] Cookie verification - li_at:', hasLiAt, 'JSESSIONID:', hasJSession, 'liap:', hasLiap);
      logs.push(`Cookie verification - li_at: ${hasLiAt}, JSESSIONID: ${hasJSession}, liap: ${hasLiap}`);
      
      // For testing: proceed even without li_at if we have other session cookies
      if (!hasLiAt && !hasJSession && !hasLiap) {
        throw new Error('Missing all essential LinkedIn cookies - authentication will likely fail');
      }
      
      if (!hasLiAt) {
        console.warn('[PlaywrightConnection] Warning: No li_at cookie found, proceeding with other session cookies');
        logs.push('⚠️ Warning: No li_at cookie found, proceeding with available session cookies');
      }
      
      // Create page with stealth scripts
      page = await context.newPage();
      
      // Add redirect listener for debugging LinkedIn's bot detection
      page.on('response', response => {
        if (response.status() >= 300 && response.status() < 400) {
          const location = response.headers()['location'] || 'unknown';
          console.log(`[PlaywrightConnection] Redirect detected: ${response.status()} from ${response.url()} to ${location}`);
          logs.push(`Redirect: ${response.status()} → ${location}`);
        }
        if (response.url().includes('challenge') || response.url().includes('checkpoint')) {
          console.warn(`[PlaywrightConnection] Challenge/Checkpoint detected: ${response.url()}`);
          logs.push(`⚠️ LinkedIn challenge detected: ${response.url()}`);
        }
      });
      
      // Add comprehensive stealth script
      await page.addInitScript(() => {
        // Remove webdriver traces
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // Mock realistic browser properties
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        
        // Mock Chrome runtime
        (window as any).chrome = {
          runtime: {}
        };
        
        // Override permission query
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: 'denied' } as PermissionStatus) :
            originalQuery(parameters)
        );
      });
      
      // Step 1: Warm up session (mimics real user behavior)
      console.log('[PlaywrightConnection] Warming up LinkedIn session...');
      logs.push('Warming up session via LinkedIn feed');
      
      await page.goto('https://www.linkedin.com/feed/', { 
        waitUntil: 'domcontentloaded',
        timeout: 25000 // Increased timeout for anti-bot delays
      });
      
      // Human-like behavior on feed
      await page.waitForTimeout(2000 + Math.random() * 1000); // Random delay 2-3s
      await page.evaluate(() => window.scrollTo(0, 200 + Math.random() * 300)); // Random scroll
      
      const feedUrl = page.url();
      if (feedUrl.includes('/login') || feedUrl.includes('/challenge')) {
        throw new Error('Session invalid - redirected to login during warmup');
      }
      
      // Step 2: Navigate to target profile with enhanced fallback strategies
      console.log(`[PlaywrightConnection] Navigating to profile: ${profileUrl}`);
      logs.push(`Navigating to target profile`);
      
      // Set referer to look more natural
      await page.setExtraHTTPHeaders({ 'Referer': 'https://www.linkedin.com/feed/' });
      
      try {
        // Primary attempt: Full network idle wait
        await page.goto(profileUrl, { 
          waitUntil: 'networkidle',
          timeout: 60000 // Extended timeout for anti-bot delays
        });
        logs.push('Profile navigation successful with networkidle');
      } catch (err: any) {
        if (err.message.includes('net::ERR_TOO_MANY_REDIRECTS')) {
          console.warn('[PlaywrightConnection] Redirect storm detected, trying fallback navigation...');
          logs.push('⚠️ Redirect storm detected, attempting fallback');
          
          // Fallback strategy: Use domcontentloaded instead
          try {
            await page.goto(profileUrl, { 
              waitUntil: 'domcontentloaded',
              timeout: 30000 
            });
            logs.push('Fallback navigation successful with domcontentloaded');
          } catch (fallbackErr: any) {
            // Log page content for debugging
            try {
              const pageContent = await page.content();
              console.log('[PlaywrightConnection] Page content on navigation error:', pageContent.substring(0, 1000));
              logs.push(`Navigation failed. Page content length: ${pageContent.length} chars`);
              logs.push(`Page content preview: ${pageContent.substring(0, 200)}...`);
            } catch (contentErr) {
              logs.push('Could not capture page content for debugging');
            }
            throw new Error(`Profile navigation failed: ${fallbackErr.message}`);
          }
        } else {
          throw err;
        }
      }
      
      // Check for auth redirects
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/authwall') || currentUrl.includes('/challenge')) {
        throw new Error(`Redirected to ${currentUrl} - profile requires authentication or blocked by LinkedIn`);
      }
      
      // Step 3: Human-like behavior on profile page
      console.log('[PlaywrightConnection] Waiting for profile to load...');
      await page.waitForTimeout(1000 + Math.random() * 1000); // Random delay 1-2s
      
      // Scroll to actions section like a human would
      await page.evaluate(() => window.scrollTo(0, 300 + Math.random() * 200)); // Scroll to profile actions
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
   * Build proxy configuration (reusing your existing proxy logic from playwrightFetcher.ts)
   */
  private static buildProxyConfig() {
    const host = process.env.DECODO_HOST || 'gate.decodo.com';
    const port = process.env.DECODO_PORT || '10001';
    const user = process.env.DECODO_USER || '';
    const pass = process.env.DECODO_PASS || '';
    
    if (!user || !pass) {
      console.log('[PlaywrightConnection] No Decodo proxy credentials configured');
      return { args: [], creds: null };
    }
    
    const proxyUrl = `http://${host}:${port}`;
    const creds = { username: user, password: pass };
    return { 
      args: [`--proxy-server=${proxyUrl}`], 
      creds 
    };
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
      // Check if already connected first (if Message button exists but no Connect)
      const messageButton = await page.$('button:has-text("Message")');
      if (messageButton) {
        logs.push('Found Message button - checking if already connected...');
      }

      let connectButton = null;
      let usedSelector = '';
      
      // Enhanced selectors for 2025 LinkedIn UI
      const directConnectSelectors = [
        'button[aria-label*="Invite"][aria-label*="connect"]',
        'button[aria-label*="Invite"][aria-label*="Connect"]', 
        'button[data-control-name="connect"]',
        'button:has-text("Connect")',
        '.pv-s-profile-actions button:has-text("Connect")',
        '[data-tracking-control-name="connect"] button',
        'button[aria-label*="Connect"]',
        'button.artdeco-button--secondary:has-text("Connect")'
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
      
      // If no direct Connect button found, try the "More" dropdown (2025 UI)
      if (!connectButton) {
        logs.push('No direct Connect button found, trying "More" dropdown...');
        
        // Enhanced More button selectors for 2025
        const moreSelectors = [
          'button[aria-label="More actions"]',
          'button[aria-label*="More"]',
          'button:has-text("More")',
          '.pv-s-profile-actions button:has-text("More")',
          'button.artdeco-button:has-text("More")',
          'button.artdeco-dropdown-trigger',
          '[data-control-name="overflow_menu"]',
          'button[aria-expanded="false"]:has-text("More")'
        ];
        
        let moreButton = null;
        for (const selector of moreSelectors) {
          try {
            moreButton = await page.waitForSelector(selector, { timeout: 3000 });
            if (moreButton && await moreButton.isVisible()) {
              logs.push(`✅ Found More button using: ${selector}`);
              break;
            }
          } catch (e) {
            // Continue to next selector
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
          
          // Enhanced dropdown selectors for 2025
          const dropdownConnectSelectors = [
            'div[role="button"]:has-text("Connect")',
            'li[aria-label*="Invite"]',
            'span:has-text("Connect")',
            '[role="menu"] button:has-text("Connect")',
            '.artdeco-dropdown__content button:has-text("Connect")',
            '[data-control-name="connect"]',
            'button[aria-label*="connect" i]:visible',
            '.pv-s-profile-actions__overflow-menu button:has-text("Connect")',
            'ul[role="menu"] li button:has-text("Connect")',
            'div[role="menuitem"]:has-text("Connect")'
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
        
        // Log page content for debugging
        try {
          const pageContent = await page.content();
          logs.push(`Page HTML length: ${pageContent.length} chars`);
          logs.push('Available buttons: ' + await page.$$eval('button', buttons => 
            buttons.slice(0, 10).map(b => b.textContent?.trim() || b.getAttribute('aria-label') || 'unnamed').join(', ')
          ));
        } catch (e) {
          logs.push('Could not analyze page content');
        }
        
        return {
          success: false,
          message: 'Connect button not found - may already be connected or profile not accessible',
          error: 'NO_CONNECT_BUTTON'
        };
      }
      
      // Enhanced human-like connect button interaction
      logs.push(`Preparing to click Connect button (${usedSelector})...`);
      
      // Hover before clicking (human-like)
      await page.hover(connectButton.selector!);
      await page.waitForTimeout(400 + Math.random() * 300); // Random hover delay
      logs.push('Hovering over Connect button...');
      
      // Click with human-like delay
      logs.push('Clicking Connect button...');
      await page.waitForTimeout(500 + Math.random() * 500); // Random delay before click
      await connectButton.click();
      
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
      
      // Find and click send button
      const sendSelectors = [
        'button[aria-label*="Send now"]',
        'button[aria-label*="Send invitation"]',
        'button[data-control-name="send_invitation"]',
        '.send-invite button[type="submit"]',
        'button:has-text("Send invitation")',
        'button:has-text("Send")',
        '.artdeco-modal button[type="submit"]'
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
      
      // Check for success indicators
      const successSelectors = [
        '.artdeco-toast-message:has-text("Invitation sent")',
        '.artdeco-toast:has-text("sent")',
        '[data-test-toast-message]',
        '.mercado-confirmation'
      ];
      
      for (const selector of successSelectors) {
        try {
          const successElement = await page.waitForSelector(selector, { timeout: 2000 });
          if (successElement) {
            const text = await successElement.textContent();
            if (text && (text.includes('sent') || text.includes('Invitation'))) {
              return {
                success: true,
                message: message ? 'Connection request sent with personal message' : 'Connection request sent'
              };
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
            const errorText = await errorElement.textContent();
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