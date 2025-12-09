import crypto from 'crypto';
import type express from 'express';
import { supabase } from '../src/lib/supabase';
import { sendMessageToWidget } from '../src/lib/widgetBridge';
import { WebClient } from '@slack/web-api';
import { storeTeamReply } from '../src/routes/slackService';

function verifySlackSignatureAny(req: express.Request, secrets: string[]): boolean {
  const timestamp = req.headers['x-slack-request-timestamp'] as string | undefined;
  const signature = req.headers['x-slack-signature'] as string | undefined;
  if (!timestamp || !signature) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 60 * 5) return false;
  const rawBody: Buffer | string = (req as any).rawBody || (req as any).bodyRaw || (req as any).body;
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody || {});
  const base = `v0:${timestamp}:${body}`;
  for (const s of secrets) {
    if (!s) continue;
    try {
      const hmac = crypto.createHmac('sha256', s).update(base).digest('hex');
      const expected = `v0=${hmac}`;
      if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return true;
    } catch {}
  }
  return false;
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

    // Parse body early so we can respond to Slack URL verification before signature checks
    let payload: any = undefined;
    try {
      payload = JSON.parse(rawBuf.toString('utf8'));
    } catch (e) {
      console.error('[slack-events] parse error', e);
      res.status(400).send('parse error');
      return;
    }
    console.log('[slack-events] parsed payload', payload);

    // Slack URL verification: respond with plain challenge string
    if (payload?.type === 'url_verification') {
      res.status(200).send(payload.challenge || '');
      return;
    }

    // From here on, verify signatures for real events
    const multi = (process.env.SLACK_SIGNING_SECRETS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (process.env.SLACK_SIGNING_SECRET) multi.push(process.env.SLACK_SIGNING_SECRET);
    const secrets = Array.from(new Set(multi));
    if (!secrets.length) {
      res.status(500).send('SLACK_SIGNING_SECRET not set');
      return;
    }
    const timestamp = req.headers['x-slack-request-timestamp'] as string | undefined;
    const signature = req.headers['x-slack-signature'] as string | undefined;
    if (!timestamp || !signature) {
      res.status(400).send('missing headers');
      return;
    }
    if (!verifySlackSignatureAny(req, secrets)) {
      console.warn('[slack-events] signature mismatch', { provided: signature });
      res.status(400).send('bad signature');
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
          const botToken = process.env.SLACK_BOT_TOKEN || process.env.OFFR_WEBSITE_CHAT_SLACK_BOT_TOKEN;
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
          .select('id, widget_session_id, user_name, human_engaged_at, rex_disabled')
          .eq('slack_channel_id', channel)
          .eq('slack_thread_ts', thread)
          .maybeSingle();

        let widgetIdFromParent: string | null = null;

        // Fallback mapping by parsing parent message
        const botTokenForHistory = process.env.SLACK_BOT_TOKEN || process.env.OFFR_WEBSITE_CHAT_SLACK_BOT_TOKEN;
        if (!session && botTokenForHistory) {
          try {
            const slack = new WebClient(botTokenForHistory);
            const { messages } = await slack.conversations.history({ channel, latest: thread, inclusive: true, limit: 1 });
            const parent = (messages?.[0]?.text || '') as string;
            const m = parent.match(/Session:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
            const widgetId = m?.[1] || null;
            if (widgetId) {
              widgetIdFromParent = widgetId;
              // Ensure mapping without relying on unique constraint
              const { data: byWidget } = await supabase
                .from('rex_live_sessions')
                .select('id')
                .eq('widget_session_id', widgetId)
                .maybeSingle();
              if (byWidget?.id) {
                await supabase.from('rex_live_sessions').update({ slack_channel_id: channel, slack_thread_ts: thread }).eq('id', byWidget.id);
              } else {
                const { data: byThread } = await supabase
                  .from('rex_live_sessions')
                  .select('id')
                  .eq('slack_channel_id', channel)
                  .eq('slack_thread_ts', thread)
                  .maybeSingle();
                if (byThread?.id) {
                  await supabase.from('rex_live_sessions').update({ widget_session_id: widgetId }).eq('id', byThread.id);
                } else {
                  await supabase.from('rex_live_sessions').insert({ widget_session_id: widgetId, slack_channel_id: channel, slack_thread_ts: thread });
                }
              }
              console.log('[slack-events] ensured mapping for session', widgetId);
              session = { id: null, widget_session_id: widgetId, user_name: null } as any;
            }
          } catch (e) {
            console.error('[slack-events] fallback mapping error', e);
          }
        }

        // Manual overrides via text commands in thread: rex-off / rex-on
        try {
          const cmdMatch = /\brex[-_ ]?(off|on)\b/i.exec(text);
          if (cmdMatch) {
            const disable = cmdMatch[1].toLowerCase() === 'off';
            await supabase
              .from('rex_live_sessions')
              .update({ rex_disabled: disable })
              .eq('slack_channel_id', channel)
              .eq('slack_thread_ts', thread);
            console.log('[slack-events] rex manual toggle', { disable });
            // Acknowledge in thread
            try {
              const botToken = process.env.SLACK_BOT_TOKEN;
              if (botToken) {
                const slack = new WebClient(botToken);
                await slack.chat.postMessage({ channel, thread_ts: thread, text: `REX ${disable ? 'disabled' : 'enabled'} for this thread.` });
              }
            } catch {}
          }
        } catch {}

        const widgetSessionId = session?.widget_session_id || widgetIdFromParent;

        if (widgetSessionId) {
          // Fetch user name (best-effort)
          let userName: string | null = null;
          try {
            const botToken = process.env.SLACK_BOT_TOKEN || process.env.OFFR_WEBSITE_CHAT_SLACK_BOT_TOKEN;
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
              .select('human_engaged_at, rex_disabled')
              .eq('widget_session_id', widgetSessionId)
              .maybeSingle();
            if (current && !current.human_engaged_at) {
              await supabase
                .from('rex_live_sessions')
                .update({ human_engaged_at: new Date().toISOString() })
                .eq('widget_session_id', widgetSessionId);
              console.log('[slack-events] marked engaged');
            } else if (current) {
              console.log('[slack-events] already engaged');
            }
          } catch {}

          // Bridge to legacy widget system (if present)
          await sendMessageToWidget(widgetSessionId, {
            from: 'human',
            name: userName,
            message: text,
            timestamp: new Date().toISOString(),
          });

          // ALSO store for the new live chat popup so polling displays team replies
          try {
            await storeTeamReply(widgetSessionId, text);
            console.log('[slack-events] storeTeamReply success', { widgetSessionId, textSnippet: String(text).slice(0, 80) });
          } catch (e) {
            console.error('[slack-events] storeTeamReply failed', e);
          }
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


