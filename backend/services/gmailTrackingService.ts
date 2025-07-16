import { google } from 'googleapis';
import { supabase } from '../lib/supabaseClient';
import { EmailEventService } from './emailEventService';
import { getGoogleAccessToken } from './googleTokenHelper';

export class GmailTrackingService {
  /**
   * Generate a tracking pixel URL for Gmail
   */
  static generateTrackingPixel(messageId: string): string {
    const baseUrl = process.env.BACKEND_URL || 'https://api.thehirepilot.com';
    const pixelUrl = `${baseUrl}/api/tracking/pixel/${messageId}`;
    console.log('[GmailTrackingService] Generated tracking pixel URL:', pixelUrl);
    return pixelUrl;
  }

  /**
   * Add tracking pixel to email HTML
   */
  static addTrackingPixel(html: string, messageId: string): string {
    const trackingPixel = this.generateTrackingPixel(messageId);
    return html + `<img src="${trackingPixel}" width="1" height="1" alt="" style="display:none" />`;
  }

  /**
   * Send email via Gmail API with tracking
   */
  static async sendEmail(userId: string, to: string, subject: string, html: string, campaignId?: string, leadId?: string): Promise<string> {
    try {
      const accessToken = await getGoogleAccessToken(userId);
      const oauth2client = new google.auth.OAuth2();
      oauth2client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: oauth2client });

      // Generate a unique message ID
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Add tracking pixel to HTML
      const htmlWithTracking = this.addTrackingPixel(html, messageId);

      // Create email message
      const raw = Buffer.from(
        `To: ${to}\r\n` +
        `Subject: ${subject}\r\n` +
        'Content-Type: text/html; charset=utf-8\r\n' +
        '\r\n' +
        htmlWithTracking
      ).toString('base64url');

      // Send email
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });

      // Store sent event
      await EmailEventService.storeEvent({
        user_id: userId,
        campaign_id: campaignId,
        lead_id: leadId,
        provider: 'gmail',
        message_id: messageId,
        event_type: 'sent',
        metadata: {
          gmail_message_id: response.data.id,
          thread_id: response.data.threadId
        }
      });

      return messageId;
    } catch (error) {
      console.error('Error sending Gmail:', error);
      throw error;
    }
  }

  /**
   * Handle tracking pixel request
   */
  static async handleTrackingPixel(messageId: string, ip: string, userAgent?: string): Promise<void> {
    try {
      // Get message details from database
      const { data: message, error } = await supabase
        .from('email_events')
        .select('user_id, campaign_id, lead_id')
        .eq('message_id', messageId)
        .eq('event_type', 'sent')
        .single();

      if (error || !message) {
        console.error('Message not found:', messageId);
        return;
      }

      // Store open event
      await EmailEventService.storeEvent({
        user_id: message.user_id,
        campaign_id: message.campaign_id,
        lead_id: message.lead_id,
        provider: 'gmail',
        message_id: messageId,
        event_type: 'open',
        metadata: {
          ip_address: ip,
          user_agent: userAgent || 'Unknown'
        }
      });
    } catch (error) {
      console.error('Error handling tracking pixel:', error);
      throw error;
    }
  }

  /* 
   * REMOVED: Gmail reply notification functionality to comply with CASA requirements
   * The following methods have been commented out as they require gmail.readonly scope:
   * - setupReplyNotifications
   * - handlePushNotification
   * 
   * These features relied on Gmail API methods that read user messages:
   * - gmail.users.watch (requires gmail.readonly)
   * - gmail.users.messages.get (requires gmail.readonly)
   * 
   * Email tracking now relies solely on:
   * - Tracking pixels for open detection (no special permissions needed)
   * - SendGrid webhooks for reply detection when using SendGrid
   * - Outlook webhooks for reply detection when using Outlook
   */

  // DEPRECATED: setupReplyNotifications method removed
  // This method required gmail.readonly scope which is not compatible with CASA approval
  
  // DEPRECATED: handlePushNotification method removed  
  // This method required gmail.readonly scope which is not compatible with CASA approval
} 