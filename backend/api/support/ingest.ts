import type { ApiHandler } from '../../apiRouter';
import { createClient } from '@supabase/supabase-js';

type KnowledgeItem = {
  type: 'tool' | 'faq' | 'blog' | 'plan';
  title?: string;
  content: string;
  restricted?: boolean;
};

async function embedBatch(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY as string;
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts.map(t => t.slice(0,8000)) })
  });
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  return data.data.map((d: any) => d.embedding);
}

const handler: ApiHandler = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const items = (req.body?.items || []) as KnowledgeItem[];
  if (!Array.isArray(items) || items.length === 0) { res.status(400).json({ error: 'Provide items[]' }); return; }

  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const embeddings = await embedBatch(items.map(i => i.content));
    const payload = items.map((i, idx) => ({
      type: i.type,
      title: i.title || null,
      content: i.content,
      restricted: !!i.restricted,
      embedding: embeddings[idx] as any,
    }));
    const { data, error } = await supabase.from('support_knowledge').insert(payload).select('id');
    if (error) throw error;
    res.json({ inserted: data?.length || 0 });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'ingest failed' });
  }
};

export default handler;


