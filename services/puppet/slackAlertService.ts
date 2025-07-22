/**
 * Slack Alert Service
 * Sends immediate alerts to Slack when CAPTCHA incidents are detected
 */

export interface SlackAlertPayload {
  incidentId: string;
  userId: string;
  userEmail: string;
  jobId?: string;
  proxyId?: string;
  pageUrl: string;
  captchaType: string;
  detectionMethod: string;
  screenshotUrl?: string;
  detectedAt: string;
  severity: 'high' | 'medium' | 'low';
}

export class SlackAlertService {
  private webhookUrl: string | null = process.env.SLACK_WEBHOOK_URL || null;
  private alertCache = new Set<string>();

  /**
   * Send CAPTCHA alert to Slack
   */
  async sendCaptchaAlert(alertData: SlackAlertPayload): Promise<boolean> {
    try {
      if (!this.webhookUrl) {
        console.log('⚠️ [Slack] No webhook URL configured');
        return false;
      }

      // Check for duplicate alerts (cooldown)
      const cacheKey = `${alertData.userId}-${alertData.captchaType}`;
      if (this.alertCache.has(cacheKey)) {
        console.log(`⏳ [Slack] Alert cooldown active for ${alertData.userEmail}`);
        return false;
      }

      // Create simple Slack message
      const message = this.createCaptchaAlertMessage(alertData);

      // Simple fetch instead of axios to avoid dependency issues
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      if (response.ok) {
        console.log(`✅ [Slack] CAPTCHA alert sent for ${alertData.userEmail}`);
        this.alertCache.add(cacheKey);
        return true;
      } else {
        console.error(`❌ [Slack] Alert failed with status: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error('❌ [Slack] Error sending CAPTCHA alert:', error);
      return false;
    }
  }

  /**
   * Create formatted Slack message for CAPTCHA alert
   */
  private createCaptchaAlertMessage(alertData: SlackAlertPayload) {
    const emoji = alertData.severity === 'high' ? '🚨' : alertData.severity === 'medium' ? '⚠️' : 'ℹ️';
    const captchaType = alertData.captchaType.replace('_', ' ').toUpperCase();

    return {
      text: `${emoji} CAPTCHA DETECTED!`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} CAPTCHA DETECTED - IMMEDIATE ATTENTION REQUIRED`
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*User:*\n${alertData.userEmail}` },
            { type: 'mrkdwn', text: `*Type:*\n${captchaType}` },
            { type: 'mrkdwn', text: `*Job ID:*\n${alertData.jobId || 'N/A'}` },
            { type: 'mrkdwn', text: `*Proxy:*\n${alertData.proxyId || 'N/A'}` }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Page URL:*\n${alertData.pageUrl}\n${alertData.screenshotUrl ? `*Screenshot:* ${alertData.screenshotUrl}` : ''}`
          }
        }
      ]
    };
  }

  /**
   * Send test alert
   */
  async sendTestAlert(): Promise<boolean> {
    try {
      if (!this.webhookUrl) {
        console.error('❌ [Slack] No webhook URL available for test');
        return false;
      }

      const testMessage = {
        text: '🧪 Test CAPTCHA Alert - Integration Working!',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🧪 CAPTCHA Detection Test Alert'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'This is a test alert to verify Slack integration is working correctly.'
            }
          }
        ]
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testMessage)
      });

      const success = response.ok;
      console.log(`${success ? '✅' : '❌'} [Slack] Test alert ${success ? 'sent successfully' : 'failed'}`);
      return success;
    } catch (error) {
      console.error('❌ [Slack] Error sending test alert:', error);
      return false;
    }
  }

  async loadWebhookUrl(): Promise<string | null> {
    return this.webhookUrl;
  }
}

export const slackAlertService = new SlackAlertService(); 