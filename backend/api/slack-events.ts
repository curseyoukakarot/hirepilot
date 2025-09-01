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
    console.log('[slack-events] incoming request', {
      headers: req.headers,
      hasRaw: typeof (req as any).rawBody === 'string',
      bodyType: typeof (req as any).body,
    });

    // Handle Slack URL verification (must respond immediately with the challenge)
    if (req.body && (req.body as any).type === 'url_verification') {
      const ch = (req.body as any).challenge;
      console.log('[slack-events] handling url_verification', { challenge: ch });
      res.status(200).json({ challenge: ch });
      return;
    }
    const secret = process.env.SLACK_SIGNING_SECRET;
    if (!secret) {
      res.status(500).send('SLACK_SIGNING_SECRET not set');
      return;
    }

    // Slack URL verification challenge
    if ((req.body as any)?.type === 'url_verification' && (req.body as any)?.challenge) {
      res.send((req.body as any).challenge);
      return;
    }

    if (!verifySlackSignature(req, secret)) {
      try {
        const timestamp = req.headers['x-slack-request-timestamp'] as string | '';
        const signature = req.headers['x-slack-signature'] as string | '';
        const rawBody: Buffer | string = (req as any).rawBody || (req as any).bodyRaw || (req as any).body || '';
        const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody || {});
        const base = `v0:${timestamp}:${body}`;
        const calc = require('crypto').createHmac('sha256', secret).update(base).digest('hex');
        console.warn('[slack-events] signature mismatch', { provided: signature, expected: `v0=${calc}` });
      } catch {}
      res.status(401).send('invalid signature');
      return;
    }

    const event = (req.body as any)?.event;
    try { console.log('[slack-events] event', JSON.stringify(event)); } catch {}
    if (!event) { res.status(200).json({ ok: true }); return; }

    // Only handle message events in threads, ignore bots
    if (event.type === 'message' && event.thread_ts && !event.subtype && event.user) {
      const thread = event.thread_ts as string;
      const channel = event.channel as string;
      const text = (event.text || '').toString();

      // Lookup live session by slack_thread_ts
      let { data: session, error } = await supabase
        .from('rex_live_sessions')
        .select('id, widget_session_id, user_name')
        .eq('slack_thread_ts', thread)
        .eq('slack_channel_id', channel)
        .maybeSingle();
      if (error) {
        console.error('[slack-events] session lookup error', error);
      }

      // Fallback: if no session mapping exists yet, try to resolve the widget_session_id by
      // reading the parent message (posted by our mirror or handoff) and parsing "Session: <uuid>"
      if (!session && process.env.SLACK_BOT_TOKEN) {
        try {
          const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
          const r = await slack.conversations.replies({ channel, ts: thread, limit: 1 });
          const starter = (r.messages || [])[0] as any;
          const parentText: string = (starter?.text || '').toString();
          const m = parentText.match(/Session:\s*([0-9a-fA-F-]{36})/);
          const widgetSessionId = m?.[1] || null;
          if (widgetSessionId) {
            await supabase
              .from('rex_live_sessions')
              .insert({ widget_session_id: widgetSessionId, slack_channel_id: channel, slack_thread_ts: thread })
              .select('id, widget_session_id')
              .single();
            const { data: sess2 } = await supabase
              .from('rex_live_sessions')
              .select('id, widget_session_id, user_name')
              .eq('slack_thread_ts', thread)
              .eq('slack_channel_id', channel)
              .maybeSingle();
            session = sess2 as any;
          }
        } catch (e) {
          console.error('[slack-events] fallback session resolution failed', e);
        }
      }

      if (session?.widget_session_id) {
        await sendMessageToWidget(session.widget_session_id, {
          from: 'human',
          name: session.user_name || null,
          message: text,
          timestamp: new Date().toISOString(),
        });
        // Update last_human_reply
        await supabase
          .from('rex_live_sessions')
          .update({ last_human_reply: new Date().toISOString() })
          .eq('id', session.id);
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[slack-events] error', err);
    res.status(500).json({ error: 'internal_error' });
  }
}

export default slackEventsHandler;


