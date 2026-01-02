/**
 * Enhanced Puppet Job Runner with Proxy Health Monitoring and Invite Deduplication
 * Integrates health checking before jobs, deduplication checking, and outcome recording after jobs
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { supabase } from '../../lib/supabase';
import { ProxyHealthMonitoringService } from './proxyHealthMonitoringService';
import { ProxyAssignmentService, assignProxyToUser } from './proxyAssignmentService';
import { InviteDeduplicationService } from './inviteDeduplicationService';
import { captchaOrchestrator } from './captchaOrchestrator';

export interface CaptchaResponse {
  captchaDetected: boolean;
  jobHalted: boolean;
  proxyDisabled: boolean;
  alertSent: boolean;
  incidentId?: string;
  cooldownUntil?: string;
  details: {
    captchaType: string;
    detectionMethod: string;
    pageUrl: string;
    screenshotUrl?: string;
    severity: 'high' | 'medium' | 'low';
  };
}

interface EnhancedJobContext {
  jobId: string;
  userId: string;
  linkedinProfileUrl: string;
  message?: string;
  priority: number;
  maxRetries: number;
  campaignId?: string; // Added for deduplication tracking
}

interface JobExecutionResult {
  success: boolean;
  proxyId: string;
  responseTimeMs: number;
  skipped?: boolean; // Added for deduplication skips
  skipReason?: string;
  inviteId?: string; // Added for invite tracking
  captchaDetected?: boolean; // 🆕 CAPTCHA detection result
  captchaResponse?: CaptchaResponse; // 🆕 Full CAPTCHA response details
  errorDetails?: {
    type: 'captcha' | 'timeout' | 'security_checkpoint' | 'invite_failure' | 'network_error' | 'banned' | 'deduplication_blocked' | 'other';
    message: string;
    screenshot?: string;
  };
  metadata?: {
    user_agent: string;
    ip_address?: string;
    linkedin_response?: any;
    deduplication_result?: any;
    captcha_incidents?: any[]; // 🆕 CAPTCHA incident tracking
  };
}

export class EnhancedPuppetJobRunner {
  
  /**
   * Main job execution function with enhanced proxy health monitoring and invite deduplication
   */
  static async executeLinkedInJob(context: EnhancedJobContext): Promise<JobExecutionResult> {
    const startTime = Date.now();
    let browser: Browser | null = null;
    let proxyId: string | null = null;
    
    try {
      console.log(`🚀 Starting LinkedIn job ${context.jobId} for user ${context.userId}`);
      
      // 🆕 ===== STEP 0: PRE-EXECUTION CAPTCHA COOLDOWN CHECK =====
      console.log(`🛡️ Checking CAPTCHA cooldown for user ${context.userId}`);
      
      const userEmail = await this.getUserEmail(context.userId);
      const isInCooldown = await captchaOrchestrator.quickCaptchaCheck({url: () => 'cooldown-check'} as any);
      
      if (isInCooldown) {
        console.log(`⏳ User ${context.userId} is in CAPTCHA cooldown, skipping job`);
        
        return {
          success: false,
          skipped: true,
          skipReason: 'User in CAPTCHA cooldown period',
          proxyId: '',
          responseTimeMs: Date.now() - startTime,
          captchaDetected: false,
          errorDetails: {
            type: 'captcha',
            message: 'User in CAPTCHA cooldown period - job skipped for safety'
          }
        };
      }
      
      // ===== STEP 1: DEDUPLICATION CHECK =====
      console.log(`🔍 Checking invite deduplication for ${context.linkedinProfileUrl}`);
      
      const deduplicationResult = await InviteDeduplicationService.checkInviteDeduplication(
        context.userId,
        context.linkedinProfileUrl,
        context.campaignId,
        context.jobId
      );
      
      // If invite is not allowed, skip the job
      if (!deduplicationResult.isAllowed) {
        console.log(`❌ Invite blocked by deduplication: ${deduplicationResult.message}`);
        
        return {
          success: false,
          skipped: true,
          skipReason: deduplicationResult.message,
          proxyId: '',
          responseTimeMs: Date.now() - startTime,
          errorDetails: {
            type: 'deduplication_blocked',
            message: deduplicationResult.message
          },
          metadata: {
            user_agent: '',
            deduplication_result: deduplicationResult
          }
        };
      }
      
      console.log(`✅ Deduplication check passed: ${deduplicationResult.message}`);
      
      // ===== STEP 2: ASSIGN PROXY TO USER =====
      proxyId = await assignProxyToUser(context.userId);
      console.log(`📡 Assigned proxy ${proxyId} to user ${context.userId}`);
      
      // ===== STEP 3: CHECK PROXY HEALTH BEFORE PROCEEDING =====
      const healthCheck = await ProxyHealthMonitoringService.isProxyHealthyForJob(proxyId, context.userId);
      
      if (!healthCheck.isHealthy) {
        console.log(`⚠️ Proxy ${proxyId} is not healthy: ${healthCheck.reason}`);
        
        if (healthCheck.alternative_needed) {
          // Try to get alternative proxy
          console.log(`🔄 Requesting alternative proxy...`);
          proxyId = await ProxyAssignmentService.reassignUserProxy(context.userId, 'health_check_failed');
          
          // Recheck new proxy health
          const newHealthCheck = await ProxyHealthMonitoringService.isProxyHealthyForJob(proxyId, context.userId);
          if (!newHealthCheck.isHealthy) {
            throw new Error(`No healthy proxy available for user ${context.userId}`);
          }
        } else {
          throw new Error(`Proxy ${proxyId} unhealthy: ${healthCheck.reason}`);
        }
      }
      
      // ===== STEP 4: GET PROXY DETAILS FOR PUPPETEER =====
      const proxyDetails = await ProxyAssignmentService.getUserProxy(context.userId);
      if (!proxyDetails) {
        throw new Error(`Unable to get proxy details for ${proxyId}`);
      }
      
      console.log(`✅ Using healthy proxy: ${proxyDetails.provider} (${proxyDetails.country_code})`);
      
      // ===== STEP 5: CONFIGURE AND LAUNCH BROWSER WITH PROXY =====
      const puppeteerConfig = ProxyAssignmentService.formatProxyForPuppeteer(proxyDetails);
      browser = await this.launchBrowserWithProxy(puppeteerConfig);
      
      // 🆕 ===== STEP 6: EXECUTE LINKEDIN AUTOMATION WITH CAPTCHA DETECTION =====
      const automationResult = await this.performLinkedInConnectionWithCaptchaDetection(
        browser, 
        context.linkedinProfileUrl, 
        context.message,
        {
          jobId: context.jobId,
          userId: context.userId,
          userEmail: userEmail || 'unknown@example.com',
          proxyId: proxyId,
          sessionId: `session-${context.jobId}-${Date.now()}`
        }
      );
      
      const responseTime = Date.now() - startTime;
      
      // 🆕 Check if CAPTCHA was detected during automation
      if (automationResult.captchaDetected) {
        console.log(`🚨 CAPTCHA detected during automation for job ${context.jobId}`);
        
        return {
          success: false,
          proxyId: proxyId || '',
          responseTimeMs: responseTime,
          captchaDetected: true,
          captchaResponse: automationResult.captchaResponse,
          errorDetails: {
            type: 'captcha',
            message: `CAPTCHA detected: ${automationResult.captchaResponse?.details.captchaType}`,
            screenshot: automationResult.captchaResponse?.details.screenshotUrl
          },
          metadata: {
            user_agent: automationResult.userAgent,
            ip_address: automationResult.ipAddress,
            captcha_incidents: [automationResult.captchaResponse]
          }
        };
      }
      
      // ===== STEP 7: RECORD SUCCESSFUL INVITE IN DEDUPLICATION SYSTEM =====
      let inviteId: string | undefined;
      
      if (automationResult.success) {
        try {
          // Extract profile information if available
          const profileName = automationResult.profileInfo?.name;
          const profileTitle = automationResult.profileInfo?.title;
          const profileCompany = automationResult.profileInfo?.company;
          
          inviteId = await InviteDeduplicationService.recordLinkedInInvite(
            context.userId,
            context.linkedinProfileUrl,
            context.campaignId,
            context.message,
            profileName,
            profileTitle,
            profileCompany,
            context.jobId
          );
          
          console.log(`📝 Recorded invite in deduplication system: ${inviteId}`);
          
        } catch (deduplicationError) {
          console.error('❌ Failed to record invite in deduplication system:', deduplicationError);
          // Don't fail the job for deduplication recording errors
        }
      }
      
      // ===== STEP 8: RECORD SUCCESSFUL OUTCOME =====
      await ProxyHealthMonitoringService.recordJobOutcome(
        proxyId,
        context.userId,
        automationResult.success,
        { 
          failure_type: automationResult.success ? 'other' : 'invite_failure',
          response_time_ms: responseTime 
        }
      );
      
      // Update assignment performance
      await ProxyAssignmentService.updateAssignmentPerformance(
        context.userId,
        automationResult.success,
        responseTime
      );
      
      console.log(`${automationResult.success ? '✅' : '❌'} LinkedIn job ${context.jobId} ${automationResult.success ? 'completed successfully' : 'failed'} in ${responseTime}ms`);
      
      return {
        success: automationResult.success,
        proxyId,
        responseTimeMs: responseTime,
        inviteId,
        errorDetails: automationResult.success ? undefined : {
          type: 'invite_failure',
          message: 'LinkedIn automation failed'
        },
        metadata: {
          user_agent: automationResult.userAgent,
          ip_address: automationResult.ipAddress,
          linkedin_response: automationResult.linkedinResponse,
          deduplication_result: deduplicationResult
        }
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`❌ LinkedIn job ${context.jobId} failed:`, error);
      
      // Record failed outcome if we have a proxy
      if (proxyId) {
        try {
          await ProxyHealthMonitoringService.recordJobOutcome(
            proxyId,
            context.userId,
            false,
            { 
              failure_type: this.categorizeError(error),
              response_time_ms: responseTime,
              error_message: error instanceof Error ? error.message : 'Unknown error'
            }
          );
          
          await ProxyAssignmentService.updateAssignmentPerformance(
            context.userId,
            false,
            responseTime
          );
        } catch (recordError) {
          console.error('Failed to record error outcome:', recordError);
        }
      }
      
      return {
        success: false,
        proxyId: proxyId || '',
        responseTimeMs: responseTime,
        errorDetails: {
          type: this.categorizeError(error),
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        metadata: {
          user_agent: ''
        }
      };
      
    } finally {
      // Always close browser
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
    }
  }

  /**
   * Get user email from database
   */
  static async getUserEmail(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.error('❌ Error fetching user email:', error);
        return null;
      }

      return data.email;
    } catch (error) {
      console.error('❌ Exception fetching user email:', error);
      return null;
    }
  }

  /**
   * Launch browser with proxy configuration
   */
  static async launchBrowserWithProxy(proxyConfig: any): Promise<Browser> {
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ];
    
    // Add proxy configuration if provided
    if (proxyConfig?.server) {
      args.push(`--proxy-server=${proxyConfig.server}`);
    }
    
    const browser = await puppeteer.launch({
      headless: true,
      args,
      defaultViewport: { width: 1366, height: 768 }
    });
    
    // Set proxy authentication if provided
    if (proxyConfig?.username && proxyConfig?.password) {
      const pages = await browser.pages();
      if (pages.length > 0) {
        await pages[0].authenticate({
          username: proxyConfig.username,
          password: proxyConfig.password
        });
      }
    }
    
    return browser;
  }
  
  /**
   * Perform LinkedIn connection automation WITH comprehensive CAPTCHA detection
   */
  static async performLinkedInConnectionWithCaptchaDetection(
    browser: Browser,
    profileUrl: string,
    message?: string,
    jobContext?: {
      jobId: string;
      userId: string;
      userEmail: string;
      proxyId?: string;
      sessionId?: string;
    }
  ): Promise<{
    success: boolean;
    userAgent: string;
    ipAddress?: string;
    linkedinResponse?: any;
    profileInfo?: {
      name?: string;
      title?: string;
      company?: string;
    };
    captchaDetected?: boolean;
    captchaResponse?: CaptchaResponse;
  }> {
    
    const page = await browser.newPage();
    
    // Set realistic user agent
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    await page.setUserAgent(userAgent);
    
    try {
      // Navigate to profile
      console.log(`🔗 Navigating to LinkedIn profile: ${profileUrl}`);
      await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // 🆕 ===== CAPTCHA CHECK #1: After Navigation =====
      if (jobContext) {
        console.log(`🛡️ [CAPTCHA] Checking after navigation to ${profileUrl}`);
        const captchaCheck1 = await captchaOrchestrator.checkForCaptcha(page, {
          jobId: jobContext.jobId,
          userId: jobContext.userId,
          userEmail: jobContext.userEmail,
          proxyId: jobContext.proxyId,
          sessionId: jobContext.sessionId
        });

        if (captchaCheck1.captchaDetected) {
          console.log(`🚨 [CAPTCHA] Detected after navigation: ${captchaCheck1.details.captchaType}`);
          return {
            success: false,
            userAgent,
            captchaDetected: true,
            captchaResponse: captchaCheck1
          };
        }
      }
      
      // Wait for profile to load (Puppeteer v22 removed waitForTimeout)
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000)); // Random delay
      
      // 🆕 ===== CAPTCHA CHECK #2: After Page Load =====
      if (jobContext) {
        console.log(`🛡️ [CAPTCHA] Checking after page load`);
        const captchaCheck2 = await captchaOrchestrator.checkForCaptcha(page, {
          jobId: jobContext.jobId,
          userId: jobContext.userId,
          userEmail: jobContext.userEmail,
          proxyId: jobContext.proxyId,
          sessionId: jobContext.sessionId
        });

        if (captchaCheck2.captchaDetected) {
          console.log(`🚨 [CAPTCHA] Detected after page load: ${captchaCheck2.details.captchaType}`);
          return {
            success: false,
            userAgent,
            captchaDetected: true,
            captchaResponse: captchaCheck2
          };
        }
      }
      
      // Extract profile information for deduplication tracking
      const profileInfo = await this.extractProfileInfo(page);
      
      // Find and click connect button
      const connectButton = await page.$('button[aria-label*="Invite"][aria-label*="connect"], button[data-control-name="connect"]');
      
      if (!connectButton) {
        throw new Error('Connect button not found - may already be connected or page structure changed');
      }
      
      // Human-like clicking behavior
      await this.simulateHumanClick(page, connectButton);
      
      // Wait for modal or next step (Puppeteer v22 removed waitForTimeout)
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
      
      // 🆕 ===== CAPTCHA CHECK #3: After Connect Button Click =====
      if (jobContext) {
        console.log(`🛡️ [CAPTCHA] Checking after connect button click`);
        const captchaCheck3 = await captchaOrchestrator.checkForCaptcha(page, {
          jobId: jobContext.jobId,
          userId: jobContext.userId,
          userEmail: jobContext.userEmail,
          proxyId: jobContext.proxyId,
          sessionId: jobContext.sessionId
        });

        if (captchaCheck3.captchaDetected) {
          console.log(`🚨 [CAPTCHA] Detected after connect click: ${captchaCheck3.details.captchaType}`);
          return {
            success: false,
            userAgent,
            captchaDetected: true,
            captchaResponse: captchaCheck3
          };
        }
      }
      
      // Handle message if provided
      if (message) {
        await this.handleConnectionMessage(page, message);
      } else {
        // Send without note
        const sendButton = await page.$('button[aria-label*="Send"]');
        if (sendButton) {
          await this.simulateHumanClick(page, sendButton);
        }
      }
      
      // Wait for confirmation (Puppeteer v22 removed waitForTimeout)
      await new Promise((r) => setTimeout(r, 2000));
      
      // 🆕 ===== CAPTCHA CHECK #4: Final Check Before Completion =====
      if (jobContext) {
        console.log(`🛡️ [CAPTCHA] Final check before completion`);
        const captchaCheck4 = await captchaOrchestrator.checkForCaptcha(page, {
          jobId: jobContext.jobId,
          userId: jobContext.userId,
          userEmail: jobContext.userEmail,
          proxyId: jobContext.proxyId,
          sessionId: jobContext.sessionId
        });

        if (captchaCheck4.captchaDetected) {
          console.log(`🚨 [CAPTCHA] Detected in final check: ${captchaCheck4.details.captchaType}`);
          return {
            success: false,
            userAgent,
            captchaDetected: true,
            captchaResponse: captchaCheck4
          };
        }
      }
      
      // Get actual IP address used
      const ipAddress = await this.getActualIPAddress(page);
      
      console.log(`✅ [CAPTCHA] All checks passed - LinkedIn automation completed successfully`);
      
      return {
        success: true,
        userAgent,
        ipAddress,
        linkedinResponse: { status: 'sent' },
        profileInfo,
        captchaDetected: false
      };
      
    } catch (error) {
      console.error('❌ LinkedIn automation error:', error);
      
      // 🆕 ===== EMERGENCY CAPTCHA CHECK ON ERROR =====
      if (jobContext) {
        console.log(`🚨 [CAPTCHA] Emergency check due to error: ${error.message}`);
        try {
          const emergencyCheck = await captchaOrchestrator.checkForCaptcha(page, {
            jobId: jobContext.jobId,
            userId: jobContext.userId,
            userEmail: jobContext.userEmail,
            proxyId: jobContext.proxyId,
            sessionId: jobContext.sessionId
          });

          if (emergencyCheck.captchaDetected) {
            console.log(`🚨 [CAPTCHA] Emergency detection confirmed: ${emergencyCheck.details.captchaType}`);
            return {
              success: false,
              userAgent,
              captchaDetected: true,
              captchaResponse: emergencyCheck
            };
          }
        } catch (captchaError) {
          console.error('❌ Error during emergency CAPTCHA check:', captchaError);
        }
      }
      
      return {
        success: false,
        userAgent,
        profileInfo: {},
        captchaDetected: false
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Extract profile information from LinkedIn page
   */
  static async extractProfileInfo(page: Page): Promise<{
    name?: string;
    title?: string;
    company?: string;
  }> {
    try {
      const profileInfo: any = {};
      
      // Extract name
      try {
        const nameElement = await page.$('h1.text-heading-xlarge, .pv-text-details__left-panel h1');
        if (nameElement) {
          profileInfo.name = await page.evaluate(el => el.textContent?.trim(), nameElement);
        }
      } catch (error) {
        // Name extraction failed, continue
      }
      
      // Extract title/headline
      try {
        const titleElement = await page.$('.text-body-medium.break-words, .pv-text-details__left-panel .text-body-medium');
        if (titleElement) {
          profileInfo.title = await page.evaluate(el => el.textContent?.trim(), titleElement);
        }
      } catch (error) {
        // Title extraction failed, continue
      }
      
      // Extract company (usually part of title)
      try {
        const companyElement = await page.$('.pv-text-details__left-panel .text-body-medium:nth-child(2)');
        if (companyElement) {
          const companyText = await page.evaluate(el => el.textContent?.trim(), companyElement);
          if (companyText && companyText.includes('at ')) {
            profileInfo.company = companyText.split('at ')[1]?.trim();
          }
        }
      } catch (error) {
        // Company extraction failed, continue
      }
      
      return profileInfo;
      
    } catch (error) {
      console.error('Error extracting profile info:', error);
      return {};
    }
  }

  /**
   * Check for security challenges
   */
  static async checkForSecurityChallenges(page: Page): Promise<{ detected: boolean; type?: string }> {
    try {
      // Check for common security challenge elements
      const securitySelectors = [
        'input[type="password"]', // Password re-entry
        '.challenge-page',
        '.captcha-container',
        '[data-test-id="captcha-internal"]',
        '.phone-verification',
        '.security-checkpoint'
      ];
      
      for (const selector of securitySelectors) {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            return { detected: true, type: selector };
          }
        }
      }
      
      return { detected: false };
      
    } catch (error) {
      console.error('Error checking for security challenges:', error);
      return { detected: false };
    }
  }

  /**
   * Simulate human-like clicking behavior
   */
  static async simulateHumanClick(page: Page, element: any): Promise<void> {
    try {
      // Move mouse to element first
      const box = await element.boundingBox();
      if (box) {
        await page.mouse.move(
          box.x + box.width / 2 + (Math.random() - 0.5) * 10,
          box.y + box.height / 2 + (Math.random() - 0.5) * 10
        );
        
        // Small delay before clicking
        await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
      }
      
      await element.click();
    } catch (error) {
      console.error('Error during human-like click:', error);
      throw error;
    }
  }

  /**
   * Handle connection message
   */
  static async handleConnectionMessage(page: Page, message: string): Promise<void> {
    try {
      // Look for add note button
      const addNoteButton = await page.$('button[aria-label*="Add a note"], button[data-control-name="add_note"]');
      if (addNoteButton) {
        await this.simulateHumanClick(page, addNoteButton);
      await new Promise((r) => setTimeout(r, 1000));
      }
      
      // Find message textarea
      const messageTextarea = await page.$('textarea[name="message"], textarea[id="custom-message"]');
      if (messageTextarea) {
        await messageTextarea.click();
        // Select all text using keyboard shortcut
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        
        // Type message with human-like delays
        for (const char of message) {
          await page.keyboard.type(char);
          await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
        }
        
        // Find and click send button
        const sendButton = await page.$('button[aria-label*="Send"], button[data-control-name="send"]');
        if (sendButton) {
          await this.simulateHumanClick(page, sendButton);
        }
      }
    } catch (error) {
      console.error('Error handling connection message:', error);
      // Continue without message rather than failing
    }
  }

  /**
   * Get actual IP address being used
   */
  static async getActualIPAddress(page: Page): Promise<string | undefined> {
    try {
      // Navigate to IP checking service
      await page.goto('https://api.ipify.org?format=json', { waitUntil: 'networkidle2', timeout: 10000 });
      
      const ipData = await page.evaluate(() => {
        return JSON.parse(document.body.innerText);
      });
      
      return ipData.ip;
    } catch (error) {
      console.error('Error getting IP address:', error);
      return undefined;
    }
  }

  /**
   * Categorize error for health monitoring
   */
  static categorizeError(error: any): 'captcha' | 'timeout' | 'security_checkpoint' | 'invite_failure' | 'network_error' | 'banned' | 'other' {
    if (!error) return 'other';
    
    const errorMessage = error.message?.toLowerCase() || '';
    
    if (errorMessage.includes('captcha')) return 'captcha';
    if (errorMessage.includes('timeout')) return 'timeout';
    if (errorMessage.includes('security') || errorMessage.includes('challenge')) return 'security_checkpoint';
    if (errorMessage.includes('connect button') || errorMessage.includes('invitation')) return 'invite_failure';
    if (errorMessage.includes('network') || errorMessage.includes('connection')) return 'network_error';
    if (errorMessage.includes('banned') || errorMessage.includes('restricted')) return 'banned';
    
    return 'other';
  }
  
  /**
   * Process jobs with proxy health checks
   */
  static async processJobQueue(): Promise<void> {
    try {
      console.log('🔄 Processing job queue with health monitoring...');
      
      // Get pending jobs
      const { data: jobs, error } = await supabase
        .from('puppet_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(10);
      
      if (error) {
        throw new Error(`Failed to get pending jobs: ${error.message}`);
      }
      
      if (!jobs || jobs.length === 0) {
        console.log('📭 No pending jobs found');
        return;
      }
      
      console.log(`📋 Found ${jobs.length} pending jobs`);
      
      // Process each job
      for (const job of jobs) {
        try {
          // Update job status to running
          await supabase
            .from('puppet_jobs')
            .update({ 
              status: 'running', 
              started_at: new Date().toISOString() 
            })
            .eq('id', job.id);
          
          // Execute job with health monitoring
          const result = await this.executeLinkedInJob({
            jobId: job.id,
            userId: job.user_id,
            linkedinProfileUrl: job.linkedin_profile_url,
            message: job.message,
            priority: job.priority,
            maxRetries: job.max_retries || 2,
            campaignId: job.campaign_id // Pass campaign_id to the job context
          });
          
          // Update job with result
          await supabase
            .from('puppet_jobs')
            .update({
              status: result.success ? 'completed' : 'failed',
              completed_at: new Date().toISOString(),
              result_data: {
                proxy_id: result.proxyId,
                response_time_ms: result.responseTimeMs,
                error_details: result.errorDetails,
                metadata: result.metadata
              },
              error_message: result.errorDetails?.message
            })
            .eq('id', job.id);
          
          console.log(`${result.success ? '✅' : '❌'} Job ${job.id} ${result.success ? 'completed' : 'failed'}`);
          
        } catch (error) {
          console.error(`❌ Error processing job ${job.id}:`, error);
          
          // Update job as failed
          await supabase
            .from('puppet_jobs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_message: error instanceof Error ? error.message : 'Unknown error'
            })
            .eq('id', job.id);
        }
        
        // Small delay between jobs
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
      }
      
    } catch (error) {
      console.error('❌ Error processing job queue:', error);
    }
  }
} 