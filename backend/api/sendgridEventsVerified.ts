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
    const publicKey = (process.env.SENDGRID_WEBHOOK_PUBLIC_KEY || process.env.SENDGRID_WEBHOOK_PUB_KEY || '').trim();

    const ew = new EventWebhook();
    const bodyBuffer = req.body as Buffer;

    let verified = false;
    if (signature && timestamp && publicKey) {
      try {
        const ecdsaPubKey = ew.convertPublicKeyToECDSA(publicKey);
        verified = ew.verifySignature(ecdsaPubKey, bodyBuffer, signature, timestamp);
        if (!verified) {
          console.warn('[sendgridEventsHandler] signature mismatch; falling back to unsigned processing');
        }
        // Optional replay guard (5 minutes) only when verification headers are present
        if (verified && Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
          console.warn('[sendgridEventsHandler] stale timestamp; proceeding for debugging purposes');
        }
      } catch (e) {
        console.warn('[sendgridEventsHandler] verification error; falling back to unsigned processing', e);
      }
    } else {
      console.warn('[sendgridEventsHandler] missing signature/public key; processing unsigned payload');
    }

    let parsed: any;
    try {
      if (Buffer.isBuffer(req.body)) {
        const raw = (req.body as Buffer).toString('utf8');
        parsed = raw ? JSON.parse(raw) : [];
      } else if (typeof req.body === 'string') {
        parsed = (req.body as string) ? JSON.parse(req.body as any) : [];
      } else {
        parsed = req.body || [];
      }
    } catch (e) {
      console.error('[sendgridEventsHandler] failed to parse body as JSON', e);
      res.status(400).send('invalid json');
      return;
    }

    const batch = Array.isArray(parsed) ? parsed : [parsed];

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
      const hpSourcingCampaignId = (custom_args as any)?.hp_sourcing_campaign_id || null;
      const hpSourcingLeadId = (custom_args as any)?.hp_sourcing_lead_id || null;
      const eventTimestamp = new Date((Number(ts) || Math.floor(Date.now() / 1000)) * 1000).toISOString();

      // Strip SendGrid suffix (e.g., ".filterdrecv") for matching against our stored message identifiers
      const strippedSgId = sg_message_id ? String(sg_message_id).split('.')[0] : null;
      const smtpIdAny: string | undefined = (ev['smtp-id'] || ev['smtp_id']) as any;
      const strippedSmtpId = smtpIdAny ? String(smtpIdAny).split('.')[0] : null;
      const resolvedMessageId = customMessageId || strippedSmtpId || strippedSgId || null;

      // Fallback attribution: if any ids are missing, try to resolve from messages by our stored identifiers
      if (!user_id || !campaign_id || !lead_id) {
        try {
          const ors: string[] = [];
          if (customMessageId) ors.push(`message_id.eq.${customMessageId}`);
          if (resolvedMessageId) ors.push(`message_id_header.eq.${resolvedMessageId}`);
          if (strippedSgId) ors.push(`sg_message_id.eq.${strippedSgId}`);
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

      // Final best-effort: match by recipient email to most recent message
      if ((!user_id || !campaign_id) && email) {
        try {
          const { data: msg2 } = await supabase
            .from('messages')
            .select('user_id,campaign_id,lead_id')
            .eq('to_email', email)
            .order('sent_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (msg2) {
            user_id = user_id || (msg2 as any).user_id || null;
            campaign_id = campaign_id || (msg2 as any).campaign_id || null;
            lead_id = lead_id || (msg2 as any).lead_id || null;
          }
        } catch {}
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

      const { error: upsertError } = await supabase
        .from('email_events')
        .upsert(row, { onConflict: 'sg_event_id' });
      if (upsertError) {
        console.error('[sendgridEventsHandler] upsert email_events failed:', upsertError);
      }

      // If this SendGrid event includes sourcing context, keep sourcing_leads state in sync for campaign stats.
      // Note: we do NOT write sourcing ids into email_events.campaign_id/lead_id (those FKs are for classic campaigns/leads).
      if (hpSourcingLeadId && (eventType === 'bounce' || eventType === 'dropped')) {
        try {
          await supabase
            .from('sourcing_leads')
            .update({ outreach_stage: 'bounced' })
            .eq('id', String(hpSourcingLeadId));
        } catch (e) {
          console.warn('[sendgridEventsHandler] failed to mark sourcing lead bounced', { hpSourcingCampaignId, hpSourcingLeadId, err: (e as any)?.message || e });
        }
      }

      // Update message flags/status for quick UI access (avoid referencing non-existent columns)
      if (eventType === 'delivered' || eventType === 'bounce' || eventType === 'dropped') {
        const status = eventType === 'delivered' ? 'delivered' : 'failed';
        if (customMessageId) {
          const { error: updErr } = await supabase.from('messages').update({ status }).eq('message_id', customMessageId);
          if (updErr) console.error('[sendgridEventsHandler] update messages status failed (message_id):', updErr);
        } else if (resolvedMessageId) {
          const { error: updErr } = await supabase.from('messages').update({ status }).eq('message_id_header', resolvedMessageId);
          if (updErr) console.error('[sendgridEventsHandler] update messages status failed (message_id_header):', updErr);
        } else if (strippedSgId) {
          const { error: updErr } = await supabase.from('messages').update({ status }).eq('sg_message_id', strippedSgId);
          if (updErr) console.error('[sendgridEventsHandler] update messages status failed (message_id_header):', updErr);
        }
      }

      if (eventType === 'open') {
        const update = { opened: true } as any;
        if (customMessageId) {
          const { error: updErr } = await supabase.from('messages').update(update).eq('message_id', customMessageId);
          if (updErr) console.error('[sendgridEventsHandler] set opened failed (message_id):', updErr);
        } else if (resolvedMessageId) {
          const { error: updErr } = await supabase.from('messages').update(update).eq('message_id_header', resolvedMessageId);
          if (updErr) console.error('[sendgridEventsHandler] set opened failed (message_id_header):', updErr);
        } else if (strippedSgId) {
          const { error: updErr } = await supabase.from('messages').update(update).eq('sg_message_id', strippedSgId);
          if (updErr) console.error('[sendgridEventsHandler] set opened failed (message_id_header):', updErr);
        }
      }

      if (eventType === 'click') {
        const update = { clicked: true } as any;
        if (customMessageId) {
          const { error: updErr } = await supabase.from('messages').update(update).eq('message_id', customMessageId);
          if (updErr) console.error('[sendgridEventsHandler] set clicked failed (message_id):', updErr);
        } else if (resolvedMessageId) {
          const { error: updErr } = await supabase.from('messages').update(update).eq('message_id_header', resolvedMessageId);
          if (updErr) console.error('[sendgridEventsHandler] set clicked failed (message_id_header):', updErr);
        } else if (strippedSgId) {
          const { error: updErr } = await supabase.from('messages').update(update).eq('sg_message_id', strippedSgId);
          if (updErr) console.error('[sendgridEventsHandler] set clicked failed (message_id_header):', updErr);
        }
      }

      // Immediate Slack notification on reply (optional based on env flag)
      if (eventType === 'reply' && (process.env.NOTIFY_SLACK_ON_REPLY || 'true') === 'true') {
        try {
          const { notifySlack } = await import('../lib/slack');
          const title = 'New reply';
          const camp = campaign_id ? `Campaign: ${campaign_id}` : 'Campaign: unknown';
          const lead = lead_id ? `Lead: ${lead_id}` : email ? `Lead: ${email}` : 'Lead: unknown';
          await notifySlack(`💬 ${title}\n${camp}\n${lead}`);
        } catch (e) {
          console.warn('[sendgridEventsHandler] slack notify on reply failed:', e);
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


