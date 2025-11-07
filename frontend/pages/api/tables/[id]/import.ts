import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAuthed } from '../../_utils/tables';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { supabase } = getSupabaseAuthed(req);
    const { id } = req.query as { id: string };
    const body = (req.body && typeof req.body === 'string') ? JSON.parse(req.body) : (req.body || {});
    const source = String(body.source || '').toLowerCase();

    const { data: table, error: fetchErr } = await supabase
      .from('custom_tables')
      .select('id,name,schema_json,data_json')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!table) return res.status(404).json({ error: 'Not found' });

    let schema = (table as any).schema_json as any[] || [];
    let rows = (table as any).data_json as any[] || [];

    if (source === '/deals' || source === 'deals' || source === '/opportunities' || source === 'opportunities') {
      const { data: opps } = await supabase
        .from('opportunities')
        .select('title,value,stage,created_at')
        .limit(1000);
      // Ensure schema has basic deal columns
      const ensure = (name: string, type: string) => {
        if (!schema.some(c => String(c.name) === name)) schema.push({ name, type });
      };
      ensure('Deal Title', 'text');
      ensure('Value', 'number');
      ensure('Status', 'status');
      ensure('Created', 'date');
      rows = (opps || []).map(o => ({
        'Deal Title': o?.title || 'Deal',
        'Value': Number(o?.value) || 0,
        'Status': o?.stage || 'Pipeline',
        'Created': o?.created_at || null,
      }));
    } else if (source === '/jobs' || source === 'jobs') {
      const { data: jobs } = await supabase
        .from('job_requisitions')
        .select('title,status,candidate_count,created_at')
        .limit(1000);
      const ensure = (name: string, type: string) => { if (!schema.some(c => String(c.name) === name)) schema.push({ name, type }); };
      ensure('Position', 'text');
      ensure('Candidates', 'number');
      ensure('Status', 'status');
      ensure('Created', 'date');
      rows = (jobs || []).map(j => ({
        'Position': j?.title || 'Job',
        'Candidates': Number(j?.candidate_count) || 0,
        'Status': j?.status || 'Open',
        'Created': j?.created_at || null,
      }));
    } else if (source === '/analytics' || source === 'analytics') {
      // Example: source attribution
      const { data: candidates } = await supabase
        .from('candidates')
        .select('source, hire_status')
        .limit(5000);
      const ensure = (name: string, type: string) => { if (!schema.some(c => String(c.name) === name)) schema.push({ name, type }); };
      ensure('Source', 'text');
      ensure('Hires', 'number');
      const map = new Map<string, number>();
      (candidates || []).forEach(c => {
        const s = String((c as any)?.source || 'unknown');
        const hired = !!(c as any)?.hire_status;
        if (hired) map.set(s, (map.get(s) || 0) + 1);
      });
      rows = Array.from(map.entries()).map(([k, v]) => ({ 'Source': k, 'Hires': v }));
    } else {
      return res.status(400).json({ error: 'Unsupported source' });
    }

    const { data: updated, error } = await supabase
      .from('custom_tables')
      .update({ schema_json: schema, data_json: rows, updated_at: new Date().toISOString() })
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


