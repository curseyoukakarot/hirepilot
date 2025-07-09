import { Client } from '@microsoft/microsoft-graph-client';
import { supabase } from '../lib/supabase';
import { EmailEventService } from './emailEventService';
import { getOutlookAccessToken } from './outlookTokenHelper';

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
  static async sendEmail(userId: string, to: string, subject: string, html: string, campaignId?: string, leadId?: string): Promise<string> {
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
          ]
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
        .select('conversationId,inReplyTo')
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
          conversation_id: message.conversationId
        }
      });
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