import type { ApiHandler } from '../../apiRouter';
import { createClient } from '@supabase/supabase-js';

const handler: ApiHandler = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const { query, tags, limit } = (req.body || {}) as { query?: string; tags?: string[]; limit?: number };
  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const matchTags: string[] = Array.isArray(tags) && tags.length ? tags : [];
    let suggestions: any[] = [];
    if (matchTags.length) {
      const { data } = await supabase
        .from('support_playbook')
        .select('title, suggestion, tag, weight')
        .in('tag', matchTags)
        .order('weight', { ascending: false })
        .limit(Math.min(limit || 2, 2));
      suggestions = data || [];
    } else if (query) {
      const q = String(query).toLowerCase();
      const derived: string[] = [];
      if (/campaign|sequence|launch/.test(q)) derived.push('campaign');
      if (/pipeline|stage|candidate/.test(q)) derived.push('pipeline');
      if (/linkedin/.test(q)) derived.push('linkedin');
      if (/invite|guest|manager|collab/.test(q)) derived.push('collaboration');
      if (/enrich|enrichment|apollo/.test(q)) derived.push('enrichment');
      const uniq = Array.from(new Set(derived));
      if (uniq.length) {
        const { data } = await supabase
          .from('support_playbook')
          .select('title, suggestion, tag, weight')
          .in('tag', uniq)
          .order('weight', { ascending: false })
          .limit(Math.min(limit || 2, 2));
        suggestions = data || [];
      }
    }
    res.json({ suggestions });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'suggest failed' });
  }
};

export default handler;


