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
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Use req.user (set by middleware)
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let finalHtml = html;

    // Build alias map for backward compatibility (e.g., {{first_name}})
    const aliasData: Record<string, any> = { ...template_data };
    if (template_data?.Candidate) {
      const c = template_data.Candidate;
      if (c.FirstName) aliasData.first_name = c.FirstName;
      if (c.LastName) aliasData.last_name = c.LastName;
      if (c.FirstName || c.LastName) {
        aliasData.full_name = `${c.FirstName || ''} ${c.LastName || ''}`.trim();
      }
      if (c.Company) aliasData.company = c.Company;
      if (c.Job) aliasData.title = c.Job;
    }

    // Use aliasData for replacement going forward
    const dataForTemplate = aliasData;

    // Helper to resolve nested values (e.g., Candidate.FirstName)
    const resolvePath = (obj: Record<string, any> | undefined, path: string): string | undefined => {
      if (!obj) return undefined;
      return path.split('.').reduce((acc: any, part: string) => {
        if (acc && Object.prototype.hasOwnProperty.call(acc, part)) {
          return acc[part];
        }
        return undefined;
      }, obj);
    };

    // If template_id is provided, fetch and populate the template. Otherwise, just run replacement on provided html.
    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', template_id)
        .single();

      if (templateError || !template) {
        res.status(400).json({ error: 'Template not found' });
        return;
      }

      // Replace template variables with actual data, supporting dot notation
      finalHtml = template.content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match: string, path: string) => {
        const value = resolvePath(dataForTemplate, path);
        return (value !== undefined && value !== null) ? String(value) : _match;
      });
    } else if (template_data) {
      // No template file; run replacement on provided HTML/body
      finalHtml = html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match: string, path: string) => {
        const value = resolvePath(dataForTemplate, path);
        return (value !== undefined && value !== null) ? String(value) : _match;
      });
    }

    // Convert plain text newlines to <br/> to preserve spacing in HTML emails
    finalHtml = finalHtml.replace(/\n/g, '<br/>');

    // Fetch the user's integration details for the selected provider
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single();

    console.log('DEBUG: integration object:', integration);

    if (integrationError || !integration) {
      res.status(400).json({ error: `Integration for ${provider} not found` });
      return;
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
        res.status(400).json({ error: 'Unsupported provider' });
        return;
    }

    if (sendResult.error) {
      res.status(500).json({ error: sendResult.error });
      return;
    }

    // Helper function to generate avatar URL
    const getAvatarUrl = (name: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    // Store the message in the database with UI-friendly fields
    const currentTime = new Date();
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        user_id: user.id,
        to_email: to,
        recipient: to,
        from_address: user.email || 'you@example.com',
        subject,
        content: finalHtml,
        provider,
        template_id,
        status: 'sent',
        sent_at: currentTime.toISOString(),
        created_at: currentTime.toISOString(),
        updated_at: currentTime.toISOString(),
        // UI-friendly fields
        sender: 'You',
        avatar: getAvatarUrl('You'),
        preview: finalHtml.replace(/<[^>]+>/g, '').slice(0, 100),
        time: currentTime.toLocaleTimeString(),
        unread: false,
        read: true
      });

    if (messageError) {
      console.error('Error storing message:', messageError);
    }

    // Add analytics tracking - store sent event
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { error: analyticsError } = await supabase
      .from('email_events')
      .insert({
        user_id: user.id,
        message_id: messageId,
        event_type: 'sent',
        provider,
        to_email: to,
        timestamp: new Date().toISOString(),
        metadata: {
          subject,
          template_id,
          source: 'message_center'
        }
      });

    if (analyticsError) {
      console.error('Error storing analytics event:', analyticsError);
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
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
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false });
    if (error) throw error;
    res.status(200).json({ messages: data });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);
    if (error) throw error;
    res.status(200).json({ unread: count || 0 });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
}; 