import { supabaseDb } from '../lib/supabase';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';
import { GmailTrackingService } from '../services/gmailTrackingService';
import { OutlookTrackingService } from '../services/outlookTrackingService';

export async function sendViaProvider(
  provider: 'sendgrid' | 'google' | 'gmail' | 'outlook',
  lead: any,
  bodyHtml: string,
  userId: string,
  subject?: string
): Promise<boolean> {
  try {
    if (provider === 'sendgrid') {
      // Get user's SendGrid API key and default sender
      const { data, error } = await supabaseDb
        .from('user_sendgrid_keys')
        .select('api_key, default_sender')
        .eq('user_id', userId)
        .single();
      if (error || !data?.api_key || !data?.default_sender) return false;
      sgMail.setApiKey(data.api_key);
      const trackingMessageId = crypto.randomUUID();
      const msg: any = {
        to: lead.email,
        from: data.default_sender,
        subject: subject || 'Message from HirePilot',
        html: bodyHtml,
        trackingSettings: { clickTracking: { enable: true }, openTracking: { enable: true } },
        customArgs: {
          user_id: userId,
          campaign_id: lead.campaign_id,
          lead_id: lead.id,
          message_id: trackingMessageId
        },
        replyTo: `msg_${trackingMessageId}.u_${userId}.c_${lead.campaign_id}@${process.env.INBOUND_PARSE_DOMAIN || 'reply.thehirepilot.com'}`
      };
      const [response] = await sgMail.send(msg);
      const sgMsgId = (response as any)?.headers?.['x-message-id'];
      const now = new Date();
      await supabaseDb.from('messages').insert({
        user_id: userId,
        lead_id: lead.id,
        campaign_id: lead.campaign_id,
        to_email: lead.email,
        recipient: lead.email,
        from_address: data.default_sender,
        subject: msg.subject,
        content: bodyHtml,
        sg_message_id: sgMsgId,
        provider: 'sendgrid',
        status: 'sent',
        sent_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        message_id: trackingMessageId,
        sender: 'You',
        avatar: `https://ui-avatars.com/api/?name=You&background=random`,
        preview: bodyHtml.replace(/<[^>]+>/g, '').slice(0, 100),
        time: now.toLocaleTimeString(),
        unread: false,
        read: true
      });
      await supabaseDb.from('email_events').insert({
        user_id: userId,
        campaign_id: lead.campaign_id,
        lead_id: lead.id,
        message_id: trackingMessageId,
        event_type: 'sent',
        provider: 'sendgrid',
        event_timestamp: now.toISOString(),
        metadata: { subject: msg.subject, sg_message_id: sgMsgId }
      });
      return true;
    }

    if (provider === 'google' || provider === 'gmail') {
      const messageId = await GmailTrackingService.sendEmail(
        userId,
        lead.email,
        subject || 'Message from HirePilot',
        bodyHtml,
        lead.campaign_id,
        lead.id
      );
      const now = new Date();
      await supabaseDb.from('messages').insert({
        user_id: userId,
        lead_id: lead.id,
        campaign_id: lead.campaign_id,
        to_email: lead.email,
        recipient: lead.email,
        from_address: 'you@gmail.com',
        subject: subject || 'Message from HirePilot',
        content: bodyHtml,
        message_id: messageId,
        provider: 'gmail',
        status: 'sent',
        sent_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        sender: 'You',
        avatar: `https://ui-avatars.com/api/?name=You&background=random`,
        preview: bodyHtml.replace(/<[^>]+>/g, '').slice(0, 100),
        time: now.toLocaleTimeString(),
        unread: false,
        read: true
      });
      return true;
    }

    if (provider === 'outlook') {
      const messageId = await OutlookTrackingService.sendEmail(
        userId,
        lead.email,
        subject || 'Message from HirePilot',
        bodyHtml,
        lead.campaign_id,
        lead.id
      );
      const now = new Date();
      await supabaseDb.from('messages').insert({
        user_id: userId,
        lead_id: lead.id,
        campaign_id: lead.campaign_id,
        to_email: lead.email,
        recipient: lead.email,
        from_address: 'you@outlook.com',
        subject: subject || 'Message from HirePilot',
        content: bodyHtml,
        message_id: messageId,
        provider: 'outlook',
        status: 'sent',
        sent_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        sender: 'You',
        avatar: `https://ui-avatars.com/api/?name=You&background=random`,
        preview: bodyHtml.replace(/<[^>]+>/g, '').slice(0, 100),
        time: now.toLocaleTimeString(),
        unread: false,
        read: true
      });
      return true;
    }

    return false;
  } catch (e) {
    console.error('[providerEmail.sendViaProvider] Error', e);
    return false;
  }
}


