import crypto from 'crypto';
import type express from 'express';
import { supabase } from '../src/lib/supabase';
import { sendMessageToWidget } from '../src/lib/widgetBridge';
import { WebClient } from '@slack/web-api';

function verifySlackSignature(req: express.Request, signingSecret: string): boolean {
  const timestamp = req.headers['x-slack-request-timestamp'] as string | undefined;
  const signature = req.headers['x-slack-signature'] as string | undefined;
  if (!timestamp || !signature) return false;
  // Prevent replay (5 min window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 60 * 5) return false;

  const rawBody: Buffer | string = (req as any).rawBody || (req as any).bodyRaw || (req as any).body;
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody || {});
  const base = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', signingSecret).update(base).digest('hex');
  const expected = `v0=${hmac}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function slackEventsHandler(req: express.Request, res: express.Response) {
  try {
    const rawBuf: Buffer = Buffer.isBuffer((req as any).body)
      ? (req as any).body
      : Buffer.isBuffer((req as any).rawBody)
        ? (req as any).rawBody
        : Buffer.from(typeof (req as any).body === 'string' ? (req as any).body : JSON.stringify((req as any).body || {}), 'utf8');

    console.log('[slack-events] incoming request', {
      headers: req.headers,
      hasRaw: Buffer.isBuffer((req as any).body),
      bodyType: typeof (req as any).body,
      rawLen: rawBuf.length,
    });

    const secret = process.env.SLACK_SIGNING_SECRET;
    if (!secret) {
      res.status(500).send('SLACK_SIGNING_SECRET not set');
      return;
    }

    // Signature verification on raw body
    const timestamp = req.headers['x-slack-request-timestamp'] as string | undefined;
    const signature = req.headers['x-slack-signature'] as string | undefined;
    if (!timestamp || !signature) {
      res.status(400).send('missing headers');
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > 60 * 5) {
      res.status(400).send('stale');
      return;
    }
    const base = `v0:${timestamp}:${rawBuf.toString('utf8')}`;
    const expected = `v0=${crypto.createHmac('sha256', secret).update(base).digest('hex')}`;
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      console.warn('[slack-events] signature mismatch', { expected, provided: signature });
      res.status(400).send('bad signature');
      return;
    }

    // Parse after signature verification
    let payload: any = undefined;
    try {
      payload = JSON.parse(rawBuf.toString('utf8'));
    } catch (e) {
      console.error('[slack-events] parse error', e);
      res.status(400).send('parse error');
      return;
    }
    console.log('[slack-events] parsed payload', payload);

    // URL verification
    if (payload?.type === 'url_verification') {
      res.status(200).send(payload.challenge || '');
      return;
    }

    // Ack immediately
    res.status(200).json({ ok: true });

    // Process event callbacks
    if (payload?.type === 'event_callback') {
      const event = payload.event;
      if (!event) { console.log('[slack-events] no event in callback'); return; }
      console.log('[slack-events] event', event);

      if (event.type === 'message' && event.thread_ts) {
        const channel = event.channel as string;
        const thread = event.thread_ts as string;
        const text = String(event.text || '');

        // Skip bot self-messages
        try {
          const botToken = process.env.SLACK_BOT_TOKEN;
          if (botToken) {
            const slack = new WebClient(botToken);
            const auth = await slack.auth.test();
            if (event.user && auth?.user_id && event.user === auth.user_id) {
              console.log('[slack-events] skipping bot message');
              return;
            }
          }
        } catch {}

        // Lookup session mapping
        let { data: session } = await supabase
          .from('rex_live_sessions')
          .select('id, widget_session_id, user_name, human_engaged_at')
          .eq('slack_channel_id', channel)
          .eq('slack_thread_ts', thread)
          .maybeSingle();

        // Fallback mapping by parsing parent message
        if (!session && process.env.SLACK_BOT_TOKEN) {
          try {
            const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
            const { messages } = await slack.conversations.history({ channel, latest: thread, inclusive: true, limit: 1 });
            const parent = (messages?.[0]?.text || '') as string;
            const m = parent.match(/Session:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
            const widgetId = m?.[1] || null;
            if (widgetId) {
              const { error: upErr } = await supabase
                .from('rex_live_sessions')
                .upsert({ widget_session_id: widgetId, slack_channel_id: channel, slack_thread_ts: thread }, { onConflict: 'widget_session_id' });
              if (upErr) console.error('[slack-events] fallback upsert error', upErr);
              else console.log('[slack-events] fallback upsert session', widgetId);
              session = { id: null, widget_session_id: widgetId, user_name: null } as any;
            }
          } catch (e) {
            console.error('[slack-events] fallback mapping error', e);
          }
        }

        if (session?.widget_session_id) {
          // Fetch user name (best-effort)
          let userName: string | null = null;
          try {
            const botToken = process.env.SLACK_BOT_TOKEN;
            if (botToken && event.user) {
              const slack = new WebClient(botToken);
              const ui = await slack.users.info({ user: event.user });
              userName = (ui.user as any)?.real_name || (ui.user as any)?.name || null;
            }
          } catch {}

          // Mark human engaged if not already
          try {
            const { data: current } = await supabase
              .from('rex_live_sessions')
              .select('human_engaged_at')
              .eq('widget_session_id', session.widget_session_id)
              .maybeSingle();
            if (current && !current.human_engaged_at) {
              await supabase
                .from('rex_live_sessions')
                .update({ human_engaged_at: new Date().toISOString() })
                .eq('widget_session_id', session.widget_session_id);
              console.log('[slack-events] marked engaged');
            } else if (current) {
              console.log('[slack-events] already engaged');
            }
          } catch {}

          await sendMessageToWidget(session.widget_session_id, {
            from: 'human',
            name: userName,
            message: text,
            timestamp: new Date().toISOString(),
          });
          await supabase
            .from('rex_live_sessions')
            .update({ last_human_reply: new Date().toISOString() })
            .eq('slack_channel_id', channel)
            .eq('slack_thread_ts', thread);
        } else {
          console.warn('[slack-events] no session mapping found for thread', { channel, thread });
        }
      }
    }
  } catch (err) {
    console.error('[slack-events] error', err);
    try { res.status(500).json({ error: 'internal_error' }); } catch {}
  }
}

export default slackEventsHandler;


