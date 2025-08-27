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

    // RAG sources (support/rex modes): hybrid semantic + keyword
    let sources: { title: string; url: string }[] | undefined = undefined;
    let contextSnippets: string[] = [];
    if (mode !== 'sales' && lastUser?.text) {
      const query = lastUser.text.slice(0, 1000);
      try {
        // 1) Embed query
        const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: query });
        const embedding = emb.data?.[0]?.embedding;
        // 2) Call RPC for vector match
        if (embedding) {
          const { data: vec } = await supabase.rpc('match_kb_chunks', { query_embedding: embedding as any, match_count: 4 });
          if (vec?.length) {
            sources = vec.map((r: any) => ({ title: r.title, url: r.url }));
            contextSnippets = vec.map((r: any) => r.content).filter(Boolean).slice(0, 4);
          }
        }
        // 3) Fallback to text search if vector returns nothing
        if ((!sources || sources.length === 0)) {
          const { data: pages } = await supabase
            .from('rex_kb_pages')
            .select('url,title')
            .textSearch('text', query, { type: 'websearch' })
            .limit(4);
          if (pages?.length) sources = pages.map((p: any) => ({ title: p.title, url: p.url }));
        }
      } catch (ragErr) {
        await logEvent('rex_widget_rag_error', { error: String(ragErr) });
      }
    }

    // Fetch settings for prompts (pricing, demo/calendly)
    const { data: settingsRows } = await supabase
      .from('system_settings')
      .select('key,value')
      .in('key', ['pricing_tiers', 'rex_demo_url', 'rex_calendly_url']);
    const settings: Record<string, any> = {};
    (settingsRows || []).forEach((r: any) => { settings[r.key] = r.value; });

    function salesPrompt(): string {
      const pricing = settings['pricing_tiers'] ? `Pricing tiers: ${JSON.stringify(settings['pricing_tiers'])}. Link: https://thehirepilot.com/pricing.` : 'Pricing available at https://thehirepilot.com/pricing.';
      const demo = settings['rex_demo_url'] ? `Demo: ${settings['rex_demo_url']}.` : '';
      const cal = settings['rex_calendly_url'] ? `Book: ${settings['rex_calendly_url']}.` : '';
      const company = context?.rb2b?.company?.name ? `The visitor appears to be from ${context?.rb2b?.company?.name}. Tailor 1-2 sentences to their industry/size.` : '';
      const citations = sources?.length ? `When referencing docs/blog, include concise citations from provided sources.` : '';
      return [
        'You are HirePilot Sales Assistant. Be concise, value-forward.',
        pricing,
        'Offer next steps when helpful: Watch demo and Book Calendly.',
        demo,
        cal,
        company,
        citations,
        'Never invent features. If unknown, say so briefly.',
        'Output JSON only with keys {"content", "sources", "tutorial"}. "sources" should be an array of {title,url} you actually cited; "tutorial" usually null in sales.'
      ].filter(Boolean).join(' ');
    }

    function supportPrompt(): string {
      const citations = sources?.length ? 'Include source links for steps where applicable.' : '';
      return [
        'You are HirePilot Support Assistant. Provide step-by-step instructions aligned to actual UI labels (e.g., "Campaigns → New Campaign").',
        'Prefer concise bullets. Call out permissions or human actions when required; suggest "Contact Support" when blocked.',
        citations,
        'Never invent features. Use provided sources for citations.',
        'Output JSON only with keys {"content", "sources", "tutorial"}.',
        'If a tutorial makes sense, include {"tutorial": {"title": string, "steps": string[]}} with clear, sequential steps.'
      ].join(' ');
    }

    function rexPrompt(): string {
      return [
        supportPrompt(),
        'You may use structured output as described. Keep answers accurate and actionable.'
      ].join(' ');
    }

    const sys = mode === 'sales' ? salesPrompt() : mode === 'support' ? supportPrompt() : rexPrompt();
    const citationBlock = sources?.length ? `\n\nWhen answering, reference these sources where relevant:\n${sources.map(s => `- ${s.title} (${s.url})`).join('\n')}` : '';

    // Include RAG snippets to ground the answer
    const ragBlock = contextSnippets.length ? `\n\nContext:\n${contextSnippets.map((s, i) => `(${i+1}) ${s}`).join('\n')}` : '';
    const oaiMessages = [
      { role: 'system', content: `${sys}${citationBlock}${ragBlock}\nReturn ONLY JSON.` },
      ...messages.map(m => ({ role: m.role, content: m.text })) as any,
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: oaiMessages,
      temperature: 0.2,
    });

    const raw = completion.choices?.[0]?.message?.content || '';
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch {}
    const content = parsed?.content || raw || 'Thanks!';
    const outSources = Array.isArray(parsed?.sources) && parsed.sources.length ? parsed.sources : (sources || []);
    const tutorial = parsed?.tutorial && parsed.tutorial.title && Array.isArray(parsed.tutorial.steps) ? parsed.tutorial : null;

    // Persist assistant message
    await supabase.from('rex_widget_messages').insert({ session_id: sessionId, role: 'assistant', text: content, sources: outSources as any, tutorial });

    res.json({ threadId: sessionId, message: { text: content, sources: outSources, tutorial } });
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


