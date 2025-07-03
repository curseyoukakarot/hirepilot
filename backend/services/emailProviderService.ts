import { supabaseDb } from '../lib/supabase';
import { getGoogleAccessToken } from './googleTokenHelper';
import { google } from 'googleapis';
import { personalizeMessage } from '../utils/messageUtils';

interface Lead {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  [key: string]: any;
}

export async function sendEmail(lead: Lead, message: string, userId: string): Promise<boolean> {
  // Ensure placeholders are replaced regardless of upstream processing.
  let processedMessage = personalizeMessage(message, lead);
  // Convert plain newlines to <br/> for HTML content
  processedMessage = processedMessage.replace(/\n/g, '<br/>');
  try {
    // Get user's email provider preference
    const { data: userData, error: userError } = await supabaseDb
      .from('users')
      .select('email_provider')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    const provider = userData?.email_provider || 'google';

    if (provider === 'google') {
      const accessToken = await getGoogleAccessToken(userId);
      const oauth2client = new google.auth.OAuth2();
      oauth2client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: oauth2client });

      const raw = Buffer.from(
        `To: ${lead.email}\r\n` +
        `Subject: ${processedMessage.split('\n')[0]}\r\n` + // Use first line as subject
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

    // Add support for other providers here
    return false;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
} 