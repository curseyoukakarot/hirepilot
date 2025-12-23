import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
dayjs.extend(utc);
dayjs.extend(weekOfYear);
dayjs.extend(quarterOfYear);

export type WidgetAgg = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
export type WidgetTimeBucket = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'none';
export type WidgetRange = '7d' | '30d' | '90d' | 'ytd' | 'all_time' | 'custom';

export type WidgetFilter = {
  column_id: string;
  op: 'eq' | 'neq' | 'in' | 'nin' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';
  value: any;
};

export type WidgetMetric = {
  agg: WidgetAgg;
  column_id: string;
  alias: string;
};

export type TableColumn = {
  id?: string;
  key?: string;
  label?: string;
  name?: string; // legacy display label
  type?: string;
  currency?: string;
};

export type WidgetQueryInput = {
  table_id: string;
  metrics: WidgetMetric[];
  date_column_id?: string;
  time_bucket: WidgetTimeBucket;
  range: WidgetRange;
  range_start?: string; // ISO date for custom
  range_end?: string; // ISO date for custom
  filters?: WidgetFilter[];
};

export type WidgetSeriesRow = Record<string, any> & { t: string };

export type WidgetQueryOutput = {
  series: WidgetSeriesRow[];
  meta: {
    totals: Record<string, number>;
    min: Record<string, number>;
    max: Record<string, number>;
    formats: Record<string, { kind: 'currency' | 'number'; currency?: string }>;
    row_count: number;
    bucket_count: number;
  };
  warnings: string[];
  message?: string;
};

function isNil(v: any) {
  return v === null || typeof v === 'undefined' || v === '';
}

function coerceNumber(v: any): number | null {
  if (isNil(v)) return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseDate(v: any): dayjs.Dayjs | null {
  if (isNil(v)) return null;
  const d = dayjs(v);
  return d.isValid() ? d : null;
}

function bucketLabel(d: dayjs.Dayjs, bucket: WidgetTimeBucket): string {
  switch (bucket) {
    case 'day': return d.utc().startOf('day').format('YYYY-MM-DD');
    case 'week': return d.utc().startOf('week').format('YYYY-[W]WW');
    case 'month': return d.utc().startOf('month').format('YYYY-MM');
    case 'quarter': return `${d.utc().year()}-Q${d.utc().quarter()}`;
    case 'year': return String(d.utc().year());
    default: return 'ALL';
  }
}

function computeRangeStart(range: WidgetRange, now = dayjs()): dayjs.Dayjs | null {
  switch (range) {
    case '7d': return now.subtract(7, 'day');
    case '30d': return now.subtract(30, 'day');
    case '90d': return now.subtract(90, 'day');
    case 'ytd': return now.startOf('year');
    case 'all_time': return null;
    default: return null;
  }
}

function applyFilterOp(value: any, op: WidgetFilter['op'], target: any): boolean {
  switch (op) {
    case 'eq': return value === target;
    case 'neq': return value !== target;
    case 'in': return Array.isArray(target) ? target.includes(value) : false;
    case 'nin': return Array.isArray(target) ? !target.includes(value) : true;
    case 'gt': return Number(value) > Number(target);
    case 'gte': return Number(value) >= Number(target);
    case 'lt': return Number(value) < Number(target);
    case 'lte': return Number(value) <= Number(target);
    case 'contains': return String(value || '').toLowerCase().includes(String(target || '').toLowerCase());
    default: return true;
  }
}

export function resolveColumn(schema: TableColumn[], columnIdOrKeyOrLabel: string): TableColumn | null {
  const q = String(columnIdOrKeyOrLabel || '').trim();
  if (!q) return null;
  const byId = schema.find(c => String(c?.id || '') === q);
  if (byId) return byId;
  const byKey = schema.find(c => String(c?.key || '') === q);
  if (byKey) return byKey;
  const byLabel = schema.find(c => String(c?.label || c?.name || '') === q);
  return byLabel || null;
}

export function getCellValue(row: any, col: TableColumn): any {
  const key = col?.key;
  const label = col?.label || col?.name;
  // Prefer stable key, fallback to legacy label/name.
  if (key && row && Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  if (label && row && Object.prototype.hasOwnProperty.call(row, label)) return row[label];
  if (col?.name && row && Object.prototype.hasOwnProperty.call(row, col.name)) return row[col.name];
  return undefined;
}

export function runWidgetQuery(input: WidgetQueryInput, schema: TableColumn[], rows: any[]): WidgetQueryOutput {
  const warnings: string[] = [];

  const metrics = (input.metrics || []).filter(m => m && m.alias && m.column_id);
  if (!metrics.length) {
    return {
      series: [],
      meta: { totals: {}, min: {}, max: {}, formats: {}, row_count: 0, bucket_count: 0 },
      warnings,
      message: 'No metrics configured.'
    };
  }

  const metricCols = metrics.map(m => ({ m, col: resolveColumn(schema, m.column_id) })).filter(x => x.col);
  if (!metricCols.length) {
    return {
      series: [],
      meta: { totals: {}, min: {}, max: {}, formats: {}, row_count: 0, bucket_count: 0 },
      warnings,
      message: 'Metric columns not found on table.'
    };
  }

  const dateCol = input.date_column_id ? resolveColumn(schema, input.date_column_id) : null;

  // Build formats map
  const formats: Record<string, { kind: 'currency' | 'number'; currency?: string }> = {};
  for (const { m, col } of metricCols) {
    const type = String(col?.type || '').toLowerCase();
    if (type === 'money' || type === 'currency') formats[m.alias] = { kind: 'currency', currency: col?.currency || 'USD' };
    else formats[m.alias] = { kind: 'number' };
  }

  // Filter rows
  let filtered = Array.isArray(rows) ? rows.slice() : [];

  // Apply filters
  for (const f of (input.filters || [])) {
    const c = resolveColumn(schema, f.column_id);
    if (!c) continue;
    filtered = filtered.filter(r => applyFilterOp(getCellValue(r, c), f.op, f.value));
  }

  // Apply date range (if date column is provided & valid)
  let missingDate = 0;
  const bucket = input.time_bucket || 'none';
  const range = input.range || 'all_time';
  let start: dayjs.Dayjs | null = computeRangeStart(range);
  let end: dayjs.Dayjs | null = null;
  if (range === 'custom') {
    start = input.range_start ? dayjs(input.range_start) : null;
    end = input.range_end ? dayjs(input.range_end) : null;
    if (start && !start.isValid()) start = null;
    if (end && !end.isValid()) end = null;
  }

  if ((start || end) && !dateCol) {
    warnings.push('Range was provided but no date column is configured; range filter was skipped.');
  }

  if (dateCol) {
    filtered = filtered.filter(r => {
      const d = parseDate(getCellValue(r, dateCol));
      if (!d) { missingDate += 1; return false; }
      if (start && d.isBefore(start)) return false;
      if (end && d.isAfter(end)) return false;
      return true;
    });
  }

  if (missingDate > 0) warnings.push(`Excluded ${missingDate} row(s) missing a valid date for grouping.`);

  if (!filtered.length) {
    return {
      series: [],
      meta: { totals: {}, min: {}, max: {}, formats, row_count: 0, bucket_count: 0 },
      warnings,
      message: 'No data in this time range.'
    };
  }

  type Acc = { sum: number; count: number; min: number; max: number };
  const buckets: Record<string, Record<string, Acc>> = {};
  const bucketOrder: string[] = [];
  const ensureBucket = (t: string) => {
    if (!buckets[t]) { buckets[t] = {}; bucketOrder.push(t); }
    return buckets[t];
  };
  const initAcc = (): Acc => ({ sum: 0, count: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY });

  for (const r of filtered) {
    let t = 'ALL';
    if (bucket !== 'none') {
      if (dateCol) {
        const d = parseDate(getCellValue(r, dateCol));
        if (!d) continue;
        t = bucketLabel(d, bucket);
      } else {
        // No date column: can't time-bucket. Fall back to ALL with warning once.
        t = 'ALL';
      }
    }
    const b = ensureBucket(t);
    for (const { m, col } of metricCols) {
      const alias = m.alias;
      b[alias] = b[alias] || initAcc();
      const acc = b[alias];
      const raw = getCellValue(r, col!);
      const num = coerceNumber(raw);

      if (m.agg === 'COUNT') {
        if (!isNil(raw)) { acc.count += 1; }
        continue;
      }

      if (m.agg === 'SUM') {
        acc.sum += num ?? 0;
        // SUM treats null as 0; no count needed.
        if (num !== null) {
          acc.min = Math.min(acc.min, num);
          acc.max = Math.max(acc.max, num);
        }
        continue;
      }

      // AVG / MIN / MAX ignore nulls
      if (num === null) continue;
      acc.sum += num;
      acc.count += 1;
      acc.min = Math.min(acc.min, num);
      acc.max = Math.max(acc.max, num);
    }
  }

  if (bucket !== 'none' && !dateCol) warnings.push('No date column configured; results are not time-bucketed.');

  const totals: Record<string, number> = {};
  const mins: Record<string, number> = {};
  const maxs: Record<string, number> = {};

  const series: WidgetSeriesRow[] = bucketOrder
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map((t) => {
      const out: WidgetSeriesRow = { t };
      for (const { m } of metricCols) {
        const alias = m.alias;
        const acc = buckets[t]?.[alias] || { sum: 0, count: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY };
        let v = 0;
        if (m.agg === 'SUM') v = acc.sum;
        else if (m.agg === 'AVG') v = acc.count ? (acc.sum / acc.count) : 0;
        else if (m.agg === 'COUNT') v = acc.count;
        else if (m.agg === 'MIN') v = Number.isFinite(acc.min) ? acc.min : 0;
        else if (m.agg === 'MAX') v = Number.isFinite(acc.max) ? acc.max : 0;
        out[alias] = v;
        totals[alias] = (totals[alias] || 0) + (Number.isFinite(v) ? v : 0);
        mins[alias] = typeof mins[alias] === 'number' ? Math.min(mins[alias], v) : v;
        maxs[alias] = typeof maxs[alias] === 'number' ? Math.max(maxs[alias], v) : v;
      }
      return out;
    });

  return {
    series,
    meta: {
      totals,
      min: mins,
      max: maxs,
      formats,
      row_count: filtered.length,
      bucket_count: series.length
    },
    warnings
  };
}


