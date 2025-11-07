import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAuthed, evaluateFormulas } from '../../_utils/tables';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'PATCH' && req.method !== 'POST') {
      res.setHeader('Allow', 'PATCH, POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { supabase } = getSupabaseAuthed(req);
    const { id } = req.query as { id: string };
    const body = (req.body && typeof req.body === 'string') ? JSON.parse(req.body) : (req.body || {});
    const name = typeof body.name === 'string' ? String(body.name).slice(0, 200) : undefined;
    const schema_json = Array.isArray(body.schema_json) ? body.schema_json : undefined;
    const data_json = Array.isArray(body.data_json) ? body.data_json : undefined;
    const collaborators = Array.isArray(body.collaborators) ? body.collaborators : undefined;

    let nextData = data_json;
    if (schema_json && data_json) {
      nextData = evaluateFormulas(schema_json as any, data_json as any);
    }

    const updater: any = {};
    if (name !== undefined) updater.name = name;
    if (schema_json !== undefined) updater.schema_json = schema_json;
    if (nextData !== undefined) updater.data_json = nextData;
    if (collaborators !== undefined) updater.collaborators = collaborators;
    updater.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('custom_tables')
      .update(updater)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json({ data });
  } catch (e: any) {
    const code = e?.statusCode || 500;
    return res.status(code).json({ error: e?.message || 'Failed' });
  }
}


