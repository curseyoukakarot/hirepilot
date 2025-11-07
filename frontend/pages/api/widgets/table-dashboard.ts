import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseForRequest, getBearerToken, assertAuth } from '../_utils/supabaseServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const token = getBearerToken(req);
    assertAuth(token);
    const supabase = createSupabaseForRequest(req);
    const { table_id, limit = '10' } = (req.query || {}) as any;
    const lim = Math.max(1, Math.min(100, Number(limit || '10')));
    if (!table_id) return res.status(400).json({ error: 'table_id required' });
    const { data, error } = await supabase
      .from('custom_tables')
      .select('name,schema_json,data_json')
      .eq('id', String(table_id))
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return res.status(404).json({ error: 'Not found' });
    const schema = Array.isArray((data as any).schema_json) ? (data as any).schema_json : [];
    const rows = Array.isArray((data as any).data_json) ? (data as any).data_json : [];
    return res.status(200).json({ name: (data as any).name, schema, rows: rows.slice(0, lim) });
  } catch (e: any) {
    const code = e?.statusCode || 500;
    return res.status(code).json({ error: e?.message || 'Failed' });
  }
}


