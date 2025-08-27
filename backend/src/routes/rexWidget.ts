import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import OpenAI from 'openai';
import { supabase } from '../lib/supabase';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const anon = (req.headers['x-rex-anon-id'] as string) || '';
    return `${req.ip}|${anon}`;
  },
});

router.use(limiter);

async function logEvent(kind: string, payload: any) {
  try { await supabase.from('rex_events').insert({ kind, payload }); } catch {}
}

function getAnonId(req: Request): string | null {
  const v = (req.headers['x-rex-anon-id'] as string) || null;
  return v && typeof v === 'string' ? v : null;
}

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { threadId, mode, messages, context } = req.body as {
      threadId?: string;
      mode: 'sales' | 'support' | 'rex';
      messages: { role: 'user' | 'assistant' | 'system'; text: string }[];
      context?: { url?: string; pathname?: string; rb2b?: any; userId?: string | null };
    };

    const anonId = getAnonId(req);
    const userId = context?.userId || null;

    // Upsert or create session
    let sessionId = threadId || null;
    if (sessionId) {
      await supabase
        .from('rex_widget_sessions')
        .upsert({ id: sessionId, user_id: userId, anon_id: anonId, mode, rb2b: context?.rb2b, last_active_at: new Date().toISOString() }, { onConflict: 'id' });
    } else {
      const { data: s, error: se } = await supabase
        .from('rex_widget_sessions')
        .insert({ user_id: userId, anon_id: anonId, mode, rb2b: context?.rb2b })
        .select('id')
        .single();
      if (se) throw se;
      sessionId = s.id;
    }

    // Persist last user message
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (lastUser) {
      await supabase.from('rex_widget_messages').insert({ session_id: sessionId, role: 'user', text: lastUser.text });
    }

    // RAG sources (support/rex modes)
    let sources: { title: string; url: string }[] | undefined = undefined;
    if (mode !== 'sales' && lastUser?.text) {
      const query = lastUser.text.slice(0, 512);
      const { data: pages } = await supabase
        .from('rex_kb_pages')
        .select('url,title')
        .textSearch('text', query, { type: 'websearch' })
        .limit(4);
      if (pages && pages.length) {
        sources = pages.map((p: any) => ({ title: p.title, url: p.url }));
      }
    }

    // Build system prompt by mode
    const modeSystem: Record<string, string> = {
      sales: 'You are HirePilot Sales Assistant. Be concise, friendly, and include CTAs when helpful (demo, book a call).',
      support: 'You are HirePilot Support Assistant. Provide step-by-step instructions referencing product docs. Cite sources as provided.',
      rex: 'You are REX, a power assistant for HirePilot. Help with advanced tasks and cite sources when applicable.'
    };
    const sys = modeSystem[mode] || modeSystem.support;
    const citationBlock = sources?.length ? `\n\nWhen answering, reference these sources where relevant:\n${sources.map(s => `- ${s.title} (${s.url})`).join('\n')}` : '';

    const oaiMessages = [
      { role: 'system', content: `${sys}${citationBlock}` },
      ...messages.map(m => ({ role: m.role, content: m.text })) as any,
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: oaiMessages,
      temperature: 0.3,
    });

    const text = completion.choices?.[0]?.message?.content || 'Thanks!';
    const assistantPayload: any = { text, sources };

    // Persist assistant message
    await supabase.from('rex_widget_messages').insert({ session_id: sessionId, role: 'assistant', text, sources: sources ? sources as any : null });

    res.json({ threadId: sessionId, message: assistantPayload });
  } catch (err: any) {
    await logEvent('rex_widget_error', { route: 'chat', error: err?.message || String(err), stack: err?.stack, body: req.body });
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

router.post('/leads', async (req: Request, res: Response) => {
  try {
    const body = req.body as { full_name: string; work_email: string; company?: string; interest?: string; notes?: string; rb2b?: any };
    const { data, error } = await supabase
      .from('rex_leads')
      .insert({
        full_name: body.full_name,
        work_email: body.work_email,
        company: body.company || null,
        interest: body.interest || null,
        notes: body.notes || null,
        rb2b: body.rb2b || null,
      })
      .select('id')
      .single();
    if (error) throw error;

    const id = data.id as string;

    // Fan-out: Slack
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackUrl) {
      try { await axios.post(slackUrl, { text: `New lead (REX Widget): ${body.full_name} <${body.work_email}>\nCompany: ${body.company || '-'}\nInterest: ${body.interest || '-'}\nNotes: ${body.notes || '-'}` }); } catch {}
    }
    // Zapier webhook
    const zapierUrl = process.env.ZAPIER_HOOK_URL;
    if (zapierUrl) { try { await axios.post(zapierUrl, { type: 'rex_widget_lead', id, ...body }); } catch {} }
    // Monday.com item
    const mondayToken = process.env.MONDAY_TOKEN;
    const mondayBoard = process.env.MONDAY_BOARD_ID;
    if (mondayToken && mondayBoard) {
      try {
        await axios.post('https://api.monday.com/v2', {
          query: `mutation ($board: Int!, $name: String!) { create_item (board_id: $board, item_name: $name) { id } }`,
          variables: { board: Number(mondayBoard), name: `Lead: ${body.full_name} (${body.work_email})` }
        }, { headers: { Authorization: mondayToken } });
      } catch {}
    }

    res.json({ id });
  } catch (err: any) {
    await logEvent('rex_widget_error', { route: 'leads', error: err?.message || String(err), stack: err?.stack, body: req.body });
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

router.post('/handoff', async (req: Request, res: Response) => {
  try {
    const { threadId, reason } = req.body as { threadId: string; reason?: string };
    const { data: msgs } = await supabase
      .from('rex_widget_messages')
      .select('role,text,created_at')
      .eq('session_id', threadId)
      .order('created_at', { ascending: true })
      .limit(50);

    const transcript = (msgs || []).map((m: any) => `${m.created_at} - ${m.role.toUpperCase()}: ${m.text}`).join('\n');
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackUrl) {
      try { await axios.post(slackUrl, { text: `REX Widget Handoff (${reason || 'general'})\nSession: ${threadId}\n\n${transcript}` }); } catch {}
    }
    const zapierUrl = process.env.ZAPIER_HOOK_URL;
    if (zapierUrl) { try { await axios.post(zapierUrl, { type: 'rex_widget_handoff', threadId, reason, transcript }); } catch {} }
    res.json({ ok: true });
  } catch (err: any) {
    await logEvent('rex_widget_error', { route: 'handoff', error: err?.message || String(err), stack: err?.stack, body: req.body });
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

router.get('/config', async (_req: Request, res: Response) => {
  try {
    const keys = ['rex_demo_url', 'rex_calendly_url', 'pricing_tiers', 'rex_sales_faq'];
    const { data } = await supabase.from('system_settings').select('key,value').in('key', keys);
    const out: any = {};
    (data || []).forEach((row: any) => { out[row.key] = row.value; });
    res.json(out);
  } catch (err: any) {
    await logEvent('rex_widget_error', { route: 'config', error: err?.message || String(err), stack: err?.stack });
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// Admin-only trigger to reindex KB (assumes auth middleware or simple token)
router.post('/kb/reindex', async (req: Request, res: Response) => {
  try {
    const token = req.headers['x-admin-token'] as string | undefined;
    if (!token || token !== process.env.ADMIN_TOKEN) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    // Call Supabase Edge Function
    const fnUrl = `${process.env.SUPABASE_URL}/functions/v1/crawl_kb`;
    const r = await axios.post(fnUrl, {}, { headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
    res.json(r.data);
  } catch (err: any) {
    await logEvent('rex_widget_error', { route: 'kb/reindex', error: err?.message || String(err), stack: err?.stack });
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

export default router;


