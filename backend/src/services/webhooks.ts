import crypto from 'crypto';
import axios from 'axios';
import { supabaseDb } from '../lib/supabase';

export type WebhookEventPayload = {
  workspace_id: string | null;
  board_id?: string | null;
  actor_user_id?: string | null;
  source: 'ui' | 'api_key' | 'zapier' | 'make' | 'system';
  data?: Record<string, any>;
};

export async function emitWebhookEvent(
  userId: string,
  event: string,
  payload: WebhookEventPayload
) {
  const { data } = await supabaseDb
    .from('webhooks')
    .select('id,url,secret,event')
    .eq('user_id', userId)
    .eq('event', event);

  if (!data?.length) return;

  const body = JSON.stringify({
    event,
    ...payload,
  });

  await Promise.all(
    data.map(async (hook: any) => {
      const secret = String(hook.secret || '');
      const signature = secret
        ? crypto.createHmac('sha256', secret).update(body).digest('hex')
        : '';
      try {
        await axios.post(hook.url, body, {
          headers: {
            'Content-Type': 'application/json',
            ...(signature ? { 'x-hp-signature': signature } : {}),
          },
          timeout: 8000,
        });
      } catch (err: any) {
        console.warn('[webhooks] delivery failed', hook.id, err?.message || err);
      }
    })
  );
}
