import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAuthed } from '../../_utils/tables';

function toCSV(rows: Array<Record<string, any>>) {
  const list = Array.isArray(rows) ? rows : [];
  const headers = Array.from(new Set(list.flatMap(r => Object.keys(r || {}))));
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    const needsQuote = /[",\n]/.test(s);
    return needsQuote ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(','),
    ...list.map(r => headers.map(h => escape((r as any)[h])).join(',')),
  ];
  return lines.join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { supabase } = getSupabaseAuthed(req);
    const { id } = req.query as { id: string };
    const format = String((req.query?.format as string) || 'csv').toLowerCase();

    const { data: table, error } = await supabase
      .from('custom_tables')
      .select('name,data_json')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!table) return res.status(404).json({ error: 'Not found' });

    const rows = (table as any).data_json as any[] || [];
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(JSON.stringify(rows));
    }
    // Default CSV
    const csv = toCSV(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${String((table as any).name || 'table').replace(/[^a-z0-9_\-]+/gi, '_')}.csv"`);
    return res.status(200).send(csv);
  } catch (e: any) {
    const code = e?.statusCode || 500;
    return res.status(code).json({ error: e?.message || 'Failed' });
  }
}


