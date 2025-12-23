import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';
import { computeFormula, Filter, SourceSpec, JoinSpec } from '../services/analytics/formulaEngine';
import { runWidgetQuery, resolveColumn, type TableColumn, type WidgetQueryInput } from '../services/analytics/widgetQueryEngine';

const router = express.Router();

async function canAccessTable(userId: string, tableId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('custom_tables')
      .select('id,user_id,collaborators')
      .eq('id', tableId)
      .maybeSingle();
    if (!data) return false;
    if ((data as any).user_id === userId) return true;
    try {
      const collabs = ((data as any).collaborators || []) as Array<{ id?: string; user_id?: string; email?: string; role?: string }>;
      const ok = collabs.some(c => c?.user_id === userId || c?.id === userId);
      return ok;
    } catch { return false; }
  } catch { return false; }
}

// POST /api/dashboards/:id/widgets/:widgetId/preview
router.post('/:id/widgets/:widgetId/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }
    const cfg = req.body || {};
    const type = String(cfg?.type || '').toLowerCase();
    // Accept both tranche-1 chart/metric and tranche-2 formula types; here we focus on formula types
    if (type !== 'formulametric' && type !== 'formulachart') {
      res.status(400).json({ error: 'unsupported_type', detail: 'Use formulaMetric or formulaChart' });
      return;
    }
    const sources: SourceSpec[] = Array.isArray(cfg.sources) ? cfg.sources : [];
    if (!sources.length) { res.status(400).json({ error: 'sources_required' }); return; }
    // Access checks
    for (const s of sources) {
      const ok = await canAccessTable(userId, s.tableId);
      if (!ok) { res.status(403).json({ error: 'forbidden_table', tableId: s.tableId }); return; }
    }
    const joins: JoinSpec[] | undefined = Array.isArray(cfg.joins) ? cfg.joins : undefined;
    const filters: Filter[] | undefined = Array.isArray(cfg.filters) ? cfg.filters : undefined;
    const timeBucket = (cfg.timeBucket || 'none') as any;
    const formula: string = String(cfg.formula || '').trim();
    if (!formula) { res.status(400).json({ error: 'formula_required' }); return; }

    // Row loader from Supabase (service role; we enforce access above)
    const loadRows = async (tableId: string) => {
      const { data } = await supabase
        .from('custom_tables')
        .select('schema_json,data_json')
        .eq('id', tableId)
        .maybeSingle();
      const rows = ((data as any)?.data_json || []) as any[];
      return { rows, schema: (data as any)?.schema_json };
    };

    const result = await computeFormula({
      formula,
      sources,
      joins,
      timeBucket,
      groupBy: cfg.groupBy,
      filters,
      loadRows
    });
    if (result.kind === 'metric') {
      res.json({ value: result.value });
      return;
    }
    res.json({ points: result.points });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'preview_failed' });
  }
});

// POST /api/dashboards/widgets/query
// Universal widget query endpoint: stable column_id support, bucketing, range, filters, warnings.
router.post('/widgets/query', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }
    const cfg = (req.body || {}) as Partial<WidgetQueryInput>;
    const tableId = String(cfg.table_id || '').trim();
    if (!tableId) { res.status(400).json({ error: 'table_id_required' }); return; }
    const ok = await canAccessTable(userId, tableId);
    if (!ok) { res.status(403).json({ error: 'forbidden_table', tableId }); return; }

    const metrics = Array.isArray(cfg.metrics) ? cfg.metrics : [];
    if (!metrics.length) { res.status(400).json({ error: 'metrics_required' }); return; }

    const { data } = await supabase
      .from('custom_tables')
      .select('schema_json,data_json')
      .eq('id', tableId)
      .maybeSingle();
    const schema = (Array.isArray((data as any)?.schema_json) ? (data as any).schema_json : []) as TableColumn[];
    const rows = (Array.isArray((data as any)?.data_json) ? (data as any).data_json : []) as any[];

    // Validate that referenced columns exist (by id/key/label) to avoid confusing all-zero results.
    const missing: string[] = [];
    for (const m of metrics) {
      const cid = String((m as any)?.column_id || '');
      if (!resolveColumn(schema, cid)) missing.push(cid);
    }
    if (cfg.date_column_id) {
      const dc = String(cfg.date_column_id || '');
      if (dc && !resolveColumn(schema, dc)) missing.push(dc);
    }
    if (missing.length) {
      res.status(400).json({ error: 'unknown_column', missing: Array.from(new Set(missing)) });
      return;
    }

    const result = runWidgetQuery(
      {
        table_id: tableId,
        metrics: metrics as any,
        date_column_id: cfg.date_column_id ? String(cfg.date_column_id) : undefined,
        time_bucket: (cfg.time_bucket || 'none') as any,
        range: (cfg.range || 'all_time') as any,
        range_start: cfg.range_start ? String(cfg.range_start) : undefined,
        range_end: cfg.range_end ? String(cfg.range_end) : undefined,
        filters: Array.isArray(cfg.filters) ? (cfg.filters as any) : undefined
      },
      schema,
      rows
    );

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'query_failed' });
  }
});

export default router;


