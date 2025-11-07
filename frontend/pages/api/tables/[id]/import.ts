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
    const filters = (body && typeof body.filters === 'object' && body.filters) ? body.filters : {};

    const { data: table, error: fetchErr } = await supabase
      .from('custom_tables')
      .select('id,name,schema_json,data_json')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!table) return res.status(404).json({ error: 'Not found' });

    let schema = (table as any).schema_json as any[] || [];
    let rows = (table as any).data_json as any[] || [];
    const ensure = (name: string, type: string) => { if (!schema.some(c => String(c.name) === name)) schema.push({ name, type }); };
    const inferAppend = (list: Array<Record<string, any>>) => {
      if (!Array.isArray(list) || list.length === 0) return;
      const keys = Array.from(new Set(list.flatMap(r => Object.keys(r || {}))));
      keys.forEach((k) => { if (!schema.some(c => String(c.name) === k)) ensure(k, 'text'); });
      rows = [...rows, ...list];
    };

    if (source === '/deals' || source === 'deals' || source === '/opportunities' || source === 'opportunities') {
      const { data: opps } = await supabase
        .from('opportunities')
        .select('title,value,stage,created_at')
        .limit(1000);
      // Ensure schema has basic deal columns
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
    } else if (source === '/leads' || source === 'leads') {
      const { data: leads } = await supabase
        .from('leads')
        .select('name,email,status,tags,location,source,user_id')
        .limit(2000);
      const list = (leads || []).filter(l => !filters.status || String(l?.status||'') === String(filters.status)).map(l => ({
        'Name': l?.name || '',
        'Email': l?.email || '',
        'Status': l?.status || '',
        'Tags': Array.isArray(l?.tags) ? l.tags.join(', ') : (l?.tags || ''),
        'Location': l?.location || '',
        'Source': l?.source || ''
      }));
      inferAppend(list);
    } else if (source === '/candidates' || source === 'candidates') {
      const { data: cands } = await supabase
        .from('candidates')
        .select('name,email,status,job_assigned,location,source')
        .limit(2000);
      const list = (cands || []).filter(c => !filters.status || String(c?.status||'') === String(filters.status)).map(c => ({
        'Name': c?.name || '',
        'Email': c?.email || '',
        'Status': c?.status || '',
        'Job': c?.job_assigned || '',
        'Location': c?.location || '',
        'Source': c?.source || ''
      }));
      inferAppend(list);
    } else if (source === '/campaigns' || source === 'campaigns') {
      const { data: camps } = await supabase
        .from('campaigns')
        .select('name,status,leads_count,outreach_sent,reply_rate,conversion_rate,created_at')
        .limit(2000);
      const list = (camps || []).map(c => ({
        'Name': c?.name || '',
        'Status': c?.status || '',
        'Leads': Number((c as any)?.leads_count) || 0,
        'Sent': Number((c as any)?.outreach_sent) || 0,
        'ReplyRate': Number((c as any)?.reply_rate) || 0,
        'ConversionRate': Number((c as any)?.conversion_rate) || 0,
        'Created': (c as any)?.created_at || null,
      }));
      inferAppend(list);
    } else if (source === '/analytics' || source === 'analytics') {
      // Example: source attribution
      const { data: candidates } = await supabase
        .from('candidates')
        .select('source, hire_status')
        .limit(5000);
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
      .update({ schema_json: schema, data_json: rows, import_sources: (table as any).import_sources ? [...(table as any).import_sources, source] : [source], updated_at: new Date().toISOString() })
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


