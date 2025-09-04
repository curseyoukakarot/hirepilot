import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { EventWebhook } from '@sendgrid/eventwebhook';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function sendgridEventsHandler(req: express.Request, res: express.Response) {
  console.log('🔥 SendGrid Events Webhook HIT:', { 
    headers: req.headers, 
    bodySize: req.body?.length 
  });
  try {
    const signature = (req.headers['x-twilio-email-event-webhook-signature'] ?? '').toString();
    const timestamp = (req.headers['x-twilio-email-event-webhook-timestamp'] ?? '').toString();

    if (!signature || !timestamp) {
      res.status(400).send('missing headers');
      return;
    }

    const publicKey = (process.env.SENDGRID_WEBHOOK_PUBLIC_KEY || process.env.SENDGRID_WEBHOOK_PUB_KEY || '').trim();
    if (!publicKey) {
      res.status(500).send('missing public key');
      return;
    }

    const ew = new EventWebhook();
    const ecdsaPubKey = ew.convertPublicKeyToECDSA(publicKey);
    const bodyBuffer = req.body as Buffer;
    const verified = ew.verifySignature(ecdsaPubKey, bodyBuffer, signature, timestamp);
    if (!verified) {
      res.status(401).send('signature mismatch');
      return;
    }

    // Optional replay guard (5 minutes)
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
      res.status(400).send('stale timestamp');
      return;
    }

    const events = JSON.parse(bodyBuffer.toString('utf8'));
    const batch = Array.isArray(events) ? events : [events];

    for (const ev of batch) {
      const {
        email,
        event: eventType,
        sg_event_id,
        sg_message_id,
        timestamp: ts,
        ip,
        useragent,
        custom_args = {}
      } = ev || {};

      let { user_id, campaign_id, lead_id, message_id: customMessageId } = (custom_args as any) || {};
      const eventTimestamp = new Date((Number(ts) || Math.floor(Date.now() / 1000)) * 1000).toISOString();

      const resolvedMessageId = customMessageId || sg_message_id || ev['smtp-id'] || ev['smtp_id'] || null;

      // Fallback attribution: if any ids are missing, try to resolve from messages by sg_message_id or headers
      if (!user_id || !campaign_id || !lead_id) {
        try {
          const ors: string[] = [];
          if (sg_message_id) ors.push(`sg_message_id.eq.${sg_message_id}`);
          if (resolvedMessageId) ors.push(`message_id_header.eq.${resolvedMessageId}`);
          if (ors.length) {
            const { data: msg } = await supabase
              .from('messages')
              .select('user_id,campaign_id,lead_id')
              .or(ors.join(','))
              .limit(1)
              .maybeSingle();
            if (msg) {
              user_id = user_id || (msg as any).user_id || null;
              campaign_id = campaign_id || (msg as any).campaign_id || null;
              lead_id = lead_id || (msg as any).lead_id || null;
            }
          }
        } catch (e) {
          // best-effort; ignore
        }
      }

      // Idempotent upsert by sg_event_id where available; fallback to (sg_message_id, event, ts)
      const row: any = {
        user_id: user_id || null,
        campaign_id: campaign_id || null,
        lead_id: lead_id || null,
        provider: 'sendgrid',
        message_id: resolvedMessageId,
        sg_message_id: sg_message_id || null,
        sg_event_id: sg_event_id || `${sg_message_id || resolvedMessageId}:${eventType}:${ts}`,
        event_type: eventType,
        event_timestamp: eventTimestamp,
        metadata: {
          email,
          ip,
          user_agent: useragent,
          raw: ev
        }
      };

      await supabase
        .from('email_events')
        .upsert(row, { onConflict: 'sg_event_id' });

      // Update message flags/status for quick UI access
      if (eventType === 'delivered' || eventType === 'bounce' || eventType === 'dropped') {
        const status = eventType === 'delivered' ? 'delivered' : 'failed';
        if (sg_message_id) {
          await supabase.from('messages').update({ status }).eq('sg_message_id', sg_message_id);
        } else if (resolvedMessageId) {
          await supabase.from('messages').update({ status }).eq('message_id_header', resolvedMessageId);
        }
      }

      if (eventType === 'open') {
        const update = { opened: true } as any;
        if (sg_message_id) {
          await supabase.from('messages').update(update).eq('sg_message_id', sg_message_id);
        } else if (resolvedMessageId) {
          await supabase.from('messages').update(update).eq('message_id_header', resolvedMessageId);
        }
      }

      if (eventType === 'click') {
        const update = { clicked: true } as any;
        if (sg_message_id) {
          await supabase.from('messages').update(update).eq('sg_message_id', sg_message_id);
        } else if (resolvedMessageId) {
          await supabase.from('messages').update(update).eq('message_id_header', resolvedMessageId);
        }
      }
    }

    res.status(204).end();
  } catch (err) {
    console.error('[sendgridEventsHandler] error:', err);
    res.status(500).send('internal error');
  }
}

export default router;


