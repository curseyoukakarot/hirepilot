import { createSupabaseForRequest, getBearerToken, assertAuth } from '../_utils/supabaseServer';

function simpleRoute(query: string) {
  const q = (query || '').toLowerCase();
  if (q.includes('email') && q.includes('linkedin')) {
    return { type: 'bar-chart', source: 'source_attribution', filters: { source: ['email','linkedin'] } };
  }
  if (q.includes('win') && q.includes('rate')) {
    return { type: 'kpi', source: 'win_rates', filters: {} };
  }
  if (q.includes('revenue') || q.includes('forecast')) {
    return { type: 'line-chart', source: 'revenue_monthly', filters: {} };
  }
  return { type: 'table', source: 'latencies', filters: {} };
}

export default async function handler(req: any, res: any) {
  try {
    const token = getBearerToken(req);
    assertAuth(token);
    const supabase = createSupabaseForRequest(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const query = body?.query as string;
    if (!query) return res.status(400).json({ error: 'Missing query' });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const route = simpleRoute(query);
    const name = query.slice(0, 64);

    const { data: inserted, error } = await supabase
      .from('rex_reports')
      .insert({ user_id: user.id, name, widget_json: route, created_by_rex: true })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ template: inserted });
  } catch (e: any) {
    return res.status(e?.statusCode || 500).json({ error: e?.message || 'Failed' });
  }
}


