import express from 'express';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';
import { newReplyToken } from '../lib/replyToken';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

router.post('/sendgrid/send', async (req, res) => {
  const { user_id, to, subject, html } = req.body;

  if (!user_id || !to || !subject || !html) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    // 1. Get the user's SendGrid API key and default sender
    const { data, error } = await supabase
      .from('user_sendgrid_keys')
      .select('api_key, default_sender')
      .eq('user_id', user_id)
      .single();

    if (error || !data?.api_key) {
      console.error('SendGrid key lookup error:', error);
      res.status(400).json({ error: 'No SendGrid API key found for user' });
      return;
    }

    if (!data.default_sender) {
      res.status(400).json({ error: 'No default sender configured for user' });
      return;
    }

    // 2. Configure SendGrid
    sgMail.setApiKey(data.api_key);

    // 3. Prepare the email (tracking id used for correlation)
    const trackingMessageId = crypto.randomUUID();

    // 3a. Prepare reply routing via short token
    const token = newReplyToken();
    const domain = process.env.INBOUND_PARSE_DOMAIN || 'reply.thehirepilot.com';
    const shortReplyAddress = `reply+${token}@${domain}`;

    // 3b. Persist reply token mapping to messages (create minimal message row if needed)
    // Ensure a messages row exists to reference by id; if not, insert a stub and grab id
    let messageRowId: string | null = null;
    try {
      const { data: inserted, error: insertErr } = await supabase
        .from('messages')
        .insert({
          user_id,
          to_email: to,
          subject,
          content: html,
          status: 'queued',
          sent_at: new Date().toISOString()
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      messageRowId = inserted?.id || null;
    } catch (e) {
      console.error('[sendgrid/send] Failed to create stub message row for token mapping', e);
    }

    if (messageRowId) {
      try {
        const campaignId = req.body.campaign_id || null;
        await supabase
          .from('reply_tokens')
          .insert({ token, message_id: messageRowId, user_id, campaign_id: campaignId });
      } catch (e) {
        console.error('[sendgrid/send] Failed to insert reply_tokens mapping', e);
      }
    }

    // 3c. Generate RFC5322 Message-ID
    const sendDomain = process.env.SEND_DOMAIN || 'thehirepilot.com';
    const messageIdHeader = `<${crypto.randomBytes(16).toString('hex')}@${sendDomain}>`;
    const msg: any = {
      to,
      from: data.default_sender,
      subject,
      html,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      },
      customArgs: {
        user_id,
        campaign_id: req.body.campaign_id || null,
        lead_id: req.body.lead_id || null,
        message_id: trackingMessageId
      },
      // Use short token Reply-To for inbound routing
      replyTo: { email: shortReplyAddress, name: `${data.default_sender} (via HirePilot)` },
      headers: { 'Message-ID': messageIdHeader }
    };

    // 4. Send the email
    console.log('Sending email via SendGrid:', {
      to,
      from: data.default_sender,
      subject
    });

    const [response] = await sgMail.send(msg);
    console.log('SendGrid response:', response);

    // 5. Store or update the message in our database with identity/threading data
    // Resolve sender identity and from_email from configuration (default_sender)
    const fromEmail = data.default_sender;
    let senderIdentityId: string | null = null;
    try {
      const { data: identity } = await supabase
        .from('email_identities')
        .select('id')
        .eq('from_email', fromEmail)
        .maybeSingle();
      senderIdentityId = identity?.id || null;
    } catch {}

    if (messageRowId) {
      const { error: updErr } = await supabase
        .from('messages')
        .update({
          sg_message_id: response.headers['x-message-id'],
          status: 'sent',
          message_id_header: messageIdHeader,
          sender_identity_id: senderIdentityId,
          from_email: fromEmail
        })
        .eq('id', messageRowId);
      if (updErr) {
        console.error('[sendgrid/send] Failed to update messages row with headers/identity', updErr);
      }
    } else {
      const { error: dbError } = await supabase
        .from('messages')
        .insert({
          user_id,
          to_email: to,
          subject,
          content: html,
          sg_message_id: response.headers['x-message-id'],
          status: 'sent',
          sent_at: new Date().toISOString(),
          message_id_header: messageIdHeader,
          sender_identity_id: senderIdentityId,
          from_email: fromEmail
        });
      if (dbError) {
        console.error('Error storing message:', dbError);
      }
    }

    res.json({ 
      success: true, 
      message: 'Email sent successfully',
      message_id: response.headers['x-message-id']
    });

  } catch (err: any) {
    console.error('SendGrid send error:', err.response?.body || err);
    res.status(500).json({ 
      error: 'Failed to send email',
      details: err.response?.body || err.message
    });
  }
});

export default router; 