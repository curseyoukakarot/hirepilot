import { createSupabaseForRequest, getBearerToken, assertAuth } from '../_utils/supabaseServer';

export default async function handler(req: any, res: any) {
  try {
    const token = getBearerToken(req);
    assertAuth(token);
    const supabase = createSupabaseForRequest(req);

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const layout = body?.layout;
    if (!Array.isArray(layout)) return res.status(400).json({ error: 'layout must be an array' });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Update-if-exists, else insert (table may not have a unique constraint on user_id)
    const { data: existing } = await supabase
      .from('user_dashboards')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from('user_dashboards')
        .update({ layout, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (error) return res.status(500).json({ error: error.message });
    } else {
      const { error } = await supabase
        .from('user_dashboards')
        .insert({ user_id: user.id, layout, updated_at: new Date().toISOString() });
      if (error) return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(e?.statusCode || 500).json({ error: e?.message || 'Failed' });
  }
}


