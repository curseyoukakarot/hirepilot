import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import {
  PuppetExecutionConfig,
  PuppetJobResult,
  PuppetSecurityDetection,
  PuppetDetectionType,
  PuppetError,
  PuppetSecurityError,
  PuppetBrowserConfig,
  PuppetLinkedInElements,
  PuppetHumanBehavior,
  PUPPET_CONSTANTS
} from '../../types/puppet';

// Import enhanced services
import { createCaptchaDetectionService, CaptchaDetectionService } from './captchaDetection';
import { inviteWarmupService } from './inviteWarmupService';
import { proxyHealthService } from './proxyHealthService';
import { inviteDeduplicationService } from './inviteDeduplicationService';
import { jobRetryService } from './jobRetryService';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// LinkedIn Element Selectors (updated for 2024)
const LINKEDIN_SELECTORS: PuppetLinkedInElements = {
  connect_button: 'button[aria-label*="Invite"][aria-label*="connect"], button[data-control-name="connect"], .pv-s-profile-actions button:contains("Connect")',
  message_button: 'button[aria-label*="Message"], button[data-control-name="message"]',
  send_button: 'button[aria-label*="Send"], button[data-control-name="send"]',
  note_textarea: 'textarea[name="message"], textarea[id="custom-message"], #custom-message',
  
  // Basic security detection selectors (enhanced version in captchaDetection.ts)
  captcha_container: [
    '[data-test-id="captcha-internal"]',
    '.captcha-container',
    '#captcha',
    '[data-cy="captcha"]',
    'iframe[src*="captcha"]',
    '.challenge-page',
    '.security-challenge'
  ],
  phone_verification: [
    '[data-test-id="phone-verification"]',
    '.phone-verification',
    '.challenge-stepup-phone',
    'input[type="tel"]',
    '.phone-challenge',
    '.add-phone'
  ],
  security_checkpoint: [
    '.security-checkpoint',
    '.checkpoint-challenge',
    '.identity-verification',
    '.account-verification',
    '.suspicious-login',
    '[data-test-id="checkpoint"]'
  ],
  account_restriction: [
    '.account-restricted',
    '.temporary-restriction',
    '.account-limitation',
    '.restriction-notice',
    '.blocked-account'
  ],
  suspicious_activity: [
    '.suspicious-activity',
    '.unusual-activity',
    '.activity-warning',
    '.security-warning'
  ],
  login_challenge: [
    '.login-challenge',
    '.two-factor',
    '.verification-code',
    '.email-verification',
    '.sms-verification'
  ]
};

// Human-like behavior configuration
const HUMAN_BEHAVIOR: PuppetHumanBehavior = {
  scroll_delay_ms: [800, 2500],
  click_delay_ms: [300, 1200],
  type_delay_ms: [50, 150],
  mouse_movement_enabled: true,
  random_pauses: true
};

/**
 * Main Puppet automation class for LinkedIn connection requests
 * Enhanced with security detection, warm-up tracking, proxy monitoring, invite deduplication, and job retry management
 */
export class PuppetLinkedInAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: PuppetExecutionConfig;
  private screenshotCounter = 0;
  private captchaDetectionService: CaptchaDetectionService | null = null;
  private currentProxyId: string | null = null;
  private proxyStartTime: number = 0;

  constructor(config: PuppetExecutionConfig) {
    this.config = config;
  }

  /**
   * Execute LinkedIn connection request automation with comprehensive monitoring and retry integration
   */
  async execute(): Promise<PuppetJobResult> {
    const startTime = Date.now();
    let result: PuppetJobResult = {
      success: false,
      connection_sent: false,
      message_sent: false,
      execution_time_ms: 0,
      page_url: this.config.linkedin_profile_url
    };

    let inviteWasAttempted = false;
    let inviteWasSuccessful = false;
    let proxyWasSuccessful = false;
    let proxyFailureReason: string | undefined;
    let shouldRetryJob = false;
    let retryFailureReason: string | undefined;

    try {
      await this.logStep('info', '🚀 Starting enhanced LinkedIn automation with full monitoring and retry support', 'initialize');
      
      // 🌐 PROXY ASSIGNMENT: Get or assign proxy for this user
      const proxyAssignment = await this.ensureProxyAssignment();
      if (!proxyAssignment.success) {
        throw new PuppetError(proxyAssignment.message, 'PROXY_ERROR', this.config.job_id);
      }
      
      // Initialize browser with assigned proxy
      await this.initializeBrowserWithProxy(proxyAssignment.proxy_config);
      
      // Initialize enhanced CAPTCHA detection service
      this.captchaDetectionService = createCaptchaDetectionService(this.page!, this.config);
      
      // Navigate to LinkedIn profile
      await this.navigateToProfile();
      
      // Enhanced security detection check
      const securityCheck = await this.performEnhancedSecurityScan();
      if (securityCheck) {
        await this.captchaDetectionService.handleSecurityDetection(securityCheck);
        
        // Record failed invite due to security detection
        inviteWasAttempted = true;
        inviteWasSuccessful = false;
        proxyWasSuccessful = false;
        proxyFailureReason = `Security detection: ${securityCheck.type}`;
        
        // Determine if this should trigger a retry
        shouldRetryJob = this.shouldRetryForError(securityCheck.type);
        retryFailureReason = `Security detection: ${securityCheck.type}`;
        
        throw new PuppetSecurityError(securityCheck.type, this.config.job_id, securityCheck.screenshot_url);
      }

      // Simulate human behavior - scroll and observe
      await this.simulateHumanBehavior();

      // Send connection request
      inviteWasAttempted = true;
      const connectionResult = await this.sendConnectionRequest();
      result.connection_sent = connectionResult;
      inviteWasSuccessful = connectionResult;
      proxyWasSuccessful = connectionResult;

      // Send message if provided and connection was successful
      if (connectionResult && this.config.message) {
        const messageResult = await this.sendMessage();
        result.message_sent = messageResult;
      }

      result.success = true;
      await this.logStep('info', `✅ Automation completed successfully. Connection: ${result.connection_sent}, Message: ${result.message_sent}`, 'complete');

    } catch (error) {
      result.error_message = error instanceof Error ? error.message : 'Unknown error';
      
      if (error instanceof PuppetSecurityError) {
        result.detection_type = error.detection_type;
        result.screenshot_url = error.screenshot_url;
        await this.logStep('warn', `🚨 Security detection: ${error.detection_type}`, 'security_detection');
              } else if (error instanceof PuppetError) {
          await this.logStep('error', `❌ Puppet error: ${error.message} (${(error as any).error_type})`, 'puppet_error');
          
          // Check if this error type should trigger a retry
          shouldRetryJob = this.shouldRetryForError((error as any).error_type || 'UNKNOWN_ERROR');
          retryFailureReason = `${(error as any).error_type || 'UNKNOWN_ERROR'}: ${error.message}`;
      } else {
        await this.logStep('error', `❌ Automation failed: ${result.error_message}`, 'error');
        
        // Unknown errors should generally be retried
        shouldRetryJob = true;
        retryFailureReason = result.error_message;
      }

      // Take error screenshot
      const errorScreenshot = await this.captureScreenshot('error');
      if (errorScreenshot) {
        result.screenshot_url = errorScreenshot;
      }

      // If invite was attempted but failed, mark outcomes accordingly
      if (inviteWasAttempted && !inviteWasSuccessful) {
        inviteWasSuccessful = false;
        proxyWasSuccessful = false;
        proxyFailureReason = result.error_message;
      }

      // Don't re-throw error yet, let cleanup and retry logic run first
    } finally {
      result.execution_time_ms = Date.now() - startTime;
      
      // 🌡️ WARM-UP TRACKING: Record actual invite outcome for warm-up progression
      if (inviteWasAttempted) {
        try {
          await inviteWarmupService.recordInviteSent(this.config.user_id, inviteWasSuccessful);
          await this.logStep('info', `📊 Recorded ${inviteWasSuccessful ? 'successful' : 'failed'} invite for warm-up tracking`, 'warmup_tracking');
        } catch (warmupError) {
          await this.logStep('error', `❌ Failed to record warm-up stats: ${warmupError instanceof Error ? warmupError.message : 'Unknown error'}`, 'warmup_tracking');
        }
      }

      // 🔄 DEDUPLICATION TRACKING: Record successful invitation in deduplication system
      if (inviteWasAttempted && inviteWasSuccessful) {
        try {
          await inviteDeduplicationService.recordSentInvite(
            this.config.user_id,
            this.config.linkedin_profile_url,
            this.config.message,
            (this.config as any).campaign_id, // Campaign ID may not be in config type
            this.config.job_id,
            'puppet_automation'
          );
          await this.logStep('info', `🔄 Recorded successful invite in deduplication system`, 'deduplication_tracking');
        } catch (deduplicationError) {
          await this.logStep('error', `❌ Failed to record deduplication: ${deduplicationError instanceof Error ? deduplicationError.message : 'Unknown error'}`, 'deduplication_tracking');
        }
      }

      // 🌐 PROXY HEALTH TRACKING: Record proxy performance
      if (this.currentProxyId) {
        try {
          const responseTime = this.proxyStartTime > 0 ? Date.now() - this.proxyStartTime : undefined;
          
          const proxyHealthResult = await proxyHealthService.recordProxyPerformance(
            this.currentProxyId,
            this.config.user_id,
            proxyWasSuccessful,
            responseTime,
            proxyFailureReason,
            this.config.job_id,
            'linkedin_connection'
          );

          await this.logStep('info', `🌐 Recorded proxy performance: ${proxyHealthResult.message}`, 'proxy_health');

          // If proxy was rotated, log the new assignment
          if (proxyHealthResult.proxy_rotated && proxyHealthResult.new_proxy_id) {
            await this.logStep('info', `🔄 Proxy rotated to ${proxyHealthResult.new_proxy_id} due to failures`, 'proxy_rotation');
          }

          // If escalated to admin, log the escalation
          if (proxyHealthResult.escalated_to_admin) {
            await this.logStep('warn', `🚨 Proxy issues escalated to admin - no available proxies`, 'admin_escalation');
          }

        } catch (proxyError) {
          await this.logStep('error', `❌ Failed to record proxy health: ${proxyError instanceof Error ? proxyError.message : 'Unknown error'}`, 'proxy_health');
        }
      }

      // 🔄 JOB RETRY MANAGEMENT: Handle retry logic for failed jobs
      if (!result.success && shouldRetryJob && this.config.job_id && retryFailureReason) {
        try {
          await this.logStep('info', `🔄 Job failed, checking retry eligibility`, 'retry_check');
          
                       const retryResult = await jobRetryService.markJobForRetry(
               this.config.job_id,
               retryFailureReason,
               {
                 error_type: result.detection_type || 'unknown',
                 execution_time_ms: result.execution_time_ms,
                 proxy_id: this.currentProxyId,
                 user_agent: (this.config as any).user_agent,
                 screenshot_url: result.screenshot_url
               }
             );

          if (retryResult.success) {
            if (retryResult.action === 'scheduled_for_retry') {
              await this.logStep('info', `⏰ Job scheduled for retry ${retryResult.attempts}/${retryResult.max_attempts} in ${retryResult.delay_minutes} minutes`, 'retry_scheduled');
              
                             // Add retry information to result
               (result as any).retry_scheduled = true;
               (result as any).retry_attempt = retryResult.attempts;
               (result as any).retry_max_attempts = retryResult.max_attempts;
               (result as any).next_retry_at = retryResult.next_retry_at;
            } else if (retryResult.action === 'permanently_failed') {
              await this.logStep('warn', `❌ Job permanently failed after ${retryResult.attempts} attempts`, 'permanently_failed');
              
                             (result as any).permanently_failed = true;
               (result as any).total_attempts = retryResult.attempts;
            }
          } else {
            await this.logStep('error', `❌ Failed to process retry logic: ${retryResult.error}`, 'retry_error');
          }

        } catch (retryError) {
          await this.logStep('error', `❌ Failed to handle job retry: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`, 'retry_error');
        }
      }
      
      await this.cleanup();
    }

         // If job failed and error wasn't handled by retry logic, throw the error
     if (!result.success && result.error_message && !(result as any).retry_scheduled) {
      if (result.detection_type) {
        throw new PuppetSecurityError(result.detection_type, this.config.job_id, result.screenshot_url);
      } else {
        throw new PuppetError(result.error_message, 'EXECUTION_ERROR', this.config.job_id);
      }
    }

    return result;
  }

  /**
   * Enhanced security detection using comprehensive CAPTCHA detection service
   */
  private async performEnhancedSecurityScan(): Promise<PuppetSecurityDetection | null> {
    await this.logStep('debug', '🔍 Performing enhanced security scan...', 'security_check');

    if (!this.captchaDetectionService) {
      await this.logStep('warn', '⚠️ CAPTCHA detection service not initialized', 'security_check');
      return null;
    }

    try {
      // Use the enhanced detection service
      const detection = await this.captchaDetectionService.detectSecurityChallenges();
      
      if (detection) {
        await this.logStep('warn', `🚨 Security challenge detected: ${detection.type} (confidence: ${Math.round(detection.confidence * 100)}%)`, 'security_detection');
        return detection;
      }

      await this.logStep('debug', '✅ No security challenges detected', 'security_check');
      return null;

    } catch (error) {
      await this.logStep('error', `❌ Security scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'security_check');
      return null;
    }
  }

  /**
   * Ensure user has a proxy assigned and get proxy configuration
   */
  private async ensureProxyAssignment(): Promise<{ success: boolean; proxy_config?: any; message: string }> {
    try {
      await this.logStep('info', '🌐 Checking proxy assignment for user', 'proxy_assignment');

      // Check if user already has an active proxy
      const userProxyStatus = await proxyHealthService.getUserProxyStatus(this.config.user_id);
      
      if (userProxyStatus && !userProxyStatus.needs_assignment && !userProxyStatus.needs_rotation && !userProxyStatus.proxy_disabled) {
        // User has a good proxy, use it
        this.currentProxyId = userProxyStatus.current_proxy_id!;
        
        const proxyConfig = {
          proxy_endpoint: userProxyStatus.current_proxy_endpoint,
          proxy_port: userProxyStatus.current_proxy_endpoint?.includes(':') ? userProxyStatus.current_proxy_endpoint.split(':')[1] : '80',
          proxy_username: '', // Would need to fetch from proxy_pool table if needed
          proxy_password: '', // Would need to fetch from proxy_pool table if needed
          proxy_type: 'residential',
          country_code: userProxyStatus.current_proxy_country,
          provider: userProxyStatus.current_proxy_provider
        };

        await this.logStep('info', `✅ Using existing proxy: ${userProxyStatus.current_proxy_endpoint} (${userProxyStatus.current_proxy_provider})`, 'proxy_assignment');
        
        return {
          success: true,
          proxy_config: proxyConfig,
          message: `Using existing proxy: ${userProxyStatus.current_proxy_endpoint}`
        };
      }

      // User needs a new proxy assignment or rotation
      const assignmentReason = userProxyStatus?.needs_rotation ? 'failure_rotation' : 
                             userProxyStatus?.proxy_disabled ? 'disabled_rotation' : 
                             'initial_assignment';

      const assignmentResult = await proxyHealthService.assignProxyToUser(
        this.config.user_id,
        assignmentReason
      );

      if (!assignmentResult.success) {
        await this.logStep('error', `❌ Failed to assign proxy: ${assignmentResult.message}`, 'proxy_assignment');
        return {
          success: false,
          message: assignmentResult.message
        };
      }

      this.currentProxyId = assignmentResult.proxy_id!;
      await this.logStep('info', `✅ Assigned new proxy: ${assignmentResult.message}`, 'proxy_assignment');

      return {
        success: true,
        proxy_config: assignmentResult.proxy_config,
        message: assignmentResult.message
      };

    } catch (error) {
      await this.logStep('error', `❌ Proxy assignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'proxy_assignment');
      return {
        success: false,
        message: `Proxy assignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Initialize browser with proxy configuration
   */
  private async initializeBrowserWithProxy(proxyConfig: any): Promise<void> {
    try {
      await this.logStep('info', '🌍 Initializing browser with proxy configuration', 'browser_init');
      
      this.proxyStartTime = Date.now();

      const viewport = {
        width: 1366 + Math.floor(Math.random() * 200),
        height: 768 + Math.floor(Math.random() * 200)
      };

      const userAgent = this.generateRandomUserAgent();

      const launchArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        `--user-agent=${userAgent}`,
        // Proxy configuration
        ...(proxyConfig?.proxy_endpoint ? [
          `--proxy-server=${proxyConfig.proxy_endpoint}`,
          '--proxy-bypass-list=<-loopback>'
        ] : [])
      ];

      const browserConfig = {
        headless: process.env.NODE_ENV === 'production',
        args: launchArgs,
        defaultViewport: viewport
      };

      this.browser = await puppeteer.launch(browserConfig);
      
      const pages = await this.browser.pages();
      this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();

      // Set viewport
      await this.page.setViewport(viewport);

      // Set user agent
      await this.page.setUserAgent(userAgent);

      // Configure proxy authentication if provided
      if (proxyConfig?.proxy_username && proxyConfig?.proxy_password) {
        await this.page.authenticate({
          username: proxyConfig.proxy_username,
          password: proxyConfig.proxy_password
        });
      }

      // Test proxy connectivity
      if (proxyConfig?.proxy_endpoint) {
        try {
          await this.page.goto('https://httpbin.org/ip', { waitUntil: 'networkidle0', timeout: 10000 });
          const ipResponse = await this.page.evaluate(() => document.body.textContent);
          await this.logStep('info', `🌐 Proxy IP verified: ${ipResponse?.includes('{') ? JSON.parse(ipResponse || '{}').origin : 'unknown'}`, 'proxy_test');
        } catch (proxyTestError) {
          await this.logStep('warn', `⚠️ Proxy test failed: ${proxyTestError instanceof Error ? proxyTestError.message : 'Unknown error'}`, 'proxy_test');
          // Don't fail the job for proxy test failures, continue with the main automation
        }
      }

      await this.logStep('info', '✅ Browser initialized with proxy successfully', 'browser_init');

    } catch (error) {
      await this.logStep('error', `❌ Browser initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'browser_init');
      throw new PuppetError(
        `Failed to initialize browser with proxy: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'BROWSER_ERROR',
        this.config.job_id
      );
    }
  }

  /**
   * Generate a random user agent string
   */
  private generateRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Navigate to LinkedIn profile URL
   */
  private async navigateToProfile(): Promise<void> {
    if (!this.page) throw new PuppetError('Browser page not initialized', 'BROWSER_ERROR', this.config.job_id);

    await this.logStep('info', `🔗 Navigating to profile: ${this.config.linkedin_profile_url}`, 'navigate');

    try {
      await this.page.goto(this.config.linkedin_profile_url, {
        waitUntil: 'networkidle2',
        timeout: PUPPET_CONSTANTS.PAGE_LOAD_TIMEOUT_MS
      });

      // Wait for profile page to load
      await this.page.waitForSelector('main', { timeout: PUPPET_CONSTANTS.ELEMENT_WAIT_TIMEOUT_MS });

      // Check if we're actually on a LinkedIn profile page
      const currentUrl = this.page.url();
      if (!currentUrl.includes('linkedin.com/in/')) {
        throw new PuppetError('Navigation did not reach LinkedIn profile page', 'NAVIGATION_ERROR', this.config.job_id);
      }

      await this.logStep('info', `✅ Successfully navigated to profile page`, 'navigate');

    } catch (error) {
      const screenshot = await this.captureScreenshot('navigation_error');
      throw new PuppetError(
        `Failed to navigate to profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NAVIGATION_ERROR',
        this.config.job_id,
        undefined,
        screenshot
      );
    }
  }

  /**
   * Simulate human-like behavior (scrolling, pauses, mouse movement)
   */
  private async simulateHumanBehavior(): Promise<void> {
    if (!this.page) return;

    await this.logStep('debug', 'Simulating human behavior', 'human_behavior');

    // Random scroll down
    await this.page.evaluate(() => {
      window.scrollBy(0, Math.random() * 300 + 200);
    });
    await this.randomDelay(HUMAN_BEHAVIOR.scroll_delay_ms);

    // Random mouse movement (if enabled)
    if (HUMAN_BEHAVIOR.mouse_movement_enabled) {
      await this.page.mouse.move(
        Math.random() * 800 + 200,
        Math.random() * 600 + 100
      );
    }

    // Random pause
    if (HUMAN_BEHAVIOR.random_pauses) {
      await this.randomDelay([500, 2000]);
    }
  }

  /**
   * Send LinkedIn connection request with enhanced error handling for warm-up tracking
   */
  private async sendConnectionRequest(): Promise<boolean> {
    if (!this.page) throw new PuppetError('Browser page not initialized', 'BROWSER_ERROR', this.config.job_id);

    await this.logStep('info', '🔗 Attempting to send connection request', 'connect');

    try {
      // Wait for and click connect button
      const connectButton = await this.page.waitForSelector(LINKEDIN_SELECTORS.connect_button, {
        timeout: PUPPET_CONSTANTS.ELEMENT_WAIT_TIMEOUT_MS,
        visible: true
      });

      if (!connectButton) {
        throw new PuppetError('Connect button not found', 'ELEMENT_NOT_FOUND', this.config.job_id);
      }

      // Human-like delay before clicking
      await this.randomDelay(HUMAN_BEHAVIOR.click_delay_ms);

      // Click connect button
      await connectButton.click();

      await this.logStep('info', '✅ Clicked connect button successfully', 'connect');

      // Wait for connection modal or confirmation
      await this.randomDelay([1000, 2000]);

      // Check for success indicators or error messages
      const successIndicators = [
        'button[aria-label*="Pending"]',
        'button[data-control-name="cancel_invite"]',
        'span:contains("Pending")',
        '.artdeco-toast-message:contains("invitation sent")'
      ];

      const errorIndicators = [
        '.artdeco-inline-feedback--error',
        'div:contains("invitation limit")',
        'div:contains("unable to send")',
        '.ip-fuse-limit-alert'
      ];

      // Wait a bit for UI to update
      await this.page.waitForTimeout(2000);

      // Check for error indicators first
      for (const errorSelector of errorIndicators) {
        try {
          const errorElement = await this.page.$(errorSelector);
          if (errorElement) {
            const isVisible = await errorElement.isVisible();
            if (isVisible) {
              await this.logStep('warn', `❌ Connection request failed: Error indicator found (${errorSelector})`, 'connect');
              return false;
            }
          }
        } catch (e) {
          // Continue checking other selectors
        }
      }

      // Check for success indicators
      for (const successSelector of successIndicators) {
        try {
          const successElement = await this.page.$(successSelector);
          if (successElement) {
            const isVisible = await successElement.isVisible();
            if (isVisible) {
              await this.logStep('info', `✅ Connection request succeeded: Success indicator found (${successSelector})`, 'connect');
              return true;
            }
          }
        } catch (e) {
          // Continue checking other selectors
        }
      }

      // If no clear indicators, assume success (LinkedIn sometimes doesn't show clear feedback)
      await this.logStep('info', '✅ Connection request likely succeeded (no error indicators found)', 'connect');
      return true;

    } catch (error) {
      const screenshot = await this.captureScreenshot('connect_error');
      await this.logStep('error', `❌ Connection request failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'connect');
      
      throw new PuppetError(
        `Failed to send connection request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONNECTION_ERROR',
        this.config.job_id,
        undefined,
        screenshot
      );
    }
  }

  /**
   * Send message with connection request
   */
  private async sendMessage(): Promise<boolean> {
    if (!this.page || !this.config.message) return false;

    await this.logStep('info', 'Attempting to send message with connection', 'message');

    try {
      // Look for message textarea
      const messageTextarea = await this.page.waitForSelector(LINKEDIN_SELECTORS.note_textarea, {
        timeout: 5000,
        visible: true
      });

      if (messageTextarea) {
        // Type message with human-like delay
        await this.typeHumanLike(messageTextarea, this.config.message);

        await this.logStep('info', 'Message typed successfully', 'message');

        // Look for send button
        const sendButton = await this.page.$(LINKEDIN_SELECTORS.send_button);
        if (sendButton) {
          await this.randomDelay(HUMAN_BEHAVIOR.click_delay_ms);
          await sendButton.click();
          await this.logStep('info', 'Send button clicked', 'message');
          return true;
        }
      }

      return false;

    } catch (error) {
      await this.logStep('warn', `Message sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'message');
      return false;
    }
  }

  /**
   * Type text with human-like delays
   */
  private async typeHumanLike(element: any, text: string): Promise<void> {
    await element.click();
    await this.randomDelay([200, 500]);

    for (const char of text) {
      await element.type(char);
      await this.randomDelay(HUMAN_BEHAVIOR.type_delay_ms);
    }
  }

  /**
   * Capture screenshot and save to Supabase storage
   */
  private async captureScreenshot(type: string): Promise<string | undefined> {
    if (!this.page) return undefined;

    try {
      this.screenshotCounter++;
      const filename = `puppet-${this.config.job_id}-${type}-${this.screenshotCounter}-${Date.now()}.png`;
      
      const screenshot = await this.page.screenshot({
        fullPage: true,
        type: 'png'
      });

      // Save to Supabase storage (bucket: 'puppet-screenshots')
      const { data, error } = await supabase.storage
        .from('puppet-screenshots')
        .upload(filename, screenshot, {
          contentType: 'image/png',
          upsert: false
        });

      if (error) {
        await this.logStep('error', `Screenshot upload failed: ${error.message}`, 'screenshot');
        return undefined;
      }

      const { data: urlData } = supabase.storage
        .from('puppet-screenshots')
        .getPublicUrl(filename);

      const screenshotUrl = urlData.publicUrl;

      // Save screenshot record to database
      await supabase
        .from('puppet_screenshots')
        .insert({
          job_id: this.config.job_id,
          detection_type: type as PuppetDetectionType,
          file_url: screenshotUrl,
          file_size: screenshot.length,
          page_url: this.page.url(),
          user_agent: await this.page.evaluate(() => navigator.userAgent),
          timestamp: new Date().toISOString()
        });

      await this.logStep('info', `📸 Screenshot captured: ${screenshotUrl}`, 'screenshot');
      return screenshotUrl;

    } catch (error) {
      await this.logStep('error', `Screenshot capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'screenshot');
      return undefined;
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(notification: any): Promise<void> {
    try {
      // Get user's Slack webhook URL from settings
      const { data: userSettings } = await supabase
        .from('puppet_user_settings')
        .select('slack_webhook_url, notification_events')
        .eq('user_id', this.config.user_id)
        .single();

      if (!userSettings?.slack_webhook_url || !userSettings.notification_events.includes(notification.event_type)) {
        return;
      }

             const slackMessage: any = {
         blocks: [
           {
             type: "header",
             text: {
               type: "plain_text",
               text: `🤖 Puppet Alert: ${notification.event_type}`,
               emoji: true
             }
           },
           {
             type: "section",
             fields: [
               {
                 type: "mrkdwn",
                 text: `*Job ID:*\n${notification.job_id}`
               },
               {
                 type: "mrkdwn",
                 text: `*User ID:*\n${notification.user_id}`
               },
               {
                 type: "mrkdwn",
                 text: `*Message:*\n${notification.message}`
               },
               {
                 type: "mrkdwn",
                 text: `*Time:*\n${notification.timestamp.toLocaleString()}`
               }
             ]
           }
         ]
       };

       // Add screenshot if available
       if (notification.screenshot_url) {
         slackMessage.blocks.push({
           type: "image",
           image_url: notification.screenshot_url,
           alt_text: `Screenshot for ${notification.detection_type || 'job'}`
         });
       }

       // Add metadata if available
       if (notification.metadata) {
         slackMessage.blocks.push({
           type: "context",
           elements: [
             {
               type: "mrkdwn",
               text: `Page: ${notification.metadata.page_url || 'N/A'}`
             }
           ]
         });
       }

      await axios.post(userSettings.slack_webhook_url, slackMessage, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });

      await this.logStep('info', 'Slack notification sent successfully', 'notification');

    } catch (error) {
      await this.logStep('error', `Slack notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'notification');
    }
  }

  /**
   * Log execution step to database
   */
  private async logStep(level: 'info' | 'warn' | 'error' | 'debug', message: string, stepName: string): Promise<void> {
    try {
      await supabase
        .from('puppet_job_logs')
        .insert({
          job_id: this.config.job_id,
          log_level: level,
          message,
          step_name: stepName,
          page_url: this.page?.url(),
          user_agent: this.page ? await this.page.evaluate(() => navigator.userAgent) : undefined,
          proxy_used: this.config.proxy_config ? `${this.config.proxy_config.proxy_endpoint}:${this.config.proxy_config.proxy_port}` : undefined,
          timestamp: new Date().toISOString()
        });

      console.log(`[Puppet ${this.config.job_id}] [${level.toUpperCase()}] ${stepName}: ${message}`);
    } catch (error) {
      console.error(`[Puppet ${this.config.job_id}] Failed to log step:`, error);
    }
  }

  /**
   * Random delay between min and max milliseconds
   */
  private async randomDelay(range: [number, number]): Promise<void> {
    const delay = Math.random() * (range[1] - range[0]) + range[0];
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Cleanup browser resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      await this.logStep('info', 'Browser cleanup completed', 'cleanup');
    } catch (error) {
      console.error(`[Puppet ${this.config.job_id}] Cleanup error:`, error);
    }
  }

  /**
   * Determine if a job should be retried based on error type
   */
  private shouldRetryForError(errorType: string): boolean {
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'PROXY_ERROR',
      'RATE_LIMIT',
      'CAPTCHA_DETECTED',
      'LINKEDIN_SECURITY',
      'BROWSER_ERROR',
      'UNKNOWN_ERROR'
    ];

    const nonRetryableErrors = [
      'INVALID_CREDENTIALS',
      'PROFILE_NOT_FOUND',
      'ALREADY_CONNECTED',
      'USER_BLOCKED',
      'ACCOUNT_SUSPENDED'
    ];

    // Check for explicit non-retryable errors
    if (nonRetryableErrors.includes(errorType)) {
      return false;
    }

    // Check for explicit retryable errors or default to retry for unknown errors
    return retryableErrors.includes(errorType) || !nonRetryableErrors.includes(errorType);
  }
}

/**
 * Main execution function for Puppet automation
 */
export async function executePuppetJob(config: PuppetExecutionConfig): Promise<PuppetJobResult> {
  const automation = new PuppetLinkedInAutomation(config);
  return await automation.execute();
} 