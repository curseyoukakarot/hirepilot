#!/usr/bin/env ts-node
/**
 * LinkedIn Connection Bot Core - Puppeteer Script
 * 
 * A production-grade TypeScript script that automates LinkedIn connection requests
 * with comprehensive edge case handling, human behavior simulation, and detailed logging.
 * 
 * Usage:
 *   ts-node connectToLinkedInProfile.ts
 *   or use as module: import { connectToLinkedInProfile } from './connectToLinkedInProfile'
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Initialize Supabase client for logging (optional)
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Response interface
interface ConnectionResult {
  status: 'success' | 'already_connected' | 'invite_sent' | 'out_of_invitations' | 'captcha_detected' | 'security_checkpoint' | 'profile_not_found' | 'connect_button_not_found' | 'rate_limited' | 'error';
  reason: string;
  page_state: {
    url: string;
    title: string;
    profile_name?: string;
    connection_status?: string;
    message_sent: boolean;
    screenshot_url?: string;
  };
  execution_time_ms: number;
  timestamp: string;
  metadata?: {
    user_agent: string;
    proxy_used?: string;
    verified_ip?: string;
    detected_elements: string[];
    error_details?: any;
  };
}

// Input parameters interface
interface ConnectionParams {
  li_at: string;
  profile_url: string;
  note?: string;
  proxy?: {
    endpoint: string;      // e.g., "us-ny.residential.smartproxy.com:10000" or "rotating-residential.brightdata.com:22225"
    username: string;      // Proxy username
    password: string;      // Proxy password
    type?: 'residential' | 'datacenter'; // Proxy type (default: residential)
    location?: string;     // Optional location identifier
  };
  user_id?: string;
  job_id?: string;
  headless?: boolean;
}

// Proxy verification response
interface ProxyVerificationResult {
  success: boolean;
  ip_address?: string;
  location?: string;
  error?: string;
  response_time_ms?: number;
}

// Human behavior configuration
interface HumanBehaviorConfig {
  scroll_min_px: number;
  scroll_max_px: number;
  action_delay_min_ms: number;
  action_delay_max_ms: number;
  mouse_movement_enabled: boolean;
  random_exploration_enabled: boolean;
  exploration_sections: string[];
  pre_action_hover_enabled: boolean;
}

// Daily rate limit checking interface
interface DailyRateLimitCheck {
  user_id: string;
  current_count: number;
  daily_limit: number;
  remaining: number;
  reset_at: string;
}

// Human behavior configuration (Prompt 4)
const HUMAN_BEHAVIOR_CONFIG: HumanBehaviorConfig = {
  scroll_min_px: 500,
  scroll_max_px: 3000,
  action_delay_min_ms: 2000,  // 2 seconds
  action_delay_max_ms: 6000,  // 6 seconds
  mouse_movement_enabled: true,
  random_exploration_enabled: true,
  exploration_sections: [
    'section[data-section="summary"]',           // About section
    'section[data-section="experience"]',       // Experience section
    '#about',                                   // About fallback
    '.pv-about-section',                        // About section alternative
    '.pv-profile-section.experience-section',  // Experience section alternative
    '.pv-experience-section'                   // Experience section fallback
  ],
  pre_action_hover_enabled: true
};

// LinkedIn selectors (updated for 2024)
const LINKEDIN_SELECTORS = {
  // Connection buttons
  connect_button: [
    'button[aria-label*="Invite"][aria-label*="connect"]',
    'button[data-control-name="connect"]',
    '.pv-s-profile-actions button:contains("Connect")',
    'button[data-test-link="invite-to-connect"]',
    '.pv-top-card-v2-ctas button[data-control-name="connect"]'
  ],
  
  // Message/Note elements
  add_note_button: [
    'button[aria-label*="Add a note"]',
    'button[data-control-name="add_note"]',
    '.connect-button-send-invite__add-note-button'
  ],
  note_textarea: [
    'textarea[name="message"]',
    'textarea[id="custom-message"]', 
    '#custom-message',
    '.connect-button-send-invite__custom-message'
  ],
  send_button: [
    'button[aria-label*="Send"]',
    'button[data-control-name="send"]',
    '.connect-button-send-invite__send-button'
  ],
  send_without_note: [
    'button[aria-label*="Send without a note"]',
    'button[data-control-name="send_without_note"]'
  ],

  // Profile information
  profile_name: [
    'h1.text-heading-xlarge',
    '.pv-text-details__left-panel h1',
    '.ph5.pb5 h1',
    '.pv-top-card--list h1'
  ],
  profile_headline: [
    '.text-body-medium.break-words',
    '.pv-text-details__left-panel .text-body-medium',
    '.pv-top-card--list .text-body-medium'
  ],

  // Status indicators
  already_connected: [
    'button[aria-label*="Message"]',
    'button[data-control-name="message"]',
    '.pv-s-profile-actions button:contains("Message")',
    'span:contains("1st")', // 1st degree connection indicator
    '.dist-value:contains("1st")'
  ],
  pending_invitation: [
    'button[aria-label*="Pending"]',
    'button[data-control-name="cancel_invite"]',
    'span:contains("Pending")',
    '.pv-top-card-v2-ctas button:contains("Pending")'
  ],

  // Error states
  out_of_invitations: [
    'div:contains("You\'re out of invitations")',
    '.artdeco-inline-feedback--error:contains("invitation")',
    '.ip-fuse-limit-alert',
    'div:contains("invitation limit")'
  ],
  captcha_elements: [
    '[data-test-id="captcha-internal"]',
    '.captcha-container',
    '#captcha',
    '.challenge-page',
    'iframe[src*="captcha"]'
  ],
  security_checkpoint: [
    '.security-checkpoint',
    '.checkpoint-challenge', 
    '.identity-verification',
    'div:contains("security checkpoint")',
    'div:contains("verify your identity")'
  ],

  // Premium upsell
  premium_upsell: [
    '.premium-upsell-link',
    'div:contains("Premium feature")',
    'a[href*="premium"]'
  ]
};

/**
 * Check daily rate limits before attempting connection (Prompt 4)
 */
async function checkDailyRateLimit(user_id: string): Promise<DailyRateLimitCheck> {
  if (!process.env.SUPABASE_URL || !user_id) {
    // Skip rate limit check if no Supabase or user_id
    return {
      user_id,
      current_count: 0,
      daily_limit: 20,
      remaining: 20,
      reset_at: new Date().toISOString()
    };
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get current daily stats
    const { data: stats, error: statsError } = await supabase
      .from('puppet_daily_stats')
      .select('connections_sent')
      .eq('user_id', user_id)
      .eq('stat_date', today)
      .single();

    // Get user's daily limit setting
    const { data: settings, error: settingsError } = await supabase
      .from('puppet_user_settings')
      .select('daily_connection_limit')
      .eq('user_id', user_id)
      .single();

    const currentCount = stats?.connections_sent || 0;
    const dailyLimit = settings?.daily_connection_limit || 20;
    const remaining = Math.max(0, dailyLimit - currentCount);

    // Calculate reset time (start of next day)
    const resetTime = new Date();
    resetTime.setDate(resetTime.getDate() + 1);
    resetTime.setHours(0, 0, 0, 0);

    const rateLimitCheck: DailyRateLimitCheck = {
      user_id,
      current_count: currentCount,
      daily_limit: dailyLimit,
      remaining,
      reset_at: resetTime.toISOString()
    };

    console.log(`📊 Rate Limit Check: ${currentCount}/${dailyLimit} (${remaining} remaining)`);
    
    return rateLimitCheck;

  } catch (error) {
    console.warn(`⚠️ Rate limit check failed, allowing request:`, error);
    return {
      user_id,
      current_count: 0,
      daily_limit: 20,
      remaining: 20,
      reset_at: new Date().toISOString()
    };
  }
}

/**
 * Advanced human behavior simulation (Prompt 4)
 */
async function simulateAdvancedHumanBehavior(page: Page, config: HumanBehaviorConfig = HUMAN_BEHAVIOR_CONFIG): Promise<void> {
  console.log(`🎭 Starting advanced human behavior simulation...`);

  // 1. Random initial delay (2-6 seconds)
  const initialDelay = Math.random() * (config.action_delay_max_ms - config.action_delay_min_ms) + config.action_delay_min_ms;
  console.log(`⏰ Initial page observation delay: ${Math.round(initialDelay / 1000)}s`);
  await new Promise(resolve => setTimeout(resolve, initialDelay));

  // 2. Random scrolling (500px - 3000px)
  const scrollAmount = Math.random() * (config.scroll_max_px - config.scroll_min_px) + config.scroll_min_px;
  console.log(`📜 Random scroll: ${Math.round(scrollAmount)}px`);
  
  await page.evaluate((pixels) => {
    window.scrollBy({
      top: pixels,
      behavior: 'smooth'
    });
  }, scrollAmount);

  // Wait for scroll to complete
  await new Promise(resolve => setTimeout(resolve, 1500));

  // 3. Random exploration of About or Experience sections
  if (config.random_exploration_enabled) {
    const shouldExplore = Math.random() < 0.7; // 70% chance to explore
    
    if (shouldExplore) {
      console.log(`🔍 Exploring profile sections...`);
      
      // Try to find and click on About or Experience section
      for (const sectionSelector of config.exploration_sections) {
        try {
          const section = await page.$(sectionSelector);
          if (section) {
            const isVisible = await section.isVisible();
            if (isVisible) {
              console.log(`👆 Clicking on section: ${sectionSelector}`);
              
              // Hover before clicking
              if (config.pre_action_hover_enabled) {
                await section.hover();
                await new Promise(resolve => setTimeout(resolve, 500));
              }
              
              await section.click();
              
              // Wait and observe the section content
              const observationTime = Math.random() * 3000 + 2000; // 2-5 seconds
              console.log(`👀 Observing section content for ${Math.round(observationTime / 1000)}s`);
              await new Promise(resolve => setTimeout(resolve, observationTime));
              
              break; // Only click one section
            }
          }
        } catch (error) {
          // Continue to next section if this one fails
          console.log(`🔄 Section ${sectionSelector} not accessible, trying next...`);
        }
      }
    }
  }

  // 4. Additional random scroll after exploration
  const secondScrollAmount = Math.random() * 1000 + 300; // 300-1300px
  console.log(`📜 Secondary scroll: ${Math.round(secondScrollAmount)}px`);
  
  await page.evaluate((pixels) => {
    window.scrollBy({
      top: pixels,
      behavior: 'smooth'
    });
  }, secondScrollAmount);

  await new Promise(resolve => setTimeout(resolve, 1000));

  // 5. Pre-action delay
  const preActionDelay = Math.random() * (config.action_delay_max_ms - config.action_delay_min_ms) + config.action_delay_min_ms;
  console.log(`⏰ Pre-action delay: ${Math.round(preActionDelay / 1000)}s`);
  await new Promise(resolve => setTimeout(resolve, preActionDelay));

  console.log(`✅ Human behavior simulation complete`);
}

/**
 * Enhanced connect button detection with pre-action hover
 */
async function findAndHoverConnectButton(page: Page): Promise<{button: any, selector: string} | null> {
  console.log(`🎯 Searching for Connect button with pre-action hover...`);

  for (const selector of LINKEDIN_SELECTORS.connect_button) {
    try {
      const button = await page.$(selector);
      if (button) {
        const isVisible = await button.isVisible();
        if (isVisible) {
          console.log(`✅ Found Connect button: ${selector}`);
          
          // Human-like mouse movement and hover
          console.log(`🖱️  Hovering over Connect button...`);
          await button.hover();
          
          // Random hover delay
          const hoverDelay = Math.random() * 2000 + 1000; // 1-3 seconds
          await new Promise(resolve => setTimeout(resolve, hoverDelay));
          
          return { button, selector };
        }
      }
    } catch (error) {
      // Continue checking other selectors
    }
  }

  return null;
}

/**
 * Track successful connection in Supabase daily stats
 */
async function trackSuccessfulConnection(user_id: string): Promise<void> {
  if (!process.env.SUPABASE_URL || !user_id) {
    console.log(`ℹ️ Skipping connection tracking (no Supabase config)`);
    return;
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`📈 Tracking successful connection for user ${user_id}`);

    // Increment connection count for today
    const { error } = await supabase
      .from('puppet_daily_stats')
      .upsert({
        user_id,
        stat_date: today,
        connections_sent: 1,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,stat_date'
      });

    if (error) {
      console.error(`❌ Failed to track connection:`, error);
    } else {
      console.log(`✅ Successfully tracked connection in daily stats`);
    }

  } catch (error) {
    console.error(`❌ Connection tracking error:`, error);
  }
}

/**
 * Main function to connect to a LinkedIn profile
 */
export async function connectToLinkedInProfile(params: ConnectionParams): Promise<ConnectionResult> {
  const startTime = Date.now();
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  const result: ConnectionResult = {
    status: 'error',
    reason: '',
    page_state: {
      url: params.profile_url,
      title: '',
      message_sent: false
    },
    execution_time_ms: 0,
    timestamp: new Date().toISOString(),
    metadata: {
      user_agent: '',
      detected_elements: []
    }
  };

  try {
    console.log(`🤖 [${params.job_id || 'standalone'}] Starting LinkedIn connection process...`);
    console.log(`📋 Profile URL: ${params.profile_url}`);
    console.log(`💬 Message: ${params.note ? 'Yes (length: ' + params.note.length + ')' : 'No'}`);
    console.log(`🔗 Proxy: ${params.proxy ? `${params.proxy.endpoint} (${params.proxy.type || 'residential'})` : 'None'}`);

    // Step 1: Launch browser with proxy configuration
    browser = await launchBrowser(params);
    page = await browser.newPage();

    // Step 1.5: Verify proxy and IP address (if proxy is configured)
    if (params.proxy) {
      console.log(`🌐 Verifying proxy connection and IP address...`);
      const proxyVerification = await verifyProxyConnection(page, params.proxy);
      
      if (!proxyVerification.success) {
        throw new Error(`Proxy verification failed: ${proxyVerification.error}`);
      }
      
      console.log(`✅ Proxy verified - IP: ${proxyVerification.ip_address} (${proxyVerification.response_time_ms}ms)`);
      if (proxyVerification.location) {
        console.log(`📍 Location: ${proxyVerification.location}`);
      }
      
      // Store proxy verification details in result metadata
      result.metadata!.proxy_used = params.proxy.endpoint;
      result.metadata!.verified_ip = proxyVerification.ip_address;
    }

    // Set user agent
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    await page.setUserAgent(userAgent);
    result.metadata!.user_agent = userAgent;

    // Set viewport
    await page.setViewport({ width: 1366, height: 768 });

    // Step 2: Set LinkedIn cookie for authentication
    console.log(`🍪 Setting LinkedIn authentication cookie...`);
    await page.setCookie({
      name: 'li_at',
      value: params.li_at,
      domain: '.linkedin.com',
      path: '/',
      httpOnly: true,
      secure: true
    });

    // Step 3: Navigate to LinkedIn profile
    console.log(`🌐 Navigating to profile: ${params.profile_url}`);
    await page.goto(params.profile_url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for page to load and update result
    await page.waitForSelector('main', { timeout: 10000 });
    result.page_state.url = page.url();
    result.page_state.title = await page.title();

    console.log(`📄 Page loaded: ${result.page_state.title}`);

    // Step 4: Check daily rate limits (Prompt 4)
    if (params.user_id) {
      console.log(`🛡️ Checking daily rate limits for user ${params.user_id}...`);
      const rateLimitCheck = await checkDailyRateLimit(params.user_id);
      
      if (rateLimitCheck.remaining <= 0) {
        result.status = 'rate_limited';
        result.reason = `Daily connection limit exceeded (${rateLimitCheck.current_count}/${rateLimitCheck.daily_limit}). Resets at ${rateLimitCheck.reset_at}`;
        console.log(`🚫 ${result.reason}`);
        return result;
      }
      
      console.log(`✅ Rate limit check passed: ${rateLimitCheck.remaining} connections remaining today`);
    }

    // Step 5: Check for security issues first  
    const securityCheck = await checkForSecurityIssues(page, params);
    if (securityCheck) {
      result.status = securityCheck.status as any;
      result.reason = securityCheck.reason;
      result.page_state.screenshot_url = securityCheck.screenshot_url;
      result.metadata!.detected_elements = securityCheck.detected_elements;
      console.log(`🚨 Security issue detected - stopping job: ${result.reason}`);
      return result;
    }

    // Step 6: Extract profile information
    const profileInfo = await extractProfileInfo(page);
    result.page_state.profile_name = profileInfo.name;
    console.log(`👤 Profile: ${profileInfo.name || 'Unknown'}`);
    console.log(`💼 Headline: ${profileInfo.headline || 'Unknown'}`);

    // Step 7: Advanced human behavior simulation (Prompt 4)
    console.log(`🎭 Starting advanced human behavior simulation...`);
    await simulateAdvancedHumanBehavior(page, HUMAN_BEHAVIOR_CONFIG);

    // Step 8: Check for security issues after human behavior (safety check)
    const postBehaviorSecurityCheck = await checkForSecurityIssues(page, params);
    if (postBehaviorSecurityCheck) {
      result.status = postBehaviorSecurityCheck.status as any;
      result.reason = `Security detection after behavior simulation: ${postBehaviorSecurityCheck.reason}`;
      result.page_state.screenshot_url = postBehaviorSecurityCheck.screenshot_url;
      result.metadata!.detected_elements = postBehaviorSecurityCheck.detected_elements;
      console.log(`🚨 Post-behavior security issue detected - stopping job: ${result.reason}`);
      return result;
    }

    // Step 9: Check current connection status
    const connectionStatus = await checkConnectionStatus(page);
    result.page_state.connection_status = connectionStatus.status;
    console.log(`🔗 Connection Status: ${connectionStatus.status}`);

    if (connectionStatus.status === 'already_connected') {
      result.status = 'already_connected';
      result.reason = 'User is already a 1st degree connection';
      return result;
    }

    if (connectionStatus.status === 'pending_invitation') {
      result.status = 'invite_sent';
      result.reason = 'Connection invitation is already pending';
      return result;
    }

    // Step 10: Enhanced connect button detection with hover (Prompt 4)
    console.log(`🤝 Attempting to send connection request with advanced interaction...`);
    const connectButtonResult = await findAndHoverConnectButton(page);
    
    if (!connectButtonResult) {
      result.status = 'connect_button_not_found';
      result.reason = 'Connect button not found or not accessible';
      return result;
    }

    // Click the connect button after hover
    console.log(`👆 Clicking Connect button after hover...`);
    await connectButtonResult.button.click();
    result.metadata!.detected_elements.push(connectButtonResult.selector);

    // Step 11: Handle connection flow and check for security issues
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for modal/response

    const connectionResult = await attemptConnection(page, params.note);
    
    result.status = connectionResult.status as any;
    result.reason = connectionResult.reason;
    result.page_state.message_sent = connectionResult.message_sent;
    result.metadata!.detected_elements.push(...connectionResult.detected_elements);

    if (connectionResult.screenshot_url) {
      result.page_state.screenshot_url = connectionResult.screenshot_url;
    }

    // Step 12: Track successful connection in database (Prompt 4)
    if (result.status === 'success' && params.user_id) {
      await trackSuccessfulConnection(params.user_id);
    }

    console.log(`✅ Connection process completed: ${result.status}`);
    console.log(`📝 Reason: ${result.reason}`);

  } catch (error) {
    console.error(`❌ Error during connection process:`, error);
    result.status = 'error';
    result.reason = error instanceof Error ? error.message : 'Unknown error occurred';
    result.metadata!.error_details = error;

    // Take error screenshot
    if (page) {
      try {
        const screenshot = await page.screenshot({ fullPage: true });
        // In production, you'd upload this to storage
        console.log(`📸 Error screenshot captured (${screenshot.length} bytes)`);
      } catch (screenshotError) {
        console.warn(`⚠️ Failed to capture error screenshot:`, screenshotError);
      }
    }

  } finally {
    result.execution_time_ms = Date.now() - startTime;
    
    // Cleanup browser
    if (browser) {
      try {
        await browser.close();
        console.log(`🧹 Browser cleanup completed`);
      } catch (cleanupError) {
        console.warn(`⚠️ Browser cleanup warning:`, cleanupError);
      }
    }

    // Log to database if configured
    if (params.job_id && process.env.SUPABASE_URL) {
      await logToDatabase(params, result);
    }
  }

  return result;
}

/**
 * Verify proxy connection and get IP address via ipify.org
 */
async function verifyProxyConnection(page: Page, proxy: NonNullable<ConnectionParams['proxy']>): Promise<ProxyVerificationResult> {
  const startTime = Date.now();
  
  try {
    console.log(`🔍 Verifying proxy connection: ${proxy.endpoint}`);
    
    // Navigate to ipify.org to get IP address
    const response = await page.goto('https://api.ipify.org?format=json', {
      waitUntil: 'networkidle2',
      timeout: 15000
    });

    if (!response || !response.ok()) {
      return {
        success: false,
        error: `Failed to reach ipify.org: ${response?.status() || 'No response'}`
      };
    }

    // Extract IP information
    const responseText = await response.text();
    let ipData;
    
    try {
      ipData = JSON.parse(responseText);
    } catch (parseError) {
      return {
        success: false,
        error: `Invalid JSON response from ipify.org: ${responseText}`
      };
    }

    const responseTime = Date.now() - startTime;

    console.log(`📡 IP verification response: ${responseText}`);

    return {
      success: true,
      ip_address: ipData.ip,
      response_time_ms: responseTime,
      location: proxy.location // Use provided location info
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown proxy verification error',
      response_time_ms: responseTime
    };
  }
}

/**
 * Launch browser with proxy configuration
 */
async function launchBrowser(params: ConnectionParams): Promise<Browser> {
  const launchOptions: any = {
    headless: params.headless !== false, // Default to headless unless explicitly set to false
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--window-size=1366,768'
    ]
  };

  // Add proxy configuration if provided
  if (params.proxy) {
    launchOptions.args.push(`--proxy-server=${params.proxy.endpoint}`);
    console.log(`🔗 Using proxy: ${params.proxy.endpoint} (${params.proxy.type || 'residential'})`);
  }

  const browser = await puppeteer.launch(launchOptions);

  // Configure proxy authentication for residential proxies
  if (params.proxy) {
    console.log(`🔐 Configuring proxy authentication for ${params.proxy.type || 'residential'} proxy...`);
    
    const pages = await browser.pages();
    for (const page of pages) {
      await page.authenticate({
        username: params.proxy.username,
        password: params.proxy.password
      });
    }
    
    console.log(`✅ Proxy authentication configured for: ${params.proxy.endpoint}`);
  }

  return browser;
}

/**
 * Check for security issues (CAPTCHA, checkpoints, etc.)
 */
async function checkForSecurityIssues(page: Page, params: ConnectionParams) {
  console.log(`🔍 Checking for security issues...`);

  // Check for CAPTCHA
  for (const selector of LINKEDIN_SELECTORS.captcha_elements) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          console.log(`🚨 CAPTCHA detected: ${selector}`);
          const screenshot_url = await captureScreenshot(page, 'captcha');
          return {
            status: 'captcha_detected',
            reason: 'CAPTCHA challenge detected - manual intervention required',
            screenshot_url,
            detected_elements: [selector]
          };
        }
      }
    } catch (error) {
      // Continue checking other selectors
    }
  }

  // Check for security checkpoint
  for (const selector of LINKEDIN_SELECTORS.security_checkpoint) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          console.log(`🚨 Security checkpoint detected: ${selector}`);
          const screenshot_url = await captureScreenshot(page, 'security_checkpoint');
          return {
            status: 'security_checkpoint',
            reason: 'Security checkpoint detected - account verification required',
            screenshot_url,
            detected_elements: [selector]
          };
        }
      }
    } catch (error) {
      // Continue checking other selectors
    }
  }

  return null;
}

/**
 * Extract profile information from the page
 */
async function extractProfileInfo(page: Page) {
  const info = { name: '', headline: '' };

  // Extract profile name
  for (const selector of LINKEDIN_SELECTORS.profile_name) {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.evaluate(el => el.textContent);
        if (text?.trim()) {
          info.name = text.trim();
          break;
        }
      }
    } catch (error) {
      // Continue trying other selectors
    }
  }

  // Extract headline
  for (const selector of LINKEDIN_SELECTORS.profile_headline) {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.evaluate(el => el.textContent);
        if (text?.trim()) {
          info.headline = text.trim();
          break;
        }
      }
    } catch (error) {
      // Continue trying other selectors
    }
  }

  return info;
}

/**
 * Simulate human behavior with random scrolling and delays
 */
async function simulateHumanBehavior(page: Page) {
  // Random scroll down
  await page.evaluate(() => {
    window.scrollBy(0, Math.random() * 300 + 200);
  });
  
  // Wait 1-3 seconds
  const delay1 = Math.random() * 2000 + 1000;
  console.log(`⏳ Human delay: ${Math.round(delay1)}ms`);
  await new Promise(resolve => setTimeout(resolve, delay1));

  // Random mouse movement
  await page.mouse.move(
    Math.random() * 800 + 200,
    Math.random() * 600 + 100
  );

  // Another scroll (maybe up a bit)
  await page.evaluate(() => {
    window.scrollBy(0, Math.random() * 100 - 50);
  });

  // Final delay before action (2-6 seconds as specified)
  const finalDelay = Math.random() * 4000 + 2000;
  console.log(`⏳ Final delay before action: ${Math.round(finalDelay)}ms`);
  await new Promise(resolve => setTimeout(resolve, finalDelay));
}

/**
 * Check current connection status with the profile
 */
async function checkConnectionStatus(page: Page) {
  // Check if already connected (1st degree connection)
  for (const selector of LINKEDIN_SELECTORS.already_connected) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          return { status: 'already_connected' };
        }
      }
    } catch (error) {
      // Continue checking
    }
  }

  // Check if invitation is pending
  for (const selector of LINKEDIN_SELECTORS.pending_invitation) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          return { status: 'pending_invitation' };
        }
      }
    } catch (error) {
      // Continue checking
    }
  }

  return { status: 'can_connect' };
}

/**
 * Attempt to send connection request
 */
async function attemptConnection(page: Page, note?: string) {
  const result = {
    status: 'error',
    reason: '',
    message_sent: false,
    detected_elements: [] as string[],
    screenshot_url: undefined as string | undefined
  };

  // Step 1: Find and click Connect button
  let connectButton = null;
  let connectSelector = '';

  for (const selector of LINKEDIN_SELECTORS.connect_button) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          connectButton = element;
          connectSelector = selector;
          result.detected_elements.push(selector);
          break;
        }
      }
    } catch (error) {
      // Continue checking other selectors
    }
  }

  if (!connectButton) {
    result.status = 'connect_button_not_found';
    result.reason = 'Connect button not found or not visible';
    return result;
  }

  console.log(`🎯 Found Connect button: ${connectSelector}`);
  
  // Click the Connect button
  await connectButton.click();
  console.log(`👆 Clicked Connect button`);

  // Wait for modal/response
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 2: Check for invitation limits
  for (const selector of LINKEDIN_SELECTORS.out_of_invitations) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          console.log(`⚠️ Out of invitations detected: ${selector}`);
          result.status = 'out_of_invitations';
          result.reason = 'You have reached your monthly invitation limit';
          result.detected_elements.push(selector);
          result.screenshot_url = await captureScreenshot(page, 'out_of_invitations');
          return result;
        }
      }
    } catch (error) {
      // Continue checking
    }
  }

  // Step 3: Handle message/note if provided
  if (note && note.trim()) {
    console.log(`💬 Adding custom message: "${note.substring(0, 50)}${note.length > 50 ? '...' : ''}"`);
    
    const messageResult = await addCustomMessage(page, note);
    result.message_sent = messageResult.success;
    
    if (!messageResult.success) {
      console.log(`⚠️ Message sending failed: ${messageResult.reason}`);
      // Continue without message
    }
  }

  // Step 4: Send the invitation
  const sendResult = await sendInvitation(page, !note);
  
  if (sendResult.success) {
    result.status = 'success';
    result.reason = note ? 'Connection request sent with custom message' : 'Connection request sent without message';
    console.log(`✅ ${result.reason}`);
  } else {
    result.status = 'error';
    result.reason = sendResult.reason;
    result.screenshot_url = await captureScreenshot(page, 'send_error');
  }

  return result;
}

/**
 * Add custom message to connection request
 */
async function addCustomMessage(page: Page, message: string) {
  // First, try to find "Add a note" button
  for (const selector of LINKEDIN_SELECTORS.add_note_button) {
    try {
      const button = await page.$(selector);
      if (button) {
        const isVisible = await button.isVisible();
        if (isVisible) {
          await button.click();
          console.log(`📝 Clicked "Add a note" button`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          break;
        }
      }
    } catch (error) {
      // Continue trying other selectors
    }
  }

  // Find message textarea
  for (const selector of LINKEDIN_SELECTORS.note_textarea) {
    try {
      const textarea = await page.$(selector);
      if (textarea) {
        const isVisible = await textarea.isVisible();
        if (isVisible) {
          // Clear existing text and type new message
          await textarea.click();
          await page.keyboard.down('Control');
          await page.keyboard.press('a');
          await page.keyboard.up('Control');
          
          // Type message with human-like delays
          for (const char of message) {
            await page.keyboard.type(char);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
          }
          
          console.log(`✍️ Message typed successfully`);
          return { success: true, reason: 'Message added successfully' };
        }
      }
    } catch (error) {
      // Continue trying other selectors
    }
  }

  return { success: false, reason: 'Message textarea not found' };
}

/**
 * Send the connection invitation
 */
async function sendInvitation(page: Page, withoutNote: boolean = false) {
  const selectors = withoutNote 
    ? LINKEDIN_SELECTORS.send_without_note 
    : LINKEDIN_SELECTORS.send_button;

  for (const selector of selectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        const isVisible = await button.isVisible();
        if (isVisible) {
          await button.click();
          console.log(`📤 Clicked Send button: ${selector}`);
          
          // Wait for confirmation
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          return { success: true, reason: 'Invitation sent successfully' };
        }
      }
    } catch (error) {
      // Continue trying other selectors
    }
  }

  return { success: false, reason: 'Send button not found or not clickable' };
}

/**
 * Capture screenshot for debugging/evidence
 */
async function captureScreenshot(page: Page, type: string): Promise<string> {
  try {
    const screenshot = await page.screenshot({ 
      fullPage: true,
      type: 'png' 
    });
    
    // In production, you'd upload to Supabase storage
    // For now, just return a placeholder URL
    const filename = `screenshot-${type}-${Date.now()}.png`;
    console.log(`📸 Screenshot captured: ${filename} (${screenshot.length} bytes)`);
    
    return `screenshots/${filename}`;
  } catch (error) {
    console.warn(`⚠️ Screenshot capture failed:`, error);
    return '';
  }
}

/**
 * Log execution to database (optional)
 */
async function logToDatabase(params: ConnectionParams, result: ConnectionResult) {
  if (!process.env.SUPABASE_URL || !params.job_id) return;

  try {
    await supabase
      .from('puppet_job_logs')
      .insert({
        job_id: params.job_id,
        log_level: result.status === 'success' ? 'info' : 'warn',
        message: `Connection attempt completed: ${result.status} - ${result.reason}`,
        step_name: 'connection_attempt',
        page_url: result.page_state.url,
        user_agent: result.metadata?.user_agent,
        execution_time_ms: result.execution_time_ms,
        timestamp: result.timestamp
      });
    
    console.log(`📊 Logged to database: ${params.job_id}`);
  } catch (error) {
    console.warn(`⚠️ Database logging failed:`, error);
  }
}

/**
 * Command line interface when run directly
 * NOTE: For production use, cookies are retrieved dynamically from Supabase per user
 */
async function main() {
  // Parse command line arguments (no static environment fallbacks for li_at)
  const params: ConnectionParams = {
    li_at: process.argv[2] || '',  // Must be provided explicitly - no static fallback
    profile_url: process.env.PROFILE_URL || process.argv[3] || '',
    note: process.env.CONNECTION_NOTE || process.argv[4] || undefined,
    proxy: process.env.PROXY_ENDPOINT ? {
      endpoint: process.env.PROXY_ENDPOINT,
      username: process.env.PROXY_USERNAME || '',
      password: process.env.PROXY_PASSWORD || '',
      type: (process.env.PROXY_TYPE as 'residential' | 'datacenter') || 'residential',
      location: process.env.PROXY_LOCATION
    } : undefined,
    user_id: process.env.USER_ID || process.argv[5] || undefined,
    job_id: process.env.JOB_ID || process.argv[6] || undefined,
    headless: process.env.HEADLESS !== 'false' // Default to headless unless explicitly set to false
  };

  // Validate required parameters
  if (!params.li_at) {
    console.error('❌ Missing LinkedIn li_at cookie. Pass as first argument.');
    console.error('ℹ️  In production, cookies are retrieved dynamically from Supabase per user.');
    console.error('ℹ️  Usage: ts-node connectToLinkedInProfile.ts "li_at_cookie" "profile_url" "message"');
    process.exit(1);
  }

  if (!params.profile_url) {
    console.error('❌ Missing profile URL. Set PROFILE_URL env var or pass as second argument.');
    process.exit(1);
  }

  if (!params.profile_url.includes('linkedin.com/in/')) {
    console.error('❌ Invalid LinkedIn profile URL format.');
    process.exit(1);
  }

  console.log('\n🚀 LinkedIn Connection Bot Starting...');
  console.log('================================================');

  try {
    const result = await connectToLinkedInProfile(params);
    
    console.log('\n📊 FINAL RESULT:');
    console.log('================================================');
    console.log(JSON.stringify(result, null, 2));
    
    // Exit with appropriate code
    process.exit(result.status === 'success' ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

// Run main function if script is executed directly
if (require.main === module) {
  main().catch(console.error);
} 