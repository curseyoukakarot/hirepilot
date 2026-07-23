import express, { Request, Response } from 'express';
import { z } from 'zod';
import OpenAI from 'openai';
import crypto from 'crypto';
import { WebClient } from '@slack/web-api';
import { supabase } from '../lib/supabase';
import { notifyIgniteLeadSlack } from '../../routes/igniteIntake';

/**
 * ignite-bot — the IgniteGTM website assistant (www.ignitegtm.com).
 * Same architecture as the Offr Group widget: AI tab + Slack-bridged live chat.
 * Knowledge lives in the ignite_bot_knowledge table (service-role only) and is
 * composed into the system prompt on every conversation — edit rows in
 * Supabase to update the bot, no deploy needed.
 */

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IGNITE_CALENDLY = process.env.IGNITE_CALENDLY_URL || 'https://calendly.com/ignitegtm/meeting-30m-with-bill-barry';

const CHAT_CHANNEL = process.env.IGNITE_SLACK_CHANNEL_CHAT || '#ignite-website-chat';
const BOT_TOKEN = () => process.env.IGNITE_SLACK_BOT_TOKEN || '';

const MASTER_PROMPT = [
  'You are ignite-bot, the IgniteGTM website assistant on www.ignitegtm.com.',
  'IgniteGTM is the AI-infrastructure events, media, and GTM agency behind the AI INFRA SUMMIT. Voice: sharp, confident, human — short paragraphs, no hype, no buzzwords. "Charged with intent."',
  'Goals: answer questions about IgniteGTM events (AI INFRA SUMMIT, NeoCloud Summit, activations), Ignite Studio, and GTM Advisory using ONLY the knowledge base below; recommend the right next step; capture lead details when a visitor wants sponsorship, speaking, invites, studio work, or advisory; and connect to a human when asked.',
  'HARD RULES:',
  '- NEVER discuss pricing, fees, tiers with dollar amounts, or budgets for anything. Every client engagement is scoped individually. When pricing comes up (especially event sponsorship): collect first name, last name, email, and company via ignite_capture_lead with prospectus_request=true and the event name in interest_area, then say the team will send the appropriate prospectus and walk them through options.',
  '- Never share or offer prospectus documents, files, or links — the team sends those directly.',
  '- Stay grounded in the knowledge base. If something is not in it, say you are not certain and offer the intro call — never invent dates, names, or details.',
  '- Use ignite_route_livechat_message when the visitor asks for a human, is a high-value prospect (sponsor, enterprise buyer, press), or is frustrated.',
  'Lead capture: politely collect first name, last name, work email, and company (plus what they are interested in) before calling ignite_capture_lead. After capture, offer the Calendly link for a 30-minute intro call with Bill Barry.',
  'Keep answers concise and concrete. Offer the right intake form URL when it is the natural next step.',
].join(' ');

// ── knowledge base, cached for 60s ──────────────────────────────────────────
let kbCache: { text: string; at: number } | null = null;

async function loadKnowledge(): Promise<string> {
  if (kbCache && Date.now() - kbCache.at < 60_000) return kbCache.text;
  try {
    const { data, error } = await supabase
      .from('ignite_bot_knowledge')
      .select('topic,title,content')
      .eq('active', true)
      .order('priority', { ascending: true });
    if (error) throw error;
    const text = (data || [])
      .map((r: any) => `## ${r.title} [${r.topic}]\n${r.content}`)
      .join('\n\n');
    kbCache = { text, at: Date.now() };
    return text;
  } catch (err: any) {
    console.error('[ignite-bot] knowledge load failed:', err?.message || err);
    return kbCache?.text || '';
  }
}

function ensureSessionId(candidate?: string | null): string {
  if (candidate && uuidRegex.test(candidate)) return candidate;
  try { return crypto.randomUUID(); } catch { return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
}

async function saveWidgetMessage(sessionId: string, role: 'user' | 'assistant', text: string) {
  try {
    if (!sessionId || !text) return;
    await supabase.from('rex_widget_messages').insert({ session_id: sessionId, role, text });
  } catch (err: any) {
    console.error('[ignite-bot/messages] insert failed', err?.message || err);
  }
}

async function postToChatChannel(text: string, threadTs?: string | null): Promise<{ ts: string; channel: string } | null> {
  // Never throws — a Slack hiccup must not break the visitor's chat.
  try {
    const token = BOT_TOKEN();
    if (!token || !CHAT_CHANNEL) {
      console.error('[ignite-bot] slack not configured (IGNITE_SLACK_BOT_TOKEN missing)');
      return null;
    }
    const slack = new WebClient(token);
    const args: any = { channel: CHAT_CHANNEL, text, unfurl_links: false, unfurl_media: false };
    if (threadTs) args.thread_ts = threadTs;
    const unpack = (posted: any) =>
      posted?.ts ? { ts: posted.ts as string, channel: (posted.channel as string) || CHAT_CHANNEL } : null;
    try {
      return unpack(await slack.chat.postMessage(args));
    } catch (err: any) {
      if (err?.data?.error === 'not_in_channel') {
        // conversations.join needs a channel ID; if CHAT_CHANNEL is a #name this
        // throws — invite @ignite-bot to the channel instead. Non-fatal either way.
        await slack.conversations.join({ channel: CHAT_CHANNEL });
        return unpack(await slack.chat.postMessage(args));
      }
      throw err;
    }
  } catch (err: any) {
    console.error('[ignite-bot] slack post failed', err?.data?.error || err?.message || err);
    return null;
  }
}

// ── lead capture → ignite_intake (form: chatbot) + Slack ────────────────────
async function handleLeadCapture(args: any, pageUrl: string | null, sessionId: string) {
  const missing = ['first_name', 'email'].filter(k => !args?.[k]);
  if (missing.length) {
    return {
      status: 'validation_error',
      confirmation_message: `Missing required fields: ${missing.join(', ')}.`,
      calendly_link: IGNITE_CALENDLY,
      should_open_calendly: false,
    };
  }
  const interests = [args.interest_area].filter(Boolean).map(String);
  const notes = [
    args.prospectus_request ? `REQUESTED PROSPECTUS${args.interest_area ? ` (${args.interest_area})` : ''}` : null,
    args.question ? `Question: ${String(args.question).slice(0, 400)}` : null,
    `via ignite-bot session ${sessionId}`,
  ].filter(Boolean).join(' | ');

  const { error } = await supabase.from('ignite_intake').insert({
    form: 'chatbot',
    first_name: String(args.first_name).slice(0, 120),
    last_name: args.last_name ? String(args.last_name).slice(0, 120) : null,
    email: String(args.email).slice(0, 200),
    company: args.company ? String(args.company).slice(0, 200) : null,
    interests,
    source: pageUrl || 'ignite-bot',
    notes,
  });
  if (error) throw error;

  void notifyIgniteLeadSlack('chatbot', {
    first_name: args.first_name,
    last_name: args.last_name,
    email: args.email,
    company: args.company,
    interests,
    source: pageUrl,
    notes,
  });

  return {
    status: 'success',
    confirmation_message: args.prospectus_request
      ? 'Got it — the team will send over the prospectus and follow up directly. Want to grab time with Bill now?'
      : 'Got it — your details are with the IgniteGTM team. Want to grab time with Bill now?',
    calendly_link: IGNITE_CALENDLY,
    should_open_calendly: true,
  };
}

// ── live chat routing → #ignite-website-chat (threaded per session) ─────────
async function routeLivechatMessage(input: {
  session_id: string;
  message_text: string;
  visitor_context?: { first_name?: string; last_name?: string; email?: string; page_url?: string };
}) {
  const sessionId = ensureSessionId(input.session_id);
  const name = [input.visitor_context?.first_name, input.visitor_context?.last_name].filter(Boolean).join(' ').trim() || 'Visitor';
  const email = input.visitor_context?.email;
  const page = input.visitor_context?.page_url || '-';

  let threadTs: string | null = null;
  try {
    const { data: live } = await supabase
      .from('rex_live_sessions')
      .select('slack_channel_id, slack_thread_ts')
      .eq('widget_session_id', sessionId)
      .maybeSingle();
    if (live?.slack_thread_ts) threadTs = live.slack_thread_ts;
  } catch {}

  const textLines = [
    `IgniteGTM website chat (Session: ${sessionId})`,
    `From: ${name}${email ? ` <${email}>` : ''}`,
    `Page: ${page}`,
    '',
    input.message_text,
  ].join('\n');

  const posted = await postToChatChannel(textLines, threadTs);
  if (posted) {
    const activeThread = threadTs || posted.ts;
    try {
      // store the resolved channel ID (Slack reply events carry the ID, not the
      // #name). Manual upsert: rex_live_sessions has no unique constraint on
      // widget_session_id, so .upsert(onConflict) errors with 42P10.
      const row = {
        widget_session_id: sessionId,
        slack_channel_id: posted.channel,
        slack_thread_ts: activeThread,
        user_name: name || null,
        user_email: email || null,
      };
      const { data: existing } = await supabase
        .from('rex_live_sessions')
        .select('id')
        .eq('widget_session_id', sessionId)
        .maybeSingle();
      const { error: saveErr } = existing?.id
        ? await supabase.from('rex_live_sessions').update(row).eq('id', existing.id)
        : await supabase.from('rex_live_sessions').insert(row);
      if (saveErr) console.error('[ignite-bot/livechat] session save failed', saveErr.message);
    } catch (insErr) {
      console.error('[ignite-bot/livechat] session save threw', insErr);
    }
  }

  try {
    await supabase.from('live_chat_messages').insert({
      session_id: sessionId,
      sender: 'visitor',
      text: input.message_text,
      name,
      email: email || null,
    });
  } catch {}

  return {
    status: 'delivered',
    display_message: 'Got it — someone from the IgniteGTM team will reply right here shortly.',
  };
}

// ── AI chat endpoint ─────────────────────────────────────────────────────────
router.post('/public-chat/ignite', async (req: Request, res: Response) => {
  const schema = z.object({
    message: z.string().min(1),
    session_id: z.string().optional(),
    page_url: z.string().optional(),
    history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string() })).max(20).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.issues });
    return;
  }

  const sessionId = ensureSessionId(parsed.data.session_id);
  const userMessage = parsed.data.message;
  await saveWidgetMessage(sessionId, 'user', userMessage);

  const knowledge = await loadKnowledge();
  const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: `${MASTER_PROMPT}\n\n=== IGNITEGTM KNOWLEDGE BASE (authoritative — answer from this) ===\n\n${knowledge}` },
  ];
  (parsed.data.history || []).forEach(m => baseMessages.push({ role: m.role, content: m.text }));
  baseMessages.push({ role: 'user', content: userMessage });

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'ignite_capture_lead',
        description: 'Capture an IgniteGTM lead (sponsorship, speaking, invites, studio, advisory, prospectus requests). Returns the Calendly link.',
        parameters: {
          type: 'object',
          properties: {
            first_name: { type: 'string' },
            last_name: { type: 'string', nullable: true },
            email: { type: 'string' },
            company: { type: 'string', nullable: true },
            interest_area: { type: 'string', enum: ['AI INFRA SUMMIT', 'NeoCloud Summit', 'Events - other', 'Studio', 'Advisory', 'General'], nullable: true },
            prospectus_request: { type: 'boolean', nullable: true, description: 'true when they asked about sponsorship pricing/packages and the team should send the prospectus' },
            question: { type: 'string', nullable: true, description: 'What they asked or want, in their words' },
          },
          required: ['first_name', 'email'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ignite_route_livechat_message',
        description: 'Escalate to a human — posts the message into the IgniteGTM team Slack. Use when the visitor asks for a person or is high-value.',
        parameters: {
          type: 'object',
          properties: {
            message_text: { type: 'string' },
            visitor_context: {
              type: 'object',
              properties: {
                first_name: { type: 'string', nullable: true },
                last_name: { type: 'string', nullable: true },
                email: { type: 'string', nullable: true },
                page_url: { type: 'string', nullable: true },
              },
              required: [],
            },
          },
          required: ['message_text'],
        },
      },
    },
  ];

  try {
    let first = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: baseMessages,
      tools,
      tool_choice: 'auto',
    });

    let assistantMessage = first.choices?.[0]?.message;
    const toolCalls = assistantMessage?.tool_calls || [];
    const toolResults: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (toolCalls.length) {
      for (const call of toolCalls) {
        const name = call.function?.name;
        let args: any = {};
        try { args = call.function?.arguments ? JSON.parse(call.function.arguments) : {}; } catch {}
        let result: any = { status: 'error', message: 'Unhandled tool' };
        if (name === 'ignite_capture_lead') {
          result = await handleLeadCapture(args, parsed.data.page_url || null, sessionId);
        } else if (name === 'ignite_route_livechat_message') {
          result = await routeLivechatMessage({
            session_id: sessionId,
            message_text: args.message_text,
            visitor_context: { ...(args.visitor_context || {}), page_url: args.visitor_context?.page_url || parsed.data.page_url },
          });
        }
        toolResults.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }

      const followUp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [...baseMessages, assistantMessage as any, ...toolResults],
      });
      assistantMessage = followUp.choices?.[0]?.message;
    }

    const finalText = assistantMessage?.content || 'Thanks — how can IgniteGTM help?';
    const captureLead = toolCalls.some(c => c.function?.name === 'ignite_capture_lead');
    await saveWidgetMessage(sessionId, 'assistant', finalText);

    res.json({
      response: finalText,
      session_id: sessionId,
      capture_lead: captureLead,
      calendly_link: captureLead ? IGNITE_CALENDLY : undefined,
    });
  } catch (err: any) {
    console.error('[ignite-bot/public-chat] error', err?.message || err);
    res.status(500).json({ error: 'internal_error', message: 'Sorry, I had trouble answering. Please try again.' });
  }
});

// ── widget lead form ─────────────────────────────────────────────────────────
router.post('/public-leads/ignite', async (req: Request, res: Response) => {
  const schema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    company: z.string().optional(),
    interestedIn: z.string().optional(),
    session_id: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'invalid_input', details: parsed.error.issues }); return; }
  const body = parsed.data;
  const sessionId = ensureSessionId(body.session_id);
  if (!body.firstName || !body.email) {
    res.status(400).json({ error: 'missing_required', message: 'First name and email are required.' });
    return;
  }
  try {
    const result = await handleLeadCapture({
      first_name: body.firstName,
      last_name: body.lastName,
      email: body.email,
      company: body.company,
      interest_area: 'General',
      question: body.interestedIn,
    }, null, sessionId);
    res.json({ ok: true, lead: result });
  } catch (err: any) {
    console.error('[ignite-bot/public-leads] error', err?.message || err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── live chat: visitor message in ────────────────────────────────────────────
router.post('/ignite-livechat/messages', async (req: Request, res: Response) => {
  const schema = z.object({
    message: z.string().min(1),
    session_id: z.string().optional(),
    page_url: z.string().optional(),
    visitor: z.object({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().optional(),
    }).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'invalid_input', details: parsed.error.issues }); return; }
  const sessionId = ensureSessionId(parsed.data.session_id);
  try {
    const routed = await routeLivechatMessage({
      session_id: sessionId,
      message_text: parsed.data.message,
      visitor_context: { ...(parsed.data.visitor || {}), page_url: parsed.data.page_url },
    });
    res.json({ response: routed.display_message, session_id: sessionId });
  } catch (err: any) {
    console.error('[ignite-bot/livechat] error', err?.message || err);
    res.status(500).json({ error: 'internal_error', message: 'Could not send message. Please try again.' });
  }
});

// ── live chat: poll for team replies ─────────────────────────────────────────
router.get('/ignite-livechat/messages', async (req: Request, res: Response) => {
  try {
    const sessionId = String((req.query?.session_id || '')).trim();
    if (!sessionId) { res.status(400).json({ error: 'invalid_input', message: 'session_id required' }); return; }
    const { data, error } = await supabase
      .from('live_chat_messages')
      .select('id,created_at,text,sender,name')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(30);
    if (error) throw error;
    res.json({ messages: data || [] });
  } catch (err: any) {
    console.error('[ignite-bot/livechat][get] error', err?.message || err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── temporary diagnostics for the live-chat bridge ───────────────────────────
router.get('/ignite-bot/diag', async (_req: Request, res: Response) => {
  const out: any = {
    env: {
      igniteToken: !!process.env.IGNITE_SLACK_BOT_TOKEN,
      chatChannel: CHAT_CHANNEL,
      signingSecretsCount: (process.env.SLACK_SIGNING_SECRETS || '').split(',').map(s => s.trim()).filter(Boolean).length,
    },
  };
  const DIAG_ID = '00000000-0000-4000-8000-00000000d1a6';
  try {
    const { error } = await supabase.from('live_chat_messages')
      .insert({ session_id: DIAG_ID, sender: 'visitor', text: 'diag', name: 'diag', email: null });
    out.lcm_insert = error ? `${error.code || ''} ${error.message}` : 'ok';
  } catch (e: any) { out.lcm_insert = 'threw: ' + (e?.message || e); }
  try {
    const { data, error } = await supabase.from('live_chat_messages')
      .select('id,sender,text').eq('session_id', DIAG_ID).limit(3);
    out.lcm_select = error ? `${error.code || ''} ${error.message}` : (data || []);
  } catch (e: any) { out.lcm_select = 'threw: ' + (e?.message || e); }
  try {
    const row = { widget_session_id: DIAG_ID, slack_channel_id: 'DIAG', slack_thread_ts: '0.0' };
    const { data: existing } = await supabase.from('rex_live_sessions')
      .select('id').eq('widget_session_id', DIAG_ID).maybeSingle();
    const { error } = existing?.id
      ? await supabase.from('rex_live_sessions').update(row).eq('id', existing.id)
      : await supabase.from('rex_live_sessions').insert(row);
    out.rls_upsert = error ? `${error.code || ''} ${error.message}` : 'ok (manual upsert)';
  } catch (e: any) { out.rls_upsert = 'threw: ' + (e?.message || e); }
  try {
    const { data, error } = await supabase.from('rex_live_sessions')
      .select('widget_session_id,slack_channel_id,slack_thread_ts')
      .eq('widget_session_id', '33333333-3333-4333-8333-333333333333').maybeSingle();
    out.session_e2e = error ? `${error.code || ''} ${error.message}` : (data || 'no row');
  } catch (e: any) { out.session_e2e = 'threw: ' + (e?.message || e); }
  try {
    const token = BOT_TOKEN();
    if (!token) { out.slack = { ok: false, reason: 'IGNITE_SLACK_BOT_TOKEN not set' }; }
    else {
      const slack = new WebClient(token);
      const a: any = await slack.auth.test();
      out.slack = { ok: true, team: a.team, botUser: a.user };
    }
  } catch (e: any) { out.slack = { ok: false, error: e?.data?.error || e?.message }; }
  res.json(out);
});

// ── open-widget ping (no DB writes) ──────────────────────────────────────────
router.post('/ignite-bot/chat-open', async (req: Request, res: Response) => {
  try {
    const sessionId = ensureSessionId((req.body as any)?.session_id);
    const pageUrl = (req.body as any)?.page_url || '';
    const text = [
      `IgniteGTM widget opened (Session: ${sessionId})`,
      pageUrl ? `Page: ${pageUrl}` : null,
    ].filter(Boolean).join('\n');
    const posted = await postToChatChannel(text);
    res.json({ ok: true, delivered: !!posted });
  } catch (err: any) {
    console.error('[ignite-bot/chat-open] error', err?.message || err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
