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
      .from('user_dashboards')
      .select('layout')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });

    // Default preset if none
    const defaultLayout = [
      { widget_id: 'Hiring Funnel', position: { x: 0, y: 0 } },
      { widget_id: 'Reply Rate Chart', position: { x: 1, y: 0 } },
      { widget_id: 'Open Rate Widget', position: { x: 2, y: 0 } },
      { widget_id: 'Revenue Forecast', position: { x: 0, y: 1 } },
      { widget_id: 'Deal Pipeline', position: { x: 1, y: 1 } },
      { widget_id: 'Team Performance', position: { x: 2, y: 1 } },
    ];

    return res.status(200).json({ layout: data?.layout || defaultLayout });
  } catch (e: any) {
    return res.status(e?.statusCode || 500).json({ error: e?.message || 'Failed' });
  }
}


