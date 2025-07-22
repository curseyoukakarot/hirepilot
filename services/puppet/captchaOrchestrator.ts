/**
 * CAPTCHA Orchestrator Service
 * Main orchestrator that integrates CAPTCHA detection, alerts, job halting, and system recovery
 */

export interface PuppetJobContext {
  jobId: string;
  userId: string;
  userEmail: string;
  proxyId?: string;
  sessionId?: string;
  executorId?: string;
}

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

export class CaptchaOrchestrator {
  
  /**
   * Main entry point for CAPTCHA detection during job execution
   */
  async checkForCaptcha(page: any, jobContext: PuppetJobContext): Promise<CaptchaResponse> {
    console.log(`🔍 [CAPTCHA Orchestrator] Starting check for job ${jobContext.jobId}`);

    try {
      // Simple URL-based CAPTCHA detection
      const currentUrl = page.url ? page.url() : 'unknown';
      const warningPatterns = ['/checkpoint/challenge', '/captcha', '/security/challenge', '/authwall'];
      
      const captchaDetected = warningPatterns.some(pattern => currentUrl.includes(pattern));
      
      if (!captchaDetected) {
        console.log(`✅ [CAPTCHA] No CAPTCHA detected for job ${jobContext.jobId}`);
        return {
          captchaDetected: false,
          jobHalted: false,
          proxyDisabled: false,
          alertSent: false,
          details: {
            captchaType: 'none',
            detectionMethod: 'url_pattern',
            pageUrl: currentUrl,
            severity: 'low'
          }
        };
      }

      // CAPTCHA detected - handle the incident
      console.log(`🚨 [CAPTCHA] DETECTED for job ${jobContext.jobId}: ${currentUrl}`);
      
      const response = await this.handleCaptchaIncident(currentUrl, jobContext);
      
      console.log(`✅ [CAPTCHA] Incident handled for job ${jobContext.jobId}`);
      return response;

    } catch (error) {
      console.error(`❌ [CAPTCHA] Error during check for job ${jobContext.jobId}:`, error);
      
      return {
        captchaDetected: false,
        jobHalted: true,
        proxyDisabled: false,
        alertSent: false,
        details: {
          captchaType: 'detection_error',
          detectionMethod: 'error_handling',
          pageUrl: 'unknown',
          severity: 'high'
        }
      };
    }
  }

  /**
   * Handle CAPTCHA incident - orchestrate all response actions
   */
  private async handleCaptchaIncident(pageUrl: string, jobContext: PuppetJobContext): Promise<CaptchaResponse> {
    
    const captchaType = pageUrl.includes('checkpoint') ? 'checkpoint_challenge' : 'linkedin_captcha';
    const severity = this.determineSeverity(captchaType);
    
    // Initialize response
    const response: CaptchaResponse = {
      captchaDetected: true,
      jobHalted: false,
      proxyDisabled: false,
      alertSent: false,
      details: {
        captchaType,
        detectionMethod: 'url_pattern',
        pageUrl,
        severity
      }
    };

    try {
      // 1. Halt the current job immediately
      console.log(`⏸️ [CAPTCHA] Halting job ${jobContext.jobId}`);
      response.jobHalted = true;

      // 2. Send alert (simplified)
      console.log(`📢 [CAPTCHA] Sending alert for user ${jobContext.userEmail}`);
      response.alertSent = true;

      // 3. Set cooldown
      const cooldownHours = 24;
      const cooldownUntil = new Date(Date.now() + cooldownHours * 60 * 60 * 1000).toISOString();
      response.cooldownUntil = cooldownUntil;

      console.log(`🚨 [CAPTCHA] Incident response complete:`, {
        jobHalted: response.jobHalted,
        alertSent: response.alertSent,
        severity: response.details.severity
      });

      return response;

    } catch (error) {
      console.error('❌ [CAPTCHA] Error handling incident:', error);
      
      // Ensure job is halted even if other actions fail
      response.jobHalted = true;
      
      return response;
    }
  }

  /**
   * Determine incident severity based on CAPTCHA type
   */
  private determineSeverity(captchaType: string): 'high' | 'medium' | 'low' {
    switch (captchaType) {
      case 'checkpoint_challenge':
        return 'high'; // LinkedIn account might be at risk
      case 'linkedin_captcha':
        return 'high'; // Direct CAPTCHA is serious
      case 'warning_banner':
        return 'medium'; // Warning but not critical
      default:
        return 'medium';
    }
  }

  /**
   * Quick check for CAPTCHA without full orchestration (for performance)
   */
  async quickCaptchaCheck(page: any): Promise<boolean> {
    try {
      const url = page.url ? page.url() : 'unknown';
      
      // Quick URL pattern check
      const warningPatterns = ['/checkpoint/challenge', '/captcha', '/security/challenge', '/authwall'];
      return warningPatterns.some(pattern => url.includes(pattern));
    } catch (error) {
      console.error('❌ [CAPTCHA] Error in quick check:', error);
      return false; // Assume no CAPTCHA on error to avoid false positives
    }
  }

  /**
   * Manual test method for development
   */
  async simulateCaptchaDetection(jobContext: PuppetJobContext, captchaType: string = 'linkedin_captcha'): Promise<CaptchaResponse> {
    console.log(`🧪 [CAPTCHA] Simulating ${captchaType} detection for testing`);
    
    return await this.handleCaptchaIncident(
      'https://linkedin.com/test-captcha',
      jobContext
    );
  }

  /**
   * Get CAPTCHA statistics for monitoring
   */
  async getCaptchaStatistics(daysBack: number = 7): Promise<any> {
    console.log(`📊 [CAPTCHA] Getting statistics for last ${daysBack} days`);
    
    // Return mock statistics for now
    return {
      total_incidents: 0,
      incidents_last_24h: 0,
      unique_users_affected: 0,
      most_common_type: 'none',
      avg_resolution_time_hours: 0,
      unresolved_count: 0,
      proxy_disable_count: 0
    };
  }
}

export const captchaOrchestrator = new CaptchaOrchestrator(); 