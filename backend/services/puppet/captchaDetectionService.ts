/**
 * Enhanced CAPTCHA & Security Detection Service
 * 
 * Comprehensive detection system for LinkedIn security challenges including:
 * - CAPTCHA detection with multiple selectors
 * - Phone verification detection  
 * - Security checkpoint identification
 * - Screenshot capture with Supabase storage upload
 * - Slack webhook notifications
 * - Job status updates to 'warning'
 */

import { Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import {
  PuppetDetectionType,
  PuppetSecurityDetection,
  PuppetExecutionConfig
} from '../../types/puppet';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Comprehensive LinkedIn Security Detection Selectors (Updated 2024)
const SECURITY_DETECTION_SELECTORS = {
  captcha: [
    // Google reCAPTCHA
    'iframe[src*="recaptcha"]',
    '.g-recaptcha',
    '#recaptcha',
    '[data-sitekey]',
    
    // hCaptcha
    'iframe[src*="hcaptcha"]',
    '.h-captcha',
    '#hcaptcha',
    
    // LinkedIn native CAPTCHA
    '[data-test-id="captcha-internal"]',
    '.captcha-container',
    '#captcha',
    '[data-cy="captcha"]',
    '.challenge-page',
    '.security-challenge',
    '.captcha-challenge',
    
    // Generic CAPTCHA indicators
    'img[alt*="captcha" i]',
    'img[src*="captcha" i]',
    '*[class*="captcha" i]',
    '*[id*="captcha" i]',
    
    // Challenge text indicators
    'text:contains("solve the puzzle")',
    'text:contains("verify you are human")',
    'text:contains("prove you are not a robot")',
    '*:contains("complete the security check")',
    '*:contains("I\'m not a robot")'
  ],
  
  phone_verification: [
    // Phone input fields
    'input[type="tel"]',
    'input[name*="phone" i]',
    'input[placeholder*="phone" i]',
    'input[id*="phone" i]',
    
    // LinkedIn phone verification
    '[data-test-id="phone-verification"]',
    '.phone-verification',
    '.challenge-stepup-phone',
    '.phone-challenge',
    '.add-phone',
    '.phone-number-input',
    
    // Text indicators
    '*:contains("verify your phone")',
    '*:contains("add your phone number")',
    '*:contains("phone verification")',
    '*:contains("enter your phone number")',
    '*:contains("mobile number")',
    '*:contains("verify with SMS")'
  ],
  
  security_checkpoint: [
    // LinkedIn security checkpoints
    '.security-checkpoint',
    '.checkpoint-challenge',
    '.identity-verification',
    '.account-verification',
    '.suspicious-login',
    '[data-test-id="checkpoint"]',
    '.verification-challenge',
    
    // Generic security indicators
    '*:contains("security checkpoint")',
    '*:contains("verify your identity")',
    '*:contains("account verification")',
    '*:contains("unusual activity")',
    '*:contains("suspicious activity")',
    '*:contains("verify it\'s you")',
    '*:contains("complete verification")'
  ],
  
  account_restriction: [
    // Account limitation messages
    '.account-restricted',
    '.temporary-restriction',
    '.account-limitation',
    '.restriction-notice',
    '.blocked-account',
    '.account-suspended',
    
    // Text indicators
    '*:contains("account has been restricted")',
    '*:contains("temporarily limited")',
    '*:contains("account suspended")',
    '*:contains("violating our terms")',
    '*:contains("review your account")',
    '*:contains("account is temporarily restricted")'
  ],
  
  suspicious_activity: [
    // Activity warnings
    '.suspicious-activity',
    '.unusual-activity',
    '.activity-warning',
    '.security-warning',
    '.fraud-detection',
    
    // Text indicators  
    '*:contains("unusual activity detected")',
    '*:contains("suspicious login")',
    '*:contains("we noticed unusual activity")',
    '*:contains("security alert")',
    '*:contains("unauthorized access")'
  ],
  
  login_challenge: [
    // Two-factor authentication
    '.login-challenge',
    '.two-factor',
    '.verification-code',
    '.email-verification',
    '.sms-verification',
    '.mfa-challenge',
    
    // Code input fields
    'input[name*="code" i]',
    'input[placeholder*="code" i]',
    'input[id*="verification" i]',
    
    // Text indicators
    '*:contains("enter the code")',
    '*:contains("verification code")',
    '*:contains("two-factor")',
    '*:contains("authenticator")',
    '*:contains("check your email")',
    '*:contains("check your phone")'
  ]
};

export class CaptchaDetectionService {
  private page: Page;
  private config: PuppetExecutionConfig;
  private screenshotCounter: number = 0;

  constructor(page: Page, config: PuppetExecutionConfig) {
    this.page = page;
    this.config = config;
  }

  /**
   * Comprehensive security detection scan
   */
  async detectSecurityChallenges(): Promise<PuppetSecurityDetection | null> {
    console.log(`🔍 [Security Scan] Starting comprehensive security detection for job ${this.config.job_id}`);

    // Check if detection is enabled for this user
    if (!this.config.user_settings.captcha_detection_enabled) {
      console.log(`⚠️ [Security Scan] CAPTCHA detection disabled for user ${this.config.user_id}`);
      return null;
    }

    // Wait for page to stabilize (Puppeteer v22 removed waitForTimeout)
    await new Promise((r) => setTimeout(r, 2000));

    // Scan for each detection type
    for (const [detectionType, selectors] of Object.entries(SECURITY_DETECTION_SELECTORS)) {
      const detection = await this.scanForDetectionType(detectionType as PuppetDetectionType, selectors);
      if (detection) {
        console.log(`🚨 [Security Scan] Detected: ${detection.type} with confidence ${detection.confidence}`);
        return detection;
      }
    }

    console.log(`✅ [Security Scan] No security challenges detected`);
    return null;
  }

  /**
   * Scan for specific detection type using multiple selectors
   */
  private async scanForDetectionType(
    detectionType: PuppetDetectionType, 
    selectors: string[]
  ): Promise<PuppetSecurityDetection | null> {
    const detectedElements: string[] = [];
    let maxConfidence = 0;

    for (const selector of selectors) {
      try {
        // Handle text-based selectors differently
        if (selector.includes(':contains(')) {
          const textMatch = await this.checkTextContent(selector);
          if (textMatch) {
            detectedElements.push(selector);
            maxConfidence = Math.max(maxConfidence, 0.9);
          }
        } else {
          // Standard CSS selector
          const elements = await this.page.$$(selector);
          for (const element of elements) {
            const isVisible = await element.isVisible().catch(() => false);
            if (isVisible) {
              detectedElements.push(selector);
              maxConfidence = Math.max(maxConfidence, 0.95);
              break;
            }
          }
        }
      } catch (error) {
        // Continue with next selector
        console.log(`🔍 [Security Scan] Selector failed: ${selector} - ${error}`);
      }
    }

    if (detectedElements.length > 0) {
      console.log(`⚠️ [Security Scan] ${detectionType} detected via: ${detectedElements.join(', ')}`);
      
      // Capture screenshot immediately
      const screenshotUrl = await this.captureSecurityScreenshot(detectionType);
      
      return {
        type: detectionType,
        confidence: maxConfidence,
        screenshot_url: screenshotUrl,
        page_url: this.page.url(),
        detected_elements: detectedElements,
        timestamp: new Date()
      };
    }

    return null;
  }

  /**
   * Check for text content matches (for :contains selectors)
   */
  private async checkTextContent(selector: string): Promise<boolean> {
    try {
      // Extract text from selector like '*:contains("verify you are human")'
      const textMatch = selector.match(/:contains\("([^"]+)"\)/);
      if (!textMatch) return false;
      
      const searchText = textMatch[1].toLowerCase();
      
      // Check if text exists anywhere on the page
      const pageText = await this.page.evaluate(() => {
        return document.body.innerText.toLowerCase();
      });
      
      return pageText.includes(searchText);
    } catch (error) {
      return false;
    }
  }

  /**
   * Capture high-quality screenshot for security detection
   */
  async captureSecurityScreenshot(detectionType: PuppetDetectionType): Promise<string | undefined> {
    try {
      this.screenshotCounter++;
      const timestamp = Date.now();
      const filename = `security-${detectionType}-${this.config.job_id}-${this.screenshotCounter}-${timestamp}.png`;
      
      console.log(`📸 [Screenshot] Capturing security screenshot: ${filename}`);

      // Ensure bucket exists
      await this.ensureStorageBucket();

      // Capture full page screenshot
      const screenshot = await this.page.screenshot({
        fullPage: true,
        type: 'png',
        quality: 90
      });

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('puppet-screenshots')
        .upload(filename, screenshot, {
          contentType: 'image/png',
          upsert: false,
          metadata: {
            job_id: this.config.job_id,
            user_id: this.config.user_id,
            detection_type: detectionType,
            page_url: this.page.url(),
            timestamp: timestamp.toString()
          }
        });

      if (error) {
        console.error(`❌ [Screenshot] Upload failed: ${error.message}`);
        
        // Fallback: try to save locally or return placeholder
        return await this.saveScreenshotFallback(screenshot, detectionType, timestamp);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('puppet-screenshots')
        .getPublicUrl(filename);

      const screenshotUrl = urlData.publicUrl;

      // Save screenshot record to database
      await this.saveScreenshotRecord(detectionType, screenshotUrl, screenshot.length);

      console.log(`✅ [Screenshot] Captured and uploaded: ${screenshotUrl}`);
      return screenshotUrl;

    } catch (error) {
      console.error(`❌ [Screenshot] Capture failed: ${error}`);
      return undefined;
    }
  }

  /**
   * Ensure the storage bucket exists for screenshots
   */
  private async ensureStorageBucket(): Promise<void> {
    try {
      // Try to get bucket info
      const { data: buckets, error } = await supabase.storage.listBuckets();
      
      if (error) {
        console.warn(`⚠️ [Storage] Could not list buckets: ${error.message}`);
        return;
      }

      const bucketExists = buckets.some(bucket => bucket.name === 'puppet-screenshots');
      
      if (!bucketExists) {
        console.log(`📁 [Storage] Creating puppet-screenshots bucket...`);
        
        const { error: createError } = await supabase.storage.createBucket('puppet-screenshots', {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg'],
          fileSizeLimit: 10 * 1024 * 1024 // 10MB limit
        });

        if (createError) {
          console.error(`❌ [Storage] Failed to create bucket: ${createError.message}`);
        } else {
          console.log(`✅ [Storage] Created puppet-screenshots bucket`);
        }
      }
    } catch (error) {
      console.warn(`⚠️ [Storage] Bucket check failed: ${error}`);
    }
  }

  /**
   * Fallback screenshot saving when Supabase upload fails
   */
  private async saveScreenshotFallback(
    screenshot: Buffer, 
    detectionType: PuppetDetectionType, 
    timestamp: number
  ): Promise<string> {
    // In production, you might save to local filesystem or alternative storage
    const fallbackUrl = `local://screenshots/security-${detectionType}-${timestamp}.png`;
    console.log(`⚠️ [Screenshot] Using fallback URL: ${fallbackUrl}`);
    return fallbackUrl;
  }

  /**
   * Save screenshot record to database
   */
  private async saveScreenshotRecord(
    detectionType: PuppetDetectionType,
    screenshotUrl: string,
    fileSize: number
  ): Promise<void> {
    try {
      await supabase
        .from('puppet_screenshots')
        .insert({
          job_id: this.config.job_id,
          detection_type: detectionType,
          file_url: screenshotUrl,
          file_size: fileSize,
          page_url: this.page.url(),
          user_agent: await this.page.evaluate(() => navigator.userAgent),
          timestamp: new Date().toISOString()
        });

      console.log(`📝 [Database] Screenshot record saved for job ${this.config.job_id}`);
    } catch (error) {
      console.error(`❌ [Database] Failed to save screenshot record: ${error}`);
    }
  }

  /**
   * Handle detected security challenge
   */
  async handleSecurityDetection(detection: PuppetSecurityDetection): Promise<void> {
    console.log(`🚨 [Security Handler] Processing ${detection.type} detection for job ${this.config.job_id}`);

    try {
      // 1. Update job status to 'warning' in database
      await this.updateJobStatus(detection);

      // 2. Send Slack notification
      await this.sendSlackNotification(detection);

      // 3. Update daily stats
      await this.updateDailyStats(detection.type);

      // 4. Auto-pause user if enabled
      if (this.config.user_settings.auto_pause_on_warning) {
        await this.autoPauseUser();
      }

      console.log(`✅ [Security Handler] Security detection handled successfully`);

    } catch (error) {
      console.error(`❌ [Security Handler] Failed to handle detection: ${error}`);
      throw error;
    }
  }

  /**
   * Update job status to 'warning' with detection details
   */
  private async updateJobStatus(detection: PuppetSecurityDetection): Promise<void> {
    try {
      const { error } = await supabase
        .from('puppet_jobs')
        .update({
          status: 'warning',
          detection_type: detection.type,
          screenshot_url: detection.screenshot_url,
          error_message: `Security detection: ${detection.type} (confidence: ${detection.confidence})`,
          result_data: {
            ...this.config,
            security_detection: {
              type: detection.type,
              confidence: detection.confidence,
              detected_elements: detection.detected_elements,
              page_url: detection.page_url,
              timestamp: detection.timestamp
            }
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', this.config.job_id);

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }

      console.log(`📝 [Database] Job ${this.config.job_id} status updated to 'warning'`);
    } catch (error) {
      console.error(`❌ [Database] Failed to update job status: ${error}`);
      throw error;
    }
  }

  /**
   * Send Slack webhook notification
   */
  async sendSlackNotification(detection: PuppetSecurityDetection): Promise<void> {
    try {
      // Get user's Slack webhook settings
      const { data: userSettings, error } = await supabase
        .from('puppet_user_settings')
        .select('slack_webhook_url, notification_events')
        .eq('user_id', this.config.user_id)
        .single();

      if (error || !userSettings?.slack_webhook_url) {
        console.log(`⚠️ [Slack] No webhook URL configured for user ${this.config.user_id}`);
        return;
      }

      // Check if user wants this type of notification
      if (!userSettings.notification_events.includes('warning') && 
          !userSettings.notification_events.includes('captcha_detected')) {
        console.log(`⚠️ [Slack] User ${this.config.user_id} disabled security notifications`);
        return;
      }

      // Build rich Slack message
      const slackMessage: any = {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `🚨 Puppet Security Alert: ${detection.type.toUpperCase()}`,
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Job ID:*\n\`${this.config.job_id}\``
              },
              {
                type: "mrkdwn",
                text: `*User ID:*\n\`${this.config.user_id}\``
              },
              {
                type: "mrkdwn",
                text: `*Detection Type:*\n${this.getDetectionEmoji(detection.type)} ${detection.type}`
              },
              {
                type: "mrkdwn",
                text: `*Confidence:*\n${Math.round(detection.confidence * 100)}%`
              }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*LinkedIn Profile:*\n<${this.config.linkedin_profile_url}|View Profile>\n\n*Page URL:*\n<${detection.page_url}|Current Page>`
            }
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `⏰ ${detection.timestamp.toLocaleString()} | 🎯 Elements: ${detection.detected_elements.length}`
              }
            ]
          }
        ]
      };

      // Add screenshot if available
      if (detection.screenshot_url) {
        slackMessage.blocks.push({
          type: "image",
          image_url: detection.screenshot_url,
          alt_text: `Security detection screenshot for ${detection.type}`
        });
      }

      // Add action buttons
      slackMessage.blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Job Details",
              emoji: true
            },
            url: `${process.env.FRONTEND_URL}/admin/puppet-monitor?job=${this.config.job_id}`,
            style: "primary"
          },
          {
            type: "button", 
            text: {
              type: "plain_text",
              text: "Pause User",
              emoji: true
            },
            url: `${process.env.FRONTEND_URL}/admin/puppet-monitor?user=${this.config.user_id}`,
            style: "danger"
          }
        ]
      });

      // Send to Slack
      const response = await axios.post(userSettings.slack_webhook_url, slackMessage, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status === 200) {
        console.log(`✅ [Slack] Security notification sent successfully`);
      } else {
        console.error(`❌ [Slack] Unexpected response status: ${response.status}`);
      }

    } catch (error) {
      console.error(`❌ [Slack] Failed to send notification: ${error}`);
      // Don't throw - notification failure shouldn't break the job
    }
  }

  /**
   * Get emoji for detection type
   */
  private getDetectionEmoji(type: PuppetDetectionType): string {
    const emojis = {
      captcha: '🔒',
      phone_verification: '📱',
      security_checkpoint: '🛡️',
      account_restriction: '⛔',
      suspicious_activity: '⚠️',
      login_challenge: '🔐'
    };
    return emojis[type] || '🚨';
  }

  /**
   * Update daily stats with security detection
   */
  private async updateDailyStats(detectionType: PuppetDetectionType): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const updateData: any = {
        user_id: this.config.user_id,
        stat_date: today,
        updated_at: new Date().toISOString()
      };

      // Increment appropriate counter
      if (detectionType === 'captcha') {
        updateData.captcha_detections = 1;
      }
      updateData.security_warnings = 1;

      await supabase
        .from('puppet_daily_stats')
        .upsert(updateData, { 
          onConflict: 'user_id,stat_date',
          ignoreDuplicates: false 
        });

      console.log(`📊 [Stats] Updated daily stats for ${detectionType} detection`);
    } catch (error) {
      console.error(`❌ [Stats] Failed to update daily stats: ${error}`);
    }
  }

  /**
   * Auto-pause user automation if enabled
   */
  private async autoPauseUser(): Promise<void> {
    try {
      const { error } = await supabase
        .from('puppet_user_settings')
        .update({ 
          rex_auto_mode_enabled: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', this.config.user_id);

      if (error) {
        throw new Error(`Failed to pause user: ${error.message}`);
      }

      console.log(`⏸️ [Auto-Pause] User ${this.config.user_id} auto-paused due to security detection`);
    } catch (error) {
      console.error(`❌ [Auto-Pause] Failed to pause user: ${error}`);
    }
  }
}

/**
 * Factory function to create detection service
 */
export function createCaptchaDetectionService(
  page: Page, 
  config: PuppetExecutionConfig
): CaptchaDetectionService {
  return new CaptchaDetectionService(page, config);
} 