import { google } from 'googleapis';
import { supabase } from '../lib/supabaseClient';
import { EmailEventService } from './emailEventService';
import { getGoogleAccessToken, forceRefreshGoogleAccessToken } from './googleTokenHelper';
import { generateUniqueReplyToken, buildReplyToAddress } from '../utils/generateReplyAddress';
import { buildGmailRawMessage } from './gmailMime';

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
   * Send email via Gmail API with tracking and Reply-To override.
   * Returns metadata needed by callers to persist message + reply token mapping.
   */
  static async sendEmailWithReplyMeta(
    userId: string,
    to: string,
    subject: string,
    html: string,
    campaignId?: string,
    leadId?: string,
    bccList?: string[]
  ): Promise<{
    trackingMessageId: string;
    gmailMessageId?: string;
    threadId?: string;
    replyToken: string;
    replyToAddress: string;
    messageIdHeader: string;
  }> {
    const accessToken = await getGoogleAccessToken(userId);
    const oauth2client = new google.auth.OAuth2();
    oauth2client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2client });

    // Tracking id used for opens and correlation
    const trackingMessageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Add tracking pixel
    const htmlWithTracking = this.addTrackingPixel(html, trackingMessageId);

    // Generate reply token/address
    const replyToken = generateUniqueReplyToken(12);
    const replyToAddress = buildReplyToAddress(replyToken);

    // We don't know "from" for the user; Gmail will use the authenticated account.
    // Set a descriptive name-less from placeholder (Gmail ignores it and uses actual account).
    const fromHeader = 'HirePilot Gmail Sender';

    // Build MIME and send
    const { raw, messageIdHeader } = buildGmailRawMessage({
      from: fromHeader,
      to,
      subject,
      htmlBody: htmlWithTracking,
      replyToOverride: replyToAddress,
      bcc: bccList && bccList.length ? bccList : undefined,
      headers: {},
    });

    let response;
    try {
      response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });
    } catch (err: any) {
      // Retry once on invalid credentials by force-refreshing
      const status = err?.response?.status || err?.code;
      const isInvalid = status === 401 || (err?.errors && err?.errors[0]?.reason === 'authError');
      if (isInvalid) {
        const freshToken = await forceRefreshGoogleAccessToken(userId);
        const oauth2client2 = new google.auth.OAuth2();
        oauth2client2.setCredentials({ access_token: freshToken });
        const gmail2 = google.gmail({ version: 'v1', auth: oauth2client2 });
        response = await gmail2.users.messages.send({
          userId: 'me',
          requestBody: { raw },
        });
      } else {
        throw err;
      }
    }

    // Store sent event
    await EmailEventService.storeEvent({
      user_id: userId,
      campaign_id: campaignId,
      lead_id: leadId,
      provider: 'gmail',
      message_id: trackingMessageId,
      event_type: 'sent',
      metadata: {
        gmail_message_id: response.data.id,
        thread_id: response.data.threadId,
        message_id_header: messageIdHeader,
        reply_to: replyToAddress,
      },
    });

    return {
      trackingMessageId,
      gmailMessageId: response.data.id,
      threadId: response.data.threadId,
      replyToken,
      replyToAddress,
      messageIdHeader,
    };
  }

  /**
   * Backwards-compatible wrapper returning only trackingMessageId
   */
  static async sendEmail(
    userId: string,
    to: string,
    subject: string,
    html: string,
    campaignId?: string,
    leadId?: string,
    bccList?: string[]
  ): Promise<string> {
    const meta = await this.sendEmailWithReplyMeta(userId, to, subject, html, campaignId, leadId, bccList);
    return meta.trackingMessageId;
  }

  /**
   * Handle tracking pixel request
   */
  static async handleTrackingPixel(messageId: string, ip: string, userAgent?: string): Promise<void> {
    try {
      // Get message details from database
      const { data: message, error } = await supabase
        .from('email_events')
        .select('user_id, campaign_id, lead_id, provider')
        .eq('message_id', messageId)
        .eq('event_type', 'sent')
        .single();

      if (error || !message) {
        console.error('Message not found:', messageId);
        return;
      }

      // Guard: only record Gmail opens for Gmail-sent messages
      if ((message as any).provider && String((message as any).provider).toLowerCase() !== 'gmail') {
        console.warn('[gmailTracking] provider mismatch on open; skipping', { messageId, provider: (message as any).provider });
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