import { supabaseDb } from '../lib/supabase';
import { getGoogleAccessToken } from './googleTokenHelper';
import { google } from 'googleapis';
import { personalizeMessage } from '../utils/messageUtils';
import { sendViaProvider } from './providerEmail';

interface Lead {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  [key: string]: any;
}

export async function sendEmail(
  lead: Lead,
  message: string,
  userId: string,
  explicitSubject?: string
): Promise<boolean> {
  // Ensure placeholders are replaced regardless of upstream processing.
  const templated = personalizeMessage(message, lead);
  // Prefer explicit subject when provided (from sequence builder/scheduler)
  let subject = explicitSubject && explicitSubject.trim().length > 0 ? explicitSubject.trim() : 'Message from HirePilot';
  // If no explicit subject was provided, attempt legacy parsing of first line
  if (!explicitSubject) {
    const lines = templated.split('\n');
    if (lines.length > 1 && lines[0].length < 100 && !lines[0].includes('<')) {
      subject = lines[0].trim();
      message = lines.slice(1).join('\n').trim();
    }
  }
  // Convert plain newlines to <br/> for HTML content
  const processedMessage = templated === message
    ? message.replace(/\n/g, '<br/>')
    : message.replace(/\n/g, '<br/>');
  
  try {
    // Prefer SendGrid if configured; else fall back to Google
    const { data: sg } = await supabaseDb
      .from('user_sendgrid_keys')
      .select('api_key, default_sender')
      .eq('user_id', userId)
      .maybeSingle();

    if (sg?.api_key && sg?.default_sender) {
      // Use the unified provider helper for SendGrid
      const ok = await sendViaProvider('sendgrid', lead as any, processedMessage, userId, subject);
      return ok;
    }

    // Google path (default fallback)
    {
      const accessToken = await getGoogleAccessToken(userId);
      const oauth2client = new google.auth.OAuth2();
      oauth2client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: oauth2client });
      const raw = Buffer.from(
        `To: ${lead.email}\r\n` +
        `Subject: ${subject}\r\n` +
        'Content-Type: text/html; charset=utf-8\r\n' +
        '\r\n' +
        processedMessage
      ).toString('base64url');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });

      return true;
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
} 