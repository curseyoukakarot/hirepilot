import { Request, Response } from 'express';
import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import sgMail from '@sendgrid/mail';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Attachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
  template_id?: string;
  template_data?: Record<string, any>;
}

export const sendMessage = async (req: Request, res: Response) => {
  console.log('DEBUG: /api/message/send endpoint hit');
  try {
    const { to, subject, html, provider, attachments, template_id, template_data } = req.body;
    
    if (!to || !subject || !html || !provider) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use req.user (set by middleware)
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // If template_id is provided, fetch and populate the template
    let finalHtml = html;
    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', template_id)
        .single();

      if (templateError || !template) {
        return res.status(400).json({ error: 'Template not found' });
      }

      // Replace template variables with actual data
      finalHtml = template.content.replace(/\{\{(\w+)\}\}/g, (_match: string, key: string) => {
        return template_data?.[key] || _match;
      });
    }

    // Fetch the user's integration details for the selected provider
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single();

    console.log('DEBUG: integration object:', integration);

    if (integrationError || !integration) {
      return res.status(400).json({ error: `Integration for ${provider} not found` });
    }

    // Route the send request to the correct integration
    let sendResult;
    switch (provider) {
      case 'google':
        sendResult = await sendViaGoogle(integration, { to, subject, html: finalHtml, attachments });
        break;
      case 'outlook':
        sendResult = await sendViaOutlook(integration, { to, subject, html: finalHtml, attachments });
        break;
      case 'sendgrid':
        sendResult = await sendViaSendGrid(integration, { to, subject, html: finalHtml, attachments });
        break;
      default:
        return res.status(400).json({ error: 'Unsupported provider' });
    }

    if (sendResult.error) {
      return res.status(500).json({ error: sendResult.error });
    }

    // Store the message in the database
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        user_id: user.id,
        to_email: to,
        subject,
        content: finalHtml,
        provider,
        template_id,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    if (messageError) {
      console.error('Error storing message:', messageError);
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error sending message:', error);
    return res.status(500).json({ error: error.message });
  }
};

async function sendViaGoogle(integration: any, { to, subject, html, attachments }: EmailParams) {
  try {
    console.log('DEBUG: Fetching Google tokens for user:', integration.user_id);
    
    // Get the latest tokens from Supabase
    const { data: tokens, error: tokenError } = await supabase
      .from('google_accounts')
      .select('*')
      .eq('user_id', integration.user_id)
      .single();

    console.log('DEBUG: Token fetch result:', { tokens, tokenError });

    if (tokenError) {
      console.error('DEBUG: Token fetch error:', tokenError);
      throw new Error(`Token fetch error: ${tokenError.message}`);
    }

    if (!tokens) {
      console.error('DEBUG: No tokens found for user:', integration.user_id);
      throw new Error('Google tokens not found');
    }

    console.log('DEBUG: Initializing OAuth2 client with credentials');
    // Initialize OAuth2 client with client ID and secret
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.BACKEND_URL}/api/auth/google/callback`
    );

    console.log('DEBUG: Setting OAuth2 credentials');
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: new Date(tokens.expires_at).getTime()
    });

    // Check if token needs refresh
    if (tokens.expires_at && new Date(tokens.expires_at) < new Date()) {
      console.log('DEBUG: Token expired, refreshing...');
      const { credentials } = await oauth2Client.refreshAccessToken();
      console.log('DEBUG: New credentials received:', credentials);
      
      await supabase
        .from('google_accounts')
        .update({
          access_token: credentials.access_token,
          expires_at: new Date(Date.now() + (credentials.expiry_date || 3600000)),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', integration.user_id);
      
      console.log('DEBUG: Updated tokens in database');
      
      // Update the tokens for this request
      oauth2Client.setCredentials({
        access_token: credentials.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: credentials.expiry_date
      });
    }

    console.log('DEBUG: Initializing Gmail API client');
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Create email parts
    const parts: Array<{
      mimeType: string;
      content: string;
      filename?: string;
    }> = [
      {
        mimeType: 'text/html',
        content: html
      }
    ];

    // Add attachments if any
    if (attachments?.length) {
      attachments.forEach(attachment => {
        parts.push({
          mimeType: attachment.contentType,
          content: attachment.content.toString('base64'),
          filename: attachment.filename
        });
      });
    }

    // Create email message
    const message = [
      'Content-Type: multipart/mixed; boundary=boundary',
      'MIME-Version: 1.0',
      `To: ${to}`,
      `Subject: ${subject}`,
      '',
      '--boundary',
      'Content-Type: text/html; charset=utf-8',
      '',
      html,
      ...attachments?.map(attachment => [
        '--boundary',
        `Content-Type: ${attachment.contentType}`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${attachment.filename}"`,
        '',
        attachment.content.toString('base64')
      ]).flat() || [],
      '--boundary--'
    ].join('\n');

    // Send the email
    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('Google send error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendViaOutlook(integration: any, { to, subject, html, attachments }: EmailParams) {
  const client = Client.init({
    authProvider: (done) => {
      done(null, integration.tokens.access_token);
    }
  });
  
  try {
    const message = {
      subject,
      body: {
        contentType: 'HTML',
        content: html
      },
      toRecipients: [{ emailAddress: { address: to } }],
      attachments: attachments?.map(attachment => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: attachment.filename,
        contentBytes: attachment.content.toString('base64'),
        contentType: attachment.contentType
      })) || []
    };

    await client.api('/me/sendMail').post({ message });
    return { success: true };
  } catch (error: unknown) {
    console.error('Outlook send error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendViaSendGrid(integration: any, { to, subject, html, attachments }: EmailParams) {
  // Fetch SendGrid API key and sender from user_sendgrid_keys
  const { data: sendgridKey, error: keyError } = await supabase
    .from('user_sendgrid_keys')
    .select('api_key, default_sender')
    .eq('user_id', integration.user_id)
    .single();

  if (keyError || !sendgridKey?.api_key) {
    console.error('SendGrid key lookup error:', keyError);
    return { error: 'No SendGrid API key found for user' };
  }

  sgMail.setApiKey(sendgridKey.api_key);
  
  try {
    const msg = {
      to,
      from: sendgridKey.default_sender,
      subject,
      html,
      attachments: attachments?.map(attachment => ({
        content: attachment.content.toString('base64'),
        filename: attachment.filename,
        type: attachment.contentType,
        disposition: 'attachment'
      })) || []
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error: unknown) {
    console.error('SendGrid send error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export const getAllMessages = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ messages: data });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);
    if (error) throw error;
    return res.status(200).json({ unread: count || 0 });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({ error: 'Failed to fetch unread count' });
  }
}; 