import type { ApiHandler } from '../../apiRouter';
import { createClient } from '@supabase/supabase-js';
import { chatLLM } from '../../lib/llm';
import { spawnSync } from 'child_process';

async function embed(text: string): Promise<number[]> {
  const key = process.env.OPENAI_API_KEY as string;
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) })
  });
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  return data.data?.[0]?.embedding || [];
}

type ToolGroup =
  | 'support.authentication'
  | 'support.messaging_email'
  | 'support.campaigns'
  | 'support.leads'
  | 'support.candidates'
  | 'support.job_reqs_applications'
  | 'support.pipelines'
  | 'support.deals_billing'
  | 'support.rex_tools'
  | 'support.sniper'
  | 'support.chrome_extension'
  | 'support.integrations'
  | 'support.tables'
  | 'support.admin_permissions'
  | 'support.system_limits'
  | 'support.automations'
  | 'support.troubleshooting';

function classifyGroup(q: string): ToolGroup | null {
  const s = q.toLowerCase();
  if (/(login|workspace|invite|collaborator|owner|permission|role)/.test(s)) return 'support.authentication';
  if (/(gmail|outlook|email|sendgrid|reply|thread|deliverability)/.test(s)) return 'support.messaging_email';
  if (/(campaign|sequence|outreach|follow.?up|launch)/.test(s)) return 'support.campaigns';
  if (/(lead|enrich|apollo|hunter|skrapp)/.test(s)) return 'support.leads';
  if (/(candidate|resume|drawer|submission)/.test(s)) return 'support.candidates';
  if (/(job req|req\b|application|job post|apply|applicant)/.test(s)) return 'support.job_reqs_applications';
  if (/(pipeline|stage)/.test(s)) return 'support.pipelines';
  if (/(deal|opportunit|invoice|billing|plan|credit|subscription)/.test(s)) return 'support.deals_billing';
  if (/(rex|agent)/.test(s)) return 'support.rex_tools';
  if (/(sniper|linkedin|connect request|warm.?up|proxy|browserless)/.test(s)) return 'support.sniper';
  if (/(chrome extension|extension|sales navigator button)/.test(s)) return 'support.chrome_extension';
  if (/(zapier|make\.com|slack|apollo|stripe|browserless|decodo|integration)/.test(s)) return 'support.integrations';
  if (/(view|filter|table|column|report|dashboard)/.test(s)) return 'support.tables';
  if (/(permission|role|admin)/.test(s)) return 'support.admin_permissions';
  if (/(limit|rate|error|429|500|escalate|outage|safety)/.test(s)) return 'support.system_limits';
  if (/(automation|workflow|trigger|action|zap)/.test(s)) return 'support.automations';
  if (/(not working|bug|issue|troubleshoot|help)/.test(s)) return 'support.troubleshooting';
  return null;
}

function runMcpTool(tool: ToolGroup, question: string): Array<{ filename: string; headings: string[]; excerpt: string; confidence: number }> {
  // Map tool name to local command (see server/mcp-support/mcp.json)
  const binMap: Record<ToolGroup, string> = {
    'support.authentication': 'server/mcp-support/tools/authentication.js',
    'support.messaging_email': 'server/mcp-support/tools/messaging_email.js',
    'support.campaigns': 'server/mcp-support/tools/campaigns.js',
    'support.leads': 'server/mcp-support/tools/leads.js',
    'support.candidates': 'server/mcp-support/tools/candidates.js',
    'support.job_reqs_applications': 'server/mcp-support/tools/job_reqs_applications.js',
    'support.pipelines': 'server/mcp-support/tools/pipelines.js',
    'support.deals_billing': 'server/mcp-support/tools/deals_billing.js',
    'support.rex_tools': 'server/mcp-support/tools/rex_tools.js',
    'support.sniper': 'server/mcp-support/tools/sniper.js',
    'support.chrome_extension': 'server/mcp-support/tools/chrome_extension.js',
    'support.integrations': 'server/mcp-support/tools/integrations.js',
    'support.tables': 'server/mcp-support/tools/tables.js',
    'support.admin_permissions': 'server/mcp-support/tools/admin_permissions.js',
    'support.system_limits': 'server/mcp-support/tools/system_limits.js',
    'support.automations': 'server/mcp-support/tools/automations.js',
    'support.troubleshooting': 'server/mcp-support/tools/troubleshooting.js',
  };
  const cmd = binMap[tool];
  if (!cmd) return [];
  const payload = JSON.stringify({ question });
  const out = spawnSync('node', [cmd], { input: payload, encoding: 'utf8' });
  if (out.error) return [];
  try {
    const json = JSON.parse(out.stdout || out.stderr || '{}');
    return Array.isArray(json?.results) ? json.results : [];
  } catch {
    return [];
  }
}

const handler: ApiHandler = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const { query, userId, history = [] } = (req.body || {}) as { query?: string; userId?: string | null, history?: Array<{ role: 'user'|'assistant', content: string }> };
  if (!query) { res.status(400).json({ error: 'Missing query' }); return; }
  try {
    const q = String(query);
    const isAction = /(move|execute|launch|create|delete|update|do this)/i.test(q);
    const isBug = /(bug|error|not working|issue|broken|fails|crash|can't|cannot)/i.test(q);

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // New behavior: even if it's an action request, try to return steps from docs first.

    if (isBug) {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert([{ user_id: userId || null, query: q, status: 'open' }])
        .select()
        .single();
      if (error) throw error;
      const hook = process.env.SLACK_SUPPORT_WEBHOOK_URL;
      if (hook) {
        try { await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `📩 New Support Ticket\nUser: ${userId || 'anon'}\nQuery: ${q}\nTicket ID: ${data.id}` }) }); } catch {}
      }
      res.json({ response: `Thanks for flagging this — I logged it for our team. Ticket ID: ${data.id}. We’ll take a look and follow up.`, escalation: 'support_ticket' });
      return;
    }

    // Retrieval via MCP tools first (file-based excerpts)
    let contextBlocks = '';
    const group = classifyGroup(q);
    if (group) {
      const mcp = runMcpTool(group, q);
      if (mcp.length) {
        contextBlocks = mcp
          .map((r, i) => `#${i + 1} [${r.filename}${r.headings?.length ? `: ${r.headings.join(' › ')}` : ''}]\n${r.excerpt}`)
          .join('\n\n');
      }
    }

    // Fallback to vector search if MCP had no hits
    if (!contextBlocks) {
      const vector = await embed(q);
      const { data: results } = await supabase.rpc('search_support_knowledge', { query_embedding: vector as any, match_limit: 4 });
      contextBlocks = (Array.isArray(results) ? results : []).map((r: any, i: number) => `#${i + 1} [${r.type}:${r.title}] ${r.content}`).join('\n\n');
    }

    // Suggestions
    const derived: string[] = [];
    const lq = q.toLowerCase();
    if (/campaign|sequence|launch/.test(lq)) derived.push('campaign');
    if (/pipeline|stage|candidate/.test(lq)) derived.push('pipeline');
    if (/linkedin/.test(lq)) derived.push('linkedin');
    if (/invite|guest|manager|collab/.test(lq)) derived.push('collaboration');
    if (/enrich|enrichment|apollo/.test(lq)) derived.push('enrichment');
    const uniq = Array.from(new Set(derived));
    let tips = '';
    if (uniq.length) {
      const { data: suggs } = await supabase
        .from('support_playbook')
        .select('suggestion')
        .in('tag', uniq)
        .order('weight', { ascending: false })
        .limit(2);
      if (Array.isArray(suggs) && suggs.length) tips = suggs.map((s: any) => `• ${s.suggestion}`).join('\n');
    }
    const SYSTEM = `You are REX, HirePilot’s AI-powered Account Manager and Customer Success partner.
Warm, friendly, consultative. Explain with brief steps and UI breadcrumbs. Never execute actions here; redirect to REX chat/Slack if asked to do something. Add one practical idea only when helpful. Avoid sounding like a manual.`;

    const messages: Array<{ role: 'system'|'user'|'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM },
      ...history.slice(-6),
      { role: 'user', content: `Question: "${q}"
Context (summaries; paraphrase, do not paste verbatim):
${contextBlocks || '(none)'}
Optional Ideas:\n${tips}` }
    ];
    const text = await chatLLM(messages);
    // If the user asked to perform an action, nudge to REX chat after giving guidance
    const escalation = isAction ? 'rex_chat' : 'none';
    res.json({ response: text || 'Thanks! Let me know what you want to do next.', escalation });
    return;
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'answer failed' });
  }
};

export default handler;


