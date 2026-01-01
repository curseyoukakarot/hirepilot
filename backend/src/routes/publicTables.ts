import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { apiKeyAuth } from '../../middleware/apiKeyAuth';
import { supabase } from '../lib/supabase';

const router = express.Router();

type TableRow = {
  id: string;
  name: string | null;
  user_id: string;
  schema_json: any[] | null;
  data_json: any[] | null;
  import_sources: any[] | null;
  updated_at?: string | null;
};

function norm(s: any) {
  return String(s || '').trim().toLowerCase();
}

function ensureCol(schema: any[], label: string, type: any) {
  const key = norm(label);
  if (!key) return schema;
  const exists = (schema || []).some((c) => norm(c?.label || c?.name || c?.key || '') === key);
  if (exists) return schema;
  return [...(schema || []), { name: label, type }];
}

function defaultLeadSchema() {
  return [
    { name: 'Record Type', type: 'text' },
    { name: 'Record ID', type: 'text' },
    { name: 'Name', type: 'text' },
    { name: 'Email', type: 'text' },
    { name: 'Company', type: 'text' },
    { name: 'Title', type: 'text' },
    { name: 'Status', type: 'status' },
    { name: 'LinkedIn', type: 'text' },
    { name: 'Phone', type: 'text' },
    { name: 'Location', type: 'text' },
    { name: 'Source', type: 'text' },
    { name: 'Tags', type: 'text' },
    { name: 'Created', type: 'date' },
  ];
}

function mapLeadToRow(lead: any) {
  const nowIso = new Date().toISOString();
  const recordId =
    String(lead?.record_id || lead?.external_id || lead?.id || '').trim()
    || (crypto.randomUUID ? crypto.randomUUID() : `lead_${Date.now()}_${Math.random().toString(16).slice(2)}`);

  const tags = Array.isArray(lead?.tags) ? lead.tags.join(', ') : (lead?.tags || '');

  const row: Record<string, any> = {
    'Record Type': 'Lead',
    'Record ID': recordId,
    Name: lead?.name || lead?.full_name || '',
    Email: lead?.email || '',
    Company: lead?.company || lead?.company_name || '',
    Title: lead?.title || lead?.job_title || '',
    Status: lead?.status || '',
    LinkedIn: lead?.linkedin_url || lead?.linkedin || '',
    Phone: lead?.phone || '',
    Location: lead?.location || '',
    Source: lead?.source || '',
    Tags: tags,
    Created: lead?.created_at || nowIso,
  };

  // Allow passing additional custom fields; we store them as-is (string keys)
  const extras = lead && typeof lead === 'object' ? lead : {};
  for (const [kRaw, v] of Object.entries(extras)) {
    const k = String(kRaw || '').trim();
    if (!k) continue;
    if (Object.prototype.hasOwnProperty.call(row, k)) continue;
    // Avoid overriding canonical columns by common aliases
    if (['id', 'external_id', 'record_id', 'created_at'].includes(norm(k))) continue;
    row[k] = v;
  }

  return row;
}

async function resolveTableByName(userId: string, tableNameRaw: string): Promise<{ table: TableRow | null; ambiguous?: any[] }> {
  const name = String(tableNameRaw || '').trim();
  if (!name) return { table: null };

  // 1) Exact match (fast)
  const exact = await supabase
    .from('custom_tables')
    .select('id,name,user_id,schema_json,data_json,import_sources,updated_at')
    .eq('user_id', userId)
    .eq('name', name);
  if (exact.error) throw new Error(exact.error.message);
  if (Array.isArray(exact.data) && exact.data.length === 1) return { table: exact.data[0] as any };
  if (Array.isArray(exact.data) && exact.data.length > 1) {
    return { table: null, ambiguous: exact.data.map((t: any) => ({ id: t.id, name: t.name, updated_at: t.updated_at })) };
  }

  // 2) Case-insensitive match (ilike without wildcards == exact string match, case-insensitive)
  const ilike = await supabase
    .from('custom_tables')
    .select('id,name,user_id,schema_json,data_json,import_sources,updated_at')
    .eq('user_id', userId)
    .ilike('name', name);
  if (ilike.error) throw new Error(ilike.error.message);
  if (Array.isArray(ilike.data) && ilike.data.length === 1) return { table: ilike.data[0] as any };
  if (Array.isArray(ilike.data) && ilike.data.length > 1) {
    return { table: null, ambiguous: ilike.data.map((t: any) => ({ id: t.id, name: t.name, updated_at: t.updated_at })) };
  }

  return { table: null };
}

// POST /api/public/tables/append-leads
// Header: X-API-Key: <user api key>
// Body: { table_name: string, leads: Lead[] } OR { table_name: string, lead: Lead }
//
// NOTE: This does NOT write to public.leads; it appends to public.custom_tables.data_json.
router.post('/append-leads', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const body = (req.body && typeof req.body === 'string') ? JSON.parse(req.body) : (req.body || {});
    const table_name = String(body.table_name || '').trim();
    if (!table_name) return res.status(400).json({ error: 'missing_table_name', message: 'You must provide an existing table_name.' });

    const leadsIn = Array.isArray(body.leads) ? body.leads : (body.lead ? [body.lead] : []);
    if (!Array.isArray(leadsIn) || leadsIn.length === 0) return res.status(400).json({ error: 'missing_leads' });
    if (leadsIn.length > 2000) return res.status(400).json({ error: 'too_many_leads', limit: 2000 });

    const resolved = await resolveTableByName(userId, table_name);
    if (resolved.ambiguous) return res.status(409).json({ error: 'ambiguous_table_name', matches: resolved.ambiguous });
    const table = resolved.table;
    if (!table?.id) return res.status(404).json({ error: 'table_not_found_create_first' });

    const existingSources: string[] = Array.isArray(table.import_sources)
      ? table.import_sources.map((s: any) => String(s || '').toLowerCase()).filter(Boolean)
      : [];
    if (existingSources.length && !existingSources.includes('leads')) {
      return res.status(409).json({ error: 'table_source_mismatch', existing_sources: existingSources, requested: 'leads' });
    }

    const existingSchema = Array.isArray(table.schema_json) ? table.schema_json : [];
    const existingRows = Array.isArray(table.data_json) ? table.data_json : [];

    // Dedup by Record ID (if present)
    const recordIdCol = 'Record ID';
    const existingRecordIds = new Set(
      existingRows
        .map((r: any) => (r && (r[recordIdCol] ?? r['Record ID'] ?? r['id'])) || null)
        .filter(Boolean)
        .map((v: any) => String(v))
    );

    const mapped = leadsIn.map(mapLeadToRow);
    const toAdd: any[] = [];
    let skipped = 0;
    for (const r of mapped) {
      const rid = r?.[recordIdCol] ? String(r[recordIdCol]) : '';
      if (rid && existingRecordIds.has(rid)) { skipped += 1; continue; }
      if (rid) existingRecordIds.add(rid);
      toAdd.push(r);
    }

    // Schema expansion (initialize to lead schema if empty)
    let nextSchema: any[] = existingSchema.length ? [...existingSchema] : defaultLeadSchema();
    nextSchema = ensureCol(nextSchema, 'Record Type', 'text');
    nextSchema = ensureCol(nextSchema, 'Record ID', 'text');

    const typeHint = (k: string) => {
      const kk = norm(k);
      if (kk.includes('created') || kk.includes('updated') || kk.includes('date')) return 'date';
      if (kk.includes('value') || kk.includes('revenue') || kk.includes('amount')) return 'number';
      if (kk === 'status' || kk === 'stage') return 'status';
      return 'text';
    };
    const keys = Array.from(new Set(toAdd.flatMap((r: any) => Object.keys(r || {}))));
    for (const k of keys) nextSchema = ensureCol(nextSchema, k, typeHint(k));

    const nextRows = [...existingRows, ...toAdd];
    const nextSources = existingSources.includes('leads') ? existingSources : [...existingSources, 'leads'];

    const { data: updated, error: updErr } = await supabase
      .from('custom_tables')
      .update({
        schema_json: nextSchema,
        data_json: nextRows,
        import_sources: nextSources.length ? nextSources : ['leads'],
        updated_at: new Date().toISOString(),
      })
      .eq('id', table.id)
      .select('id,name,updated_at,import_sources')
      .maybeSingle();
    if (updErr) return res.status(500).json({ error: updErr.message });

    return res.json({
      success: true,
      table: updated,
      table_id: table.id,
      table_name: table.name,
      received: leadsIn.length,
      added: toAdd.length,
      skipped,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'append_failed' });
  }
});

// GET /api/public/tables/poll?table_name=...&since=ISO
// Header: X-API-Key: <user api key>
//
// Zapier-friendly polling trigger: compare updated_at to last seen timestamp.
router.get('/poll', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const table_name = String((req.query as any)?.table_name || '').trim();
    if (!table_name) return res.status(400).json({ error: 'missing_table_name' });

    const sinceRaw = String((req.query as any)?.since || '').trim();
    const sinceMs = sinceRaw ? new Date(sinceRaw).getTime() : NaN;
    if (sinceRaw && !Number.isFinite(sinceMs)) return res.status(400).json({ error: 'invalid_since' });

    const resolved = await resolveTableByName(userId, table_name);
    if (resolved.ambiguous) return res.status(409).json({ error: 'ambiguous_table_name', matches: resolved.ambiguous });
    const table = resolved.table;
    if (!table?.id) return res.status(404).json({ error: 'table_not_found_create_first' });

    const updatedAt = table.updated_at ? String(table.updated_at) : null;
    const updatedMs = updatedAt ? new Date(updatedAt).getTime() : NaN;

    const changed = !sinceRaw ? true : (Number.isFinite(updatedMs) && updatedMs > sinceMs);
    return res.json({
      table_id: table.id,
      table_name: table.name,
      updated_at: updatedAt,
      changed,
      since: sinceRaw || null,
      import_sources: Array.isArray(table.import_sources) ? table.import_sources : [],
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'poll_failed' });
  }
});

export default router;


