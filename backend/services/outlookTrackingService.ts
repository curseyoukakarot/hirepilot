import { Client } from '@microsoft/microsoft-graph-client';
import { supabase } from '../lib/supabaseClient';
import { EmailEventService } from './emailEventService';
import { getOutlookAccessToken } from './outlookTokenHelper';
import { SourcingNotifications } from '../src/lib/notifications';
import { postToSlack } from '../src/lib/slackPoster';

export class OutlookTrackingService {
  /**
   * Generate a tracking pixel URL for Outlook
   */
  static generateTrackingPixel(messageId: string): string {
    const baseUrl = process.env.BACKEND_URL || 'https://api.thehirepilot.com';
    const pixelUrl = `${baseUrl}/api/tracking/pixel/${messageId}`;
    console.log('[OutlookTrackingService] Generated tracking pixel URL:', pixelUrl);
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
   * Send email via Microsoft Graph API with tracking
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
    try {
      const accessToken = await getOutlookAccessToken(userId);
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        }
      });

      // Generate a unique message ID
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Add tracking pixel to HTML
      const htmlWithTracking = this.addTrackingPixel(html, messageId);

      // Create email message
      const message = {
        message: {
          subject,
          body: {
            contentType: 'HTML',
            content: htmlWithTracking
          },
          toRecipients: [
            {
              emailAddress: {
                address: to
              }
            }
          ],
          ...(bccList && bccList.length
            ? {
                bccRecipients: bccList.map(address => ({
                  emailAddress: { address }
                }))
              }
            : {})
        }
      };

      // Send email
      const response = await client
        .api('/me/sendMail')
        .post(message);

      // Store sent event
      await EmailEventService.storeEvent({
        user_id: userId,
        campaign_id: campaignId,
        lead_id: leadId,
        provider: 'outlook',
        message_id: messageId,
        event_type: 'sent',
        metadata: {
          outlook_message_id: response.id,
          conversation_id: response.conversationId
        }
      });

      return messageId;
    } catch (error) {
      console.error('Error sending Outlook email:', error);
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
        .select('user_id, campaign_id, lead_id, provider')
        .eq('message_id', messageId)
        .eq('event_type', 'sent')
        .single();

      if (error || !message) {
        console.error('Message not found:', messageId);
        return;
      }

      // Guard: only record Outlook opens for Outlook-sent messages
      if ((message as any).provider && String((message as any).provider).toLowerCase() !== 'outlook') {
        console.warn('[outlookTracking] provider mismatch on open; skipping', { messageId, provider: (message as any).provider });
        return;
      }

      // Store open event
      await EmailEventService.storeEvent({
        user_id: message.user_id,
        campaign_id: message.campaign_id,
        lead_id: message.lead_id,
        provider: 'outlook',
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
   * Set up Outlook subscription for replies
   */
  static async setupReplyNotifications(userId: string): Promise<void> {
    try {
      const accessToken = await getOutlookAccessToken(userId);
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        }
      });

      // Create subscription
      const subscription = await client
        .api('/subscriptions')
        .post({
          changeType: 'created,updated',
          notificationUrl: `${process.env.BACKEND_URL}/api/outlook/webhook`,
          resource: '/me/mailFolders/inbox/messages',
          expirationDateTime: new Date(Date.now() + 4230 * 60 * 1000).toISOString(), // 4230 minutes
          clientState: userId // Pass user ID in clientState for verification
        });

      // Store subscription in database
      await supabase
        .from('outlook_subscriptions')
        .upsert({
          user_id: userId,
          subscription_id: subscription.id,
          expiration_date: subscription.expirationDateTime,
          updated_at: new Date()
        });
    } catch (error) {
      console.error('Error setting up Outlook subscription:', error);
      throw error;
    }
  }

  /**
   * Handle Outlook webhook notification
   */
  static async handleWebhookNotification(userId: string, messageId: string): Promise<void> {
    try {
      const accessToken = await getOutlookAccessToken(userId);
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        }
      });

      // Get message details
      const message = await client
        .api(`/me/messages/${messageId}`)
        .select('conversationId,inReplyTo,subject,from,bodyPreview')
        .get();

      // Check if this is a reply
      if (!message.inReplyTo) return;

      // Find original message
      const { data: originalMessage } = await supabase
        .from('email_events')
        .select('user_id, campaign_id, lead_id, message_id')
        .eq('provider', 'outlook')
        .eq('event_type', 'sent')
        .eq('metadata->outlook_message_id', message.inReplyTo)
        .single();

      if (!originalMessage) return;

      // Store reply event
      await EmailEventService.storeEvent({
        user_id: originalMessage.user_id,
        campaign_id: originalMessage.campaign_id,
        lead_id: originalMessage.lead_id,
        provider: 'outlook',
        message_id: originalMessage.message_id,
        event_type: 'reply',
        metadata: {
          reply_message_id: messageId,
          conversation_id: message.conversationId,
          subject: message.subject,
          from: message?.from?.emailAddress?.address,
          preview: message.bodyPreview
        }
      });

      // 1) In‑app Action Inbox card for the owner
      try {
        await SourcingNotifications.newReply({
          userId: originalMessage.user_id,
          campaignId: originalMessage.campaign_id!,
          leadId: originalMessage.lead_id!,
          replyId: messageId,
          classification: 'neutral',
          subject: message.subject || '(no subject)',
          fromEmail: (message?.from?.emailAddress?.address) || 'unknown',
          body: message.bodyPreview || ''
        });
      } catch (e) {
        console.warn('[OutlookTrackingService] failed to push Action Inbox card', e);
      }

      // 2) Slack notification (best‑effort, only if Slack connected)
      try {
        const text = `💬 New Outlook reply\nCampaign: ${originalMessage.campaign_id || 'unknown'}\nLead: ${originalMessage.lead_id || 'unknown'}\nFrom: ${(message?.from?.emailAddress?.address) || 'unknown'}\nSubject: ${message.subject || '(no subject)'}\nPreview: ${(message.bodyPreview || '').slice(0, 180)}`;
        await postToSlack(originalMessage.user_id, text);
      } catch {}
    } catch (error) {
      console.error('Error handling Outlook webhook:', error);
      throw error;
    }
  }

  /**
   * Refresh Outlook subscription
   */
  static async refreshSubscription(userId: string): Promise<void> {
    try {
      const { data: subscription } = await supabase
        .from('outlook_subscriptions')
        .select('subscription_id')
        .eq('user_id', userId)
        .single();

      if (!subscription) {
        await this.setupReplyNotifications(userId);
        return;
      }

      const accessToken = await getOutlookAccessToken(userId);
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        }
      });

      // Update subscription
      await client
        .api(`/subscriptions/${subscription.subscription_id}`)
        .patch({
          expirationDateTime: new Date(Date.now() + 4230 * 60 * 1000).toISOString()
        });

      // Update database
      await supabase
        .from('outlook_subscriptions')
        .update({
          expiration_date: new Date(Date.now() + 4230 * 60 * 1000),
          updated_at: new Date()
        })
        .eq('user_id', userId);
    } catch (error) {
      console.error('Error refreshing Outlook subscription:', error);
      throw error;
    }
  }
} 