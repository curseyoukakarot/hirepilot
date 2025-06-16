import express from 'express';
import { getUserTokens } from '../utils/userHelpers'; // ← helper you set up earlier
import nodemailer from 'nodemailer';
import { supabase } from '../lib/supabase';
import { getGoogleAccessToken } from '../services/googleTokenHelper';
import { google } from 'googleapis';

const router = express.Router();

router.post('/sendEmail', async (req, res) => {
  const { userId, to, subject, html, provider } = req.body;

  try {
    if (provider === 'google') {
      // Use Gmail API directly with auto-retry on 401
      const trySend = async (retry = false) => {
        const accessToken = await getGoogleAccessToken(userId);
        // Fetch expires_at for debug
        const { data: acc } = await supabase
          .from('google_accounts')
          .select('expires_at')
          .eq('user_id', userId)
          .single();
        console.log('DEBUG: About to send with access_token:', accessToken);
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
        try {
          await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw },
          });
        } catch (err) {
          console.error('DEBUG: Gmail send 401 or error:', err);
          if (err instanceof Error && 'code' in err) {
            if ((err as any).code === 401) {
              // force refresh by zeroing expires_at
              await supabase.from('google_accounts')
                .update({ expires_at: new Date(0).toISOString() })
                .eq('user_id', userId);
              return trySend(true); // retry exactly once
            }
          }
          throw err;
        }
      };
      await trySend();
      res.status(200).json({ success: true, message: '✅ Email sent!' });
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
