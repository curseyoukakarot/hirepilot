import sg from '@sendgrid/mail';
import { supabase as db } from '../lib/supabase';

/**
 * SendGrid email sender that prefers the user's own API key and default sender.
 * Falls back to global SENDGRID_API_KEY and SENDGRID_FROM when user-specific
 * credentials are not available.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  headers?: Record<string, string>,
  opts?: { userId?: string }
) {
  let fromEmail: string | undefined = process.env.SENDGRID_FROM;
  let apiKey: string | undefined = process.env.SENDGRID_API_KEY;

  // Attempt to resolve per-user credentials
  if (opts?.userId) {
    try {
      const { data: keyRow } = await db
        .from('user_sendgrid_keys')
        .select('api_key, default_sender')
        .eq('user_id', opts.userId)
        .maybeSingle();
      if (keyRow?.api_key) apiKey = keyRow.api_key as string;
      if (keyRow?.default_sender) fromEmail = keyRow.default_sender as string;
    } catch {}
  }

  if (!apiKey) throw new Error('SendGrid API key not configured');
  if (!fromEmail) throw new Error('SendGrid From email not configured');

  sg.setApiKey(apiKey);
  await sg.send({ from: fromEmail, to, subject, html, headers });
}
