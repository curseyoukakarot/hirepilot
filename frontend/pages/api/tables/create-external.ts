import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAuthed } from './_utils/tables';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Prefer Authorization if present, else allow API key auth via api_keys table
    let uid: string | null = null;
    let supabaseClient = null as any;
    try {
      const { supabase } = getSupabaseAuthed(req);
      supabaseClient = supabase;
      const { data: { user } } = await supabase.auth.getUser((req.headers.authorization || '').replace(/^Bearer\s+/i, '') as any);
      uid = user?.id || null;
    } catch {}

    const body = (req.body && typeof req.body === 'string') ? JSON.parse(req.body) : (req.body || {});
    const { name, schema_json = [], initial_data = [], user_api_key } = body || {};

    if (!uid && user_api_key) {
      // Try to map API key to user_id if api_keys table exists
      try {
        const { data } = await (supabaseClient as any)
          .from('api_keys')
          .select('user_id')
          .eq('key', user_api_key)
          .maybeSingle();
        uid = data?.user_id || null;
      } catch {}
    }

    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await (supabaseClient as any)
      .from('custom_tables')
      .insert({ user_id: uid, name: String(name || 'Untitled Table').slice(0, 200), schema_json: Array.isArray(schema_json) ? schema_json : [], data_json: Array.isArray(initial_data) ? initial_data : [] })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return res.status(200).json({ data });
  } catch (e: any) {
    const code = e?.statusCode || 500;
    return res.status(code).json({ error: e?.message || 'Failed' });
  }
}


