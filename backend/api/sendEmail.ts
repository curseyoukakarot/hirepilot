import express from 'express';
import { getUserTokens } from '../utils/userHelpers'; // ← helper you set up earlier
import nodemailer from 'nodemailer';
import { supabase, supabaseDb } from '../lib/supabase';
import { getGoogleAccessToken } from '../services/googleTokenHelper';
import { google } from 'googleapis';
import { GmailTrackingService } from '../services/gmailTrackingService';

const router = express.Router();

router.post('/sendEmail', async (req, res) => {
  const { userId, to, subject, html, provider } = req.body;

  try {
    if (provider === 'google') {
      // Send via Gmail using our tracking + Reply-To override path
      let meta;
      try {
        meta = await GmailTrackingService.sendEmailWithReplyMeta(
          userId,
          to,
          subject,
          html
        );
      } catch (primaryErr) {
        console.warn('[sendEmail:gmail] Primary send failed, attempting fallback without custom Reply-To', primaryErr);
        // Fallback path: try the legacy direct Gmail send and then proceed without mapping
        const trySend = async () => {
          const accessToken = await getGoogleAccessToken(userId);
          const { data: acc } = await supabase
            .from('google_accounts')
            .select('expires_at')
            .eq('user_id', userId)
            .single();
          console.log('DEBUG: Fallback send with access_token:', accessToken);
          console.log('DEBUG: Token expires_at:', acc?.expires_at);
          const oauth2client = new google.auth.OAuth2();
          oauth2client.setCredentials({ access_token: accessToken });
          const gmail = google.gmail({ version: 'v1', auth: oauth2client });
          const raw = Buffer.from(
            `To: ${to}\r\n` +
            `Subject: ${subject}\r\n` +
            'Content-Type: text/html; charset=utf-8\r\n' +
            '\r\n' +
            html
          ).toString('base64url');
          await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
        };
        await trySend();
        // synthesize minimal meta
        meta = {
          trackingMessageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          gmailMessageId: undefined,
          threadId: undefined,
          replyToken: undefined as unknown as string,
          replyToAddress: undefined as unknown as string,
          messageIdHeader: ''
        };
      }

      // Persist message row
      const now = new Date();
      const { data: messageRecord, error: insertError } = await supabaseDb
        .from('messages')
        .insert({
          user_id: userId,
          to_email: to,
          recipient: to,
          subject,
          content: html,
          provider: 'gmail',
          status: 'sent',
          sent_at: now.toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
          message_id: meta.trackingMessageId,
          message_id_header: meta.messageIdHeader,
          reply_to_override: meta.replyToAddress
        })
        .select()
        .single();

      if (insertError) {
        console.warn('[sendEmail:gmail] Failed to insert message row:', insertError);
      } else {
        // Map reply token to message id for inbound routing
        try {
          await supabaseDb.from('reply_tokens').insert({
            token: meta.replyToken,
            message_id: (messageRecord as any).id,
            user_id: userId,
            campaign_id: null
          });
        } catch (e) {
          console.warn('[sendEmail:gmail] Failed to insert reply_tokens mapping', e);
        }
        // Optional additional mapping table
        try {
          await supabaseDb.from('gmail_reply_mappings').insert({
            outbound_email_id: (messageRecord as any).id,
            gmail_message_id: meta.gmailMessageId || null,
            unique_reply_token: meta.replyToken,
            reply_to_address: meta.replyToAddress
          });
        } catch {}
      }

      res.status(200).json({ success: true, message: '✅ Email sent!', meta });
      return;
    }
    // Fallback: other providers (e.g., Outlook, SendGrid) can use nodemailer or their SDKs
    // ... existing code for other providers ...
    res.status(400).json({ error: 'Unsupported provider' });
    return;
  } catch (error) {
    console.error('❌ Email send error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

export default router;
