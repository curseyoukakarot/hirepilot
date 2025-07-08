import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { sendEmail } from '../services/emailProviderService';
import { personalizeMessage } from '../utils/messageUtils';
import sgMail from '@sendgrid/mail';
import { google } from 'googleapis';
import { getGoogleAccessToken } from '../services/googleTokenHelper';

// Helper function to generate avatar URL
const getAvatarUrl = (name: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

// Provider-specific sending functions
async function sendViaProvider(lead: any, content: string, userId: string, provider: string): Promise<boolean> {
  try {
    console.log(`[sendViaProvider] Attempting to send via ${provider} to ${lead.email}`);
    
    switch (provider) {
      case 'sendgrid':
        return await sendViaSendGrid(lead, content, userId);
      case 'google':
      case 'gmail':
        return await sendViaGoogle(lead, content, userId);
      case 'outlook':
        // TODO: Implement Outlook sending
        console.log('[sendViaProvider] Outlook not implemented yet, falling back to emailProviderService');
        return await sendEmail(lead, content, userId);
      default:
        console.log(`[sendViaProvider] Unknown provider ${provider}, falling back to emailProviderService`);
        return await sendEmail(lead, content, userId);
    }
  } catch (error) {
    console.error(`[sendViaProvider] Error with ${provider}:`, error);
    return false;
  }
}

async function sendViaSendGrid(lead: any, content: string, userId: string): Promise<boolean> {
  try {
    // Parse subject and body from content
    const lines = content.split('\n');
    let subject = 'Message from HirePilot';
    let body = content;
    
    if (lines.length > 1 && lines[0].length < 100 && !lines[0].includes('<')) {
      subject = lines[0].trim();
      body = lines.slice(1).join('\n').trim();
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

    // Prepare the email
    const msg = {
      to: lead.email,
      from: data.default_sender,
      subject,
      html: body,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      }
    };

    console.log(`[sendViaSendGrid] Sending email to ${lead.email} from ${data.default_sender}`);
    const [response] = await sgMail.send(msg);
    
    // Store the message in our database with UI-friendly fields
    const currentTime = new Date();
    const { data: messageRecord, error: insertError } = await supabaseDb.from('messages').insert({
      user_id: userId,
      lead_id: lead.id,
      to_email: lead.email,
      recipient: lead.email,
      from_address: data.default_sender,
      subject,
      content: body,
      sg_message_id: response.headers['x-message-id'],
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
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { error: analyticsError } = await supabaseDb.from('email_events').insert({
      user_id: userId,
      lead_id: lead.id,
      message_id: messageId,
      event_type: 'sent',
      provider: 'sendgrid',
      event_timestamp: currentTime.toISOString(),
      metadata: {
        subject,
        sg_message_id: response.headers['x-message-id'],
        source: 'bulk_messaging',
        to_email: lead.email,
        database_message_id: messageRecord?.id
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

async function sendViaGoogle(lead: any, content: string, userId: string): Promise<boolean> {
  try {
    // Parse subject and body from content
    const lines = content.split('\n');
    let subject = 'Message from HirePilot';
    let body = content;
    
    if (lines.length > 1 && lines[0].length < 100 && !lines[0].includes('<')) {
      subject = lines[0].trim();
      body = lines.slice(1).join('\n').trim();
    }
    
    body = body.replace(/\n/g, '<br/>');

    const accessToken = await getGoogleAccessToken(userId);
    const oauth2client = new google.auth.OAuth2();
    oauth2client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2client });

    const raw = Buffer.from(
      `To: ${lead.email}\r\n` +
      `Subject: ${subject}\r\n` +
      'Content-Type: text/html; charset=utf-8\r\n' +
      '\r\n' +
      body
    ).toString('base64url');

    console.log(`[sendViaGoogle] Sending email to ${lead.email}`);
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    // Store the message in our database with UI-friendly fields
    const currentTime = new Date();
    const { data: messageRecord, error: insertError } = await supabaseDb.from('messages').insert({
      user_id: userId,
      lead_id: lead.id,
      to_email: lead.email,
      recipient: lead.email,
      from_address: 'you@gmail.com', // Could get actual from user profile
      subject,
      content: body,
      gmail_message_id: response.data.id,
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
    }

    // Add analytics tracking - store sent event
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { error: analyticsError } = await supabaseDb.from('email_events').insert({
      user_id: userId,
      lead_id: lead.id,
      message_id: messageId,
      event_type: 'sent',
      provider: 'gmail',
      event_timestamp: currentTime.toISOString(),
      metadata: {
        subject,
        gmail_message_id: response.data.id,
        source: 'bulk_messaging',
        to_email: lead.email,
        database_message_id: messageRecord?.id
      }
    });

    if (analyticsError) {
      console.error('[sendViaGoogle] Analytics insert error:', analyticsError);
    } else {
      console.log('[sendViaGoogle] Analytics event stored successfully');
    }

    console.log(`[sendViaGoogle] Successfully sent to ${lead.email}`);
    return true;
  } catch (error: any) {
    console.error('[sendViaGoogle] Error:', error);
    return false;
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
        sent = await sendViaProvider(lead, content, uid, ch);
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
        sent = await sendViaProvider(lead, personalizedMessage, user_id, channel);
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
