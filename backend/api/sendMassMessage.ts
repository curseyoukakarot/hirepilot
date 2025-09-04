import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { personalizeMessage } from '../utils/messageUtils';
import { getGoogleAccessToken } from '../services/googleTokenHelper';
import { google } from 'googleapis';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';
import { sendEmail } from '../services/emailProviderService';
import { GmailTrackingService } from '../services/gmailTrackingService';
import { OutlookTrackingService } from '../services/outlookTrackingService';

// Helper function to generate avatar URL
const getAvatarUrl = (name: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

// Provider-specific sending functions
async function sendViaProvider(lead: any, content: string, userId: string, provider: string, templateId?: string): Promise<boolean> {
  try {
    console.log(`[sendViaProvider] Attempting to send via ${provider} to ${lead.email}`);
    
    switch (provider) {
      case 'sendgrid':
        return await sendViaSendGrid(lead, content, userId, templateId);
      case 'google':
      case 'gmail':
        return await sendViaGoogle(lead, content, userId, templateId);
      case 'outlook':
        return await sendViaOutlook(lead, content, userId, templateId);
      default:
        console.log(`[sendViaProvider] Unknown provider ${provider}, falling back to emailProviderService`);
        return await sendEmail(lead, content, userId);
    }
  } catch (error) {
    console.error(`[sendViaProvider] Error with ${provider}:`, error);
    return false;
  }
}

async function sendViaSendGrid(lead: any, content: string, userId: string, templateId?: string): Promise<boolean> {
  try {
    // Get subject from template if templateId is provided
    let subject = 'Message from HirePilot';
    let body = content;
    
    if (templateId) {
      const { data: template, error: templateError } = await supabaseDb
        .from('email_templates')
        .select('subject')
        .eq('id', templateId)
        .eq('user_id', userId)
        .single();
      
      if (!templateError && template?.subject) {
        subject = template.subject;
      } else {
        console.log(`[sendViaSendGrid] Could not fetch template subject for ${templateId}, using fallback parsing`);
        // Fallback to parsing from content
        const lines = content.split('\n');
        if (lines.length > 1 && lines[0].length < 100 && !lines[0].includes('<')) {
          subject = lines[0].trim();
          body = lines.slice(1).join('\n').trim();
        }
      }
    } else {
      // Parse subject and body from content (legacy behavior)
      const lines = content.split('\n');
      if (lines.length > 1 && lines[0].length < 100 && !lines[0].includes('<')) {
        subject = lines[0].trim();
        body = lines.slice(1).join('\n').trim();
      }
    }
    
    body = body.replace(/\n/g, '<br/>');

    // Get user's SendGrid API key and default sender
    const { data, error } = await supabaseDb
      .from('user_sendgrid_keys')
      .select('api_key, default_sender')
      .eq('user_id', userId)
      .single();

    if (error || !data?.api_key) {
      console.error('[sendViaSendGrid] No SendGrid API key found:', error);
      return false;
    }

    if (!data.default_sender) {
      console.error('[sendViaSendGrid] No default sender configured');
      return false;
    }

    // Configure SendGrid with user's API key
    sgMail.setApiKey(data.api_key);

    // Generate tracking message id for VERP Reply-To and event correlation
    const trackingMessageId = crypto.randomUUID();

    // Prepare the email
    const msg: any = {
      to: lead.email,
      from: data.default_sender,
      subject,
      html: body,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      },
      customArgs: {
        user_id: userId,
        campaign_id: lead.campaign_id,
        lead_id: lead.id,
        message_id: trackingMessageId
      },
      replyTo: `msg_${trackingMessageId}.u_${userId}.c_${lead.campaign_id}@${process.env.INBOUND_PARSE_DOMAIN || 'reply.thehirepilot.com'}`
    };

    console.log(`[sendViaSendGrid] Sending email to ${lead.email} from ${data.default_sender} with subject: ${subject}`);
    const [response] = await sgMail.send(msg);
    
    // Store the message in our database with UI-friendly fields
    const currentTime = new Date();
    const { data: messageRecord, error: insertError } = await supabaseDb.from('messages').insert({
      user_id: userId,
      lead_id: lead.id,
      campaign_id: lead.campaign_id, // Include campaign attribution
      to_email: lead.email,
      recipient: lead.email,
      from_address: data.default_sender,
      subject,
      content: body,
      sg_message_id: response.headers['x-message-id'],
      message_id: trackingMessageId,
      provider: 'sendgrid',
      status: 'sent',
      sent_at: currentTime.toISOString(),
      created_at: currentTime.toISOString(),
      updated_at: currentTime.toISOString(),
      // UI-friendly fields
      sender: 'You',
      avatar: getAvatarUrl('You'),
      preview: body.replace(/<[^>]+>/g, '').slice(0, 100),
      time: currentTime.toLocaleTimeString(),
      unread: false,
      read: true
    })
    .select()
    .single();

    if (insertError) {
      console.error('[sendViaSendGrid] Message insert error:', insertError);
    }

    // Add analytics tracking - store sent event
    const messageId = trackingMessageId;
    const { error: analyticsError } = await supabaseDb.from('email_events').insert({
      user_id: userId,
      campaign_id: lead.campaign_id, // Include campaign attribution
      lead_id: lead.id,
      message_id: messageId,
      event_type: 'sent',
      provider: 'sendgrid',
      event_timestamp: currentTime.toISOString(),
      metadata: {
        subject,
        sg_message_id: response.headers['x-message-id'],
        reply_to: msg.replyTo,
        source: 'bulk_messaging',
        to_email: lead.email,
        database_message_id: messageRecord?.id,
        lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.name
      }
    });

    if (analyticsError) {
      console.error('[sendViaSendGrid] Analytics insert error:', analyticsError);
    } else {
      console.log('[sendViaSendGrid] Analytics event stored successfully');
    }

    console.log(`[sendViaSendGrid] Successfully sent to ${lead.email}`);
    return true;
  } catch (error: any) {
    console.error('[sendViaSendGrid] Error:', error.response?.body || error);
    return false;
  }
}

async function sendViaGoogle(lead: any, content: string, userId: string, templateId?: string): Promise<boolean> {
  try {
    // Get subject from template if templateId is provided
    let subject = 'Message from HirePilot';
    let body = content;
    
    if (templateId) {
      const { data: template, error: templateError } = await supabaseDb
        .from('email_templates')
        .select('subject')
        .eq('id', templateId)
        .eq('user_id', userId)
        .single();
      
      if (!templateError && template?.subject) {
        subject = template.subject;
      } else {
        console.log(`[sendViaGoogle] Could not fetch template subject for ${templateId}, using fallback parsing`);
        // Fallback to parsing from content
        const lines = content.split('\n');
        if (lines.length > 1 && lines[0].length < 100 && !lines[0].includes('<')) {
          subject = lines[0].trim();
          body = lines.slice(1).join('\n').trim();
        }
      }
    } else {
      // Parse subject and body from content (legacy behavior)
      const lines = content.split('\n');
      if (lines.length > 1 && lines[0].length < 100 && !lines[0].includes('<')) {
        subject = lines[0].trim();
        body = lines.slice(1).join('\n').trim();
      }
    }
    
    body = body.replace(/\n/g, '<br/>');

    console.log(`[sendViaGoogle] Sending email to ${lead.email} with subject: ${subject}`);
    
    // Use GmailTrackingService for proper tracking with campaign attribution
    const messageId = await GmailTrackingService.sendEmail(
      userId,
      lead.email,
      subject,
      body,
      lead.campaign_id, // Fix: Pass campaign_id instead of undefined
      lead.id    // leadId
    );

    // Store the message in our database with UI-friendly fields
    const currentTime = new Date();
    const { data: messageRecord, error: insertError } = await supabaseDb.from('messages').insert({
      user_id: userId,
      lead_id: lead.id,
      campaign_id: lead.campaign_id, // Include campaign attribution
      to_email: lead.email,
      recipient: lead.email,
      from_address: 'you@gmail.com', // Could get actual from user profile
      subject,
      content: body,
      message_id: messageId,
      provider: 'gmail',
      status: 'sent',
      sent_at: currentTime.toISOString(),
      created_at: currentTime.toISOString(),
      updated_at: currentTime.toISOString(),
      // UI-friendly fields
      sender: 'You',
      avatar: getAvatarUrl('You'),
      preview: body.replace(/<[^>]+>/g, '').slice(0, 100),
      time: currentTime.toLocaleTimeString(),
      unread: false,
      read: true
    })
    .select()
    .single();

    if (insertError) {
      console.error('[sendViaGoogle] Message insert error:', insertError);
      // Don't fail the entire operation for database insert errors
    } else {
      console.log('[sendViaGoogle] Message stored successfully with tracking ID:', messageId);
    }

    console.log(`[sendViaGoogle] Successfully sent to ${lead.email}`);
    return true;
  } catch (error: any) {
    console.error('[sendViaGoogle] Failed to send email:', error);
    
    // Check for specific Gmail API errors
    if (error.message?.includes('Google not connected') || error.message?.includes('access_token')) {
      console.error('[sendViaGoogle] Gmail authentication issue for user:', userId);
    } else if (error.response?.status === 401) {
      console.error('[sendViaGoogle] Gmail token expired or invalid for user:', userId);
    } else if (error.response?.status === 403) {
      console.error('[sendViaGoogle] Gmail API permission denied for user:', userId);
    } else if (error.response?.status === 429) {
      console.error('[sendViaGoogle] Gmail API rate limit exceeded for user:', userId);
    }
    
    return false; // Return false on any error to ensure accurate status reporting
  }
}

async function sendViaOutlook(lead: any, content: string, userId: string, templateId?: string): Promise<boolean> {
  try {
    // Get subject from template if templateId is provided
    let subject = 'Message from HirePilot';
    let body = content;
    
    if (templateId) {
      const { data: template, error: templateError } = await supabaseDb
        .from('email_templates')
        .select('subject')
        .eq('id', templateId)
        .eq('user_id', userId)
        .single();
      
      if (!templateError && template?.subject) {
        subject = template.subject;
      } else {
        console.log(`[sendViaOutlook] Could not fetch template subject for ${templateId}, using fallback parsing`);
        // Fallback to parsing from content
        const lines = content.split('\n');
        if (lines.length > 1 && lines[0].length < 100 && !lines[0].includes('<')) {
          subject = lines[0].trim();
          body = lines.slice(1).join('\n').trim();
        }
      }
    } else {
      // Parse subject and body from content (legacy behavior)
      const lines = content.split('\n');
      if (lines.length > 1 && lines[0].length < 100 && !lines[0].includes('<')) {
        subject = lines[0].trim();
        body = lines.slice(1).join('\n').trim();
      }
    }
    
    body = body.replace(/\n/g, '<br/>');

    console.log(`[sendViaOutlook] Sending email to ${lead.email} with subject: ${subject}`);
    
    // Use OutlookTrackingService for proper tracking with campaign attribution
    const messageId = await OutlookTrackingService.sendEmail(
      userId,
      lead.email,
      subject,
      body,
      lead.campaign_id, // Fix: Pass campaign_id instead of undefined
      lead.id    // leadId
    );

    // Store the message in our database with UI-friendly fields
    const currentTime = new Date();
    const { data: messageRecord, error: insertError } = await supabaseDb.from('messages').insert({
      user_id: userId,
      lead_id: lead.id,
      campaign_id: lead.campaign_id, // Include campaign attribution
      to_email: lead.email,
      recipient: lead.email,
      from_address: 'you@outlook.com', // Could get actual from user profile
      subject,
      content: body,
      message_id: messageId,
      provider: 'outlook',
      status: 'sent',
      sent_at: currentTime.toISOString(),
      created_at: currentTime.toISOString(),
      updated_at: currentTime.toISOString(),
      // UI-friendly fields
      sender: 'You',
      avatar: getAvatarUrl('You'),
      preview: body.replace(/<[^>]+>/g, '').slice(0, 100),
      time: currentTime.toLocaleTimeString(),
      unread: false,
      read: true
    })
    .select()
    .single();

    if (insertError) {
      console.error('[sendViaOutlook] Message insert error:', insertError);
      // Don't fail the entire operation for database insert errors
    } else {
      console.log('[sendViaOutlook] Message stored successfully with tracking ID:', messageId);
    }

    console.log(`[sendViaOutlook] Successfully sent to ${lead.email}`);
    return true;
  } catch (error: any) {
    console.error('[sendViaOutlook] Failed to send email:', error);
    
    // Check for specific Outlook API errors
    if (error.message?.includes('No Outlook tokens found') || error.message?.includes('access_token')) {
      console.error('[sendViaOutlook] Outlook authentication issue for user:', userId);
    } else if (error.response?.status === 401) {
      console.error('[sendViaOutlook] Outlook token expired or invalid for user:', userId);
    } else if (error.response?.status === 403) {
      console.error('[sendViaOutlook] Outlook API permission denied for user:', userId);
    } else if (error.response?.status === 429) {
      console.error('[sendViaOutlook] Outlook API rate limit exceeded for user:', userId);
    }
    
    return false; // Return false on any error to ensure accurate status reporting
  }
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  console.log('[sendMassMessage] Processing request with body:', JSON.stringify(req.body, null, 2));

  // Two payload shapes are supported:
  // 1) Legacy: { lead_ids, template_id, custom_content, channel, user_id }
  // 2) New: { messages: [{ lead_id, user_id, content, template_id, channel }] }

  const { messages } = req.body as any;

  if (Array.isArray(messages) && messages.length) {
    // NEW PAYLOAD ----------------------------------------------
    const results: any[] = [];

    for (const msg of messages) {
      const { lead_id, user_id: uid, content, template_id: tId, channel: ch } = msg;
      console.log(`[sendMassMessage] Processing message for lead ${lead_id} with provider ${ch}`);
      
      if (!lead_id || !uid || !content) {
        results.push({ lead_id, status: 'failed', error: 'missing_fields' });
        continue;
      }

      // Fetch lead restricted to owner
      const { data: lead, error: leadError } = await supabaseDb
        .from('leads')
        .select('*')
        .eq('id', lead_id)
        .eq('user_id', uid)
        .single();

      if (leadError || !lead) {
        console.error(`[sendMassMessage] Lead not found: ${lead_id}`, leadError);
        results.push({ lead_id, status: 'failed', error: 'lead_not_found' });
        continue;
      }

      // Use provider-specific sending if channel is specified, otherwise fall back to emailProviderService
      let sent = false;
      if (ch && ['sendgrid', 'google', 'gmail', 'outlook'].includes(ch)) {
        sent = await sendViaProvider(lead, content, uid, ch, tId);
      } else {
        console.log(`[sendMassMessage] No valid provider specified (${ch}), using emailProviderService`);
        sent = await sendEmail(lead, content, uid);
      }

      // Only insert into messages table if provider-specific sending didn't already do it
      if (!sent && (!ch || !['sendgrid', 'google', 'gmail'].includes(ch))) {
        await supabaseDb.from('messages').insert({
          lead_id,
          user_id: uid,
          template_id: tId,
          channel: ch || null,
          content,
          status: 'failed',
        });
      }

      results.push({ 
        lead_id, 
        status: sent ? 'sent' : 'failed',
        email: lead.email,
        provider: ch || 'default',
        error: sent ? null : 'Failed to send email - check email provider configuration'
      });
    }

    const response = {
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      details: results,
    };
    
    console.log('[sendMassMessage] Sending response:', response);
    res.json(response);
    return;
  }

  // LEGACY PAYLOAD ----------------------------------------------
  const { lead_ids, template_id, custom_content, channel, user_id } = req.body;

  if (!lead_ids || !template_id || !custom_content || !channel || !user_id) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    // Fetch leads
    const { data: leads, error: leadsError } = await supabaseDb
      .from('leads')
      .select('*')
      .in('id', lead_ids);

    if (leadsError) throw leadsError;

    // Get template content if provided
    let templateContent = custom_content;

    if (template_id) {
      const { data: template, error: templateError } = await supabaseDb
        .from('templates')
        .select('content')
        .eq('id', template_id)
        .single();

      if (templateError) throw templateError;
      templateContent = template.content;
    }

    const results = [];

    for (const lead of leads) {
      const personalizedMessage = personalizeMessage(templateContent, lead);

      // Use provider-specific sending if channel is specified
      let sent = false;
      if (channel && ['sendgrid', 'google', 'gmail', 'outlook'].includes(channel)) {
        sent = await sendViaProvider(lead, personalizedMessage, user_id, channel, template_id);
      } else {
        sent = await sendEmail(lead, personalizedMessage, user_id);
      }

      // Only insert into messages table if provider-specific sending didn't already do it
      if (!sent && (!channel || !['sendgrid', 'google', 'gmail'].includes(channel))) {
        await supabaseDb.from('messages').insert({
          lead_id: lead.id,
          user_id,
          template_id,
          channel,
          content: personalizedMessage,
          status: 'failed',
        });
      }

      results.push({ 
        lead_id: lead.id, 
        status: sent ? 'sent' : 'failed',
        email: lead.email,
        provider: channel || 'default',
        error: sent ? null : 'Failed to send email - check email provider configuration'
      });
    }

    const response = {
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      details: results,
    };
    
    console.log('[sendMassMessage] Legacy payload - Sending response:', response);
    res.json(response);
  } catch (error: any) {
    console.error('Error in sendMassMessage:', error);
    res.status(500).json({ error: 'Failed to send mass message' });
    return;
  }
}
