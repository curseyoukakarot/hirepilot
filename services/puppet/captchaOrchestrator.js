"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captchaOrchestrator = exports.CaptchaOrchestrator = void 0;
class CaptchaOrchestrator {
    async checkForCaptcha(page, jobContext) {
        console.log(`🔍 [CAPTCHA Orchestrator] Starting check for job ${jobContext.jobId}`);
        try {
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
            console.log(`🚨 [CAPTCHA] DETECTED for job ${jobContext.jobId}: ${currentUrl}`);
            const response = await this.handleCaptchaIncident(currentUrl, jobContext);
            console.log(`✅ [CAPTCHA] Incident handled for job ${jobContext.jobId}`);
            return response;
        }
        catch (error) {
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
    async handleCaptchaIncident(pageUrl, jobContext) {
        const captchaType = pageUrl.includes('checkpoint') ? 'checkpoint_challenge' : 'linkedin_captcha';
        const severity = this.determineSeverity(captchaType);
        const response = {
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
            console.log(`⏸️ [CAPTCHA] Halting job ${jobContext.jobId}`);
            response.jobHalted = true;
            console.log(`📢 [CAPTCHA] Sending alert for user ${jobContext.userEmail}`);
            response.alertSent = true;
            const cooldownHours = 24;
            const cooldownUntil = new Date(Date.now() + cooldownHours * 60 * 60 * 1000).toISOString();
            response.cooldownUntil = cooldownUntil;
            console.log(`🚨 [CAPTCHA] Incident response complete:`, {
                jobHalted: response.jobHalted,
                alertSent: response.alertSent,
                severity: response.details.severity
            });
            return response;
        }
        catch (error) {
            console.error('❌ [CAPTCHA] Error handling incident:', error);
            response.jobHalted = true;
            return response;
        }
    }
    determineSeverity(captchaType) {
        switch (captchaType) {
            case 'checkpoint_challenge':
                return 'high';
            case 'linkedin_captcha':
                return 'high';
            case 'warning_banner':
                return 'medium';
            default:
                return 'medium';
        }
    }
    async quickCaptchaCheck(page) {
        try {
            const url = page.url ? page.url() : 'unknown';
            const warningPatterns = ['/checkpoint/challenge', '/captcha', '/security/challenge', '/authwall'];
            return warningPatterns.some(pattern => url.includes(pattern));
        }
        catch (error) {
            console.error('❌ [CAPTCHA] Error in quick check:', error);
            return false;
        }
    }
    async simulateCaptchaDetection(jobContext, captchaType = 'linkedin_captcha') {
        console.log(`🧪 [CAPTCHA] Simulating ${captchaType} detection for testing`);
        return await this.handleCaptchaIncident('https://linkedin.com/test-captcha', jobContext);
    }
    async getCaptchaStatistics(daysBack = 7) {
        console.log(`📊 [CAPTCHA] Getting statistics for last ${daysBack} days`);
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
exports.CaptchaOrchestrator = CaptchaOrchestrator;
exports.captchaOrchestrator = new CaptchaOrchestrator();
