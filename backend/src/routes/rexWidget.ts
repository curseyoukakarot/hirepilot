import express, { Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import OpenAI from 'openai';
import { supabase } from '../lib/supabase';
import { WebClient } from '@slack/web-api';
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
    const chatSchema = z.object({
      threadId: z.string().uuid().optional(),
      mode: z.enum(['sales', 'support', 'rex']),
      messages: z.array(z.object({ role: z.enum(['user', 'assistant', 'system']), text: z.string().max(2000) })).max(20),
      context: z.object({ url: z.string().url().optional(), pathname: z.string().optional(), rb2b: z.any().optional(), userId: z.string().uuid().nullable().optional() }).optional(),
    });
    const validated = chatSchema.safeParse(req.body);
    if (!validated.success) {
      res.status(400).json({ error: 'Invalid input', details: validated.error.issues });
      return;
    }
    const { threadId, mode, messages, context } = validated.data;

    const anonId = getAnonId(req);
    const userId = context?.userId || null;

    // Upsert or create session
    let sessionId = threadId || null;
    let createdNewSession = false;
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
      createdNewSession = true;
    }

    // Persist last user message
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (lastUser) {
      await supabase.from('rex_widget_messages').insert({ session_id: sessionId, role: 'user', text: lastUser.text });
      // Notify Slack on first engagement (session created now)
      if (createdNewSession) {
        const slackUrl = process.env.SLACK_WIDGET_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
        if (slackUrl) {
          try {
            const shortTxt = (lastUser.text || '').slice(0, 300);
            await axios.post(slackUrl, { text: `REX Widget: New conversation started\nSession: ${sessionId}\nMessage: ${shortTxt}` });
          } catch {}
        }
      }
    }

    // If human takeover is engaged or REX is disabled, suppress AI and optionally relay to Slack
    try {
      const { data: live, error: liveErr } = await supabase
        .from('rex_live_sessions')
        .select('slack_channel_id, slack_thread_ts, human_engaged_at, rex_disabled')
        .eq('widget_session_id', sessionId)
        .maybeSingle();
      if (liveErr) {
        console.error('[rex_widget/chat] live query error', liveErr);
      }
      console.log('[rex_widget/chat] live session check', { sessionId, live: live ? { human_engaged_at: live.human_engaged_at, rex_disabled: live.rex_disabled } : 'none' });
      if (live && (live.human_engaged_at || live.rex_disabled)) {
        console.log('[rex_widget/chat] suppressing AI - live engaged');
        // Relay user's message to Slack thread if available
        const botToken = process.env.SLACK_BOT_TOKEN;
        if (lastUser && live.slack_channel_id && live.slack_thread_ts && botToken) {
          try {
            const { WebClient } = require('@slack/web-api');
            const slack = new WebClient(botToken);
            await slack.chat.postMessage({
              channel: live.slack_channel_id,
              thread_ts: live.slack_thread_ts,
              text: `User: ${lastUser.text}`,
              unfurl_links: false,
              unfurl_media: false,
            });
            console.log('[rex_widget/chat] relayed user to Slack');
          } catch (e: any) {
            console.error('[rex_widget/chat] Slack relay failed', e?.message || e);
          }
        }
        // Return without generating assistant content
        res.json({ threadId: sessionId, message: { text: 'Message sent to team — awaiting reply' }, cta: null, state: 'live', intent: 'handoff' });
        return;
      }
    } catch (e: any) { console.error('[rex_widget/chat] live guard error', e?.message || e); }

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

    // Clean-slate REX system prompt (used by the modular handler below)
    // Optionally load from system_settings to allow prompt updates without deploy
    let rexSystemPrompt = [
      'You are REX, the official AI recruiting assistant for HirePilot — a modern AI-powered sourcing and outreach platform.',
      '',
      'Your job is to confidently and helpfully answer questions about HirePilot’s product features, pricing, integrations, automation capabilities, and use cases. You may also compare HirePilot to other tools like Greenhouse, Lever, Outreach.io, or Clay — and explain how HirePilot is different.',
      '',
      'Always speak with clarity and confidence. Never say “as an AI...” — you are a team member at HirePilot, not an external tool.',
      '',
      'If the user asks “how to” questions, respond with a clear, friendly numbered list of steps. If they ask a comparison question, give a concise but thoughtful answer. If you\'re unsure, answer helpfully based on available information and offer to connect them to the team or provide a demo link.',
      '',
      'Your tone is expert, modern, and helpful. You are never vague. You always give the best possible answer — even without exact documentation.',
      '',
      'For comparisons, structure the answer as a Markdown table when helpful.',
      'Sources must be an array of URLs only.',
      '',
      'Respond in this JSON format:',
      '{',
      '  "content": "<your answer as Markdown>",',
      '  "sources": ["<linked source or blog>", "..."],',
      '  "tutorial": "<if applicable, short how-to steps, else null>"',
      '}',
    ].join('\n');
    try {
      const { data: promptRow } = await supabase.from('system_settings').select('value').eq('key', 'rex_system_prompt').maybeSingle();
      if (promptRow?.value && typeof promptRow.value === 'string') rexSystemPrompt = promptRow.value;
    } catch {}

    // === Helpers for clean REX handler ===
    function checkCuratedFAQ(message: string | undefined): { content: string; sources: string[]; tutorial: string | null } | null {
      const q = (message || '').toLowerCase();
      if (!q) return null;
      const entries: Array<{ pattern: RegExp; answer: { content: string; sources: string[]; tutorial: string | null } }> = [
        {
          pattern: /how\s+(do|can)?\s*i\s*(launch|start|create|set\s*up)\s+(a\s*)?campaign/i,
          answer: {
            content: [
              'Launching a campaign in HirePilot is straightforward:',
              '',
              '1. Go to Campaigns → New Campaign.',
              '2. Name it, select your audience or import a list.',
              '3. Customize your AI outreach sequence and follow-ups.',
              '4. Set sender details and schedule.',
              '5. Click Launch — automation handles the rest.',
            ].join('\n'),
            sources: ['https://thehirepilot.com/blog/flow-of-hirepilot'],
            tutorial: '1) Campaigns → New Campaign → Audience → Messages → Launch',
          },
        },
        {
          pattern: /what(\s+is|'s)\s+included\s+in\s+(pro|professional)\s+plan|what\s+do\s+i\s+get\s+with\s+pro/i,
          answer: {
            content: [
              'The Pro plan includes AI sourcing, full campaign automation, data enrichment, Chrome extension, Slack alerts, and advanced analytics. It\'s ideal for teams scaling recruiting with automation.',
              'See current details here: https://thehirepilot.com/pricing',
            ].join('\n'),
            sources: ['https://thehirepilot.com/pricing'],
            tutorial: null,
          },
        },
        {
          pattern: /pricing|cost|plans?/i,
          answer: {
            content: 'We offer multiple plans for different team sizes. For the latest tiers and inclusions, see https://thehirepilot.com/pricing. I can also help you pick the right plan.',
            sources: ['https://thehirepilot.com/pricing'],
            tutorial: null,
          },
        },
        {
          pattern: /compare|versus|vs\.?\s+.*(greenhouse|lever|outreach|gem|clay|sales\s*nav|sales\s*navigator|linkedin\s*recruiter)/i,
          answer: {
            content: [
              'High level: ATS/CRM tools manage candidates after they apply; HirePilot focuses on AI-powered sourcing and outreach before they enter your ATS.',
              'We can work alongside Greenhouse/Lever — HirePilot finds and engages candidates, then you track them in the ATS.',
            ].join('\n'),
            sources: ['https://thehirepilot.com/blog'],
            tutorial: null,
          },
        },
        {
          pattern: /integrations?|connect.*(ats|greenhouse|lever|workable|bullhorn|zapier)/i,
          answer: {
            content: 'HirePilot complements common ATS tools and supports flexible workflows. Tell me which tool you use and I\'ll outline the best setup.',
            sources: ['https://thehirepilot.com/blog'],
            tutorial: null,
          },
        },
        {
          pattern: /how\s+to\s+write|compose\s+message|sequence|outreach/i,
          answer: {
            content: [
              'To compose effective outreach in HirePilot:',
              '',
              '1. Choose your audience and tags.',
              '2. Lead with a short, value-forward opener.',
              '3. Add 2–3 follow-ups spaced a few days apart.',
              '4. Personalize tokens like company or role.',
            ].join('\n'),
            sources: ['https://thehirepilot.com/blog'],
            tutorial: '1) Select audience → 2) Draft opener → 3) Add follow-ups → 4) Personalize',
          },
        },
      ];
      const hit = entries.find(e => e.pattern.test(q));
      return hit ? hit.answer : null;
    }

    async function matchKbChunks(query: string | undefined): Promise<{ snippets: string[]; links: string[] }> {
      if (!query) return { snippets: [], links: [] };
      const q = query.slice(0, 1000);
      const snippets: string[] = [];
      const links: string[] = [];
      try {
        const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: q });
        const embedding = emb.data?.[0]?.embedding as any;
        if (embedding) {
          const { data: vec } = await supabase.rpc('match_kb_chunks', { query_embedding: embedding, match_count: 8 });
          if (Array.isArray(vec) && vec.length) {
            const picked = (vec as any[]).slice(0, 6);
            picked.forEach((r: any) => {
              if (r?.content) snippets.push(String(r.content).slice(0, 1800));
              if (r?.url) links.push(String(r.url));
            });
          }
        }
        if (snippets.length === 0) {
          const { data: pages } = await supabase
            .from('rex_kb_pages')
            .select('id,url,title')
            .textSearch('text', q, { type: 'websearch' })
            .limit(4);
          if (pages?.length) {
            links.push(...pages.map((p: any) => p.url).filter(Boolean));
            const ids = pages.map((p: any) => p.id);
            const { data: chunks } = await supabase
              .from('rex_kb_chunks')
              .select('content,page_id,ordinal')
              .in('page_id', ids)
              .order('ordinal', { ascending: true })
              .limit(8);
            (chunks || []).forEach((c: any) => { if (c?.content) snippets.push(String(c.content).slice(0, 1800)); });
          }
        }
      } catch {}
      const uniqueLinks = Array.from(new Set(links));
      const uniqueSnippets = Array.from(new Set(snippets)).slice(0, 4);
      if (uniqueSnippets.length < 2) { try { await logEvent('rex_rag_miss', { query: q }); } catch {} }
      return { snippets: uniqueSnippets, links: uniqueLinks.slice(0, 6) };
    }

    function isWeakAnswer(content: string | undefined | null): boolean {
      const t = (content || '').trim();
      if (t.length < 40) return true;
      const weakPhrases = [
        'no verified answer',
        'not sure',
        'i\'m not sure',
        'book a demo',
        'here\'s what i found',
      ];
      const lowInfo = ['how to', 'feature', 'pricing', 'integration', 'campaign'].some(k => t.toLowerCase().includes(k));
      return weakPhrases.some(p => t.toLowerCase().includes(p)) && !lowInfo;
    }

    function isValidAnswer(content: string | undefined | null): boolean {
      const t = (content || '').trim();
      return t.length >= 40;
    }

    async function sendSlackTicket(userMessage: string | undefined, extras?: Record<string, any>): Promise<void> {
      try {
        const slackUrl = process.env.SLACK_WIDGET_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
        if (!slackUrl || !userMessage) return;
        const tail = extras ? `\nExtras: ${JSON.stringify(extras).slice(0, 1500)}` : '';
        await axios.post(slackUrl, { text: `REX Escalation Needed\nMessage: ${userMessage}${tail}` });
      } catch {}
    }

    async function callGPT(params: { prompt: string; context: string[]; userMessage: string }): Promise<{ content: string; sources: string[]; tutorial: any }> {
      const { prompt, context, userMessage } = params;
      const contextBlock = context.length ? `\n\nContext:\n${context.map((s, i) => `(${i + 1}) ${s}`).join('\n')}` : '';
      const messages = [
        { role: 'system', content: `${prompt}${contextBlock}\n\nReturn ONLY valid JSON with keys {content, sources, tutorial}.` },
        { role: 'user', content: userMessage },
      ] as any;
      const resp = await openai.chat.completions.create({ model: 'gpt-4o', temperature: 0.2, max_tokens: 800, messages });
      const raw = resp.choices?.[0]?.message?.content || '';
      try {
        const parsed = JSON.parse(raw);
        const content = typeof parsed?.content === 'string' ? parsed.content : '';
        const sources = Array.isArray(parsed?.sources) ? parsed.sources.map((s: any) => String(s)).filter(Boolean).slice(0, 8) : [];
        const tutorial = parsed?.tutorial ?? null;
        return { content, sources, tutorial };
      } catch {
        return { content: '', sources: [], tutorial: null };
      }
    }

    // Web tools for function calling
    async function webSearchTool(query: string): Promise<any> {
      if (!ALLOW_WEB_FALLBACK) return { results: [] };
      const SERP = process.env.SERPAPI_KEY;
      try {
        if (SERP) {
          const r = await axios.get('https://serpapi.com/search.json', { params: { engine: 'google', q: query, api_key: SERP, num: 5 }, timeout: 6000 });
          const items = (r.data?.organic_results || []).slice(0, 5).map((it: any) => ({ title: it.title, link: it.link, snippet: it.snippet }));
          return { results: items };
        }
      } catch {}
      // Fallback: no external API → return empty
      return { results: [] };
    }

    async function browsePageTool(url: string, instructions: string): Promise<any> {
      if (!ALLOW_WEB_FALLBACK) return { url, content: '' };
      try {
        const r = await axios.get(url, { timeout: 6000 });
        const txt = htmlToText(String(r.data || '')).slice(0, 4000);
        return { url, content: txt, instructions };
      } catch {
        return { url, content: '', instructions };
      }
    }

    async function callGPTWithTools(params: { prompt: string; context: string[]; userMessage: string }): Promise<{ content: string; sources: string[]; tutorial: any; toolData?: any }> {
      const { prompt, context, userMessage } = params;
      const contextBlock = context.length ? `\n\nContext:\n${context.map((s, i) => `(${i + 1}) ${s}`).join('\n')}` : '';
      let messages: any[] = [
        { role: 'system', content: `${prompt}${contextBlock}\n\nUse tools when you need external info for comparisons. Return ONLY valid JSON {content, sources, tutorial}.` },
        { role: 'user', content: userMessage },
      ];
      const tools = [
        {
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web for up-to-date info on recruiting tools (features, pricing, pros/cons).',
            parameters: {
              type: 'object',
              properties: { query: { type: 'string', description: 'Search query like “Greenhouse features pricing 2025”' } },
              required: ['query'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'browse_page',
            description: 'Fetch and summarize content from a specific URL, such as pricing pages.',
            parameters: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'URL to fetch' },
                instructions: { type: 'string', description: 'What to extract, e.g., pricing or features' },
              },
              required: ['url', 'instructions'],
            },
          },
        },
      ] as any;
      const first = await openai.chat.completions.create({ model: 'gpt-4o', temperature: 0.2, max_tokens: 400, messages, tools, tool_choice: 'auto' as any });
      const mc = first.choices?.[0]?.message as any;
      let toolData: any[] = [];
      if (mc?.tool_calls && mc.tool_calls.length) {
        const capped = mc.tool_calls.slice(0, 3);
        const toolResponses = await Promise.all(capped.map(async (tc: any) => {
          const name = tc.function?.name;
          let args: any = {};
          try { args = JSON.parse(tc.function?.arguments || '{}'); } catch {}
          let data: any;
          try {
            if (name === 'web_search') {
              data = await webSearchTool(String(args.query || ''));
            } else if (name === 'browse_page') {
              data = await browsePageTool(String(args.url || ''), String(args.instructions || ''));
            } else {
              data = { error: 'unknown_tool' };
            }
          } catch (toolErr: any) {
            data = { error: String(toolErr?.message || toolErr) };
          }
          toolData.push({ name, args, data });
          return { role: 'tool', tool_call_id: tc.id, content: JSON.stringify(data) };
        }));
        messages.push(...toolResponses);
        const second = await openai.chat.completions.create({ model: 'gpt-4o', temperature: 0.2, max_tokens: 800, messages });
        const raw2 = second.choices?.[0]?.message?.content || '';
        try {
          const parsed = JSON.parse(raw2);
          const content = typeof parsed?.content === 'string' ? parsed.content : '';
          const sources = Array.isArray(parsed?.sources) ? parsed.sources.map((s: any) => String(s)).filter(Boolean).slice(0, 8) : [];
          const tutorial = parsed?.tutorial ?? null;
          return { content, sources, tutorial, toolData };
        } catch {
          return { content: '', sources: [], tutorial: null, toolData };
        }
      }
      const raw = mc?.content || '';
      try {
        const parsed = JSON.parse(raw);
        const content = typeof parsed?.content === 'string' ? parsed.content : '';
        const sources = Array.isArray(parsed?.sources) ? parsed.sources.map((s: any) => String(s)).filter(Boolean).slice(0, 8) : [];
        const tutorial = parsed?.tutorial ?? null;
        return { content, sources, tutorial, toolData };
      } catch {
        return { content: '', sources: [], tutorial: null, toolData };
      }
    }

    async function handleRexMessage(userMessage: string): Promise<{ content: string; sources: string[]; tutorial: any }> {
      // 1) Curated FAQ
      const curated = checkCuratedFAQ(userMessage);
      if (curated) return curated;

      // 2) KB match and grounded GPT
      const kb = await matchKbChunks(userMessage);
      const grounded = await callGPT({ prompt: rexSystemPrompt, context: kb.snippets, userMessage });
      if (!isWeakAnswer(grounded.content)) {
        const mergedSources = Array.from(new Set([...(grounded.sources || []), ...(kb.links || [])])).slice(0, 8);
        return { content: grounded.content, sources: mergedSources, tutorial: grounded.tutorial };
      }

      // 3) Tool-using GPT for comparisons or when grounded is weak
      const looksComparative = /(compare|versus|vs\.?)/i.test(userMessage) || /(greenhouse|lever|outreach|gem|clay|sales\s*nav|sales\s*navigator|linkedin\s*recruiter)/i.test(userMessage);
      const withTools = await callGPTWithTools({ prompt: rexSystemPrompt, context: looksComparative ? kb.snippets : [], userMessage });
      if (!isWeakAnswer(withTools.content)) {
        const mergedSources = Array.from(new Set([...(withTools.sources || []), ...(kb.links || [])])).slice(0, 8);
        return { content: withTools.content, sources: mergedSources, tutorial: withTools.tutorial };
      }

      // 4) Fallback GPT with no context
      const fallback = await callGPT({ prompt: rexSystemPrompt, context: [], userMessage });
      if (isValidAnswer(fallback.content)) {
        return fallback;
      }

      // 5) Escalation to Slack with tool data and polite fallback
      await sendSlackTicket(userMessage, { kb_links: kb.links?.slice(0, 5), tools: 'used' });
      return {
        content: 'I wasn\'t able to answer that fully — but I\'ve pinged the team for help. Meanwhile, here are quick links: [Blog](https://thehirepilot.com/blog) · [Pricing](https://thehirepilot.com/pricing) · [Demo](https://thehirepilot.com/demo).',
        sources: [],
        tutorial: null,
      };
    }

    function salesPrompt(): string {
      const pricing = settings['pricing_tiers']
        ? `Pricing tiers: ${JSON.stringify(settings['pricing_tiers'])}. Link: https://thehirepilot.com/pricing.`
        : 'Pricing available at https://thehirepilot.com/pricing.';
      const demo = settings['rex_demo_url'] ? `Demo: ${settings['rex_demo_url']}.` : '';
      const cal = settings['rex_calendly_url'] ? `Book: ${settings['rex_calendly_url']}.` : '';
      const faqs = Array.isArray(settings['rex_sales_faq']) && settings['rex_sales_faq'].length
        ? `Known FAQs: ${JSON.stringify(settings['rex_sales_faq'])}.`
        : '';
      const company = context?.rb2b?.company?.name
        ? `The visitor appears to be from ${context?.rb2b?.company?.name}. Consider their industry/size.`
        : '';

      return [
        `You are REX, the AI recruiting assistant inside HirePilot for domain ${CANONICAL}.`,
        'You help visitors understand HirePilot’s product, pricing, and features — and guide them toward the next best action (demo, trial, or signup).',
        `You’ve been trained on in-domain content from ${CANONICAL} (homepage, pricing, blog, docs).`,
        'You may confidently answer questions based on that knowledge, even if citations are not present — as long as you don’t invent features.',
        'Use RAG context and citations where helpful, but don’t block answers if RAG is missing. If unsure, briefly say so and link to support, docs, or pricing.',
        'Use a helpful, natural tone. Speak clearly, avoid robotic or repetitive phrases. Prefer links to: Pricing, Blog, Book a Demo.',
        pricing,
        demo,
        cal,
        faqs,
        company,
        'Never say "No verified answer." Instead, offer your best available insight and point the user toward the next step.',
        'Output valid JSON with keys: {content, sources, tutorial}. If no sources are found, you may still answer confidently using product knowledge. Never say "no verified answer" — instead, say what you do know and offer a link or next step.'
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
    const citationBlock = sources?.length ? `\n\nSources:\n${sources.map(s => `- ${s.title} (${s.url})`).join('\n')}` : '';

    // Include RAG snippets to ground the answer
    // Deterministic knowledge routing for common questions
    const deterministicKnowledge: Record<string, { title: string; url: string }[]> = {
      'how do i launch a campaign': [ { title: 'Flow of HirePilot', url: 'https://thehirepilot.com/blog/flow-of-hirepilot' } ],
      "what's included in pro plan": [ { title: 'HirePilot Pricing', url: 'https://thehirepilot.com/pricing' } ],
      'what is hirepilot': [ { title: 'HirePilot Home', url: 'https://thehirepilot.com/' } ],
    };
    const key = (lastUser?.text || '').toLowerCase().trim();
    const deterministic = Object.keys(deterministicKnowledge).find(k => k.split(' ').every(w => key.includes(w)));
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
    
    // Basic RAG diagnostics
    console.log('[rex_widget/chat] 🧠 Query:', lastUser?.text);
    console.log('[rex_widget/chat] 🔍 RAG snippets count:', contextSnippets.length);
    console.log('[rex_widget/chat] 📚 Sources:', sources);

    const ragBlock = contextSnippets.length ? `\n\nContext:\n${contextSnippets.map((s, i) => `(${i + 1}) ${s}`).join('\n')}` : '';
    const buildGroundedMessages = () => ([
      {
        role: 'system',
        content: `${sys}${citationBlock}${ragBlock}\n\nReturn ONLY JSON: {content, sources, tutorial}.`,
      },
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

    // Use clean handler flow for REX mode
    if (mode === 'rex' && lastUser?.text) {
      try {
        const rex = await handleRexMessage(lastUser.text);
        content = rex.content || content;
        // Allow string links; normalize later
        outSources = (rex.sources as any) || [];
        tutorial = rex.tutorial ?? tutorial;
      } catch {}
    }

    function answerIsWeak(txt: string, intent?: string) {
      const t = (txt || '').toLowerCase();
      const weakPhrases = [
        'no verified answer',
        'here’s what i found',
        "here's what i found",
        'thanks!',
        'i recommend you to book a demo',
        'i’m not sure',
        "i'm not sure",
        'i cannot answer',
      ];
      const noSourcesWeak = intent === 'greeting_smalltalk' ? false : ((outSources || []).length === 0);
      return weakPhrases.some(p => t.includes(p)) || noSourcesWeak;
    }

    // Relaxed guardrail (skip for rex mode since handler already does fallbacks)
    if (mode !== 'rex') {
      if ((/price|pricing|pro plan|plans?|what is hirepilot|compare|different|vs\b/i.test(lastUser?.text || '')) && (!sources || sources.length === 0) && plan.intent !== 'greeting_smalltalk') {
        content = 'Here’s a quick overview based on what I know. For the latest details, check our pricing page or book a quick demo.';
        if (!outSources.find((s: any) => /pricing/i.test(s.title))) outSources.push({ title: 'HirePilot Pricing', url: 'https://thehirepilot.com/pricing' });
      }
    }

    // If still generic and we have RAG snippets, nudge a second pass to produce concrete steps.
    if (mode !== 'rex' && !tutorial && mode !== 'sales' && contextSnippets.length && /refer to|documentation|support resources/i.test(content)) {
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
    if (mode !== 'rex' && lastUser?.text && plan.intent !== 'greeting_smalltalk' && (answerIsWeak(content, plan.intent) || contextSnippets.length === 0)) {
      try {
        // Add competitor context if relevant
        await maybeAddCompetitorContext(lastUser.text);
        // Recompute rag block to include any newly added context
        const dynamicRagBlock = contextSnippets.length ? `\n\nContext:\n${contextSnippets.map((s, i) => `(${i + 1}) ${s}`).join('\n')}` : '';
        const resp = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            { role: 'system', content: `${sys}${citationBlock}${dynamicRagBlock}\n\nRewrite the following weak or generic answer into a confident, helpful, product-aware response. Use provided context where possible. Return JSON: {content, sources, tutorial}.` },
            { role: 'user', content: `Answer: ${content}` },
          ],
        });
        try {
          const raw = resp.choices?.[0]?.message?.content || '';
          const parsed = JSON.parse(raw);
          content = parsed.content || content;
          if (parsed.sources) outSources = parsed.sources;
          if (parsed.tutorial) tutorial = parsed.tutorial;
        } catch {}
      } catch (fallbackErr) {
        await logEvent('rex_widget_grounded_fallback_error', { error: String(fallbackErr) });
      }
    }

    // Heuristic: pricing → only summarize if settings provide tiers. Never invent.
    if (mode !== 'rex' && /\b(price|pricing|pro plan|plans?|cost|how\s*much)\b/i.test(lastUser?.text || '')) {
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

    // Final safety: if response is empty, offer useful next steps (never say "No verified answer")
    if (mode !== 'rex' && (!content || !content.trim())) {
      const cal = settings['rex_calendly_url'];
      content = `I’m not totally sure — but you can ${cal ? `[Book a Demo](${cal})` : 'book a demo'} or check out our [Pricing Page](https://thehirepilot.com/pricing). Want help choosing a plan?`;
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

    // Normalize sources to array of {title,url}
    const normalizeSources = (val: any): { title: string; url: string }[] => {
      try {
        if (!val) return [];
        const v = Array.isArray(val) ? val : (typeof val === 'object' && Array.isArray((val as any).sources) ? (val as any).sources : []);
        const mapped = (v as any[]).filter(Boolean).map((s: any) => {
          if (typeof s === 'string') {
            const url = s;
            try {
              const u = new URL(url);
              const host = u.hostname.replace(/^www\./, '');
              return { title: host, url };
            } catch { return { title: 'Source', url }; }
          }
          return { title: String(s?.title || '').slice(0, 200), url: String(s?.url || '') };
        });
        return mapped.filter(s => !!s.title && !!s.url);
      } catch { return []; }
    };
    const safeSources = normalizeSources(outSources);

    // Persist assistant message
    await supabase.from('rex_widget_messages').insert({ session_id: sessionId, role: 'assistant', text: content, sources: safeSources as any, tutorial });
    // Optional Slack mirror of assistant responses (trim to avoid noisy payloads)
    try {
      const slackMirror = String(process.env.SLACK_WIDGET_MIRROR || '').toLowerCase() === 'true';
      const slackUrl = process.env.SLACK_WIDGET_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
      if (slackMirror && slackUrl && lastUser?.text) {
        const u = (lastUser.text || '').slice(0, 300);
        const a = (content || '').slice(0, 500);
        await axios.post(slackUrl, { text: `REX Widget Reply\nSession: ${sessionId}\nUser: ${u}\nAssistant: ${a}` });
      }
    } catch {}
    // Persist session meta updates
    const newMeta: SessionMeta = { ...meta, state: (plan.state || plan.state_patch?.state) as any, last_intent: (plan.intent as any) || meta.last_intent, collected: { ...(meta.collected||{}), ...(plan.state_patch?.collected||{}) }, support_ctx: { ...(meta.support_ctx||{}), ...(plan.state_patch?.support_ctx||{}) } };
    await supabase.from('rex_widget_sessions').update({ meta: newMeta }).eq('id', sessionId);

    res.json({ threadId: sessionId, message: { text: content, sources: safeSources, tutorial }, cta: (plan.response?.cta || plan.cta), state: (plan.state || plan.state_patch?.state), intent: plan.intent });
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

    // Fan-out: Slack (use widget-specific webhook if present)
    const slackUrl = process.env.SLACK_WIDGET_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
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
    console.log('[handoff] hit', {
      headers: req.headers,
      body: req.body,
    });
    const { threadId, reason } = req.body as { threadId: string; reason?: string };
    const { data: msgs } = await supabase
      .from('rex_widget_messages')
      .select('role,text,created_at')
      .eq('session_id', threadId)
      .order('created_at', { ascending: true })
      .limit(50);

    const transcript = (msgs || []).map((m: any) => `${m.created_at} - ${m.role.toUpperCase()}: ${m.text}`).join('\n');

    // Prefer Slack Web API (to capture thread_ts) if configured; fallback to webhook otherwise
    const botToken = process.env.SLACK_BOT_TOKEN;
    const channelId = process.env.SLACK_CHANNEL_ID; // e.g., C123...
    let threadTs: string | null = null;
    if (botToken && channelId) {
      try {
        const slack = new WebClient(botToken);
        const result = await slack.chat.postMessage({
          channel: channelId,
          text: `REX Widget Handoff (${reason || 'general'})\nSession: ${threadId}\n\n${transcript}`,
          unfurl_links: false,
          unfurl_media: false,
        });
        threadTs = (result as any)?.ts || null;
      } catch (e) {
        console.error('[rex_widget/handoff] Slack Web API post failed, falling back to webhook', e);
      }
    }

    if (!threadTs) {
      const slackUrl = process.env.SLACK_WEBHOOK_URL;
      if (slackUrl) {
        try { await axios.post(slackUrl, { text: `REX Widget Handoff (${reason || 'general'})\nSession: ${threadId}\n\n${transcript}` }); } catch {}
      }
    }

    // Create live session row if we have a root thread ts + channel id
    if (threadTs && channelId) {
      try {
        // Try to find existing by widget_session_id
        const { data: existingByWidget } = await supabase
          .from('rex_live_sessions')
          .select('id')
          .eq('widget_session_id', threadId)
          .maybeSingle();
        if (existingByWidget?.id) {
          await supabase
            .from('rex_live_sessions')
            .update({ slack_channel_id: channelId, slack_thread_ts: threadTs })
            .eq('id', existingByWidget.id);
        } else {
          // Check existing by channel/thread
          const { data: existingByThread } = await supabase
            .from('rex_live_sessions')
            .select('id')
            .eq('slack_channel_id', channelId)
            .eq('slack_thread_ts', threadTs)
            .maybeSingle();
          if (existingByThread?.id) {
            await supabase
              .from('rex_live_sessions')
              .update({ widget_session_id: threadId })
              .eq('id', existingByThread.id);
          } else {
            await supabase
              .from('rex_live_sessions')
              .insert({
                widget_session_id: threadId,
                slack_channel_id: channelId,
                slack_thread_ts: threadTs,
                user_email: null,
                user_name: null,
              });
          }
        }
      } catch (insErr) {
        console.error('[rex_widget/handoff] ensure live session mapping failed', insErr);
      }
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
    const { sessionId, summary, details } = req.body as { sessionId?: string; summary: string; details?: string };
    const anonId = getAnonId(req);
    // Accept non-UUID session identifiers from public pages; coerce invalid to null
    const isUuid = typeof sessionId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId);
    const sessionIdOrNull = isUuid ? sessionId : null;
    const { data, error } = await supabase
      .from('rex_tickets')
      .insert({ session_id: sessionIdOrNull, anon_id: anonId, summary, details: details || null })
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


