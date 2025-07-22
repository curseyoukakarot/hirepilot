/**
 * CAPTCHA Detection Service
 * Detects LinkedIn CAPTCHA/warning pages, captures screenshots, and manages incidents
 */

import { createClient } from '@supabase/supabase-js';
import { Page } from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CaptchaDetectionSettings {
  linkedinCaptchaSelectors: string[];
  linkedinWarningUrls: string[];
  linkedinWarningText: string[];
  screenshotSettings: {
    quality: number;
    fullPage: boolean;
    type: 'png' | 'jpeg';
  };
  alertCooldownMinutes: number;
  autoDisableProxy: boolean;
  cooldownHours: number;
  enableSlackAlerts: boolean;
}

export interface CaptchaDetectionResult {
  detected: boolean;
  captchaType: 'linkedin_captcha' | 'checkpoint_challenge' | 'warning_banner' | 'none';
  detectionMethod: 'element_selector' | 'url_pattern' | 'text_content';
  pageUrl: string;
  screenshotPath?: string;
  screenshotUrl?: string;
  evidence: {
    matchedSelector?: string;
    matchedUrlPattern?: string;
    matchedText?: string;
    pageTitle?: string;
    htmlSnippet?: string;
  };
}

export interface CaptchaIncident {
  id: string;
  userId: string;
  jobId?: string;
  proxyId?: string;
  detectedAt: string;
  pageUrl: string;
  captchaType: string;
  screenshotUrl?: string;
  incidentStatus: string;
  adminAcknowledged: boolean;
  cooldownUntil?: string;
}

export class CaptchaDetectionService {
  private settings: CaptchaDetectionSettings | null = null;
  private screenshotDir: string;

  constructor() {
    this.screenshotDir = path.join(process.cwd(), 'screenshots', 'captcha');
    this.ensureScreenshotDirectory();
  }

  /**
   * Load CAPTCHA detection settings from database
   */
  async loadSettings(): Promise<CaptchaDetectionSettings> {
    if (this.settings) {
      return this.settings;
    }

    try {
      const { data: settingsData, error } = await supabase
        .from('puppet_captcha_detection_settings')
        .select('setting_key, setting_value')
        .eq('enabled', true);

      if (error) {
        console.error('❌ Error loading CAPTCHA settings:', error);
        return this.getDefaultSettings();
      }

      const settingsMap = new Map(
        settingsData.map(s => [s.setting_key, s.setting_value])
      );

      this.settings = {
        linkedinCaptchaSelectors: settingsMap.get('linkedin_captcha_selectors') || [],
        linkedinWarningUrls: settingsMap.get('linkedin_warning_urls') || [],
        linkedinWarningText: settingsMap.get('linkedin_warning_text') || [],
        screenshotSettings: settingsMap.get('screenshot_settings') || { quality: 90, fullPage: true, type: 'png' },
        alertCooldownMinutes: Number(settingsMap.get('alert_cooldown_minutes')) || 5,
        autoDisableProxy: settingsMap.get('auto_disable_proxy') === 'true',
        cooldownHours: Number(settingsMap.get('cooldown_hours')) || 24,
        enableSlackAlerts: settingsMap.get('enable_slack_alerts') === 'true'
      };

      console.log('✅ CAPTCHA detection settings loaded successfully');
      return this.settings;
    } catch (error) {
      console.error('❌ Exception loading CAPTCHA settings:', error);
      return this.getDefaultSettings();
    }
  }

  /**
   * Main CAPTCHA detection method
   */
  async detectCaptcha(page: Page, context: {
    userId: string;
    jobId?: string;
    proxyId?: string;
    sessionId?: string;
  }): Promise<CaptchaDetectionResult> {
    const settings = await this.loadSettings();
    const currentUrl = page.url();
    const pageTitle = await page.title().catch(() => 'Unknown');

    console.log(`🔍 [CAPTCHA Detection] Checking page: ${currentUrl}`);

    // 1. URL Pattern Detection
    const urlDetection = await this.detectByUrlPattern(currentUrl, settings);
    if (urlDetection.detected) {
      console.log(`🚨 [CAPTCHA] URL pattern detected: ${urlDetection.evidence.matchedUrlPattern}`);
      return await this.handleCaptchaDetection(page, urlDetection, context);
    }

    // 2. Element Selector Detection
    const elementDetection = await this.detectByElementSelectors(page, settings);
    if (elementDetection.detected) {
      console.log(`🚨 [CAPTCHA] Element detected: ${elementDetection.evidence.matchedSelector}`);
      return await this.handleCaptchaDetection(page, elementDetection, context);
    }

    // 3. Text Content Detection
    const textDetection = await this.detectByTextContent(page, settings);
    if (textDetection.detected) {
      console.log(`🚨 [CAPTCHA] Warning text detected: ${textDetection.evidence.matchedText}`);
      return await this.handleCaptchaDetection(page, textDetection, context);
    }

    // No CAPTCHA detected
    console.log(`✅ [CAPTCHA] No CAPTCHA detected on: ${currentUrl}`);
    return {
      detected: false,
      captchaType: 'none',
      detectionMethod: 'element_selector',
      pageUrl: currentUrl,
      evidence: { pageTitle }
    };
  }

  /**
   * Detect CAPTCHA by URL patterns
   */
  private async detectByUrlPattern(url: string, settings: CaptchaDetectionSettings): Promise<CaptchaDetectionResult> {
    for (const pattern of settings.linkedinWarningUrls) {
      if (url.includes(pattern)) {
        const captchaType = pattern.includes('checkpoint') ? 'checkpoint_challenge' : 'linkedin_captcha';
        return {
          detected: true,
          captchaType,
          detectionMethod: 'url_pattern',
          pageUrl: url,
          evidence: {
            matchedUrlPattern: pattern,
            pageTitle: await this.getPageTitle(url)
          }
        };
      }
    }

    return {
      detected: false,
      captchaType: 'none',
      detectionMethod: 'url_pattern',
      pageUrl: url,
      evidence: {}
    };
  }

  /**
   * Detect CAPTCHA by element selectors
   */
  private async detectByElementSelectors(page: Page, settings: CaptchaDetectionSettings): Promise<CaptchaDetectionResult> {
    try {
      for (const selector of settings.linkedinCaptchaSelectors) {
        const element = await page.$(selector).catch(() => null);
        if (element) {
          // Get some context around the detected element
          const htmlSnippet = await element.evaluate(el => {
            const parent = el.parentElement || el;
            return parent.outerHTML.substring(0, 500);
          }).catch(() => 'Unable to capture HTML');

          return {
            detected: true,
            captchaType: 'linkedin_captcha',
            detectionMethod: 'element_selector',
            pageUrl: page.url(),
            evidence: {
              matchedSelector: selector,
              pageTitle: await page.title().catch(() => 'Unknown'),
              htmlSnippet
            }
          };
        }
      }
    } catch (error) {
      console.error('❌ Error in element selector detection:', error);
    }

    return {
      detected: false,
      captchaType: 'none',
      detectionMethod: 'element_selector',
      pageUrl: page.url(),
      evidence: {}
    };
  }

  /**
   * Detect CAPTCHA by text content
   */
  private async detectByTextContent(page: Page, settings: CaptchaDetectionSettings): Promise<CaptchaDetectionResult> {
    try {
      const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
      
      for (const warningText of settings.linkedinWarningText) {
        if (pageText.toLowerCase().includes(warningText.toLowerCase())) {
          return {
            detected: true,
            captchaType: 'warning_banner',
            detectionMethod: 'text_content',
            pageUrl: page.url(),
            evidence: {
              matchedText: warningText,
              pageTitle: await page.title().catch(() => 'Unknown')
            }
          };
        }
      }
    } catch (error) {
      console.error('❌ Error in text content detection:', error);
    }

    return {
      detected: false,
      captchaType: 'none',
      detectionMethod: 'text_content',
      pageUrl: page.url(),
      evidence: {}
    };
  }

  /**
   * Handle CAPTCHA detection - take screenshot and record incident
   */
  private async handleCaptchaDetection(
    page: Page, 
    detection: CaptchaDetectionResult, 
    context: { userId: string; jobId?: string; proxyId?: string; sessionId?: string }
  ): Promise<CaptchaDetectionResult> {
    try {
      // Take screenshot
      const screenshotResult = await this.captureAndUploadScreenshot(page, context);
      detection.screenshotPath = screenshotResult.localPath;
      detection.screenshotUrl = screenshotResult.publicUrl;

      // Record incident in database
      const incidentId = await this.recordIncident({
        userId: context.userId,
        jobId: context.jobId,
        proxyId: context.proxyId,
        pageUrl: detection.pageUrl,
        captchaType: detection.captchaType,
        detectionMethod: detection.detectionMethod,
        screenshotUrl: detection.screenshotUrl,
        htmlSnippet: detection.evidence.htmlSnippet,
        executionContext: {
          sessionId: context.sessionId,
          userAgent: await page.evaluate(() => navigator.userAgent).catch(() => 'Unknown'),
          pageTitle: detection.evidence.pageTitle,
          detectedAt: new Date().toISOString()
        }
      });

      console.log(`🚨 [CAPTCHA] Incident recorded: ${incidentId}`);

      return detection;
    } catch (error) {
      console.error('❌ Error handling CAPTCHA detection:', error);
      return detection;
    }
  }

  /**
   * Capture screenshot and upload to Supabase Storage
   */
  async captureAndUploadScreenshot(page: Page, context: { userId: string; jobId?: string }): Promise<{
    localPath: string;
    publicUrl: string;
  }> {
    const settings = await this.loadSettings();
    const timestamp = Date.now();
    const filename = `captcha-${context.userId}-${timestamp}.${settings.screenshotSettings.type}`;
    const localPath = path.join(this.screenshotDir, filename);

    try {
      // Capture screenshot
      await page.screenshot({
        path: localPath,
        quality: settings.screenshotSettings.quality,
        fullPage: settings.screenshotSettings.fullPage,
        type: settings.screenshotSettings.type
      });

      console.log(`📸 [CAPTCHA] Screenshot captured: ${localPath}`);

      // Upload to Supabase Storage
      const fileBuffer = await fs.readFile(localPath);
      const storagePath = `captcha-alerts/${filename}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('puppet_alerts')
        .upload(storagePath, fileBuffer, {
          contentType: `image/${settings.screenshotSettings.type}`,
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('❌ Error uploading screenshot to Supabase:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('puppet_alerts')
        .getPublicUrl(storagePath);

      console.log(`☁️ [CAPTCHA] Screenshot uploaded: ${urlData.publicUrl}`);

      return {
        localPath,
        publicUrl: urlData.publicUrl
      };
    } catch (error) {
      console.error('❌ Error capturing/uploading screenshot:', error);
      return {
        localPath: localPath,
        publicUrl: ''
      };
    }
  }

  /**
   * Record CAPTCHA incident in database
   */
  async recordIncident(params: {
    userId: string;
    jobId?: string;
    proxyId?: string;
    pageUrl: string;
    captchaType: string;
    detectionMethod: string;
    screenshotUrl?: string;
    htmlSnippet?: string;
    executionContext?: any;
  }): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('record_captcha_incident', {
        p_user_id: params.userId,
        p_job_id: params.jobId || null,
        p_proxy_id: params.proxyId || null,
        p_page_url: params.pageUrl,
        p_captcha_type: params.captchaType,
        p_detection_method: params.detectionMethod,
        p_screenshot_url: params.screenshotUrl || null,
        p_page_html_snippet: params.htmlSnippet || null,
        p_execution_context: params.executionContext || {}
      });

      if (error) {
        console.error('❌ Error recording CAPTCHA incident:', error);
        throw error;
      }

      console.log(`📝 [CAPTCHA] Incident recorded with ID: ${data}`);
      return data;
    } catch (error) {
      console.error('❌ Exception recording CAPTCHA incident:', error);
      throw error;
    }
  }

  /**
   * Check if user is in CAPTCHA cooldown
   */
  async isUserInCooldown(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('is_user_in_captcha_cooldown', {
        p_user_id: userId
      });

      if (error) {
        console.error('❌ Error checking CAPTCHA cooldown:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('❌ Exception checking CAPTCHA cooldown:', error);
      return false;
    }
  }

  /**
   * Get unresolved CAPTCHA incidents
   */
  async getUnresolvedIncidents(limit: number = 50): Promise<CaptchaIncident[]> {
    try {
      const { data, error } = await supabase.rpc('get_unresolved_captcha_incidents', {
        p_limit: limit
      });

      if (error) {
        console.error('❌ Error fetching unresolved incidents:', error);
        return [];
      }

      return data.map((incident: any) => ({
        id: incident.incident_id,
        userId: incident.user_id,
        jobId: incident.job_id,
        proxyId: incident.proxy_id,
        detectedAt: incident.detected_at,
        pageUrl: incident.page_url,
        captchaType: incident.captcha_type,
        screenshotUrl: incident.screenshot_url,
        incidentStatus: incident.incident_status,
        adminAcknowledged: incident.admin_acknowledged,
        cooldownUntil: incident.cooldown_until
      }));
    } catch (error) {
      console.error('❌ Exception fetching unresolved incidents:', error);
      return [];
    }
  }

  /**
   * Acknowledge CAPTCHA incident (admin action)
   */
  async acknowledgeIncident(incidentId: string, adminUserId: string, notes?: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('acknowledge_captcha_incident', {
        p_incident_id: incidentId,
        p_admin_user_id: adminUserId,
        p_notes: notes || null
      });

      if (error) {
        console.error('❌ Error acknowledging CAPTCHA incident:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('❌ Exception acknowledging CAPTCHA incident:', error);
      return false;
    }
  }

  /**
   * Resolve CAPTCHA incident
   */
  async resolveIncident(incidentId: string, resolutionMethod: string, adminUserId?: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('resolve_captcha_incident', {
        p_incident_id: incidentId,
        p_resolution_method: resolutionMethod,
        p_admin_user_id: adminUserId || null
      });

      if (error) {
        console.error('❌ Error resolving CAPTCHA incident:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('❌ Exception resolving CAPTCHA incident:', error);
      return false;
    }
  }

  /**
   * Ensure screenshot directory exists
   */
  private async ensureScreenshotDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
    } catch (error) {
      console.error('❌ Error creating screenshot directory:', error);
    }
  }

  /**
   * Get page title safely
   */
  private async getPageTitle(url: string): Promise<string> {
    try {
      // Extract title from URL if possible
      return url.split('/').pop() || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Default settings fallback
   */
  private getDefaultSettings(): CaptchaDetectionSettings {
    return {
      linkedinCaptchaSelectors: [
        'input[name="captcha"]',
        'img[alt*="captcha"]',
        '.captcha-container',
        '#captcha',
        '.challenge-form'
      ],
      linkedinWarningUrls: [
        '/checkpoint/challenge',
        '/captcha',
        '/security/challenge',
        '/authwall'
      ],
      linkedinWarningText: [
        'Please complete this security check',
        'Verify you\'re human',
        'Security verification',
        'Complete this challenge'
      ],
      screenshotSettings: {
        quality: 90,
        fullPage: true,
        type: 'png'
      },
      alertCooldownMinutes: 5,
      autoDisableProxy: true,
      cooldownHours: 24,
      enableSlackAlerts: true
    };
  }
}

export const captchaDetectionService = new CaptchaDetectionService(); 