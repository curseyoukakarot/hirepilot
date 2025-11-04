import { createSupabaseForRequest, getBearerToken, assertAuth } from '../_utils/supabaseServer';

export default async function handler(req: any, res: any) {
  try {
    const token = getBearerToken(req);
    assertAuth(token);
    const supabase = createSupabaseForRequest(req);
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('rex_reports')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ data: data || [] });
  } catch (e: any) {
    return res.status(e?.statusCode || 500).json({ error: e?.message || 'Failed' });
  }
}


