import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import OpenAI from 'openai';
import { supabase } from '../lib/supabase';
import { planTurn as legacyPlanTurn, SessionMeta } from '../rex/agent';
import type { SessionState, Config as AgentConfig } from '../rex/agent/types';
let strictPlanTurn: any = null;
try { strictPlanTurn = require('../rex/agent/planner').planTurn; } catch {}

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const ALLOW_WEB_FALLBACK = String(process.env.REX_ALLOW_WEB_FALLBACK || '').toLowerCase() === 'true';

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

    // RAG sources (all modes now): hybrid semantic + keyword
    let sources: { title: string; url: string }[] | undefined = undefined;
    let contextSnippets: string[] = [];
    if (lastUser?.text) {
      const query = lastUser.text.slice(0, 1000);
      try {
        // 1) Embed query
        const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: query });
        const embedding = emb.data?.[0]?.embedding;
        // 2) Call RPC for vector match
        if (embedding) {
          const { data: vec } = await supabase.rpc('match_kb_chunks', { query_embedding: embedding as any, match_count: 12 });
          if (vec?.length) {
            // Prefer blog articles first, then others by similarity
            const blog = vec.filter((r: any) => /\/blog\//i.test(r.url)).slice(0, 4);
            const nonBlog = vec.filter((r: any) => !/\/blog\//i.test(r.url)).slice(0, 4 - blog.length);
            const picked = [...blog, ...nonBlog];
            sources = picked.map((r: any) => ({ title: r.title, url: r.url }));
            contextSnippets = picked.map((r: any) => r.content).filter(Boolean).slice(0, 4);
          }
        }
        // 3) Fallback to text search with blog-first if vector returns nothing
        if ((!sources || sources.length === 0)) {
          const { data: blogPages } = await supabase
            .from('rex_kb_pages')
            .select('id,url,title')
            .ilike('url', '%/blog/%')
            .textSearch('text', query, { type: 'websearch' })
            .limit(4);
          if (blogPages?.length) {
            sources = blogPages.map((p: any) => ({ title: p.title, url: p.url }));
            const ids = blogPages.map((p: any) => p.id);
            const { data: chunks } = await supabase
              .from('rex_kb_chunks')
              .select('content,page_id,ordinal')
              .in('page_id', ids)
              .order('ordinal', { ascending: true })
              .limit(8);
            if (chunks?.length) contextSnippets = chunks.map((c: any) => c.content).filter(Boolean).slice(0, 4);
          }
          if ((!sources || sources.length === 0)) {
            const { data: pages } = await supabase
              .from('rex_kb_pages')
              .select('id,url,title')
              .textSearch('text', query, { type: 'websearch' })
              .limit(4);
            if (pages?.length) {
              sources = pages.map((p: any) => ({ title: p.title, url: p.url }));
              const ids = pages.map((p: any) => p.id);
              const { data: chunks2 } = await supabase
                .from('rex_kb_chunks')
                .select('content,page_id,ordinal')
                .in('page_id', ids)
                .order('ordinal', { ascending: true })
                .limit(8);
              if (chunks2?.length) contextSnippets = chunks2.map((c: any) => c.content).filter(Boolean).slice(0, 4);
            }
          }
        }
      } catch (ragErr) {
        await logEvent('rex_widget_rag_error', { error: String(ragErr) });
      }
    }

    // Helper to turn HTML into plain text for context fallback
    const htmlToText = (html: string) => {
      if (!html) return '';
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Optional: fetch limited competitor pages for context when comparable questions are asked
    async function maybeAddCompetitorContext(query: string) {
      if (!ALLOW_WEB_FALLBACK) return;
      const q = (query || '').toLowerCase();
      const candidates: { name: string; url: string }[] = [];
      if (/\bsales\s*navigator|sales\s*nav\b/.test(q)) candidates.push({ name: 'Sales Navigator', url: 'https://business.linkedin.com/sales-solutions/sales-navigator' });
      if (/\blever\b/.test(q)) candidates.push({ name: 'Lever', url: 'https://www.lever.co/' });
      if (/\bbullhorn\b/.test(q)) candidates.push({ name: 'Bullhorn', url: 'https://www.bullhorn.com/' });
      if (/\bgreenhouse\b/.test(q)) candidates.push({ name: 'Greenhouse', url: 'https://www.greenhouse.io/' });
      if (/\bworkable\b/.test(q)) candidates.push({ name: 'Workable', url: 'https://www.workable.com/' });
      if (/\bapollo\b/.test(q)) candidates.push({ name: 'Apollo', url: 'https://www.apollo.io/' });
      let added = 0;
      for (const c of candidates.slice(0, 2)) {
        try {
          const r = await axios.get(c.url, { timeout: 4000 });
          const txt = htmlToText(String(r.data || ''));
          if (txt) {
            contextSnippets.push(txt.slice(0, 1800));
            (sources = sources || []).push({ title: c.name, url: c.url });
            added++;
          }
        } catch {}
        if (added >= 2) break;
      }
    }

    // If we have sources but no snippets, pull page HTML/Text as a last resort
    if ((!contextSnippets || contextSnippets.length === 0) && sources && sources.length) {
      try {
        const urls = sources.slice(0, 2).map(s => s.url);
        const { data: pagesMaybe } = await supabase
          .from('rex_kb_pages')
          .select('url, html')
          .in('url', urls);
        let added = 0;
        for (const u of urls) {
          const row = (pagesMaybe || []).find((p: any) => p.url === u);
          if (row?.html) {
            const txt = htmlToText(row.html);
            if (txt) { contextSnippets.push(txt.slice(0, 1800)); added++; }
          } else {
            // As a final fallback, fetch live page
            try {
              const r = await axios.get(u, { timeout: 4000 });
              const txt = htmlToText(r.data);
              if (txt) { contextSnippets.push(txt.slice(0, 1800)); added++; }
            } catch {}
          }
          if (added >= 2) break;
        }
      } catch {}
    }

    // Fetch settings for prompts (pricing, demo/calendly)
    const { data: settingsRows } = await supabase
      .from('system_settings')
      .select('key,value')
      .in('key', ['pricing_tiers', 'rex_demo_url', 'rex_calendly_url', 'rex_sales_faq']);
    const settings: Record<string, any> = {};
    (settingsRows || []).forEach((r: any) => { settings[r.key] = r.value; });

    const CANONICAL = 'https://thehirepilot.com';

    function salesPrompt(): string {
      const pricing = settings['pricing_tiers'] ? `Pricing tiers: ${JSON.stringify(settings['pricing_tiers'])}. Link: https://thehirepilot.com/pricing.` : 'Pricing available at https://thehirepilot.com/pricing.';
      const demo = settings['rex_demo_url'] ? `Demo: ${settings['rex_demo_url']}.` : '';
      const cal = settings['rex_calendly_url'] ? `Book: ${settings['rex_calendly_url']}.` : '';
      const company = context?.rb2b?.company?.name ? `The visitor appears to be from ${context?.rb2b?.company?.name}. Tailor 1-2 sentences to their industry/size.` : '';
      const citations = sources?.length ? `When referencing docs/blog, include concise citations from provided sources.` : '';
      const faqs = Array.isArray(settings['rex_sales_faq']) && settings['rex_sales_faq'].length
        ? `Known FAQs (prefer these verbatim if the user's question matches): ${JSON.stringify(settings['rex_sales_faq'])}.`
        : '';
      return [
        `You are HirePilot Sales Assistant for domain ${CANONICAL}. Be concise, value-forward.`,
        `Ground every answer strictly on in-domain content from ${CANONICAL} (homepage, pricing, blog, docs).`,
        'Only answer if you can directly quote or summarize from the provided Context snippets or linked in-domain pages. If you cannot, respond: "No verified answer available" and suggest Book a Demo or Contact Support. Do NOT guess.',
        pricing,
        'Offer next steps when helpful: Watch demo and Book Calendly.',
        demo,
        cal,
        company,
        citations,
        faqs,
        'Never invent features. If unknown, say so briefly and provide the most relevant in-domain link.',
        'Output JSON only with keys {"content", "sources", "tutorial"}. "sources" should be an array of {title,url} you actually cited; "tutorial" usually null in sales.'
      ].filter(Boolean).join(' ');
    }

    function supportPrompt(): string {
      const citations = sources?.length ? 'Include source links for steps where applicable.' : '';
      return [
        `You are HirePilot Support Assistant for domain ${CANONICAL}.`,
        `ONLY answer using in-domain sources from ${CANONICAL} and the provided Context snippets.`,
        'Provide step-by-step instructions aligned to actual UI labels (e.g., "Campaigns → New Campaign").',
        'Prefer concise bullets. Call out permissions or human actions when required; suggest "Contact Support" when blocked.',
        citations,
        'Never invent features. If you cannot cite an in-domain source, say you are unsure and point to the closest relevant link.',
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
    // Deterministic knowledge routing for common questions
    const deterministicKnowledge: Record<string, { title: string; url: string }[]> = {
      'how do i launch a campaign': [ { title: 'Flow of HirePilot', url: 'https://thehirepilot.com/blog/flow-of-hirepilot' } ],
      "what's included in pro plan": [ { title: 'HirePilot Pricing', url: 'https://thehirepilot.com/pricing' } ],
      'what is hirepilot': [ { title: 'HirePilot Home', url: 'https://thehirepilot.com/' } ],
    };
    const key = (lastUser?.text || '').toLowerCase().trim();
    const deterministic = Object.keys(deterministicKnowledge).find(k => key.includes(k));
    if (deterministic) {
      const forced = deterministicKnowledge[deterministic];
      sources = forced.concat(sources || []).slice(0, 4);
      // If we have no context yet, pull top chunks for these forced URLs
      if (!contextSnippets.length) {
        const forcedUrls = forced.map(f => f.url);
        const { data: pgs } = await supabase
          .from('rex_kb_pages')
          .select('id,url,title')
          .in('url', forcedUrls);
        if (pgs?.length) {
          const ids = pgs.map((p: any) => p.id);
          const { data: ch } = await supabase
            .from('rex_kb_chunks')
            .select('content,page_id,ordinal')
            .in('page_id', ids)
            .order('ordinal', { ascending: true })
            .limit(8);
          if (ch?.length) contextSnippets = ch.map((c: any) => c.content).filter(Boolean).slice(0, 4);
        }
      }
    }

    const ragBlock = contextSnippets.length ? `\n\nContext (prefer blog articles when available):\n${contextSnippets.map((s, i) => `(${i+1}) ${s}`).join('\n')}` : '';
    const buildGroundedMessages = () => ([
      { role: 'system', content: `${sys}${citationBlock}${ragBlock}\nReturn ONLY a JSON object with keys \"content\", \"sources\", \"tutorial\". Ensure this is valid JSON. Limit content to 120 words unless steps are required.` },
      ...messages.map(m => ({ role: m.role, content: m.text })) as any,
    ]);

    // Load session meta for agent state
    let meta: SessionMeta = {};
    try {
      const { data: sMeta } = await supabase.from('rex_widget_sessions').select('meta').eq('id', sessionId).maybeSingle();
      meta = (sMeta?.meta as any) || {};
    } catch {}

    // Planner: decide intent/state/cta/actions (prefer strict zod planner if present)
    const sessionState: SessionState = { state: meta.state as any, collected: meta.collected as any, support_ctx: meta.support_ctx as any, last_intent: meta.last_intent as any, mode: mode as any };
    const agentConfig: AgentConfig = {
      demoUrl: settings['rex_demo_url'],
      pricingUrl: 'https://thehirepilot.com/pricing',
      docsUrl: 'https://thehirepilot.com/blog',
      calendlyUrl: settings['rex_calendly_url'],
      calendlyEvent: undefined,
      allowWebFallback: ALLOW_WEB_FALLBACK,
    };
    const plan = strictPlanTurn ? strictPlanTurn({ userMessage: lastUser?.text || '', mode: mode as any, session: sessionState, config: agentConfig }) : legacyPlanTurn({ text: lastUser?.text || '', mode, meta, config: { demoUrl: settings['rex_demo_url'], calendlyUrl: settings['rex_calendly_url'] } });
    // Execute: minimal execution for now (kb.search maps to existing RAG we already computed)
    // We already have sources/contextSnippets via RAG. If plan requested kb.search and we have none, keep as is; later we can branch per args.
    // Compose: say + CTA mapped to existing UI (we still return legacy shape plus CTA for forward-compat)
    let content = plan.response.say || 'Thanks!';
    let outSources = sources || [];
    let tutorial = null as any;

    function answerIsWeak(txt: string, intent?: string) {
      const t = (txt || '').toLowerCase();
      const weakPhrases = [
        'no verified answer',
        'here’s what i found',
        "here's what i found",
        'thanks!',
        'i recommend you to book a demo',
      ];
      const noSourcesWeak = intent === 'greeting_smalltalk' ? false : ((outSources || []).length === 0);
      return weakPhrases.some(p => t.includes(p)) || noSourcesWeak;
    }

    // Guardrail: if sales info intent and no sources, avoid fabrication
    if ((/price|pricing|pro plan|plans?|what is hirepilot|compare|different|vs\b/i.test(lastUser?.text || '')) && (!sources || sources.length === 0) && plan.intent !== 'greeting_smalltalk') {
      content = "I’m not sure based on what I can see. Want me to point you to docs or connect you with a human?";
    }

    // If still generic and we have RAG snippets, nudge a second pass to produce concrete steps.
    if (!tutorial && mode !== 'sales' && contextSnippets.length && /refer to|documentation|support resources/i.test(content)) {
      const follow = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'Rewrite the answer below into a concrete, step-by-step guide using the provided context. Output JSON {"content","sources","tutorial"}. Keep it short and accurate.' },
          { role: 'user', content: `Answer: ${content}\nContext:\n${contextSnippets.join('\n')}` }
        ]
      });
      const raw2 = follow.choices?.[0]?.message?.content || '';
      try { const p2 = JSON.parse(raw2); content = p2.content || content; }
      catch {}
    }

    // Grounded fallback: if planner response looks weak, produce grounded answer (content only), keep CTA/state
    if (lastUser?.text && plan.intent !== 'greeting_smalltalk' && answerIsWeak(content, plan.intent)) {
      try {
        // Add competitor context if relevant
        await maybeAddCompetitorContext(lastUser.text);
        const gm = buildGroundedMessages();
        const resp = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: gm
        });
        const raw = resp.choices?.[0]?.message?.content || '';
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            if (parsed.content) content = parsed.content;
            if (Array.isArray(parsed.sources) && parsed.sources.length) {
              outSources = parsed.sources;
            } else if (sources && sources.length) {
              outSources = sources;
            }
            if (parsed.tutorial) tutorial = parsed.tutorial;
          }
        } catch {}
      } catch (fallbackErr) {
        await logEvent('rex_widget_grounded_fallback_error', { error: String(fallbackErr) });
      }
    }

    // Heuristic: pricing → only summarize if settings provide tiers. Never invent.
    if (/\b(price|pricing|pro plan|plans?|cost|how\s*much)\b/i.test(lastUser?.text || '')) {
      const tiers = settings['pricing_tiers'];
      if (Array.isArray(tiers) && tiers.length) {
        try {
          const lines = tiers.map((t: any) => `- ${t.name || 'Plan'}${t.summary ? `: ${t.summary}` : ''}${t.price ? ` (from ${t.price})` : ''}`);
          content = ['Here’s a quick overview of our plans (no hard numbers unless in settings):', ...lines, 'See full details on our pricing page.'].join('\n');
        } catch {}
      } else {
        content = 'Please see our pricing page for up-to-date plan details.';
      }
      if (!outSources.find((s: any) => /pricing/i.test(s.title))) outSources.push({ title: 'HirePilot Pricing', url: 'https://thehirepilot.com/pricing' });
    }

    // Optional: debug diagnostics
    if ((req.query as any)?.debug === 'true') {
      await logEvent('rex_widget_debug', {
        q: lastUser?.text,
        top_sources: (sources || []).slice(0, 10),
        used_sources: outSources,
        snippet_lengths: contextSnippets.map(s => s.length),
        allow_web: ALLOW_WEB_FALLBACK,
      });
    }

    // Persist assistant message
    await supabase.from('rex_widget_messages').insert({ session_id: sessionId, role: 'assistant', text: content, sources: outSources as any, tutorial });
    // Persist session meta updates
    const newMeta: SessionMeta = { ...meta, state: (plan.state || plan.state_patch?.state) as any, last_intent: (plan.intent as any) || meta.last_intent, collected: { ...(meta.collected||{}), ...(plan.state_patch?.collected||{}) }, support_ctx: { ...(meta.support_ctx||{}), ...(plan.state_patch?.support_ctx||{}) } };
    await supabase.from('rex_widget_sessions').update({ meta: newMeta }).eq('id', sessionId);

    res.json({ threadId: sessionId, message: { text: content, sources: outSources, tutorial }, cta: (plan.response?.cta || plan.cta), state: (plan.state || plan.state_patch?.state), intent: plan.intent });
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

// Create a support ticket
router.post('/tickets', async (req: Request, res: Response) => {
  try {
    const { sessionId, summary, details } = req.body as { sessionId: string; summary: string; details?: string };
    const anonId = getAnonId(req);
    const { data, error } = await supabase
      .from('rex_tickets')
      .insert({ session_id: sessionId, anon_id: anonId, summary, details: details || null })
      .select('id')
      .single();
    if (error) throw error;
    // Fan-out to Slack if configured
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackUrl) {
      try { await axios.post(slackUrl, { text: `New Support Ticket (REX): ${data.id}\nSession: ${sessionId}\n${summary}\n\n${details || ''}` }); } catch {}
    }
    res.json({ id: data.id });
  } catch (err: any) {
    await logEvent('rex_widget_error', { route: 'tickets', error: err?.message || String(err), stack: err?.stack, body: req.body });
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


