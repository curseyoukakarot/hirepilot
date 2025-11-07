import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAuthed, evaluateFormulas } from '../../_utils/tables';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { supabase } = getSupabaseAuthed(req);
    const { id } = req.query as { id: string };
    const body = (req.body && typeof req.body === 'string') ? JSON.parse(req.body) : (req.body || {});
    const enrich_with = String(body.enrich_with || '').toLowerCase();
    const incomingRows: Array<Record<string, any>> = Array.isArray(body.data) ? body.data : [];

    const { data: table, error: fetchErr } = await supabase
      .from('custom_tables')
      .select('schema_json,data_json')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!table) return res.status(404).json({ error: 'Not found' });

    const schema = Array.isArray((table as any).schema_json) ? (table as any).schema_json : [];
    let dataRows = Array.isArray((table as any).data_json) ? (table as any).data_json : [];

    if (incomingRows.length) {
      // Ensure schema has any new keys from incoming rows
      const keys = Array.from(new Set(incomingRows.flatMap(r => Object.keys(r || {}))));
      const have = new Set(schema.map((c: any) => String(c.name)));
      const newCols = keys.filter(k => !have.has(k)).map(k => ({ name: k, type: 'text' }));
      if (newCols.length) schema.push(...newCols as any);
      dataRows = [...dataRows, ...incomingRows];
    }

    if (enrich_with === 'formula') {
      dataRows = evaluateFormulas(schema as any, dataRows as any) as any;
    }

    const { data: updated, error } = await supabase
      .from('custom_tables')
      .update({ schema_json: schema, data_json: dataRows, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return res.status(200).json({ data: updated });
  } catch (e: any) {
    const code = e?.statusCode || 500;
    return res.status(code).json({ error: e?.message || 'Failed' });
  }
}


