import axios from 'axios';
import crypto from 'crypto';
import { supabaseDb } from './supabase';

interface WebhookPayload {
  event: string;
  data: any;
  timestamp: number;
}

/**
 * Send POST requests to all registered webhooks for the given user & event.
 * The request is signed with an HMAC SHA256 header `X-HirePilot-Signature`.
 */
export async function emitWebhook(userId: string, event: string, data: any) {
  try {
    // Fetch matching webhooks
    const { data: hooks, error } = await supabaseDb
      .from('webhooks')
      .select('*')
      .eq('user_id', userId)
      .eq('event', event);

    if (error) {
      console.error('[webhookEmitter] fetch error', error);
      return;
    }

    if (!hooks || hooks.length === 0) return;

    const payload: WebhookPayload = {
      event,
      data,
      timestamp: Date.now(),
    };
    const body = JSON.stringify(payload);

    await Promise.all(
      hooks.map(async (hook: any) => {
        try {
          const signature = crypto
            .createHmac('sha256', hook.secret)
            .update(body)
            .digest('hex');

          await axios.post(hook.url, body, {
            headers: {
              'Content-Type': 'application/json',
              'X-HirePilot-Signature': signature,
            },
            timeout: 5000,
          });
        } catch (err) {
          console.error('[webhookEmitter] error posting to', hook.url, err?.message || err);
        }
      })
    );
  } catch (err) {
    console.error('[webhookEmitter] unexpected', err);
  }
} 