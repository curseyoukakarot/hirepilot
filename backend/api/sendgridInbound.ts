import express from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';

const upload = multer();
const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function extractTokenAddress(toValue: string | undefined) {
  if (!toValue) return null;
  // to may include multiple addresses separated by commas
  const first = toValue.split(',')[0].trim();
  const match = first.match(/msg_([0-9a-fA-F-]{36})\.u_([0-9a-fA-F-]{36})\.c_([0-9a-fA-F-]+|none)@/);
  if (!match) return null;
  const campaignId = match[3] === 'none' ? null : match[3];
  return { messageId: match[1], userId: match[2], campaignId };
}

function basicAuthOk(req: express.Request): boolean {
  const basic = process.env.INBOUND_PARSE_BASIC_AUTH || '';
  if (!basic) return true; // not configured
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Basic ')) return false;
  const token = header.slice('Basic '.length);
  return token === Buffer.from(basic).toString('base64');
}

async function computeForwardRecipients(userId: string): Promise<string[]> {
  try {
    // Get user's primary email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('primary_email, email')
      .eq('id', userId)
      .single();
    
    if (userError || !user) {
      console.error('[computeForwardRecipients] User not found:', userError);
      return [];
    }

    // Use primary_email if available, fallback to email
    const primaryEmail = user.primary_email || user.email;
    if (!primaryEmail) {
      console.error('[computeForwardRecipients] No email found for user:', userId);
      return [];
    }

    // Check forwarding preferences
    const { data: prefs, error: prefsError } = await supabase
      .from('user_reply_forwarding_prefs')
      .select('enabled, cc_recipients')
      .eq('user_id', userId)
      .maybeSingle();

    if (prefsError) {
      console.error('[computeForwardRecipients] Error fetching prefs:', prefsError);
      // Default to enabled if no prefs found
    }

    // If explicitly disabled, return empty
    if (prefs && prefs.enabled === false) {
      console.log('[computeForwardRecipients] Forwarding disabled for user:', userId);
      return [];
    }

    // Build recipient list
    const recipients = [primaryEmail];
    
    // Add CC recipients if configured
    if (prefs?.cc_recipients && Array.isArray(prefs.cc_recipients)) {
      recipients.push(...prefs.cc_recipients.filter(email => 
        email && !email.includes('@reply.thehirepilot.com')
      ));
    }

    // Filter out any reply.thehirepilot.com addresses to prevent loops
    return recipients.filter(email => !email.includes('@reply.thehirepilot.com'));
  } catch (error) {
    console.error('[computeForwardRecipients] Error:', error);
    return [];
  }
}

async function forwardReply({
  recipients,
  originalFrom,
  originalSubject,
  textBody,
  htmlBody,
  messageId,
  campaignId,
  userId,
  attachments = []
}: {
  recipients: string[];
  originalFrom: string;
  originalSubject: string;
  textBody: string;
  htmlBody: string;
  messageId: string;
  campaignId: string | null;
  userId: string;
  attachments?: any[];
}) {
  try {
    if (recipients.length === 0) {
      console.log('[forwardReply] No recipients, skipping forward');
      return;
    }

    // Configure SendGrid with system API key
    const systemApiKey = process.env.SENDGRID_API_KEY;
    if (!systemApiKey) {
      console.error('[forwardReply] SENDGRID_API_KEY not configured');
      return;
    }
    sgMail.setApiKey(systemApiKey);

    const forwardFromEmail = process.env.FORWARD_FROM_EMAIL || 'replies@thehirepilot.com';
    const forwardFromName = process.env.FORWARD_FROM_NAME || 'HirePilot Replies';
    
    // Build enhanced subject
    const enhancedSubject = `[HirePilot Reply] ${originalSubject} — ${originalFrom}`;
    
    // Build enhanced body with metadata
    const metadataText = `\n\n--- HirePilot Metadata ---\nMessage ID: ${messageId}\nCampaign ID: ${campaignId || 'none'}\nCandidate Email: ${originalFrom}\n`;
    const metadataHtml = `<br><br><hr><small><strong>HirePilot Metadata</strong><br>Message ID: ${messageId}<br>Campaign ID: ${campaignId || 'none'}<br>Candidate Email: ${originalFrom}</small>`;
    
    const enhancedTextBody = textBody + metadataText;
    const enhancedHtmlBody = htmlBody ? htmlBody + metadataHtml : `<p>${textBody.replace(/\n/g, '<br>')}</p>${metadataHtml}`;

    // Prepare message
    const msg: any = {
      to: recipients,
      from: {
        email: forwardFromEmail,
        name: forwardFromName
      },
      replyTo: originalFrom, // Critical: replies go back to candidate
      subject: enhancedSubject,
      text: enhancedTextBody,
      html: enhancedHtmlBody,
      customArgs: {
        hp_message_id: messageId,
        hp_campaign_id: campaignId || 'none',
        hp_user_id: userId,
        hp_forwarded: '1'
      },
      headers: {
        'X-HirePilot-Forwarded': 'true'
      }
    };

    // Add attachments if present
    if (attachments && attachments.length > 0) {
      msg.attachments = attachments.map((att: any) => ({
        content: att.content || '',
        filename: att.filename || 'attachment',
        type: att.type || 'application/octet-stream',
        disposition: 'attachment'
      }));
    }

    console.log(`[forwardReply] Forwarding to ${recipients.length} recipients:`, recipients);
    const [response] = await sgMail.send(msg);
    console.log(`[forwardReply] Successfully forwarded reply, message ID:`, response.headers['x-message-id']);
    
  } catch (error) {
    console.error('[forwardReply] Error forwarding reply:', error);
    // Don't throw - forwarding failure shouldn't break inbound processing
  }
}

router.post('/sendgrid/inbound', upload.any(), async (req, res) => {
  console.log('📬 SendGrid Inbound Parse HIT:', { 
    to: req.body.to, 
    from: req.body.from, 
    subject: req.body.subject 
  });
  try {
    if (!basicAuthOk(req)) {
      res.status(401).send('unauthorized');
      return;
    }

    // Loop protection: check if this is already a forwarded email
    const headers = (req.body.headers as string) || '';
    if (headers.includes('X-HirePilot-Forwarded: true')) {
      console.log('[sendgrid/inbound] Skipping forwarded email to prevent loop');
      res.status(204).end();
      return;
    }

    const to = (req.body.to as string) || '';
    const from = (req.body.from as string) || '';
    const subject = (req.body.subject as string) || '';
    const text = (req.body.text as string) || '';
    const html = (req.body.html as string) || '';

    const token = extractTokenAddress(to);
    if (!token) {
      res.status(400).send('invalid to token');
      return;
    }

    const { messageId, userId, campaignId } = token;

    // Optional lookup of lead by message id from messages table
    let lead_id: string | null = null;
    try {
      const { data: msgRow } = await supabase
        .from('messages')
        .select('lead_id')
        .eq('id', messageId)
        .maybeSingle();
      lead_id = msgRow?.lead_id ?? null;
    } catch {}

    // Save reply to database
    await supabase.from('email_replies').insert({
      user_id: userId,
      campaign_id: campaignId,
      lead_id,
      message_id: messageId,
      from_email: from,
      subject,
      text_body: text,
      html_body: html,
      raw: req.body
    });

    // Also store an event into email_events for convenience
    await supabase.from('email_events').insert({
      user_id: userId,
      campaign_id: campaignId,
      lead_id,
      provider: 'sendgrid',
      message_id: messageId,
      event_type: 'reply',
      event_timestamp: new Date().toISOString(),
      metadata: { from, subject }
    });

    console.log(`[sendgrid/inbound] Saved reply from ${from} for message ${messageId}`);

    // Forward reply to user's inbox
    try {
      const recipients = await computeForwardRecipients(userId);
      if (recipients.length > 0) {
        console.log(`[sendgrid/inbound] Forwarding reply to ${recipients.length} recipients`);
        
        // Handle attachments from multipart data
        const attachments = (req.files as any[])?.map((file: any) => ({
          content: file.buffer ? file.buffer.toString('base64') : '',
          filename: file.originalname || file.filename || 'attachment',
          type: file.mimetype || 'application/octet-stream'
        })) || [];

        await forwardReply({
          recipients,
          originalFrom: from,
          originalSubject: subject,
          textBody: text,
          htmlBody: html,
          messageId,
          campaignId,
          userId,
          attachments
        });
      } else {
        console.log(`[sendgrid/inbound] No forward recipients for user ${userId}`);
      }
    } catch (forwardError) {
      console.error('[sendgrid/inbound] Forward error (non-blocking):', forwardError);
      // Continue processing even if forwarding fails
    }

    res.status(204).end();
  } catch (err) {
    console.error('[sendgrid/inbound] error:', err);
    res.status(500).send('internal error');
  }
});

export default router;


