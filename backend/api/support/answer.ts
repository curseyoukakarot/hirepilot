import type { ApiHandler } from '../../apiRouter';
import { createClient } from '@supabase/supabase-js';

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

const handler: ApiHandler = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const { query, userId } = (req.body || {}) as { query?: string; userId?: string | null };
  if (!query) { res.status(400).json({ error: 'Missing query' }); return; }
  try {
    const q = String(query);
    const isAction = /(move|execute|send|launch|create|delete|update|do this)/i.test(q);
    const isBug = /(bug|error|not working|issue|broken|fails|crash|can't|cannot)/i.test(q);

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    if (isAction) {
      return res.json({
        response: "I can’t run that directly, but it’s quick to do in REX chat. Open the REX drawer and say what you want done — I’ll handle it from there.",
        escalation: 'rex_chat'
      });
    }

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
      return res.json({ response: `Thanks for flagging this — I logged it for our team. Ticket ID: ${data.id}. We’ll take a look and follow up.`, escalation: 'support_ticket' });
    }

    // Retrieval
    const vector = await embed(q);
    const { data: results } = await supabase.rpc('search_support_knowledge', { query_embedding: vector as any, match_limit: 5 });
    let top = '';
    if (Array.isArray(results) && results.length) {
      top = results.slice(0, 3).map((h: any) => `• ${h.title || h.type}: ${String(h.content || '').slice(0, 240)}${(h.content || '').length > 240 ? '…' : ''}`).join('\n');
      if (results.some((h: any) => h.restricted)) top += '\n\nNote: Some features are explain-only here. Use REX chat to execute.';
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
      if (Array.isArray(suggs) && suggs.length) tips = '\n\n' + suggs.map((s: any) => `💡 ${s.suggestion}`).join('\n');
    }
    const response = top ? `${top}${tips}` : `I don’t have that answer yet. Quick option: open the REX drawer and ask directly — I’ll take care of it.`;
    return res.json({ response, escalation: 'none' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'answer failed' });
  }
};

export default handler;


