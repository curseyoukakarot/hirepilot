import express from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
import { simpleParser } from 'mailparser';
import { SourcingNotifications } from '../src/lib/notifications';
import { sendSourcingReplyNotification } from '../src/services/sourcingNotifications';

const upload = multer();
const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ---------------- Routing resolution: token first, legacy VERP fallback ----------------
function extractToken(toAddr: string) {
  const m = toAddr.match(/reply\+([A-Za-z0-9]+)@/i);
  return m?.[1] || null;
}

async function resolveRoutingFromAddress(toHeader: string) {
  // toHeader can include name + angle brackets; get the addr
  const addr = toHeader.match(/<([^>]+)>/)?.[1] || toHeader;
  // short-token path
  const token = extractToken(addr);
  if (token) {
    try {
      const { data, error } = await supabase
        .from('reply_tokens')
        .select('token, message_id, user_id, campaign_id')
        .eq('token', token)
        .maybeSingle();
      if (!error && data) {
        return { messageId: data.message_id, userId: data.user_id, campaignId: data.campaign_id, via: 'token' as const };
      }
    } catch {}
  }
  // Fallback to legacy VERP parsing
  const legacy = addr.match(/msg_([a-f0-9-]+)\.u_([a-f0-9-]+)\.c_([A-Za-z0-9-]+)@/i);
  if (legacy) {
    return { messageId: legacy[1], userId: legacy[2], campaignId: legacy[3] === 'none' ? null : legacy[3], via: 'legacy' as const };
  }
  throw new Error('Unable to resolve message context from To address');
}

type ParsedReply = {
  from: string | null;
  subject: string | null;
  text: string | null;
  html: string | null;
  attachments: Array<{ filename: string; type?: string; content: string }>;
};

async function parseInbound(req: express.Request): Promise<ParsedReply> {
  // Start with SendGrid's parsed fields if present
  let parsed: ParsedReply = {
    from: req.body.from || null,
    subject: req.body.subject || null,
    text: req.body.text || null,
    html: req.body.html || null,
    attachments: [],
  };

  const rawMime: string | undefined = req.body.email; // present when "POST raw MIME" is ON
  if (!rawMime) return parsed;

  try {
    const mail = await simpleParser(rawMime);

    // From
    const fromAddr =
      mail.from?.value?.[0]?.address ||
      (parsed.from?.match(/<([^>]+)>/)?.[1] || parsed.from) ||
      null;

    // Bodies
    const text = (mail.text && mail.text.trim()) ? mail.text : (parsed.text || null);

    let html: string | null = null;
    if (typeof mail.html === 'string') html = mail.html;
    else if (mail.textAsHtml) html = mail.textAsHtml; // fallback: render text as HTML
    else if (parsed.html) html = parsed.html;

    // Attachments to base64 for SendGrid forwarder
    const attachments = (mail.attachments || []).map(a => ({
      filename: a.filename || 'attachment',
      type: a.contentType || 'application/octet-stream',
      content: Buffer.isBuffer(a.content)
        ? a.content.toString('base64')
        : Buffer.from(a.content as any).toString('base64'),
    }));

    parsed = { 
      from: fromAddr, 
      subject: mail.subject || parsed.subject || null, 
      text, 
      html, 
      attachments 
    };
  } catch (e) {
    console.error('[parseInbound] MIME parse failed; using fallback fields', e);
  }

  return parsed;
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

// Prefer sender identity routing; fallback to user's primary email
async function computeRecipientsForMessage(messageId: string): Promise<{ recipients: string[]; msg: any }> {
  // Look up message metadata (messages table holds sender_identity_id/from_email/message_id_header)
  const { data: m, error: mErr } = await supabase
    .from('messages')
    .select('id, user_id, campaign_id, sender_identity_id, from_email, message_id_header')
    .eq('id', messageId)
    .maybeSingle();
  if (mErr || !m) throw new Error('message not found');

  // prefer sender_identity.forward_to
  if (m.sender_identity_id) {
    const { data: idn } = await supabase
      .from('email_identities')
      .select('forward_to')
      .eq('id', m.sender_identity_id)
      .maybeSingle();
    if (idn?.forward_to) return { recipients: [idn.forward_to], msg: m };
  }

  // fallback: match identity by from_email
  if (m.from_email) {
    const { data: idn2 } = await supabase
      .from('email_identities')
      .select('forward_to')
      .eq('from_email', m.from_email)
      .maybeSingle();
    if (idn2?.forward_to) return { recipients: [idn2.forward_to], msg: m };
  }

  // final fallback: the user's primary_email
  const { data: u } = await supabase
    .from('users')
    .select('primary_email')
    .eq('id', m.user_id)
    .maybeSingle();
  return { recipients: u?.primary_email ? [u.primary_email] : [], msg: m };
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
  attachments = [],
  headers
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
  headers?: Record<string, string>;
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

    if (headers && Object.keys(headers).length > 0) {
      msg.headers = { ...(msg.headers || {}), ...headers };
    }

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

    const to = (req.body.to as string) || (req.body.envelope_to as string) || (req.body.to_raw as string) || '';

    // Parse MIME data to get real email bodies and attachments
    console.log('[sendgrid/inbound] Content-Type:', req.headers['content-type']);
    const parsed = await parseInbound(req);
    console.log('[sendgrid/inbound] MIME present:', Boolean(req.body.email), 'text.len:', parsed.text?.length || 0, 'html.len:', parsed.html?.length || 0);

    let routing;
    try {
      routing = await resolveRoutingFromAddress(to);
    } catch (e) {
      console.error('[sendgrid/inbound] routing resolution failed:', e);
      res.status(400).send('invalid to token');
      return;
    }
    const { messageId, userId, campaignId } = routing as any;

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

    // Save reply to database using parsed data
    const { data: replyRow } = await supabase.from('email_replies').insert({
      user_id: userId,
      campaign_id: campaignId,
      lead_id,
      message_id: messageId,
      from_email: parsed.from,
      subject: parsed.subject,
      text_body: parsed.text,
      html_body: parsed.html,
      raw: req.body
    }).select().single();

    // Also store an event into email_events for convenience
    await supabase.from('email_events').insert({
      user_id: userId,
      campaign_id: campaignId,
      lead_id,
      provider: 'sendgrid',
      message_id: messageId,
      event_type: 'reply',
      event_timestamp: new Date().toISOString(),
      metadata: { from: parsed.from, subject: parsed.subject }
    });

    console.log(`[sendgrid/inbound] Saved reply from ${parsed.from} for message ${messageId}`);

    // Create Action Inbox notification (in-app) for the user
    try {
      if (userId) {
        await SourcingNotifications.newReply({
          userId,
          campaignId: (campaignId ?? 'none') as any,
          leadId: (lead_id ?? 'none') as any,
          replyId: (replyRow as any)?.id || messageId,
          classification: 'neutral',
          subject: parsed.subject || '',
          fromEmail: parsed.from || 'unknown@unknown.com',
          body: parsed.text || parsed.html || ''
        }).catch(async (e:any) => {
          // Fallback path if notifications schema lacks metadata column
          console.warn('[sendgrid/inbound] newReply failed, inserting minimal notification:', e?.message);
          await supabase.from('notifications').insert({
            user_id: userId,
            source: 'inapp',
            thread_key: (campaignId && lead_id) ? `sourcing:${campaignId}:${lead_id}` : null,
            title: `New reply from ${parsed.from || 'candidate'}`,
            body_md: `${(parsed.text || parsed.html || '').slice(0,700)}`,
            type: 'sourcing_reply',
            actions: [
              { id: 'reply_draft', type: 'button', label: '🤖 Draft with REX', style: 'primary' },
              { id: 'book_meeting', type: 'button', label: '📅 Book Meeting', style: 'secondary' },
              { id: 'disqualify', type: 'button', label: '❌ Disqualify', style: 'danger' },
              { id: 'free_text', type: 'input', placeholder: 'Type an instruction…' }
            ],
            created_at: new Date().toISOString()
          });
        });
      }
    } catch (notifErr) {
      console.warn('[sendgrid/inbound] Failed to create Action Inbox notification:', notifErr);
    }

    // Slack notification (per-user setting): notify on reply if enabled
    try {
      if (userId) {
        const { data: settings } = await supabase
          .from('user_settings')
          .select('slack_webhook_url, slack_notifications, campaign_updates')
          .eq('user_id', userId)
          .maybeSingle();
        const slackAllowed = Boolean(settings?.slack_notifications ?? settings?.campaign_updates);
        if (slackAllowed && (settings?.slack_webhook_url || process.env.SLACK_WEBHOOK_URL)) {
          await sendSourcingReplyNotification({
            campaignId: (campaignId ?? 'none') as any,
            leadId: (lead_id ?? 'none') as any,
            replyId: (replyRow as any)?.id || messageId,
            from: parsed.from || 'unknown@unknown.com',
            subject: parsed.subject || '(no subject)',
            classification: 'neutral',
            nextAction: 'reply',
            userId
          });
        }
      }
    } catch (e) {
      console.warn('[sendgrid/inbound] Slack notify skipped', (e as any)?.message || e);
    }

    // Forward reply to user's inbox
    try {
      let recipients: string[] = [];
      let msgMeta: any = null;
      try {
        const r = await computeRecipientsForMessage(messageId);
        recipients = r.recipients;
        msgMeta = r.msg;
      } catch (e) {
        console.warn('[sendgrid/inbound] computeRecipientsForMessage failed, falling back to user primary:', e);
        recipients = await computeForwardRecipients(userId);
      }

      if (recipients.length > 0) {
        console.log(`[sendgrid/inbound] Forwarding reply to ${recipients.length} recipients`);
        
        // Use parsed attachments from MIME data, fallback to multipart files
        let attachments = parsed.attachments;
        if (attachments.length === 0 && req.files) {
          attachments = (req.files as any[]).map((file: any) => ({
            content: file.buffer ? file.buffer.toString('base64') : '',
            filename: file.originalname || file.filename || 'attachment',
            type: file.mimetype || 'application/octet-stream'
          }));
        }

        await forwardReply({
          recipients,
          originalFrom: parsed.from || 'unknown@unknown.com',
          originalSubject: parsed.subject || '(no subject)',
          textBody: parsed.text,
          htmlBody: parsed.html,
          messageId,
          campaignId,
          userId,
          attachments,
          headers: {
            'In-Reply-To': msgMeta?.message_id_header || '',
            'References': msgMeta?.message_id_header || '',
            'X-HirePilot-Forwarded': 'true'
          }
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


