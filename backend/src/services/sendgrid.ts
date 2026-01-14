import sg from '@sendgrid/mail';
import { supabase as db } from '../lib/supabase';
import crypto from 'crypto';

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

  const getHeader = (k: string) => {
    if (!headers) return undefined;
    return headers[k] ?? headers[k.toLowerCase()] ?? undefined;
  };
  const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

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

  // Allow per-message override when provided (e.g. campaign sender rotation)
  const fromOverride = String(getHeader('X-From-Override') || '').trim();
  if (fromOverride && looksLikeEmail(fromOverride)) {
    fromEmail = fromOverride;
  }

  if (!apiKey) throw new Error('SendGrid API key not configured');
  if (!fromEmail) throw new Error('SendGrid From email not configured');

  sg.setApiKey(apiKey);

  // Centralized reply routing for attribution (shared convention across app)
  // Format: msg_<uuid>.u_<userId>.c_<campaignId|none>.l_<leadId|none>@<INBOUND_PARSE_DOMAIN>
  let replyTo: string | undefined = undefined;
  let customArgs: Record<string, any> | undefined = undefined;
  try {
    const userId = opts?.userId ? String(opts.userId) : '';
    const campaignId = String(getHeader('X-Campaign-Id') || '').trim();
    const leadId = String(getHeader('X-Lead-Id') || '').trim();
    const hasContext = !!userId && (!!campaignId || !!leadId);
    if (hasContext) {
      const domain = (process.env.INBOUND_PARSE_DOMAIN || 'reply.thehirepilot.com').trim();
      const trackingMessageId = crypto.randomUUID();
      replyTo = `msg_${trackingMessageId}.u_${userId}.c_${campaignId || 'none'}.l_${leadId || 'none'}@${domain}`;
      // Safe SendGrid event attribution: only set hp_user_id + message_id (avoid invalid FK writes for campaign/lead).
      customArgs = {
        message_id: trackingMessageId,
        hp_user_id: userId,
        hp_sourcing_campaign_id: campaignId || null,
        hp_sourcing_lead_id: leadId || null,
      };
    }
  } catch {}

  await sg.send({ from: fromEmail, to, subject, html, headers, replyTo, customArgs });
}
