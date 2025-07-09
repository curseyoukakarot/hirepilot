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

  /**
   * Set up Gmail push notifications for replies
   */
  static async setupReplyNotifications(userId: string): Promise<void> {
    try {
      const accessToken = await getGoogleAccessToken(userId);
      const oauth2client = new google.auth.OAuth2();
      oauth2client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: oauth2client });

      // Set up push notifications
      await gmail.users.watch({
        userId: 'me',
        requestBody: {
          labelIds: ['INBOX'],
          topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/topics/gmail-notifications`
        }
      });

      // Store notification setup in database
      await supabase
        .from('gmail_notifications')
        .upsert({
          user_id: userId,
          watch_expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          updated_at: new Date()
        });
    } catch (error) {
      console.error('Error setting up Gmail notifications:', error);
      throw error;
    }
  }

  /**
   * Handle Gmail push notification
   */
  static async handlePushNotification(userId: string, messageId: string): Promise<void> {
    try {
      const accessToken = await getGoogleAccessToken(userId);
      const oauth2client = new google.auth.OAuth2();
      oauth2client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: oauth2client });

      // Get message details
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['In-Reply-To', 'References']
      });

      // Check if this is a reply
      const inReplyTo = message.data.payload?.headers?.find(h => h.name === 'In-Reply-To')?.value;
      if (!inReplyTo) return;

      // Find original message
      const { data: originalMessage } = await supabase
        .from('email_events')
        .select('user_id, campaign_id, lead_id, message_id')
        .eq('provider', 'gmail')
        .eq('event_type', 'sent')
        .eq('metadata->gmail_message_id', inReplyTo)
        .single();

      if (!originalMessage) return;

      // Store reply event
      await EmailEventService.storeEvent({
        user_id: originalMessage.user_id,
        campaign_id: originalMessage.campaign_id,
        lead_id: originalMessage.lead_id,
        provider: 'gmail',
        message_id: originalMessage.message_id,
        event_type: 'reply',
        metadata: {
          reply_message_id: messageId,
          thread_id: message.data.threadId
        }
      });
    } catch (error) {
      console.error('Error handling Gmail push notification:', error);
      throw error;
    }
  }
} 