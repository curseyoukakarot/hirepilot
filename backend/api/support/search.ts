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
  const { query, limit } = (req.body || {}) as { query?: string; limit?: number };
  if (!query) { res.status(400).json({ error: 'Missing query' }); return; }

  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const vector = await embed(query);
    const { data, error } = await supabase
      .rpc('search_support_knowledge', { query_embedding: vector as any, match_limit: Math.min(Math.max(limit || 5, 1), 10) });
    if (error) throw error;
    res.json({ results: data || [] });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'search failed' });
  }
};

export default handler;


