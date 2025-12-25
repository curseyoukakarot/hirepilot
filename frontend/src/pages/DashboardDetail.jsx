import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { AnimatePresence, motion } from 'framer-motion';
import PlotlyImport from 'plotly.js-dist-min';

const Plotly = PlotlyImport?.default || PlotlyImport;

// -------------------- Minimal SVG charts (Plotly-free fallback / default) --------------------
function SimpleLineChart({ series, keys, colors, height = 320 }) {
  const rows = Array.isArray(series) ? series : [];
  const ks = Array.isArray(keys) ? keys : [];
  if (!rows.length || !ks.length) return null;

  const w = 1000;
  const h = height;
  const padL = 50;
  const padR = 18;
  const padT = 14;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const xs = rows.map((r) => String(r?.t ?? ''));
  const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    for (const k of ks) {
      const v = toNum(r?.[k]);
      minY = Math.min(minY, v);
      maxY = Math.max(maxY, v);
    }
  }
  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
    minY = 0; maxY = 1;
  }
  if (minY === maxY) {
    // Make a visible range
    minY = minY - 1;
    maxY = maxY + 1;
  }

  const xFor = (i) => padL + (xs.length === 1 ? innerW / 2 : (i / (xs.length - 1)) * innerW);
  const yFor = (v) => padT + (1 - ((v - minY) / (maxY - minY))) * innerH;

  const grid = 4;
  const gridLines = Array.from({ length: grid + 1 }).map((_, i) => {
    const y = padT + (i / grid) * innerH;
    return <line key={i} x1={padL} x2={w - padR} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
  });

  const paths = ks.map((k, idx) => {
    const pts = rows.map((r, i) => ({ x: xFor(i), y: yFor(toNum(r?.[k])) }));
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    const c = colors?.[idx] || '#3b82f6';
    return (
      <g key={k}>
        <path d={d} fill="none" stroke={c} strokeWidth="3" />
        {pts.length === 1 ? <circle cx={pts[0].x} cy={pts[0].y} r="6" fill={c} stroke="#ffffff" strokeWidth="2" /> : null}
      </g>
    );
  });

  const xLabels = xs.length <= 1 ? xs : [xs[0], xs[Math.floor(xs.length / 2)], xs[xs.length - 1]];
  const xLabelEls = xLabels.map((lab, i) => {
    const idx = xs.indexOf(lab);
    const x = idx >= 0 ? xFor(idx) : padL;
    return <text key={`${lab}-${i}`} x={x} y={h - 8} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="12">{lab}</text>;
  });

  const yTicks = [maxY, (maxY + minY) / 2, minY];
  const yLabelEls = yTicks.map((v, i) => {
    const y = yFor(v);
    return (
      <text key={i} x={padL - 10} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize="12">
        {Math.round(v).toLocaleString()}
      </text>
    );
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="block">
      {gridLines}
      {paths}
      {yLabelEls}
      {xLabelEls}
    </svg>
  );
}

const rangeToStartDate = (range) => {
  const now = new Date();
  if (range === 'last_30_days') { now.setDate(now.getDate() - 30); return now; }
  if (range === 'last_90_days') { now.setDate(now.getDate() - 90); return now; }
  if (range === 'last_180_days') { now.setDate(now.getDate() - 180); return now; }
  if (range === 'ytd') { return new Date(now.getFullYear(), 0, 1); }
  if (range === 'all_time') return null;
  now.setDate(now.getDate() - 90);
  return now;
};

const isSafeIdentifier = (s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(s || ''));
const aggRef = (alias, columnId) => {
  const a = String(alias || '').trim();
  const c = String(columnId || '');
  // Use bracket JSON-string form when the column name is not a safe identifier (spaces, punctuation, etc).
  // Backend formula engine supports both: A.col and A["Column Name"].
  return isSafeIdentifier(c) ? `${a}.${c}` : `${a}[${JSON.stringify(c)}]`;
};

const mapRangeToWidgetRange = (range, rangeStartDate) => {
  // DashboardDetail uses last_* values; the universal widget query engine uses short codes.
  if (range === 'last_7_days') return { range: '7d' };
  if (range === 'last_30_days') return { range: '30d' };
  if (range === 'last_90_days') return { range: '90d' };
  if (range === 'ytd') return { range: 'ytd' };
  if (range === 'all_time') return { range: 'all_time' };
  // last_180_days isn't a first-class option in the widget engine; use custom with computed start.
  if (range === 'last_180_days' && rangeStartDate) {
    return { range: 'custom', range_start: rangeStartDate.toISOString(), range_end: new Date().toISOString() };
  }
  return { range: '90d' };
};

// -------------------- Executive template view (to spec) --------------------
const parseTplMappings = (raw) => {
  try {
    if (!raw) return {};
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    try { return JSON.parse(String(raw)); } catch { return {}; }
  }
};

// Template mappings can be legacy (roleId -> columnId) or multi-table (roleId -> { tableId, columnId }).
const resolveTplRole = (mappings, roleId, fallbackTableId) => {
  const raw = mappings ? mappings[roleId] : null;
  if (!raw) return { tableId: String(fallbackTableId || ''), columnId: '' };
  if (typeof raw === 'string') {
    const s = String(raw);
    // Allow "tableId::columnId" encoding as an escape hatch.
    if (s.includes('::')) {
      const [t, c] = s.split('::');
      return { tableId: String(t || ''), columnId: String(c || '') };
    }
    return { tableId: String(fallbackTableId || ''), columnId: s };
  }
  if (typeof raw === 'object') {
    const tableId = raw.tableId || raw.table_id || fallbackTableId || '';
    const columnId = raw.columnId || raw.column_id || '';
    return { tableId: String(tableId || ''), columnId: String(columnId || '') };
  }
  return { tableId: String(fallbackTableId || ''), columnId: '' };
};

const mergeSeriesByT = (seriesList) => {
  const out = new Map();
  for (const series of (seriesList || [])) {
    for (const row of (Array.isArray(series) ? series : [])) {
      const t = String(row?.t ?? '');
      if (!t) continue;
      const prev = out.get(t) || { t };
      Object.keys(row || {}).forEach((k) => {
        if (k === 't') return;
        prev[k] = row[k];
      });
      out.set(t, prev);
    }
  }
  return Array.from(out.values()).sort((a, b) => String(a.t).localeCompare(String(b.t)));
};

const resolveTplRoleMulti = (mappings, roleId, fallbackTableId) => {
  const raw = mappings ? mappings[roleId] : null;
  const normalizeCols = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    const s = String(v);
    if (!s.trim()) return [];
    // support comma-separated as a fallback encoding
    if (s.includes(',')) return s.split(',').map(x => String(x).trim()).filter(Boolean);
    return [s];
  };
  if (!raw) return { tableId: String(fallbackTableId || ''), columnIds: [] };
  if (typeof raw === 'string') {
    // Allow "tableId::colA,colB" encoding as an escape hatch.
    if (raw.includes('::')) {
      const [t, cols] = raw.split('::');
      return { tableId: String(t || ''), columnIds: normalizeCols(cols) };
    }
    return { tableId: String(fallbackTableId || ''), columnIds: normalizeCols(raw) };
  }
  if (typeof raw === 'object') {
    const tableId = raw.tableId || raw.table_id || fallbackTableId || '';
    const cols = raw.columnIds ?? raw.column_ids ?? raw.columnId ?? raw.column_id ?? '';
    return { tableId: String(tableId || ''), columnIds: normalizeCols(cols) };
  }
  return { tableId: String(fallbackTableId || ''), columnIds: [] };
};

const formatCurrency = (n, currency = 'USD') => {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n) || 0); }
  catch { return `$${Number(n) || 0}`; }
};

const formatNumber = (n) => {
  try { return new Intl.NumberFormat('en-US').format(Number(n) || 0); }
  catch { return String(Number(n) || 0); }
};

function ExecutiveKpiCard({ label, value, subtext }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="text-xs uppercase tracking-wider text-white/50">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-white/40">{subtext || ''}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/60 px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="text-white font-semibold">{title}</div>
        <button className="text-white/50 hover:text-white/80">
          <i className="fa-solid fa-ellipsis-vertical"></i>
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ChartEmpty({ onChangeRange }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60">
        <i className="fa-solid fa-chart-line"></i>
      </div>
      <div className="mt-4 text-white font-semibold">No data in this time range</div>
      <div className="mt-1 text-sm text-white/50">Try expanding the date range or checking your date column mapping.</div>
      <button
        onClick={onChangeRange}
        className="mt-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm text-white/80"
      >
        Change range
      </button>
    </div>
  );
}

function ChartError({ message, onRetry }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 text-red-200 rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-3">
      <div className="min-w-0 truncate">{message}</div>
      <button onClick={onRetry} className="shrink-0 underline text-red-100 hover:text-white">Retry</button>
    </div>
  );
}

function Skeleton({ h }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 border border-white/10 ${h}`} />;
}

function ExecOverviewCommandCenter() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartError, setChartError] = useState('');
  const [plotNonce, setPlotNonce] = useState(0);
  const [range, setRange] = useState('last_90_days');
  const [bucket, setBucket] = useState('month');
  const [kpi, setKpi] = useState({ revenue: 0, cost: 0, profit: 0, margin: 0 });
  const [series, setSeries] = useState([]);
  const [statusCounts, setStatusCounts] = useState({ healthy: 0, atRisk: 0, notViable: 0 });
  const [atRiskItems, setAtRiskItems] = useState([]);

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const url = new URL(window.location.href);
      const tpl = url.searchParams.get('tpl') || '';
      const fallbackTableId = url.searchParams.get('tpl_table') || '';
      const mappings = parseTplMappings(url.searchParams.get('tpl_map') || '') || {};
      const revenue = resolveTplRole(mappings, 'revenue', fallbackTableId);
      const cost = resolveTplRole(mappings, 'cost', fallbackTableId);
      const sharedDate = resolveTplRole(mappings, 'date', fallbackTableId);
      const revenueDate = resolveTplRole(mappings, 'revenue_date', fallbackTableId);
      const costDate = resolveTplRole(mappings, 'cost_date', fallbackTableId);
      const revDate = revenueDate?.columnId ? revenueDate : sharedDate;
      const cstDate = costDate?.columnId ? costDate : sharedDate;
      const status = resolveTplRole(mappings, 'status', fallbackTableId);

      if (!tpl || !revenue?.tableId || !revenue?.columnId || !cost?.tableId || !cost?.columnId || !revDate?.columnId || !cstDate?.columnId) {
        throw new Error('Missing required template mappings (Revenue, Revenue Date, Cost, Cost Date).');
      }
      const backendBase = (import.meta?.env && import.meta.env.VITE_BACKEND_URL) || 'https://api.thehirepilot.com';
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
      const rangeStart = rangeToStartDate(range);
      const rangeCfg = mapRangeToWidgetRange(range, rangeStart || undefined);

      const query = async (payload) => {
        const resp = await fetch(`${backendBase}/api/dashboards/widgets/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error('Failed to query dashboard data');
        return resp.json();
      };

      // KPI totals (can come from multiple tables)
      let revenueTotal = 0;
      let costTotal = 0;
      if (revenue.tableId === cost.tableId) {
        const kpiJson = await query({
          table_id: revenue.tableId,
          metrics: [
            { alias: 'Revenue', agg: 'SUM', column_id: revenue.columnId },
            { alias: 'Cost', agg: 'SUM', column_id: cost.columnId }
          ],
          time_bucket: 'none',
          ...rangeCfg
      });
      const krow = Array.isArray(kpiJson?.series) ? kpiJson.series[0] : null;
        revenueTotal = Number(krow?.Revenue) || 0;
        costTotal = Number(krow?.Cost) || 0;
      } else {
        const [revJson, costJson] = await Promise.all([
          query({
            table_id: revenue.tableId,
            metrics: [{ alias: 'Revenue', agg: 'SUM', column_id: revenue.columnId }],
            time_bucket: 'none',
            ...rangeCfg
          }),
          query({
            table_id: cost.tableId,
            metrics: [{ alias: 'Cost', agg: 'SUM', column_id: cost.columnId }],
            time_bucket: 'none',
          ...rangeCfg
        })
        ]);
        const rrow = Array.isArray(revJson?.series) ? revJson.series[0] : null;
        const crow = Array.isArray(costJson?.series) ? costJson.series[0] : null;
        revenueTotal = Number(rrow?.Revenue) || 0;
        costTotal = Number(crow?.Cost) || 0;
      }
      const profit = revenueTotal - costTotal;
      const margin = revenueTotal ? (profit / revenueTotal) * 100 : 0;
      setKpi({ revenue: revenueTotal, cost: costTotal, profit, margin });

      const fetchTrend = async (timeBucket) => {
        if (revenue.tableId === cost.tableId && revDate.columnId === cstDate.columnId) {
          const trendJson = await query({
            table_id: revenue.tableId,
              metrics: [
              { alias: 'Revenue', agg: 'SUM', column_id: revenue.columnId },
              { alias: 'Cost', agg: 'SUM', column_id: cost.columnId }
              ],
            date_column_id: revDate.columnId,
            time_bucket: timeBucket,
              ...rangeCfg
          });
          return Array.isArray(trendJson?.series) ? trendJson.series : [];
        }
        const [revTrend, costTrend] = await Promise.all([
          query({
            table_id: revenue.tableId,
            metrics: [{ alias: 'Revenue', agg: 'SUM', column_id: revenue.columnId }],
            date_column_id: revDate.columnId,
            time_bucket: timeBucket,
            ...rangeCfg
          }),
          query({
            table_id: cost.tableId,
            metrics: [{ alias: 'Cost', agg: 'SUM', column_id: cost.columnId }],
            date_column_id: cstDate.columnId,
            time_bucket: timeBucket,
            ...rangeCfg
          })
        ]);
        return mergeSeriesByT([
          Array.isArray(revTrend?.series) ? revTrend.series : [],
          Array.isArray(costTrend?.series) ? costTrend.series : []
        ]);
      };

      // Trend series (auto-fallback to day if bucketing collapses)
      const initial = await fetchTrend(bucket);
      if ((bucket === 'month' || bucket === 'week') && initial.length <= 1) {
        try {
          const finer = await fetchTrend('day');
          setSeries(finer.length > 1 ? finer : initial);
        } catch {
          setSeries(initial);
        }
      } else {
        setSeries(initial);
      }

      // Best-effort: compute health + at-risk list from raw rows (client-side).
      try {
        // Row-level "at risk" only makes sense when revenue + cost live on the same table.
        if (revenue.tableId !== cost.tableId) return;
        const tableId = revenue.tableId;
        const revenueCol = revenue.columnId;
        const costCol = cost.columnId;
        const statusCol = status?.columnId || '';
        const { data } = await supabase.from('custom_tables').select('schema_json,data_json').eq('id', tableId).maybeSingle();
        const schema = Array.isArray(data?.schema_json) ? data.schema_json : [];
        const rows = Array.isArray(data?.data_json) ? data.data_json : [];
        const findCol = (id) => schema.find((c) => String(c?.id || c?.key || c?.name || '') === String(id));
        const revC = findCol(revenueCol);
        const costC = findCol(costCol);
        const statusC = statusCol ? findCol(statusCol) : null;
        const titleC = schema.find((c) => /event|project|name|title/i.test(String(c?.label || c?.name || ''))) || schema[0];
        const get = (r, c) => {
          if (!c) return undefined;
          const key = c?.key;
          const label = c?.label || c?.name;
          return (key && r && Object.prototype.hasOwnProperty.call(r, key)) ? r[key] : (label && r ? r[label] : undefined);
        };
        const threshold = 10; // margin % threshold
        const items = (rows || []).map((r) => {
          const rv = Number(get(r, revC)) || 0;
          const cv = Number(get(r, costC)) || 0;
          const pf = rv - cv;
          const mg = rv ? ((pf / rv) * 100) : 0;
          const st = statusC ? String(get(r, statusC) || '').toLowerCase() : '';
          const atRisk = mg < threshold || st.includes('at risk');
          const notViable = mg < 0;
          const title = String(get(r, titleC) || 'Item');
          return { title, mg, atRisk, notViable };
        });
        const atRiskList = items.filter(x => x.atRisk).sort((a,b)=>a.mg-b.mg).slice(0,5);
        setAtRiskItems(atRiskList);
        setStatusCounts({
          healthy: items.filter(x=>!x.atRisk).length,
          atRisk: items.filter(x=>x.atRisk).length,
          notViable: items.filter(x=>x.notViable).length
        });
      } catch {
        // ignore
      }
    } catch (e) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [range, bucket]);

  // Plotly charts were replaced with inline SVG charts to eliminate environments where Plotly renders a blank panel.
  useEffect(() => {
    setChartError('');
  }, [series, plotNonce]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top Header (to spec) */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-2xl font-semibold text-white">Executive Overview</div>
            <div className="mt-1 text-sm text-white/50">Revenue, cost, profit, and margin — plus trends and a quick at-risk view.</div>
          </div>
          <div className="flex items-center gap-3">
            <select className="rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur px-4 py-2 text-sm text-white/90" value={range} onChange={(e)=>setRange(e.target.value)}>
              <option value="all_time">All time</option>
              <option value="last_90_days">90d</option>
              <option value="last_30_days">30d</option>
              <option value="ytd">YTD</option>
            </select>
            <select className="rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur px-4 py-2 text-sm text-white/90" value={bucket} onChange={(e)=>setBucket(e.target.value)}>
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </select>
            <button className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm text-white/80">Edit Dashboard</button>
            <button className="rounded-xl bg-white text-zinc-900 hover:opacity-90 transition px-4 py-2 text-sm font-semibold">Add Widget</button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* KPI Row (to spec) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              <Skeleton h="h-[92px]" />
              <Skeleton h="h-[92px]" />
              <Skeleton h="h-[92px]" />
              <Skeleton h="h-[92px]" />
            </>
          ) : (
            <>
              <ExecutiveKpiCard label="Total Revenue" value={formatCurrency(kpi.revenue)} subtext="vs last period" />
              <ExecutiveKpiCard label="Total Cost" value={formatCurrency(kpi.cost)} subtext="vs last period" />
              <ExecutiveKpiCard label="Profit" value={formatCurrency(kpi.profit)} subtext="vs last period" />
              <ExecutiveKpiCard label="Margin %" value={`${formatNumber(kpi.margin.toFixed(1))}%`} subtext="vs last period" />
            </>
          )}
        </div>

        {/* Main Grid (to spec) */}
        <div className="mt-6 grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <ChartCard title="Revenue vs Cost">
              {error ? (
                <ChartError message={error} onRetry={load} />
              ) : chartError ? (
                <ChartError message={chartError} onRetry={() => { setChartError(''); setPlotNonce((n) => n + 1); }} />
              ) : loading ? (
                <Skeleton h="h-[320px]" />
              ) : (series || []).length === 0 ? (
                <ChartEmpty onChangeRange={() => setRange('last_90_days')} />
              ) : (
                <div className="h-[320px]">
                  <SimpleLineChart
                    height={320}
                    series={series}
                    keys={['Revenue', 'Cost']}
                    colors={['#3b82f6', '#10b981']}
                  />
                </div>
              )}
            </ChartCard>
            <ChartCard title="Margin Trend">
              {error ? (
                <ChartError message={error} onRetry={load} />
              ) : chartError ? (
                <ChartError message={chartError} onRetry={() => { setChartError(''); setPlotNonce((n) => n + 1); }} />
              ) : loading ? (
                <Skeleton h="h-[240px]" />
              ) : (series || []).length === 0 ? (
                <ChartEmpty onChangeRange={() => setRange('last_90_days')} />
              ) : (
                <div className="h-[240px]">
                  <SimpleLineChart
                    height={240}
                    series={(series || []).map((r) => {
                      const rev = Number(r?.Revenue) || 0;
                      const cost = Number(r?.Cost) || 0;
                      const marginPct = rev ? (((rev - cost) / rev) * 100) : 0;
                      return { ...r, Margin: marginPct };
                    })}
                    keys={['Margin']}
                    colors={['#f97316']}
                  />
                </div>
              )}
            </ChartCard>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-4">
            <ChartCard title="Health">
              <div className="space-y-3">
                {[
                  { label: 'Healthy', v: statusCounts.healthy, cls: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-200' },
                  { label: 'At Risk', v: statusCounts.atRisk, cls: 'bg-amber-500/10 border border-amber-500/20 text-amber-200' },
                  { label: 'Not Viable', v: statusCounts.notViable, cls: 'bg-red-500/10 border border-red-500/20 text-red-200' }
                ].map((x) => (
                  <div key={x.label} className="flex items-center justify-between">
                    <div className="text-sm text-white/70">{x.label}</div>
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${x.cls}`}>{x.v}</span>
                  </div>
                ))}
              </div>
            </ChartCard>

            <ChartCard title="At Risk Items">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton h="h-10" />
                  <Skeleton h="h-10" />
                  <Skeleton h="h-10" />
                </div>
              ) : (atRiskItems || []).length ? (
                <div className="space-y-2">
                  {atRiskItems.slice(0,5).map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">{r.title}</div>
                        <div className="text-xs text-white/40">Margin {Math.round(r.mg)}%</div>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-1 text-xs text-red-200 border border-red-500/20">At risk</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/50">No at-risk items detected.</div>
              )}
            </ChartCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelineHealthCommandCenter() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('last_90_days');
  const [bucket, setBucket] = useState('week');
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [notApprovedCount, setNotApprovedCount] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [cashSeries, setCashSeries] = useState([]);
  const [statusDist, setStatusDist] = useState([]);
  const [upcomingItems, setUpcomingItems] = useState([]);

  const parseDate = (v) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const url = new URL(window.location.href);
      const fallbackTableId = url.searchParams.get('tpl_table') || '';
      const mappings = parseTplMappings(url.searchParams.get('tpl_map') || '') || {};
      const date = resolveTplRole(mappings, 'date', fallbackTableId);
      const status = resolveTplRole(mappings, 'status', fallbackTableId);
      const cash = resolveTplRole(mappings, 'cash_required', fallbackTableId);
      const owner = resolveTplRole(mappings, 'owner', fallbackTableId);

      const tableId = date?.tableId || fallbackTableId;
      const dateCol = date?.columnId || '';
      const statusCol = (status?.tableId === tableId) ? (status?.columnId || '') : '';
      const cashCol = (cash?.tableId === tableId) ? (cash?.columnId || '') : '';
      const ownerCol = (owner?.tableId === tableId) ? (owner?.columnId || '') : '';

      if (!tableId || !dateCol) throw new Error('Missing required template mappings (Event / Project Date).');

      const backendBase = (import.meta?.env && import.meta.env.VITE_BACKEND_URL) || 'https://api.thehirepilot.com';
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
      const rangeStart = rangeToStartDate(range);
      const rangeCfg = mapRangeToWidgetRange(range, rangeStart || undefined);

      // Load raw rows for distribution + upcoming list
      const { data } = await supabase.from('custom_tables').select('schema_json,data_json').eq('id', tableId).maybeSingle();
      const schema = Array.isArray(data?.schema_json) ? data.schema_json : [];
      const rows = Array.isArray(data?.data_json) ? data.data_json : [];
      const findCol = (id) => schema.find((c) => String(c?.id || c?.key || c?.name || '') === String(id));
      const dateC = findCol(dateCol);
      const statusC = statusCol ? findCol(statusCol) : null;
      const cashC = cashCol ? findCol(cashCol) : null;
      const ownerC = ownerCol ? findCol(ownerCol) : null;
      const titleC = schema.find((c) => /event|project|name|title/i.test(String(c?.label || c?.name || ''))) || schema[0];
      const get = (r, c) => {
        if (!c) return undefined;
        const key = c?.key;
        const label = c?.label || c?.name;
        return (key && r && Object.prototype.hasOwnProperty.call(r, key)) ? r[key] : (label && r ? r[label] : undefined);
      };

      const now = new Date();
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 90);

      const upcoming = (rows || [])
        .map((r) => {
          const d = parseDate(get(r, dateC));
          if (!d) return null;
          const isUpcoming = d >= now && d <= horizon;
          const status = statusC ? String(get(r, statusC) || '').trim() : '';
          const cash = cashC ? (Number(get(r, cashC)) || 0) : 0;
          const owner = ownerC ? String(get(r, ownerC) || '').trim() : '';
          const title = String(get(r, titleC) || 'Item');
          return { title, date: d, status, cash, owner, isUpcoming };
        })
        .filter(Boolean)
        .filter((x) => x.isUpcoming)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      setUpcomingCount(upcoming.length);
      setCashTotal(upcoming.reduce((acc, x) => acc + (Number(x.cash) || 0), 0));
      setUpcomingItems(upcoming.slice(0, 5));

      if (statusC) {
        const distMap = new Map();
        for (const x of upcoming) {
          const k = (x.status || 'Unknown') || 'Unknown';
          distMap.set(k, (distMap.get(k) || 0) + 1);
        }
        const dist = Array.from(distMap.entries()).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
        setStatusDist(dist);

        const approved = upcoming.filter(x => String(x.status || '').toLowerCase().includes('approved')).length;
        setApprovedCount(approved);
        setNotApprovedCount(Math.max(0, upcoming.length - approved));
      } else {
        setStatusDist([]);
        setApprovedCount(0);
        setNotApprovedCount(0);
      }

      // Trend series (cash required)
      if (cashCol) {
        const cashResp = await fetch(`${backendBase}/api/dashboards/widgets/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            table_id: tableId,
            metrics: [{ alias: 'Cash', agg: 'SUM', column_id: cashCol }],
            date_column_id: dateCol,
            time_bucket: bucket,
            ...rangeCfg
          })
        });
        if (!cashResp.ok) throw new Error('Failed to load cash risk trend');
        const cashJson = await cashResp.json();
        setCashSeries(Array.isArray(cashJson?.series) ? cashJson.series : []);
      } else {
        setCashSeries([]);
      }
    } catch (e) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [range, bucket]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cashEl = document.getElementById('pipeline-chart-cash');
        const statusEl = document.getElementById('pipeline-chart-status');
        if (!cashEl && !statusEl) return;
        if (cancelled) return;

        const axisColor = '#e5e7eb';
        const gridColor = 'rgba(255,255,255,0.08)';

        if (cashEl) {
          const xs = (cashSeries || []).map(r => r.t);
          const ys = (cashSeries || []).map(r => Number(r?.Cash) || 0);
          const sparseMode = xs.length <= 1 ? 'lines+markers' : 'lines';
          const markerSize = xs.length <= 1 ? 10 : 6;
          await Plotly.newPlot('pipeline-chart-cash', [
            { type: 'scatter', mode: sparseMode, name: 'Cash Required', x: xs, y: ys, line: { color: '#f97316', width: 3 }, marker: { color: '#f97316', size: markerSize } }
          ], {
            margin: { t: 10, r: 10, b: 40, l: 70 },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)',
            xaxis: { title: '', showgrid: false, color: axisColor, type: 'category' },
            yaxis: { title: 'Cash ($)', gridcolor: gridColor, color: axisColor },
            showlegend: false
          }, { responsive: true, displayModeBar: false, displaylogo: false });
        }

        if (statusEl) {
          const xs = (statusDist || []).map(x => x.k);
          const ys = (statusDist || []).map(x => x.v);
          await Plotly.newPlot('pipeline-chart-status', [
            { type: 'bar', name: 'Count', x: xs, y: ys, marker: { color: '#3b82f6' } }
          ], {
            margin: { t: 10, r: 10, b: 70, l: 50 },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)',
            xaxis: { title: '', showgrid: false, color: axisColor, type: 'category', tickangle: -25 },
            yaxis: { title: 'Count', gridcolor: gridColor, color: axisColor },
            showlegend: false
          }, { responsive: true, displayModeBar: false, displaylogo: false });
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [cashSeries, statusDist]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-2xl font-semibold text-white">Pipeline / Schedule Health</div>
            <div className="mt-1 text-sm text-white/50">Upcoming items, approvals, and (optional) cash risk trend.</div>
          </div>
          <div className="flex items-center gap-3">
            <select className="rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur px-4 py-2 text-sm text-white/90" value={range} onChange={(e)=>setRange(e.target.value)}>
              <option value="all_time">All time</option>
              <option value="last_90_days">90d</option>
              <option value="last_30_days">30d</option>
              <option value="ytd">YTD</option>
            </select>
            <select className="rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur px-4 py-2 text-sm text-white/90" value={bucket} onChange={(e)=>setBucket(e.target.value)}>
              <option value="month">Month</option>
              <option value="week">Week</option>
            </select>
            <button className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm text-white/80">Edit Dashboard</button>
            <button className="rounded-xl bg-white text-zinc-900 hover:opacity-90 transition px-4 py-2 text-sm font-semibold">Add Widget</button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              <Skeleton h="h-[92px]" />
              <Skeleton h="h-[92px]" />
              <Skeleton h="h-[92px]" />
              <Skeleton h="h-[92px]" />
            </>
          ) : (
            <>
              <ExecutiveKpiCard label="Upcoming (next 90d)" value={formatNumber(upcomingCount)} subtext="count" />
              <ExecutiveKpiCard label="Approved" value={formatNumber(approvedCount)} subtext="from status column (if mapped)" />
              <ExecutiveKpiCard label="Not Approved" value={formatNumber(notApprovedCount)} subtext="from status column (if mapped)" />
              <ExecutiveKpiCard label="Cash Required (upcoming)" value={formatCurrency(cashTotal)} subtext="sum (if mapped)" />
            </>
          )}
        </div>

        <div className="mt-6 grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <ChartCard title="Approval Status Distribution">
              {error ? (
                <ChartError message={error} onRetry={load} />
              ) : loading ? (
                <Skeleton h="h-[320px]" />
              ) : (statusDist || []).length === 0 ? (
                <div className="text-sm text-white/50 py-6">
                  Map an <span className="text-white">Approval Status</span> column to see a distribution chart.
                </div>
              ) : (
                <div id="pipeline-chart-status" className="h-[320px]" />
              )}
            </ChartCard>

            <ChartCard title="Cash Risk Trend">
              {error ? (
                <ChartError message={error} onRetry={load} />
              ) : loading ? (
                <Skeleton h="h-[240px]" />
              ) : (cashSeries || []).length === 0 ? (
                <div className="text-sm text-white/50 py-6">
                  Map a <span className="text-white">Cash Required</span> column to see a cash risk trend.
                </div>
              ) : (
                <div id="pipeline-chart-cash" className="h-[240px]" />
              )}
            </ChartCard>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-4">
            <ChartCard title="Upcoming Items">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton h="h-10" />
                  <Skeleton h="h-10" />
                  <Skeleton h="h-10" />
                </div>
              ) : (upcomingItems || []).length ? (
                <div className="space-y-2">
                  {upcomingItems.slice(0,5).map((r, i) => (
                    <div key={i} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-sm text-white truncate">{r.title}</div>
                      <div className="mt-1 flex items-center justify-between text-xs text-white/40 gap-2">
                        <span>{r.date?.toLocaleDateString?.() || ''}</span>
                        <span className="truncate">{r.owner || ''}</span>
                      </div>
                      {r.status ? (
                        <div className="mt-2">
                          <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-1 text-xs text-white/70 border border-white/10">
                            {r.status}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/50">No upcoming items detected in the next 90 days.</div>
              )}
            </ChartCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function CostDriversCommandCenter() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('last_90_days');
  const [bucket, setBucket] = useState('month');
  const [totals, setTotals] = useState({ cost: 0, baseline: 0, delta: 0, deltaPct: 0 });
  const [trend, setTrend] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [topItems, setTopItems] = useState([]);

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const url = new URL(window.location.href);
      const fallbackTableId = url.searchParams.get('tpl_table') || '';
      const mappings = parseTplMappings(url.searchParams.get('tpl_map') || '') || {};
      const cost = resolveTplRole(mappings, 'cost', fallbackTableId);
      const category = resolveTplRole(mappings, 'category', fallbackTableId);
      const baseline = resolveTplRole(mappings, 'baseline_cost', fallbackTableId);
      const date = resolveTplRole(mappings, 'date', fallbackTableId);

      const tableId = cost?.tableId || fallbackTableId;
      const costCol = cost?.columnId || '';
      const categoryCol = (category?.tableId === tableId) ? (category?.columnId || '') : '';
      const baselineCol = (baseline?.tableId === tableId) ? (baseline?.columnId || '') : '';
      const dateCol = (date?.tableId === tableId) ? (date?.columnId || '') : '';

      if (!tableId || !costCol) throw new Error('Missing required template mappings (Cost).');

      const backendBase = (import.meta?.env && import.meta.env.VITE_BACKEND_URL) || 'https://api.thehirepilot.com';
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
      const rangeStart = rangeToStartDate(range);
      const rangeCfg = mapRangeToWidgetRange(range, rangeStart || undefined);

      // Total cost via query engine (respects range)
      const totalResp = await fetch(`${backendBase}/api/dashboards/widgets/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          table_id: tableId,
          metrics: [{ alias: 'Cost', agg: 'SUM', column_id: costCol }],
          time_bucket: 'none',
          ...(dateCol ? { date_column_id: dateCol } : {}),
          ...rangeCfg
        })
      });
      if (!totalResp.ok) throw new Error('Failed to load cost totals');
      const totalJson = await totalResp.json();
      const trow = Array.isArray(totalJson?.series) ? totalJson.series[0] : null;
      const costTotal = Number(trow?.Cost) || 0;

      // Raw rows for category + baseline variance
      const { data } = await supabase.from('custom_tables').select('schema_json,data_json').eq('id', tableId).maybeSingle();
      const schema = Array.isArray(data?.schema_json) ? data.schema_json : [];
      const rows = Array.isArray(data?.data_json) ? data.data_json : [];
      const findCol = (id) => schema.find((c) => String(c?.id || c?.key || c?.name || '') === String(id));
      const costC = findCol(costCol);
      const catC = categoryCol ? findCol(categoryCol) : null;
      const baseC = baselineCol ? findCol(baselineCol) : null;
      const titleC = schema.find((c) => /item|line|vendor|name|title|event|project/i.test(String(c?.label || c?.name || ''))) || schema[0];
      const get = (r, c) => {
        if (!c) return undefined;
        const key = c?.key;
        const label = c?.label || c?.name;
        return (key && r && Object.prototype.hasOwnProperty.call(r, key)) ? r[key] : (label && r ? r[label] : undefined);
      };

      // Category aggregation
      if (catC) {
        const map = new Map();
        for (const r of (rows || [])) {
          const c = Number(get(r, costC)) || 0;
          const k = String(get(r, catC) || 'Uncategorized').trim() || 'Uncategorized';
          map.set(k, (map.get(k) || 0) + c);
        }
        const arr = Array.from(map.entries()).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 10);
        setByCategory(arr);
      } else {
        setByCategory([]);
      }

      // Top line items
      const items = (rows || [])
        .map((r) => ({ title: String(get(r, titleC) || 'Item'), cost: Number(get(r, costC)) || 0 }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10);
      setTopItems(items);

      // Baseline variance (client-side)
      let baselineTotal = 0;
      if (baseC) {
        baselineTotal = (rows || []).reduce((acc, r) => acc + (Number(get(r, baseC)) || 0), 0);
      }
      const delta = costTotal - baselineTotal;
      const deltaPct = baselineTotal ? (delta / baselineTotal) * 100 : 0;
      setTotals({ cost: costTotal, baseline: baselineTotal, delta, deltaPct });

      // Trend (optional date)
      if (dateCol) {
        const trendResp = await fetch(`${backendBase}/api/dashboards/widgets/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            table_id: tableId,
            metrics: [{ alias: 'Cost', agg: 'SUM', column_id: costCol }],
            date_column_id: dateCol,
            time_bucket: bucket,
            ...rangeCfg
          })
        });
        if (!trendResp.ok) throw new Error('Failed to load cost trend');
        const trendJson = await trendResp.json();
        setTrend(Array.isArray(trendJson?.series) ? trendJson.series : []);
      } else {
        setTrend([]);
      }
    } catch (e) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [range, bucket]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const catEl = document.getElementById('cost-chart-category');
        const trendEl = document.getElementById('cost-chart-trend');
        if (!catEl && !trendEl) return;
        if (cancelled) return;

        const axisColor = '#e5e7eb';
        const gridColor = 'rgba(255,255,255,0.08)';

        if (catEl) {
          const xs = (byCategory || []).map(x => x.k);
          const ys = (byCategory || []).map(x => Number(x.v) || 0);
          await Plotly.newPlot('cost-chart-category', [
            { type: 'bar', name: 'Cost', x: xs, y: ys, marker: { color: '#10b981' } }
          ], {
            margin: { t: 10, r: 10, b: 90, l: 70 },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)',
            xaxis: { title: '', showgrid: false, color: axisColor, type: 'category', tickangle: -25 },
            yaxis: { title: 'Cost ($)', gridcolor: gridColor, color: axisColor },
            showlegend: false
          }, { responsive: true, displayModeBar: false, displaylogo: false });
        }

        if (trendEl) {
          const xs = (trend || []).map(r => r.t);
          const ys = (trend || []).map(r => Number(r?.Cost) || 0);
          const sparseMode = xs.length <= 1 ? 'lines+markers' : 'lines';
          const markerSize = xs.length <= 1 ? 10 : 6;
          await Plotly.newPlot('cost-chart-trend', [
            { type: 'scatter', mode: sparseMode, name: 'Cost', x: xs, y: ys, line: { color: '#10b981', width: 3 }, marker: { color: '#10b981', size: markerSize } }
          ], {
            margin: { t: 10, r: 10, b: 40, l: 70 },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)',
            xaxis: { title: '', showgrid: false, color: axisColor, type: 'category' },
            yaxis: { title: 'Cost ($)', gridcolor: gridColor, color: axisColor },
            showlegend: false
          }, { responsive: true, displayModeBar: false, displaylogo: false });
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [byCategory, trend]);

  const deltaChip = totals.delta >= 0
    ? { cls: 'bg-red-500/10 border border-red-500/20 text-red-200', label: `+${formatCurrency(totals.delta)}` }
    : { cls: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-200', label: formatCurrency(totals.delta) };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-2xl font-semibold text-white">Cost Drivers</div>
            <div className="mt-1 text-sm text-white/50">Category breakdown, top line items, and variance if baseline exists.</div>
          </div>
          <div className="flex items-center gap-3">
            <select className="rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur px-4 py-2 text-sm text-white/90" value={range} onChange={(e)=>setRange(e.target.value)}>
              <option value="all_time">All time</option>
              <option value="last_90_days">90d</option>
              <option value="last_30_days">30d</option>
              <option value="ytd">YTD</option>
            </select>
            <select className="rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur px-4 py-2 text-sm text-white/90" value={bucket} onChange={(e)=>setBucket(e.target.value)}>
              <option value="month">Month</option>
              <option value="week">Week</option>
            </select>
            <button className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm text-white/80">Edit Dashboard</button>
            <button className="rounded-xl bg-white text-zinc-900 hover:opacity-90 transition px-4 py-2 text-sm font-semibold">Add Widget</button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              <Skeleton h="h-[92px]" />
              <Skeleton h="h-[92px]" />
              <Skeleton h="h-[92px]" />
              <Skeleton h="h-[92px]" />
            </>
          ) : (
            <>
              <ExecutiveKpiCard label="Total Cost" value={formatCurrency(totals.cost)} subtext="sum" />
              <ExecutiveKpiCard label="Baseline Cost" value={formatCurrency(totals.baseline)} subtext="if mapped" />
              <ExecutiveKpiCard label="Cost Increase" value={<span className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${deltaChip.cls}`}>{deltaChip.label}</span>} subtext="current - baseline" />
              <ExecutiveKpiCard label="Cost Increase %" value={`${formatNumber(totals.deltaPct.toFixed(1))}%`} subtext="vs baseline" />
            </>
          )}
        </div>

        <div className="mt-6 grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <ChartCard title="Cost by Category">
              {error ? (
                <ChartError message={error} onRetry={load} />
              ) : loading ? (
                <Skeleton h="h-[320px]" />
              ) : (byCategory || []).length === 0 ? (
                <div className="text-sm text-white/50 py-6">
                  Map a <span className="text-white">Category</span> column to see cost-by-category.
                </div>
              ) : (
                <div id="cost-chart-category" className="h-[320px]" />
              )}
            </ChartCard>

            <ChartCard title="Cost Trend">
              {error ? (
                <ChartError message={error} onRetry={load} />
              ) : loading ? (
                <Skeleton h="h-[240px]" />
              ) : (trend || []).length === 0 ? (
                <div className="text-sm text-white/50 py-6">
                  Map a <span className="text-white">Date</span> column to see a trend.
                </div>
              ) : (
                <div id="cost-chart-trend" className="h-[240px]" />
              )}
            </ChartCard>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-4">
            <ChartCard title="Top 10 Cost Line Items">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton h="h-10" />
                  <Skeleton h="h-10" />
                  <Skeleton h="h-10" />
                </div>
              ) : (topItems || []).length ? (
                <div className="space-y-2">
                  {topItems.slice(0,10).map((x, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">{x.title}</div>
                      </div>
                      <div className="text-sm text-white/80">{formatCurrency(x.cost)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/50">No items found.</div>
              )}
            </ChartCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function NetProfitOutlookCommandCenter() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('last_90_days');
  const [bucket, setBucket] = useState('month');
  const [kpi, setKpi] = useState({ profit: 0, cost: 0, net: 0, margin: 0 });
  const [series, setSeries] = useState([]);
  const [topProfitCats, setTopProfitCats] = useState([]);
  const [topCostCats, setTopCostCats] = useState([]);

  const sumAliasPrefix = (row, prefix, n) => {
    let s = 0;
    for (let i = 0; i < n; i += 1) s += (Number(row?.[`${prefix}${i}`]) || 0);
    return s;
  };
  const metricsForCols = (prefix, cols) => (cols || []).map((c, i) => ({ alias: `${prefix}${i}`, agg: 'SUM', column_id: c }));

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const url = new URL(window.location.href);
      const tpl = url.searchParams.get('tpl') || '';
      const fallbackTableId = url.searchParams.get('tpl_table') || '';
      const mappings = parseTplMappings(url.searchParams.get('tpl_map') || '') || {};

      const profitAmounts = resolveTplRoleMulti(mappings, 'profit_amounts', fallbackTableId);
      const profitDates = resolveTplRoleMulti(mappings, 'profit_dates', profitAmounts.tableId || fallbackTableId);
      const profitCats = resolveTplRoleMulti(mappings, 'profit_categories', profitAmounts.tableId || fallbackTableId);
      const costAmounts = resolveTplRoleMulti(mappings, 'cost_amounts', fallbackTableId);
      const costDates = resolveTplRoleMulti(mappings, 'cost_dates', costAmounts.tableId || fallbackTableId);
      const costCats = resolveTplRoleMulti(mappings, 'cost_categories', costAmounts.tableId || fallbackTableId);

      const profitTableId = profitAmounts.tableId;
      const costTableId = costAmounts.tableId;
      const profitAmountCols = profitAmounts.columnIds;
      const costAmountCols = costAmounts.columnIds;
      const profitDateCol = profitDates.columnIds[0] || '';
      const costDateCol = costDates.columnIds[0] || '';

      if (!tpl || !profitTableId || !costTableId || profitAmountCols.length === 0 || costAmountCols.length === 0 || !profitDateCol || !costDateCol) {
        throw new Error('Missing required template mappings (Profit Amounts/Dates, Cost Amounts/Dates).');
      }

      const backendBase = (import.meta?.env && import.meta.env.VITE_BACKEND_URL) || 'https://api.thehirepilot.com';
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
      const rangeStart = rangeToStartDate(range);
      const rangeCfg = mapRangeToWidgetRange(range, rangeStart || undefined);

      const query = async (payload) => {
        const resp = await fetch(`${backendBase}/api/dashboards/widgets/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error('Failed to query dashboard data');
        return resp.json();
      };

      // KPI totals
      const [profitTotalJson, costTotalJson] = await Promise.all([
        query({ table_id: profitTableId, metrics: metricsForCols('P', profitAmountCols), time_bucket: 'none', ...rangeCfg }),
        query({ table_id: costTableId, metrics: metricsForCols('C', costAmountCols), time_bucket: 'none', ...rangeCfg })
      ]);
      const prow = Array.isArray(profitTotalJson?.series) ? profitTotalJson.series[0] : null;
      const crow = Array.isArray(costTotalJson?.series) ? costTotalJson.series[0] : null;
      const profit = sumAliasPrefix(prow, 'P', profitAmountCols.length);
      const cost = sumAliasPrefix(crow, 'C', costAmountCols.length);
      const net = profit - cost;
      const margin = profit ? (net / profit) * 100 : 0;
      setKpi({ profit, cost, net, margin });

      // Trend series: query each table separately, then merge
      const [profitTrendJson, costTrendJson] = await Promise.all([
        query({ table_id: profitTableId, metrics: metricsForCols('P', profitAmountCols), date_column_id: profitDateCol, time_bucket: bucket, ...rangeCfg }),
        query({ table_id: costTableId, metrics: metricsForCols('C', costAmountCols), date_column_id: costDateCol, time_bucket: bucket, ...rangeCfg })
      ]);
      const pRaw = Array.isArray(profitTrendJson?.series) ? profitTrendJson.series : [];
      const cRaw = Array.isArray(costTrendJson?.series) ? costTrendJson.series : [];
      const pSeries = pRaw.map((r) => ({ t: r?.t, Profit: sumAliasPrefix(r, 'P', profitAmountCols.length) }));
      const cSeries = cRaw.map((r) => ({ t: r?.t, Cost: sumAliasPrefix(r, 'C', costAmountCols.length) }));
      const merged = mergeSeriesByT([pSeries, cSeries]).map((r) => {
        const p = Number(r?.Profit) || 0;
        const c = Number(r?.Cost) || 0;
        return { ...r, Net: p - c };
      });
      setSeries(merged);

      // Best-effort category drivers (overall, not range-filtered; mirrors other templates)
      const computeTopCats = async (tableId, amountCols, catColId, prefix) => {
        if (!tableId || !amountCols?.length || !catColId) return [];
        const { data } = await supabase.from('custom_tables').select('schema_json,data_json').eq('id', tableId).maybeSingle();
        const schema = Array.isArray(data?.schema_json) ? data.schema_json : [];
        const rows = Array.isArray(data?.data_json) ? data.data_json : [];
        const findCol = (id) => schema.find((c) => String(c?.id || c?.key || c?.name || '') === String(id));
        const catC = findCol(catColId);
        const amtCols = amountCols.map(findCol).filter(Boolean);
        const get = (r, c) => {
          if (!c) return undefined;
          const key = c?.key;
          const label = c?.label || c?.name;
          return (key && r && Object.prototype.hasOwnProperty.call(r, key)) ? r[key] : (label && r ? r[label] : undefined);
        };
        if (!catC || amtCols.length === 0) return [];
        const map = new Map();
        for (const r of rows) {
          const k = String(get(r, catC) || 'Uncategorized').trim() || 'Uncategorized';
          const amt = amtCols.reduce((acc, c) => acc + (Number(get(r, c)) || 0), 0);
          map.set(k, (map.get(k) || 0) + amt);
        }
        return Array.from(map.entries())
          .map(([k, v]) => ({ k, v }))
          .sort((a, b) => b.v - a.v)
          .slice(0, 8);
      };

      try {
        const profitCatCol = profitCats.columnIds[0] || '';
        const costCatCol = costCats.columnIds[0] || '';
        const [pCats, cCats] = await Promise.all([
          computeTopCats(profitTableId, profitAmountCols, profitCatCol, 'P'),
          computeTopCats(costTableId, costAmountCols, costCatCol, 'C')
        ]);
        setTopProfitCats(pCats);
        setTopCostCats(cCats);
      } catch {
        setTopProfitCats([]);
        setTopCostCats([]);
      }
    } catch (e) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [range, bucket]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-2xl font-semibold text-white">Net Profit Outlook</div>
            <div className="mt-1 text-sm text-white/50">Combine profit + cost tables into totals, trend, and category drivers.</div>
          </div>
          <div className="flex items-center gap-2">
            <select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
              <option value="last_30_days">Last 30 Days</option>
              <option value="last_90_days">Last 90 Days</option>
              <option value="last_180_days">Last 180 Days</option>
              <option value="ytd">Year to Date</option>
              <option value="all_time">All Time</option>
            </select>
            <select value={bucket} onChange={(e) => setBucket(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
            <button onClick={load} className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-sm text-white/80">Refresh</button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {error ? <ChartError message={error} onRetry={load} /> : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              <Skeleton h="h-[92px]" />
              <Skeleton h="h-[92px]" />
              <Skeleton h="h-[92px]" />
              <Skeleton h="h-[92px]" />
            </>
          ) : (
            <>
              <ExecutiveKpiCard label="Total Profit" value={formatCurrency(kpi.profit)} subtext="sum across profit amount columns" />
              <ExecutiveKpiCard label="Total Cost" value={formatCurrency(kpi.cost)} subtext="sum across cost amount columns" />
              <ExecutiveKpiCard label="Net Profit" value={formatCurrency(kpi.net)} subtext="profit - cost" />
              <ExecutiveKpiCard label="Margin %" value={`${formatNumber(kpi.margin.toFixed(1))}%`} subtext="net / profit" />
            </>
          )}
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <ChartCard title="Profit, Cost, Net (Trend)">
              {loading ? (
                <Skeleton h="h-[320px]" />
              ) : (series || []).length === 0 ? (
                <ChartEmpty onChangeRange={() => setRange('last_90_days')} />
              ) : (
                <div className="h-[320px]">
                  <SimpleLineChart height={320} series={series} keys={['Profit', 'Cost', 'Net']} colors={['#22c55e', '#ef4444', '#3b82f6']} />
                </div>
              )}
            </ChartCard>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-4">
            <ChartCard title="Top Profit Categories">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton h="h-10" />
                  <Skeleton h="h-10" />
                  <Skeleton h="h-10" />
                </div>
              ) : (topProfitCats || []).length ? (
                <div className="space-y-2">
                  {topProfitCats.map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-sm text-white truncate">{r.k}</div>
                      <div className="text-sm text-white/70">{formatCurrency(r.v)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/50">Map a Profit Category column to see drivers.</div>
              )}
            </ChartCard>

            <ChartCard title="Top Cost Categories">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton h="h-10" />
                  <Skeleton h="h-10" />
                  <Skeleton h="h-10" />
                </div>
              ) : (topCostCats || []).length ? (
                <div className="space-y-2">
                  {topCostCats.map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-sm text-white truncate">{r.k}</div>
                      <div className="text-sm text-white/70">{formatCurrency(r.v)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/50">Map a Cost Category column to see drivers.</div>
              )}
            </ChartCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function SingleTablePremiumCommandCenter() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('last_90_days');
  const [bucket, setBucket] = useState('month');
  const [kpis, setKpis] = useState([]);
  const [series, setSeries] = useState([]);
  const [title, setTitle] = useState('Dashboard');

  const parseJsonParam = (p) => {
    try {
      if (!p) return null;
      return JSON.parse(decodeURIComponent(p));
    } catch {
      try { return JSON.parse(String(p)); } catch { return null; }
    }
  };

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const url = new URL(window.location.href);
      const sources = parseJsonParam(url.searchParams.get('sources') || '') || [];
      const metrics = parseJsonParam(url.searchParams.get('metrics') || '') || [];
      const tableId = sources?.[0]?.tableId || '';
      const metricList = Array.isArray(metrics) ? metrics.filter(m => m && m.alias && (m.column_id || m.columnId)) : [];
      if (!tableId || !metricList.length) throw new Error('Missing dashboard configuration.');

      setTitle(url.searchParams.get('name') || 'Dashboard');

      const dateCol = (() => {
        const m = metricList.find(mm => mm && (mm.date_column_id || mm.dateColumn));
        return m ? String(m.date_column_id || m.dateColumn || '') : '';
      })();
      const backendBase = (import.meta?.env && import.meta.env.VITE_BACKEND_URL) || 'https://api.thehirepilot.com';
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
      const rangeStart = rangeToStartDate(range);
      const rangeCfg = mapRangeToWidgetRange(range, rangeStart || undefined);

      // KPI totals (up to 4)
      const kpiMetrics = metricList.slice(0, 4).map(m => ({
        alias: String(m.alias),
        agg: String(m.agg || 'SUM'),
        column_id: String(m.column_id || m.columnId || '')
      }));
      const kpiResp = await fetch(`${backendBase}/api/dashboards/widgets/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          table_id: tableId,
          metrics: kpiMetrics,
          time_bucket: 'none',
          ...(dateCol ? { date_column_id: dateCol } : {}),
          ...rangeCfg
        })
      });
      if (!kpiResp.ok) throw new Error('Failed to load KPI totals');
      const kpiJson = await kpiResp.json();
      const krow = Array.isArray(kpiJson?.series) ? kpiJson.series[0] : null;
      setKpis(kpiMetrics.map(m => ({ label: m.alias, value: Number(krow?.[m.alias]) || 0 })));

      // Trend (first 2 metrics)
      const trendMetrics = metricList.slice(0, 2).map(m => ({
        alias: String(m.alias),
        agg: String(m.agg || 'SUM'),
        column_id: String(m.column_id || m.columnId || '')
      }));
      if (dateCol) {
        const trendResp = await fetch(`${backendBase}/api/dashboards/widgets/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            table_id: tableId,
            metrics: trendMetrics,
            date_column_id: dateCol,
            time_bucket: bucket,
            ...rangeCfg
          })
        });
        if (!trendResp.ok) throw new Error('Failed to load trend series');
        const trendJson = await trendResp.json();
        setSeries(Array.isArray(trendJson?.series) ? trendJson.series : []);
      } else {
        setSeries([]);
      }
    } catch (e) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [range, bucket]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const el = document.getElementById('single-table-trend');
        if (!el) return;
        if (cancelled) return;

        const axisColor = '#e5e7eb';
        const gridColor = 'rgba(255,255,255,0.08)';
        const xs = (series || []).map(r => r.t);
        const keys = series?.[0] ? Object.keys(series[0]).filter(k => k !== 't') : [];
        const sparseMode = xs.length <= 1 ? 'lines+markers' : 'lines';
        const markerSize = xs.length <= 1 ? 10 : 6;
        const colors = ['#3b82f6', '#10b981', '#f97316', '#a855f7'];

        const traces = keys.slice(0, 2).map((k, idx) => ({
          type: 'scatter',
          mode: sparseMode,
          name: k,
          x: xs,
          y: (series || []).map(r => Number(r?.[k]) || 0),
          line: { color: colors[idx], width: 3 },
          marker: { color: colors[idx], size: markerSize }
        }));

        await Plotly.newPlot('single-table-trend', traces, {
          margin: { t: 10, r: 10, b: 40, l: 70 },
          plot_bgcolor: 'rgba(0,0,0,0)',
          paper_bgcolor: 'rgba(0,0,0,0)',
          xaxis: { title: '', showgrid: false, color: axisColor, type: 'category' },
          yaxis: { title: '', gridcolor: gridColor, color: axisColor },
          showlegend: true,
          legend: { orientation: 'h', y: -0.2, font: { color: axisColor } }
        }, { responsive: true, displayModeBar: false, displaylogo: false });
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [series]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-2xl font-semibold text-white">{title}</div>
            <div className="mt-1 text-sm text-white/50">Single-table dashboard</div>
          </div>
          <div className="flex items-center gap-3">
            <select className="rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur px-4 py-2 text-sm text-white/90" value={range} onChange={(e)=>setRange(e.target.value)}>
              <option value="all_time">All time</option>
              <option value="last_90_days">90d</option>
              <option value="last_30_days">30d</option>
              <option value="ytd">YTD</option>
            </select>
            <select className="rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur px-4 py-2 text-sm text-white/90" value={bucket} onChange={(e)=>setBucket(e.target.value)}>
              <option value="month">Month</option>
              <option value="week">Week</option>
            </select>
            <button className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm text-white/80">Edit Dashboard</button>
            <button className="rounded-xl bg-white text-zinc-900 hover:opacity-90 transition px-4 py-2 text-sm font-semibold">Add Widget</button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              <Skeleton h="h-[92px]" />
              <Skeleton h="h-[92px]" />
              <Skeleton h="h-[92px]" />
              <Skeleton h="h-[92px]" />
            </>
          ) : (
            <>
              {kpis.slice(0,4).map((k) => (
                <ExecutiveKpiCard key={k.label} label={k.label} value={formatNumber(k.value)} subtext="" />
              ))}
            </>
          )}
        </div>

        <div className="mt-6 grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <ChartCard title="Trend">
              {error ? (
                <ChartError message={error} onRetry={load} />
              ) : loading ? (
                <Skeleton h="h-[320px]" />
              ) : (series || []).length === 0 ? (
                <ChartEmpty onChangeRange={() => setRange('last_90_days')} />
              ) : (
                <div id="single-table-trend" className="h-[320px]" />
              )}
            </ChartCard>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-4">
            <ChartCard title="Notes">
              <div className="text-sm text-white/60">
                This is the premium single-table renderer. Multi-source dashboards still fall back to the legacy UI.
              </div>
            </ChartCard>
          </div>
        </div>
      </div>
    </div>
  );
}

const NavButton = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
      active
        ? 'text-white bg-gradient-to-r from-primary to-secondary shadow-lg'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
    }`}
  >
    <i className={`fa-solid ${icon}`}></i>
    <span className="font-medium">{label}</span>
  </button>
);

const SectionCard = ({ title, subtitle, icon, children }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 space-y-4">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
    </div>
    {children}
  </div>
);

const TablesSection = () => (
  <motion.div
    key="tables"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="flex-1 overflow-y-auto"
  >
    <div className="px-8 py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Tables Workspace</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Centralize every recruiting dataset—expenses, pipeline, leads, candidates—then share directly into dashboards.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Recent Tables" subtitle="Editable, resizable, formula-ready grids" icon="fa-table">
          <div className="space-y-3 text-sm">
            {['Expenses (Net Revenue)', 'Deals & Pipeline', 'Candidate Scorecards'].map((table) => (
              <div key={table} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{table}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Updated {Math.floor(Math.random() * 5) + 1} hrs ago</p>
                </div>
                <button className="text-indigo-600 dark:text-indigo-300 text-xs font-semibold hover:underline">Open</button>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Schema builder" subtitle="Drag columns, add money formats, attach formulas" icon="fa-layer-group">
          <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
            <li className="flex items-start gap-2"><i className="fa-solid fa-circle text-indigo-400 text-[8px] mt-1.5"></i>Money columns auto-format with currency + decimal rules.</li>
            <li className="flex items-start gap-2"><i className="fa-solid fa-circle text-indigo-400 text-[8px] mt-1.5"></i>Formula editor supports SUM/AVG/COUNT + nested expressions.</li>
            <li className="flex items-start gap-2"><i className="fa-solid fa-circle text-indigo-400 text-[8px] mt-1.5"></i>Inline collaboration: drag columns, resize widths, track history.</li>
          </ul>
        </SectionCard>
      </div>
      <SectionCard title="Import & Automations" subtitle="Connect CSV, ATS, CRM or Recruiting Agents" icon="fa-cloud-arrow-up">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {[
            { title: 'CSV Imports', note: 'Map columns, save presets, auto-enrich missing data.' },
            { title: 'API Sync', note: 'Pull Deals, Leads, Campaigns nightly via secure tokens.' },
            { title: 'Public Forms', note: 'Route lead/candidate submissions directly into tables.' },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-4">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.note}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  </motion.div>
);

const FormulasSection = () => (
  <motion.div
    key="formulas"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="flex-1 overflow-y-auto"
  >
    <div className="px-8 py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Formula Library</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Blend metrics across tables, assign aliases, then reuse them in dashboards or KPIs.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Featured Formulas" subtitle="Cross-table KPIs in plain English" icon="fa-calculator">
          <div className="space-y-3 text-sm">
            {[
              { label: 'Net Profit', expr: 'SUM(Revenue.amount) - SUM(Expenses.monthly)' },
              { label: 'Cost per Hire', expr: 'SUM(Expenses.recruiting) / COUNT(Hires.id)' },
              { label: 'Fill Rate', expr: 'COUNT(ClosedRequisitions.id) / COUNT(JobReqs.id)' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-slate-50 dark:bg-slate-900/40 p-3">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
                <p className="text-xs font-mono text-indigo-500 dark:text-indigo-300 mt-1">{item.expr}</p>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Formula Builder" subtitle="Safe parser with auto-complete tokens" icon="fa-wand-magic-sparkles">
          <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
            <li className="flex items-start gap-2"><i className="fa-solid fa-circle text-indigo-400 text-[8px] mt-1.5"></i>Select sources → name aliases → join on date/client.</li>
            <li className="flex items-start gap-2"><i className="fa-solid fa-circle text-indigo-400 text-[8px] mt-1.5"></i>Supports SUM, AVG, COUNT, MIN, MAX and arithmetic order-of-operations.</li>
            <li className="flex items-start gap-2"><i className="fa-solid fa-circle text-indigo-400 text-[8px] mt-1.5"></i>Preview results by time bucket (daily / weekly / monthly) instantly.</li>
          </ul>
          <button className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700">Launch Formula Builder</button>
        </SectionCard>
      </div>
      <SectionCard title="Recently Edited Formulas" subtitle="Drafts saved every change" icon="fa-clock-rotate-left">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600 dark:text-slate-300">
          {['Net Revenue Retention', 'Agency Fee %', 'Time-to-Fill Delta'].map((item) => (
            <div key={item} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{item}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Edited {Math.floor(Math.random()*3)+1} days ago</p>
              <button className="mt-3 text-indigo-600 dark:text-indigo-300 text-xs font-semibold hover:underline">Open Formula</button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  </motion.div>
);

const AIInsightsSection = () => (
  <motion.div
    key="ai"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="flex-1 overflow-y-auto"
  >
    <div className="px-8 py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">REX AI Insights</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ask natural questions, auto-generate summaries, and trigger AI-recommended playbooks from any dashboard.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Insight Templates" subtitle="One-click prompts tuned for recruiting ops" icon="fa-robot">
          <div className="space-y-3 text-sm">
            {[
              { title: 'Pipeline anomalies', detail: '“What changed week-over-week for pipeline value and win-rate?”' },
              { title: 'Expense variance', detail: '“Explain why expenses spiked vs budget last month.”' },
              { title: 'Next best action', detail: '“Suggest 3 actions to increase net profit next quarter.”' },
            ].map((item) => (
              <div key={item.title} className="rounded-lg bg-slate-50 dark:bg-slate-900/40 p-3">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Snapshot Builder" subtitle="Normalize charts + KPIs for LLM consumption" icon="fa-chart-pie">
          <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
            <li className="flex items-start gap-2"><i className="fa-solid fa-circle text-indigo-400 text-[8px] mt-1.5"></i>Converts each widget to `AnalyticsSeries`/`AnalyticsKPI` JSON.</li>
            <li className="flex items-start gap-2"><i className="fa-solid fa-circle text-indigo-400 text-[8px] mt-1.5"></i>Embeds context (filters, time range, targets) before hitting the LLM.</li>
            <li className="flex items-start gap-2"><i className="fa-solid fa-circle text-indigo-400 text-[8px] mt-1.5"></i>Routes responses to Insights panel, Slack, or email digests.</li>
          </ul>
          <button className="mt-4 px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold shadow hover:opacity-90">Generate Snapshot</button>
        </SectionCard>
      </div>
      <SectionCard title="Automation Hooks" subtitle="Let AI kick off alerts, tasks, and sequences" icon="fa-bolt">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {[
            { title: 'Alerts', copy: 'Auto-send recap to exec Slack channel when KPIs move ±10%.' },
            { title: 'Playbooks', copy: 'Trigger outreach sequences when deal velocity slows.' },
            { title: 'Briefings', copy: 'Export AI summary into CRM notes for weekly reviews.' },
          ].map((hook) => (
            <div key={hook.title} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{hook.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{hook.copy}</p>
              <button className="mt-3 text-indigo-600 dark:text-indigo-300 text-xs font-semibold hover:underline">Configure</button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  </motion.div>
);

function DashboardDetailLegacy() {
  const [kpis, setKpis] = useState([]);
  const [showFunnel, setShowFunnel] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showCphTrend, setShowCphTrend] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [profile, setProfile] = useState({ name: 'Alex Chen', role: 'Admin', avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg' });
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id || !mounted) return;
        const { data: profileRow } = await supabase
          .from('users')
          .select('first_name,last_name,role,avatar_url,account_type,full_name')
          .eq('id', user.id)
          .maybeSingle();
        const displayName = profileRow?.full_name
          || [profileRow?.first_name, profileRow?.last_name].filter(Boolean).join(' ')
          || user.user_metadata?.name
          || `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim()
          || user.email
          || 'You';
        const avatarUrl = profileRow?.avatar_url || user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
        const normalizedRole = (profileRow?.role || profileRow?.account_type || user.user_metadata?.role || 'Member')
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        const displayRole = normalizedRole;
        if (mounted) setProfile({ name: displayName, role: displayRole, avatar: avatarUrl });
      } catch (err) {
        console.error('Profile fetch failed', err);
      }
    })();
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id && isMounted) {
          // Some environments don't have users.full_name; derive display name from first/last name or auth metadata.
          const { data: dbProfile, error: dbErr } = await supabase
            .from('users')
            .select('first_name,last_name,role,avatar_url,account_type')
            .eq('id', user.id)
            .maybeSingle();
          if (dbErr) throw dbErr;
          const firstName = user.user_metadata?.first_name || '';
          const lastName = user.user_metadata?.last_name || '';
          const fallbackName = [firstName, lastName].filter(Boolean).join(' ') || user.email || 'Member';
          const derivedName =
            [dbProfile?.first_name, dbProfile?.last_name].filter(Boolean).join(' ')
            || fallbackName;
          const derivedRole = (dbProfile?.role || dbProfile?.account_type || user.user_metadata?.role || 'Member').replace(/_/g, ' ');
          const derivedAvatar = dbProfile?.avatar_url || user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(derivedName)}&background=random`;
          setProfile({ name: derivedName, role: derivedRole, avatar: derivedAvatar });
        }
      } catch {
        // silent fallback to default profile
      }
    })();
    (async () => {
      try {
        if (!isMounted) return;
        // Try dynamic data via preview endpoint using modal selections
        const url = new URL(window.location.href);
        // Prefer env, but default to Railway API domain so charts call backend in prod
        const backendBase = (import.meta?.env && import.meta.env.VITE_BACKEND_URL) || 'https://api.thehirepilot.com';
        const sourcesParam = url.searchParams.get('sources');
        const metricsParam = url.searchParams.get('metrics');
        const formulaParam = url.searchParams.get('formula');
        const tb = url.searchParams.get('tb') || 'month';
        const groupAlias = url.searchParams.get('groupAlias') || '';
        const groupCol = url.searchParams.get('groupCol') || '';
        const groupMode = url.searchParams.get('groupMode') || (tb !== 'none' ? 'time' : 'row');
        const includeDeals = url.searchParams.get('includeDeals') === '1';
        const range = url.searchParams.get('range') || 'last_90_days';
        const formulaLabel = url.searchParams.get('formulaLabel') || 'Formula';
        const sources = sourcesParam ? JSON.parse(decodeURIComponent(sourcesParam)) : [];
        const metrics = metricsParam ? JSON.parse(decodeURIComponent(metricsParam)) : [];
        const formulaExpr = formulaParam ? decodeURIComponent(formulaParam) : '';
        const groupBy = groupAlias ? { alias: groupAlias, columnId: groupCol || undefined, mode: groupMode } : undefined;
        const rangeStart = rangeToStartDate(range);
        // Optional UI flags: default hidden unless explicitly requested
        setShowFunnel(url.searchParams.get('showFunnel') === '1');
        setShowCampaigns(url.searchParams.get('showCampaigns') === '1');
        // Build dynamic traces
        const traces = [];
        const plotlyModeForPoints = (pts) => (Array.isArray(pts) && pts.length <= 1 ? 'lines+markers' : 'lines');
        const plotlyMarkerFor = (color, pts) => {
          // Make single-point series very obvious; otherwise keep markers subtle/off.
          if (Array.isArray(pts) && pts.length <= 1) return { size: 10, color, line: { width: 2, color: '#ffffff' } };
          return { size: 6, color, opacity: 0.9 };
        };
        // If includeDeals, fetch revenue monthly series via Supabase view and add as trace and KPI
        let revenueKpi = 0;
        if (includeDeals) {
          try {
            let dealsQuery = supabase
              .from('opportunities')
              .select('value, stage, created_at')
              .order('created_at', { ascending: true });
            if (rangeStart) dealsQuery = dealsQuery.gte('created_at', rangeStart.toISOString());
            const { data: dealsRows, error: dealsError } = await dealsQuery;
            if (dealsError) throw dealsError;
            const closeWon = (dealsRows || []).filter((row) => String(row?.stage || '').toLowerCase() === 'close won');
            if (closeWon.length) {
              const buckets = new Map();
              closeWon.forEach((row, idx) => {
                const amt = Number(row?.value) || 0;
                if (!amt) return;
                let bucketKey = `Deal ${idx + 1}`;
                if (groupMode === 'time' && row?.created_at) {
                  const d = new Date(row.created_at);
                  bucketKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                }
                buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + amt);
              });
              const overlayX = Array.from(buckets.keys());
              const overlayY = overlayX.map((key) => buckets.get(key) || 0);
              if (overlayY.some((v) => Number.isFinite(v) && v !== 0)) {
                traces.push({
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Close Won',
                  x: overlayX,
                  y: overlayY,
                  line: { width: 3, color: '#f97316' }
                });
                revenueKpi = overlayY.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
              }
            } else {
              toast('No Close Won deals in this range yet.');
            }
          } catch (err) {
            console.error('Close Won overlay error', err);
            toast.error('Failed to load Close Won revenue');
          }
        }
        if (backendBase && sources.length) {
          const palette = ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6'];
          let paletteIdx = 0;
          const { data: { session } } = await supabase.auth.getSession();
          const authHeader = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
          // Prefer universal single-table query when possible (faster, stable column_id, better empty states).
          const canUseWidgetQuery = sources.length === 1 && Array.isArray(metrics) && metrics.length > 0;
          if (canUseWidgetQuery) {
            try {
              const tableId = sources[0]?.tableId;
              const tbMapped = tb === 'none' ? 'none' : (tb || 'month');
              const rangeCfg = mapRangeToWidgetRange(range, rangeStart);
              const dateColumnId = groupBy?.mode === 'time' ? (groupBy?.columnId || undefined) : undefined;
              const widgetMetrics = (metrics || []).map((m) => ({
                alias: m.alias,
                agg: (m.agg || 'SUM').toUpperCase(),
                column_id: m.column_id || m.columnId
              }));
              const r = await fetch(`${backendBase}/api/dashboards/widgets/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeader },
                body: JSON.stringify({
                  table_id: tableId,
                  metrics: widgetMetrics,
                  date_column_id: dateColumnId,
                  time_bucket: tbMapped,
                  ...rangeCfg
                })
              });
              if (r.ok) {
                const json = await r.json();
                const series = Array.isArray(json?.series) ? json.series : [];
                if (json?.message && String(json.message).toLowerCase().includes('no data')) {
                  toast(json.message);
                }
                (json?.warnings || []).forEach((w) => { try { toast(String(w)); } catch {} });
                if (series.length) {
                  for (const m of (metrics || [])) {
                    const alias = m.alias;
                    const pts = series.map((row) => ({ x: row.t, value: Number(row?.[alias]) || 0 }));
                    const color = palette[paletteIdx % palette.length];
                    traces.push({
                      type: 'scatter',
                      mode: plotlyModeForPoints(pts),
                      name: alias,
                      x: pts.map(p => p.x),
                      y: pts.map(p => p.value),
                      line: { width: 3, color },
                      marker: plotlyMarkerFor(color, pts)
                    });
                    paletteIdx += 1;
                  }
                }
              }
            } catch {
              // fall back to formula preview below
            }
          }
          // Side-by-side metrics (each becomes its own formula chart) fallback: multi-table or widget query failed
          if (!traces.length) {
            for (const m of (Array.isArray(metrics) ? metrics : [])) {
              try {
                const columnId = m.column_id || m.columnId;
                const r = await fetch(`${backendBase}/api/dashboards/any/widgets/any/preview`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({
                    type: 'formulaChart',
                    formula: `${(m.agg || 'SUM').toUpperCase()}(${aggRef(m.alias, columnId)})`,
                    sources,
                    timeBucket: tb,
                    groupBy
                  })
                });
                if (r.ok) {
                  const json = await r.json();
                  const pts = json?.points || [];
                  if (!Array.isArray(pts) || pts.length === 0) continue;
                  const color = palette[paletteIdx % palette.length];
                  traces.push({
                    type: 'scatter',
                    mode: plotlyModeForPoints(pts),
                    name: m.alias || m.columnId,
                    x: pts.map(p => p.x),
                    y: pts.map(p => p.value),
                    line: { width: 3, color },
                    marker: plotlyMarkerFor(color, pts)
                  });
                  paletteIdx += 1;
                }
              } catch {
                toast.error(`Failed to load ${m.alias || m.columnId} series`);
              }
            }
          }
          // Optional formula series
          if (formulaExpr) {
            try {
              const r = await fetch(`${backendBase}/api/dashboards/any/widgets/any/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeader },
                body: JSON.stringify({
                  type: 'formulaChart',
                  formula: formulaExpr,
                  sources,
                  timeBucket: tb,
                  groupBy
                })
              });
              if (r.ok) {
                const json = await r.json();
                const pts = json?.points || [];
                if (Array.isArray(pts) && pts.length) {
                  const color = palette[paletteIdx % palette.length];
                  traces.push({
                  type: 'scatter',
                  mode: plotlyModeForPoints(pts),
                  name: formulaLabel || 'Formula',
                  x: pts.map(p => p.x),
                  y: pts.map(p => p.value),
                  line: { width: 3, color },
                  marker: plotlyMarkerFor(color, pts)
                });
                }
                paletteIdx += 1;
              }
            } catch {
              toast.error('Failed to load formula series');
            }
          }
          // Compute KPI cards (aggregates with no time bucket)
          const k = [];
          // Prefer universal widget query for KPI row when single-table.
          if (sources.length === 1 && Array.isArray(metrics) && metrics.length) {
            try {
              const rangeCfg = mapRangeToWidgetRange(range, rangeStart);
              const widgetMetrics = (metrics || []).map((m) => ({
                alias: m.alias,
                agg: (m.agg || 'SUM').toUpperCase(),
                column_id: m.column_id || m.columnId
              }));
              const r = await fetch(`${backendBase}/api/dashboards/widgets/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeader },
                body: JSON.stringify({
                  table_id: sources[0]?.tableId,
                  metrics: widgetMetrics,
                  time_bucket: 'none',
                  ...rangeCfg
                })
              });
              if (r.ok) {
                const j = await r.json();
                const row = Array.isArray(j?.series) ? j.series[0] : null;
                for (const m of (metrics || [])) {
                  const columnId = m.column_id || m.columnId;
                  const val = row ? (row[m.alias] ?? 0) : 0;
                  k.push({ id: `${m.alias}_${columnId}`, label: m.alias || columnId, value: val, format: /amount|revenue|price|cost|value|total|monthly|yearly/i.test(String(columnId)) ? 'currency' : 'number' });
                }
              }
            } catch {}
          }
          // Fallback to formula preview KPI for multi-table
          if (!k.length) {
            for (const m of (Array.isArray(metrics) ? metrics : [])) {
              try {
                const columnId = m.column_id || m.columnId;
                const r = await fetch(`${backendBase}/api/dashboards/any/widgets/any/preview`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({
                    type: 'formulaMetric',
                    formula: `${(m.agg || 'SUM').toUpperCase()}(${aggRef(m.alias, columnId)})`,
                    sources,
                    timeBucket: 'none'
                  })
                });
                if (r.ok) {
                  const j = await r.json();
                  k.push({ id: `${m.alias}_${columnId}`, label: m.alias || columnId, value: j?.value ?? 0, format: /amount|revenue|price|cost|value|total|monthly|yearly/i.test(String(columnId)) ? 'currency' : 'number' });
                }
              } catch {
                toast.error(`Failed to load ${m.alias || m.columnId} KPI`);
              }
            }
          }
          if (formulaExpr) {
            try {
              const r = await fetch(`${backendBase}/api/dashboards/any/widgets/any/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeader },
                body: JSON.stringify({
                  type: 'formulaMetric',
                  formula: formulaExpr,
                  sources,
                  timeBucket: 'none'
                })
              });
              if (r.ok) {
                const j = await r.json();
                k.unshift({ id: 'formula_metric', label: formulaLabel || 'Formula', value: j?.value ?? 0, format: 'currency' });
              }
            } catch {
              toast.error('Failed to load formula KPI');
            }
          }
          // Add revenue KPI if present
          if (revenueKpi > 0) k.unshift({ id: 'revenue_total', label: 'Revenue', value: revenueKpi, format: 'currency' });
          if (isMounted) setKpis(k);
        }

        // Theme-aware chart colors
        const isDark = document.documentElement.classList.contains('dark');
        const axisColor = isDark ? '#e5e7eb' : '#475569';
        const gridColor = isDark ? '#334155' : '#f1f5f9';
        const paperBg = 'rgba(0,0,0,0)';
        const plotBg = 'rgba(0,0,0,0)';

        // Revenue vs Expenses (dynamic if traces, otherwise fallback)
        try {
          await Plotly.newPlot('revenue-chart', traces.length ? traces : [{
            type: 'scatter',
            mode: 'lines',
            name: 'Revenue',
            x: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
            y: [420000, 445000, 438000, 465000, 482000, 490000, 505000, 518000, 532000],
            line: { color: '#6366f1', width: 3 }
          }, {
            type: 'scatter',
            mode: 'lines',
            name: 'Expenses',
            x: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
            y: [280000, 285000, 290000, 295000, 298000, 302000, 305000, 310000, 315000],
            line: { color: '#ec4899', width: 3 }
          }], {
            margin: { t: 20, r: 20, b: 40, l: 60 },
            plot_bgcolor: plotBg,
            paper_bgcolor: paperBg,
            // When we're plotting bucket keys (YYYY-MM, row labels, categories), treat x as categorical
            // so Plotly doesn't auto-interpret as a date axis and zoom into weird sub-second ticks.
            xaxis: { title: '', showgrid: false, color: axisColor, type: traces.length ? 'category' : undefined },
            yaxis: { title: 'Amount ($)', gridcolor: gridColor, color: axisColor },
            showlegend: true,
            legend: { orientation: 'h', y: -0.15 }
          }, { responsive: true, displayModeBar: false, displaylogo: false });
        } catch {}
        // Funnel (only if container exists)
        try {
          const funnelEl = document.getElementById('funnel-chart');
          if (funnelEl) await Plotly.newPlot('funnel-chart', [{
            type: 'funnel',
            y: ['Leads', 'Candidates', 'Screening', 'Interviews', 'Offers', 'Hires'],
            x: [2450, 1820, 1050, 420, 198, 142],
            marker: { color: ['#6366f1', '#7c3aed', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe'] }
          }], {
            margin: { t: 20, r: 20, b: 40, l: 100 },
            plot_bgcolor: plotBg,
            paper_bgcolor: paperBg
          }, { responsive: true, displayModeBar: false, displaylogo: false });
        } catch {}
        // Campaign performance (only if container exists)
        try {
          const campEl = document.getElementById('campaign-chart');
          if (campEl) await Plotly.newPlot('campaign-chart', [{
            type: 'bar',
            x: ['LinkedIn', 'Email', 'Referrals', 'Job Boards', 'Events'],
            y: [58, 42, 28, 10, 4],
            marker: { color: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'] }
          }], {
            margin: { t: 20, r: 20, b: 60, l: 60 },
            plot_bgcolor: plotBg,
            paper_bgcolor: paperBg,
            xaxis: { title: '', showgrid: false, color: axisColor },
            yaxis: { title: 'Hires', gridcolor: gridColor, color: axisColor }
          }, { responsive: true, displayModeBar: false, displaylogo: false });
        } catch {}
        // Cost Per Hire trend (fallback; only if container exists)
        try {
          const cphEl = document.getElementById('cph-chart');
          let cphSeries = null; // not computed yet in this version
          const cphTrace = cphSeries ? {
            type: 'scatter',
            mode: 'lines',
            x: cphSeries.map(p => p.x),
            y: cphSeries.map(p => p.value),
            line: { color: '#10b981', width: 3 },
            fill: 'tozeroy',
            fillcolor: 'rgba(16, 185, 129, 0.1)'
          } : null;
          if (cphEl) await Plotly.newPlot('cph-chart', cphTrace ? [cphTrace] : [{
            type: 'scatter',
            mode: 'lines',
            x: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
            y: [2280, 2240, 2195, 2150, 2120, 2085, 2055, 2030, 2004],
            line: { color: '#10b981', width: 3 },
            fill: 'tozeroy',
            fillcolor: 'rgba(16, 185, 129, 0.1)'
          }], {
            margin: { t: 20, r: 20, b: 40, l: 60 },
            plot_bgcolor: plotBg,
            paper_bgcolor: paperBg,
            xaxis: { title: '', showgrid: false, color: axisColor },
            yaxis: { title: 'Cost ($)', gridcolor: gridColor, color: axisColor },
            showlegend: false
          }, { responsive: true, displayModeBar: false, displaylogo: false });
          if (isMounted) setShowCphTrend(Boolean(cphSeries && cphEl));
        } catch {}
      } catch (e) {
        console.error('Chart error:', e);
      }
    })();
    // Panel open/close and staged content reveal
    const askBtn = document.getElementById('ask-rex-btn');
    const closeBtn = document.getElementById('close-panel-btn');
    const showScope = (text) => {
      const scope = document.getElementById('insights-scope');
      if (scope) { scope.textContent = `Scope: ${text}`; scope.classList.remove('hidden'); }
    };
    const populatePanel = (json) => {
      const hide = (id) => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); };
      const show = (id) => { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); };
      hide('loading-state');
      show('summary-section');
      show('insights-section');
      show('suggestions-section');
      show('query-section');
      const summaryEl = document.querySelector('#summary-section p');
      if (summaryEl && json?.summary) summaryEl.textContent = json.summary;
      const list = document.querySelector('#insights-section ul');
      if (list && Array.isArray(json?.bulletInsights)) {
        list.innerHTML = '';
        json.bulletInsights.slice(0, 6).forEach((t) => {
          const li = document.createElement('li');
          li.className = 'flex items-start gap-2 text-sm text-slate-600';
          li.innerHTML = '<i class=\"fa-solid fa-circle text-purple-400 text-xs mt-1.5\"></i><span></span>';
          li.querySelector('span').textContent = t;
          list.appendChild(li);
        });
      }
      const sugWrap = document.querySelector('#suggestions-section .space-y-3');
      if (sugWrap && Array.isArray(json?.suggestions)) {
        sugWrap.innerHTML = '';
        json.suggestions.slice(0, 3).forEach((t) => {
          const div = document.createElement('div');
          div.className = 'p-3 bg-slate-50 rounded-lg';
          div.innerHTML = `<p class=\"text-sm font-semibold text-slate-900 mb-1\">Suggestion</p><p class=\"text-xs text-slate-600\"></p>`;
          div.querySelector('p.text-xs').textContent = t;
          sugWrap.appendChild(div);
        });
      }
    };
    const onAsk = async () => {
      const panel = document.getElementById('insights-panel');
      if (!panel) return;
      panel.classList.remove('hidden');
      // Call insights endpoint to populate panel
      try {
        const backendBase = (import.meta?.env && import.meta.env.VITE_BACKEND_URL) || '';
        const { data: { session } } = await supabase.auth.getSession();
        const payload = {
          kpis: [
            { id: 'net_profit', label: 'Net Profit', value: 284500, format: 'currency' },
            { id: 'total_hires', label: 'Total Hires', value: 142, format: 'number' },
            { id: 'cph', label: 'Cost Per Hire', value: 2004, format: 'currency' },
            { id: 'conv_rate', label: 'Conversion Rate', value: 0.187, format: 'percent' }
          ],
          series: []
        };
        const resp = await fetch(`${backendBase}/api/analytics/insights/dashboard/demo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
          },
          body: JSON.stringify(payload)
        });
        if (resp.ok) { const json = await resp.json(); showScope('Dashboard'); populatePanel(json); }
      } catch {}
    };
    const onClose = () => {
      const panel = document.getElementById('insights-panel');
      if (!panel) return;
      panel.classList.add('hidden');
    };
    askBtn?.addEventListener('click', onAsk);
    closeBtn?.addEventListener('click', onClose);
    // Explain buttons per widget
    const backendBase = (import.meta?.env && import.meta.env.VITE_BACKEND_URL) || '';
    const explain = async (widgetId, title, series) => {
      const panel = document.getElementById('insights-panel');
      panel?.classList.remove('hidden');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await fetch(`${backendBase}/api/analytics/insights/widget/${encodeURIComponent(widgetId)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
          },
          body: JSON.stringify({ series })
        });
        if (resp.ok) { const json = await resp.json(); showScope(title); populatePanel(json); }
      } catch {}
    };
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'];
    const staticRevenue = [420000,445000,438000,465000,482000,490000,505000,518000,532000];
    const staticExpenses = [280000,285000,290000,295000,298000,302000,305000,310000,315000];
    const btnRevenue = document.getElementById('explain-revenue');
    const btnFunnel = document.getElementById('explain-funnel');
    const btnCampaign = document.getElementById('explain-campaign');
    const btnCph = document.getElementById('explain-cph');
    btnRevenue?.addEventListener('click', () => {
      const series = revSeries ? [
        { id: 'net_profit', label: 'Net Profit', values: revSeries }
      ] : [
        { id: 'revenue', label: 'Revenue', values: months.map((m,i)=>({ x:m, value: staticRevenue[i] })) },
        { id: 'expenses', label: 'Expenses', values: months.map((m,i)=>({ x:m, value: staticExpenses[i] })) }
      ];
      explain('revenue_vs_expenses', 'Revenue vs Expenses', series);
    });
    btnFunnel?.addEventListener('click', () => {
      const cats = ['Leads','Candidates','Screening','Interviews','Offers','Hires'];
      const vals = [2450,1820,1050,420,198,142];
      const series = [{ id:'funnel', label:'Recruiting Funnel', values: cats.map((c,i)=>({ x:c, value: vals[i] })) }];
      explain('recruiting_funnel', 'Recruiting Funnel', series);
    });
    btnCampaign?.addEventListener('click', () => {
      const cats = ['LinkedIn','Email','Referrals','Job Boards','Events'];
      const vals = [58,42,28,10,4];
      const series = [{ id:'campaigns', label:'Campaign Performance', values: cats.map((c,i)=>({ x:c, value: vals[i] })) }];
      explain('campaign_performance', 'Campaign Performance', series);
    });
    btnCph?.addEventListener('click', () => {
      const series = cphSeries ? [
        { id:'cph', label:'Cost Per Hire', values: cphSeries }
      ] : [
        { id:'cph', label:'Cost Per Hire', values: months.map((m,i)=>({ x:m, value: [2280,2240,2195,2150,2120,2085,2055,2030,2004][i] })) }
      ];
      explain('cph_trend', 'Cost Per Hire Trend', series);
    });
    return () => {
      isMounted = false;
      try { askBtn?.removeEventListener('click', onAsk); } catch {}
      try { closeBtn?.removeEventListener('click', onClose); } catch {}
      try { btnRevenue?.removeEventListener('click', ()=>{}); } catch {}
      try { btnFunnel?.removeEventListener('click', ()=>{}); } catch {}
      try { btnCampaign?.removeEventListener('click', ()=>{}); } catch {}
      try { btnCph?.removeEventListener('click', ()=>{}); } catch {}
    };
  }, []);

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen">
      <style>{`
        * { font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { display: none; }
        .gradient-border { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%); padding: 2px; border-radius: 12px; }
        .gradient-bg { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); }
        .insight-card { transition: all 0.3s ease; }
        .insight-card:hover { transform: translateY(-2px); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
      `}</style>
      <div id="main-container" className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside id="sidebar" className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-chart-line text-white text-lg"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">REX Analytics</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">AI-Powered Insights</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            <NavButton icon="fa-gauge-high" label="Dashboard" active={activeSection === 'dashboard'} onClick={() => setActiveSection('dashboard')} />
            <NavButton icon="fa-table" label="Tables" active={activeSection === 'tables'} onClick={() => setActiveSection('tables')} />
            <NavButton icon="fa-calculator" label="Formulas" active={activeSection === 'formulas'} onClick={() => setActiveSection('formulas')} />
            <NavButton icon="fa-robot" label="AI Insights" active={activeSection === 'ai'} onClick={() => setActiveSection('ai')} />
          </nav>
          <div className="p-4 border-t border-slate-200">
            <div className="flex items-center gap-3 px-4 py-3">
              <img src={profile.avatar} alt={profile.name} className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{profile.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{profile.role}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main id="main-content" className="flex-1 flex overflow-hidden">
          <AnimatePresence mode="wait">
            {activeSection === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 overflow-y-auto"
              >
            {/* Header */}
            <header id="header" className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
              <div className="px-8 py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Recruiting Performance</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Last 90 days • Updated 5 min ago</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition flex items-center gap-2">
                      <i className="fa-solid fa-calendar"></i>
                      <span>Last 90 Days</span>
                    </button>
                    <button id="ask-rex-btn" className="px-6 py-2 gradient-bg text-white rounded-lg font-medium hover:opacity-90 transition flex items-center gap-2 shadow-lg">
                      <i className="fa-solid fa-sparkles"></i>
                      <span>Ask REX</span>
                    </button>
                  </div>
                </div>
              </div>
            </header>

            {/* KPIs (dynamic – only render if provided by modal config) */}
            {kpis.length > 0 && (
              <div id="kpi-section" className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {kpis.slice(0, 4).map((k) => (
                    <div key={k.id} className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 insight-card">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                          <i className="fa-solid fa-chart-line text-blue-600 text-xl"></i>
                        </div>
                        <button className="text-slate-400 hover:text-slate-600">
                          <i className="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{k.label}</p>
                      <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                        {k.format === 'currency'
                          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(k.value || 0))
                          : (k.format === 'percent'
                            ? `${Math.round(Number(k.value || 0) * 100)}%`
                            : new Intl.NumberFormat('en-US').format(Number(k.value || 0)))}
                      </h3>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charts */}
            <div id="charts-section" className="px-8 pb-8">
              <div className="grid grid-cols-2 gap-6">
                <div id="chart-card-1" className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 insight-card">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900">Revenue vs Expenses</h3>
                    <button id="explain-revenue" className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2">
                      <i className="fa-solid fa-lightbulb"></i>
                      Explain
                    </button>
                  </div>
                  <div id="revenue-chart" style={{ height: '300px' }}></div>
                </div>
                {showFunnel && (
                  <div id="chart-card-2" className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 insight-card">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-slate-900">Recruiting Funnel</h3>
                      <button id="explain-funnel" className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2">
                        <i className="fa-solid fa-lightbulb"></i>
                        Explain
                      </button>
                    </div>
                    <div id="funnel-chart" style={{ height: '300px' }}></div>
                  </div>
                )}
                {showCampaigns && (
                  <div id="chart-card-3" className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 insight-card">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-slate-900">Campaign Performance</h3>
                      <button id="explain-campaign" className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2">
                        <i className="fa-solid fa-lightbulb"></i>
                        Explain
                      </button>
                    </div>
                    <div id="campaign-chart" style={{ height: '300px' }}></div>
                  </div>
                )}
                {showCphTrend && (
                  <div id="chart-card-4" className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 insight-card">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-slate-900">Cost Per Hire Trend</h3>
                      <button id="explain-cph" className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2">
                        <i className="fa-solid fa-lightbulb"></i>
                        Explain
                      </button>
                    </div>
                    <div id="cph-chart" style={{ height: '300px' }}></div>
                  </div>
                )}
              </div>
            </div>
              </motion.div>
            )}
            {activeSection === 'tables' && <TablesSection />}
            {activeSection === 'formulas' && <FormulasSection />}
            {activeSection === 'ai' && <AIInsightsSection />}
          </AnimatePresence>

          {/* Insights Panel */}
          <aside id="insights-panel" className="w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 overflow-y-auto hidden">
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6 z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-sparkles text-white"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">REX Insights</h3>
                    <p className="text-xs text-slate-500">AI-powered analysis</p>
                      <div id="insights-scope" className="text-[11px] text-slate-500 mt-1 hidden">Scope: Dashboard</div>
                  </div>
                </div>
                <button id="close-panel-btn" className="text-slate-400 hover:text-slate-600">
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>
            </div>
            <div id="insights-content" className="p-6 space-y-6">
              <div id="loading-state" className="space-y-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-slate-200 rounded w-full mb-3"></div>
                  <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                </div>
              </div>
              <div id="summary-section" className="hidden">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-brain text-blue-600"></i>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 mb-2">Summary</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Your recruiting performance is strong this quarter. Net profit increased 12.3% to $284,500 driven by higher revenue and controlled expenses. You've hired 142 candidates with an improved cost per hire of $2,004.
                    </p>
                  </div>
                </div>
              </div>
              <div id="insights-section" className="hidden">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-lightbulb text-purple-600"></i>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-900 mb-3">Key Insights</h4>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2 text-sm text-slate-600">
                        <i className="fa-solid fa-circle text-purple-400 text-xs mt-1.5"></i>
                        <span>Revenue grew 15% while expenses only increased 8%, improving profit margins significantly.</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-600">
                        <i className="fa-solid fa-circle text-purple-400 text-xs mt-1.5"></i>
                        <span>Conversion rate from interviews to offers jumped to 18.7%, indicating better candidate quality.</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-600">
                        <i className="fa-solid fa-circle text-purple-400 text-xs mt-1.5"></i>
                        <span>LinkedIn campaigns delivered 38% more hires than email outreach at lower cost per hire.</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-600">
                        <i className="fa-solid fa-circle text-purple-400 text-xs mt-1.5"></i>
                        <span>Drop-off between candidate screening and interviews is 42%, suggesting stricter initial filters.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div id="suggestions-section" className="hidden">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-pink-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-rocket text-pink-600"></i>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-900 mb-3">Suggestions</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm font-semibold text-slate-900 mb-1">Increase LinkedIn budget</p>
                        <p className="text-xs text-slate-600">Your LinkedIn campaigns have the best ROI. Consider reallocating 20% from email to LinkedIn.</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm font-semibold text-slate-900 mb-1">Optimize screening criteria</p>
                        <p className="text-xs text-slate-600">High drop-off at screening stage. Review filters to balance quality with volume.</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm font-semibold text-slate-900 mb-1">Scale successful patterns</p>
                        <p className="text-xs text-slate-600">Your interview-to-offer rate improved. Document what changed and replicate across teams.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div id="query-section" className="hidden">
                <div className="border-t border-slate-200 pt-6">
                  <h4 className="text-sm font-bold text-slate-900 mb-3">Ask REX</h4>
                  <div className="relative">
                    <input type="text" placeholder="Ask a question about this dashboard..." className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 gradient-bg rounded-lg flex items-center justify-center text-white hover:opacity-90 transition">
                      <i className="fa-solid fa-paper-plane"></i>
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    <button className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition">Which client is most profitable?</button>
                    <button className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition">Why is net profit up this month?</button>
                    <button className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition">How can I reduce cost per hire?</button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

export default function DashboardDetail() {
  let tpl = '';
  let sourcesRaw = '';
  let metricsRaw = '';
  try {
    const url = new URL(window.location.href);
    tpl = url.searchParams.get('tpl') || '';
    sourcesRaw = url.searchParams.get('sources') || '';
    metricsRaw = url.searchParams.get('metrics') || '';
  } catch {}
  if (tpl === 'exec_overview_v1') return <ExecOverviewCommandCenter />;
  if (tpl === 'pipeline_health_v1') return <PipelineHealthCommandCenter />;
  if (tpl === 'cost_drivers_v1') return <CostDriversCommandCenter />;
  if (tpl === 'net_profit_outlook_v1') return <NetProfitOutlookCommandCenter />;
  if (tpl) return <ExecOverviewCommandCenter />;

  // If this is a single-table dashboard layout (custom tables), prefer the premium renderer.
  const isSingleTableLayout = (() => {
    try {
      if (!sourcesRaw || !metricsRaw) return false;
      const sources = JSON.parse(decodeURIComponent(sourcesRaw));
      const metrics = JSON.parse(decodeURIComponent(metricsRaw));
      if (!Array.isArray(sources) || sources.length !== 1) return false;
      if (!sources[0]?.tableId) return false;
      if (!Array.isArray(metrics) || !metrics.length) return false;
      return true;
    } catch {
      return false;
    }
  })();
  if (isSingleTableLayout) return <SingleTablePremiumCommandCenter />;

  return <DashboardDetailLegacy />;
}


