import React, { useEffect, useMemo, useState } from 'react';
import type { DashboardTemplate, TemplateRole } from '../../lib/dashboards/templates';
import { supabase } from '../../lib/supabaseClient';

type TableCol = { id?: string; key?: string; name?: string; label?: string; type?: string; currency?: string };
type TableOption = { id: string; name: string; schema_json?: TableCol[] };

type RoleMapping = { tableId: string; columnId: string };
type RoleMappings = Record<string, RoleMapping>;

type Props = {
  template: DashboardTemplate;
  tables: TableOption[];
  loadingTables: boolean;
  onBack: () => void;
  onCreate: (args: { dashboardName: string; mappings: RoleMappings }) => Promise<void>;
};

const roleTypeHint: Record<TemplateRole['kind'], string> = {
  currency: 'Money',
  number: 'Number',
  date: 'Date',
  status: 'Status',
  category: 'Category',
  text: 'Text'
};

function colLabel(c: TableCol) {
  return String(c?.label || c?.name || '');
}
function colId(c: TableCol) {
  return String(c?.id || c?.key || c?.name || '');
}
function colType(c: TableCol) {
  return String(c?.type || '').toLowerCase();
}

function isRoleCompatible(role: TemplateRole, col: TableCol) {
  const t = colType(col);
  if (role.kind === 'date') return t === 'date' || /date|created/i.test(colLabel(col));
  if (role.kind === 'currency') return t === 'money' || t === 'currency' || t === 'number' || t === 'formula';
  if (role.kind === 'number') return t === 'number' || t === 'formula' || t === 'money';
  if (role.kind === 'status') return t === 'status' || /status|state/i.test(colLabel(col));
  if (role.kind === 'category') return t === 'text' || t === 'status' || /category|type/i.test(colLabel(col));
  return true;
}

function formatCurrency(n: any, currency = 'USD') {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n) || 0); }
  catch { return `$${Number(n) || 0}`; }
}
function formatNumber(n: any) {
  try { return new Intl.NumberFormat('en-US').format(Number(n) || 0); }
  catch { return String(Number(n) || 0); }
}

function SimpleLineChart({ series, keys, colors, height = 180 }: { series: any[]; keys: string[]; colors: string[]; height?: number }) {
  const rows = Array.isArray(series) ? series : [];
  if (!rows.length || !keys.length) return null;

  const w = 1000;
  const h = height;
  const padL = 44;
  const padR = 16;
  const padT = 10;
  const padB = 26;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const xs = rows.map((r) => String(r?.t ?? ''));
  const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    for (const k of keys) {
      const v = toNum(r?.[k]);
      minY = Math.min(minY, v);
      maxY = Math.max(maxY, v);
    }
  }
  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) { minY = 0; maxY = 1; }
  if (minY === maxY) { minY -= 1; maxY += 1; }

  const xFor = (i: number) => padL + (xs.length === 1 ? innerW / 2 : (i / (xs.length - 1)) * innerW);
  const yFor = (v: number) => padT + (1 - ((v - minY) / (maxY - minY))) * innerH;

  const grid = 4;
  const gridLines = Array.from({ length: grid + 1 }).map((_, i) => {
    const y = padT + (i / grid) * innerH;
    return <line key={i} x1={padL} x2={w - padR} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
  });

  const paths = keys.map((k, idx) => {
    const pts = rows.map((r, i) => ({ x: xFor(i), y: yFor(toNum(r?.[k])) }));
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    const c = colors[idx] || '#3b82f6';
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

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="block">
      {gridLines}
      {paths}
      {xLabelEls}
    </svg>
  );
}

export default function TemplateWizard({ template, tables, loadingTables, onBack, onCreate }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [dashboardName, setDashboardName] = useState(template.name);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [mappings, setMappings] = useState<RoleMappings>({});
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewSeries, setPreviewSeries] = useState<any[]>([]);
  const [previewKpi, setPreviewKpi] = useState({ revenue: 0, cost: 0, profit: 0, margin: 0 });

  const defaultTableId = selectedTableIds?.[0] ? String(selectedTableIds[0]) : '';

  const tableById = useMemo(() => {
    const map = new Map<string, TableOption>();
    (tables || []).forEach((t) => map.set(String(t.id), t));
    return map;
  }, [tables]);

  const selectableTables = useMemo(() => {
    const ids = new Set((selectedTableIds || []).map((x) => String(x)));
    if (!ids.size) return tables || [];
    return (tables || []).filter((t) => ids.has(String(t.id)));
  }, [tables, selectedTableIds]);

  const toggleSelectedTable = (tableId: string) => {
    const tid = String(tableId || '');
    if (!tid) return;
    setSelectedTableIds((prev) => {
      const set = new Set((prev || []).map((x) => String(x)));
      if (set.has(tid)) set.delete(tid);
      else set.add(tid);
      return Array.from(set);
    });
  };

  const selectAllTables = () => setSelectedTableIds((tables || []).map((t) => String(t.id)));
  const clearAllTables = () => setSelectedTableIds([]);

  const requiredRoles = template.requirements.filter((r) => r.required);
  const missingRequired = requiredRoles.filter((r) => !mappings[r.id]?.tableId || !mappings[r.id]?.columnId);

  const nextEnabled = useMemo(() => {
    if (step === 1) return selectedTableIds.length > 0;
    if (step === 2) return missingRequired.length === 0;
    return true;
  }, [step, missingRequired.length, selectedTableIds.length]);

  const setRole = (roleId: string, patch: Partial<RoleMapping>) => {
    setMappings((m) => {
      const prev = m[roleId] || { tableId: defaultTableId || '', columnId: '' };
      const next = { ...prev, ...patch };
      // If table changes, reset column
      if (patch.tableId && patch.tableId !== prev.tableId) next.columnId = '';
      return { ...m, [roleId]: next };
    });
  };

  const resolveRole = (roleId: string): RoleMapping => {
    const v = mappings?.[roleId];
    if (v?.tableId && v?.columnId) return v;
    // If the role has a table set but no column, still return that for UI.
    if (v?.tableId) return { tableId: v.tableId, columnId: v.columnId || '' };
    return { tableId: defaultTableId || '', columnId: '' };
  };

  // Keep mappings valid if tables are deselected
  useEffect(() => {
    const allowed = new Set((selectedTableIds || []).map((x) => String(x)));
    // If none selected, leave mappings as-is; Step 1 prevents going forward anyway.
    if (!allowed.size) return;
    setMappings((m) => {
      let changed = false;
      const next: RoleMappings = { ...(m || {}) };
      for (const roleId of Object.keys(next)) {
        const cur = next[roleId];
        if (cur?.tableId && !allowed.has(String(cur.tableId))) {
          next[roleId] = { tableId: defaultTableId || '', columnId: '' };
          changed = true;
        }
      }
      return changed ? next : m;
    });
  }, [selectedTableIds, defaultTableId]);

  const filteredSchemaForRole = (role: TemplateRole, tableId: string) => {
    const t = tableById.get(String(tableId));
    const schema = Array.isArray(t?.schema_json) ? t?.schema_json : [];
    return schema.filter((c) => isRoleCompatible(role, c));
  };

  const mergeSeriesByT = (seriesList: any[][]) => {
    const out = new Map<string, any>();
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

  const queryWidget = async (payload: any) => {
    const backendBase = (import.meta as any)?.env?.VITE_BACKEND_URL || 'https://api.thehirepilot.com';
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    const resp = await fetch(`${backendBase}/api/dashboards/widgets/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error('Preview query failed');
    return resp.json();
  };

  const [costPreview, setCostPreview] = useState({ total: 0, series: [] as any[] });

  // Live preview for Executive Overview (Step 3)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (step !== 3) return;
      setPreviewError('');
      setPreviewSeries([]);
      setPreviewKpi({ revenue: 0, cost: 0, profit: 0, margin: 0 });
      setCostPreview({ total: 0, series: [] });

      setPreviewLoading(true);
      try {
        if (template.id === 'exec_overview_v1') {
          const revenue = resolveRole('revenue');
          const cost = resolveRole('cost');
          const revenueDate = resolveRole('revenue_date');
          const costDate = resolveRole('cost_date');
          // Backward-compat: if revenue_date/cost_date are unset, allow a shared 'date' mapping.
          const sharedDate = resolveRole('date');
          const revDate = revenueDate?.columnId ? revenueDate : sharedDate;
          const cstDate = costDate?.columnId ? costDate : sharedDate;

          if (!revenue?.tableId || !revenue?.columnId || !cost?.tableId || !cost?.columnId) return;
          if (!revDate?.columnId || !cstDate?.columnId) return;

          // KPI totals (all-time for preview; avoids confusing empty ranges)
          let revenueTotal = 0;
          let costTotal = 0;
          if (revenue.tableId === cost.tableId) {
            const kpiJson = await queryWidget({
              table_id: revenue.tableId,
              metrics: [
                { alias: 'Revenue', agg: 'SUM', column_id: revenue.columnId },
                { alias: 'Cost', agg: 'SUM', column_id: cost.columnId }
              ],
              time_bucket: 'none',
              range: 'all_time'
            });
            const krow = Array.isArray(kpiJson?.series) ? kpiJson.series[0] : null;
            revenueTotal = Number(krow?.Revenue) || 0;
            costTotal = Number(krow?.Cost) || 0;
          } else {
            const [revJson, costJson] = await Promise.all([
              queryWidget({
                table_id: revenue.tableId,
                metrics: [{ alias: 'Revenue', agg: 'SUM', column_id: revenue.columnId }],
                time_bucket: 'none',
                range: 'all_time'
              }),
              queryWidget({
                table_id: cost.tableId,
                metrics: [{ alias: 'Cost', agg: 'SUM', column_id: cost.columnId }],
                time_bucket: 'none',
                range: 'all_time'
              })
            ]);
            const rrow = Array.isArray(revJson?.series) ? revJson.series[0] : null;
            const crow = Array.isArray(costJson?.series) ? costJson.series[0] : null;
            revenueTotal = Number(rrow?.Revenue) || 0;
            costTotal = Number(crow?.Cost) || 0;
          }
          const profit = revenueTotal - costTotal;
          const margin = revenueTotal ? (profit / revenueTotal) * 100 : 0;
          if (!cancelled) setPreviewKpi({ revenue: revenueTotal, cost: costTotal, profit, margin });

          // Trend (90d, monthly)
          let trendSeries: any[] = [];
          if (revenue.tableId === cost.tableId && revDate.columnId === cstDate.columnId) {
            const trendJson = await queryWidget({
              table_id: revenue.tableId,
              metrics: [
                { alias: 'Revenue', agg: 'SUM', column_id: revenue.columnId },
                { alias: 'Cost', agg: 'SUM', column_id: cost.columnId }
              ],
              date_column_id: revDate.columnId,
              time_bucket: 'month',
              range: '90d'
            });
            trendSeries = Array.isArray(trendJson?.series) ? trendJson.series : [];
          } else {
            const [revTrend, costTrend] = await Promise.all([
              queryWidget({
                table_id: revenue.tableId,
                metrics: [{ alias: 'Revenue', agg: 'SUM', column_id: revenue.columnId }],
                date_column_id: revDate.columnId,
                time_bucket: 'month',
                range: '90d'
              }),
              queryWidget({
                table_id: cost.tableId,
                metrics: [{ alias: 'Cost', agg: 'SUM', column_id: cost.columnId }],
                date_column_id: cstDate.columnId,
                time_bucket: 'month',
                range: '90d'
              })
            ]);
            trendSeries = mergeSeriesByT([
              Array.isArray(revTrend?.series) ? revTrend.series : [],
              Array.isArray(costTrend?.series) ? costTrend.series : []
            ]);
          }
          if (!cancelled) setPreviewSeries(trendSeries);
        } else if (template.id === 'cost_drivers_v1') {
          const cost = resolveRole('cost');
          const date = resolveRole('date');
          if (!cost?.tableId || !cost?.columnId) return;

          const totalJson = await queryWidget({
            table_id: cost.tableId,
            metrics: [{ alias: 'Cost', agg: 'SUM', column_id: cost.columnId }],
            time_bucket: 'none',
            range: 'all_time'
          });
          const trow = Array.isArray(totalJson?.series) ? totalJson.series[0] : null;
          const total = Number(trow?.Cost) || 0;

          let series: any[] = [];
          if (date?.tableId === cost.tableId && date?.columnId) {
            const trendJson = await queryWidget({
              table_id: cost.tableId,
              metrics: [{ alias: 'Cost', agg: 'SUM', column_id: cost.columnId }],
              date_column_id: date.columnId,
              time_bucket: 'month',
              range: '90d'
            });
            series = Array.isArray(trendJson?.series) ? trendJson.series : [];
          }
          if (!cancelled) setCostPreview({ total, series });
        }
      } catch (e: any) {
        if (!cancelled) setPreviewError(e?.message || 'Preview failed');
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [step, template.id, defaultTableId, mappings]);

  const typeBadge = (t: string) => {
    const kind = t === 'money' ? 'currency' : t;
    return (
      <span className="ml-2 inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/60 border border-white/10">
        {String(kind || 'text')}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-white text-xl font-semibold">{template.name}</div>
          <div className="mt-1 text-sm text-white/50">{template.description}</div>
        </div>
        <button onClick={onBack} className="text-white/60 hover:text-white transition text-sm">
          ← Back
        </button>
      </div>

      {/* Stepper */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { n: 1, label: 'Tables' },
          { n: 2, label: 'Map Columns' },
          { n: 3, label: 'Preview' },
          { n: 4, label: 'Create' }
        ].map((s) => (
          <div
            key={s.n}
            className={`rounded-lg border px-3 py-2 text-xs ${
              step === s.n ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-white/5 text-white/60'
            }`}
          >
            <span className="font-semibold mr-2">{s.n}</span>
            {s.label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="rounded-xl border border-white/10 bg-zinc-950/60 px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/50">Dashboard name</div>
            <input
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/10"
              placeholder="Executive Overview"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-wider text-white/50">Select tables (required)</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllTables}
                  className="text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-1 text-white/80"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearAllTables}
                  className="text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-1 text-white/80"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3 max-h-48 overflow-y-auto">
              {loadingTables ? (
                <div className="text-sm text-white/50">Loading…</div>
              ) : (tables || []).length ? (
                <div className="space-y-2">
                  {(tables || []).map((t) => {
                    const checked = (selectedTableIds || []).map(String).includes(String(t.id));
                    return (
                      <label key={t.id} className="flex items-center gap-3 text-sm text-white/80 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectedTable(String(t.id))}
                          className="w-4 h-4"
                        />
                        <span className="truncate">{t.name}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-white/50">No tables available.</div>
              )}
            </div>
            <div className="mt-2 text-xs text-white/40">
              Pick the tables you want to use for this dashboard. In the next step, each field can be mapped to any selected table.
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-xl border border-white/10 bg-zinc-950/60 px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] space-y-4">
          <div className="text-sm text-white/70">
            Map template roles to your table columns. Required roles are marked.
          </div>
          <div className="space-y-3">
            {template.requirements.map((role) => {
              const current = resolveRole(role.id);
              const options = current?.tableId ? filteredSchemaForRole(role, current.tableId) : [];
              return (
                <div key={role.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-4">
                    <div className="text-white font-medium">
                      {role.label}{' '}
                      {role.required ? <span className="text-red-300 text-xs">(required)</span> : <span className="text-white/40 text-xs">(optional)</span>}
                    </div>
                    <div className="text-xs text-white/40">
                      {roleTypeHint[role.kind]}{role.description ? ` · ${role.description}` : ''}
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <select
                      value={current?.tableId || ''}
                      onChange={(e) => setRole(role.id, { tableId: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/10"
                    >
                      <option value="">{loadingTables ? 'Loading…' : 'Select table'}</option>
                      {selectableTables.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-5">
                    <select
                      value={current?.columnId || ''}
                      onChange={(e) => setRole(role.id, { columnId: e.target.value })}
                      disabled={!current?.tableId}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/10"
                    >
                      <option value="">{role.required ? 'Select a column' : 'None'}</option>
                      {options.map((c) => (
                        <option key={colId(c)} value={colId(c)}>
                          {colLabel(c)}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 text-xs text-white/35">
                      {current?.columnId
                        ? `Selected: ${options.find(o => colId(o) === current.columnId)?.label || options.find(o => colId(o) === current.columnId)?.name || 'Column'} (${roleTypeHint[role.kind]})`
                        : '—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {missingRequired.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 rounded-lg px-3 py-2 text-sm">
              Missing required mappings: {missingRequired.map((r) => r.label).join(', ')}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="rounded-xl border border-white/10 bg-zinc-950/60 px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] space-y-4">
          <div className="text-white/70 text-sm">
            Preview. We’ll query your real data here so you can confirm mappings before creating the dashboard.
          </div>
          {template.id === 'pipeline_health_v1' && (
            <div className="text-sm text-white/60">
              This template’s live preview is coming soon. You can still create the dashboard now.
            </div>
          )}
          {previewError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 rounded-lg px-3 py-2 text-sm">
              {previewError}
            </div>
          )}
          {template.id === 'exec_overview_v1' ? (
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-8 rounded-xl border border-white/10 bg-black/30 px-4 py-4">
                <div className="text-white font-semibold">Revenue vs Cost</div>
                <div className="mt-3 rounded-lg bg-white/5 border border-white/10 p-2">
                  {previewLoading ? (
                    <div className="h-40 rounded-lg bg-white/5 animate-pulse" />
                  ) : (previewSeries && previewSeries.length) ? (
                    <SimpleLineChart
                      height={180}
                      series={previewSeries}
                      keys={['Revenue', 'Cost']}
                      colors={['#3b82f6', '#10b981']}
                    />
                  ) : (
                    <div className="h-40 flex items-center justify-center text-sm text-white/40">
                      Map Revenue, Cost, and their Date columns to see a live preview.
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-12 lg:col-span-4 rounded-xl border border-white/10 bg-black/30 px-4 py-4">
                <div className="text-white font-semibold">Health</div>
                <div className="mt-3 space-y-2">
                  {['Healthy', 'At Risk', 'Not Viable'].map((x) => (
                    <div key={x} className="flex items-center justify-between text-sm text-white/70">
                      <span>{x}</span>
                      <span className="text-white/50">—</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-span-12 rounded-xl border border-white/10 bg-black/30 px-4 py-4">
                <div className="text-white font-semibold">KPI Row</div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { k: 'Total Revenue', v: previewLoading ? '—' : formatCurrency(previewKpi.revenue) },
                    { k: 'Total Cost', v: previewLoading ? '—' : formatCurrency(previewKpi.cost) },
                    { k: 'Profit', v: previewLoading ? '—' : formatCurrency(previewKpi.profit) },
                    { k: 'Margin %', v: previewLoading ? '—' : `${formatNumber(previewKpi.margin.toFixed(1))}%` }
                  ].map(({ k, v }) => (
                    <div key={k} className="rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                      <div className="text-xs uppercase tracking-wider text-white/50">{k}</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{v}</div>
                      <div className="mt-1 text-xs text-white/40">preview</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : template.id === 'cost_drivers_v1' ? (
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-4 rounded-xl border border-white/10 bg-black/30 px-4 py-4">
                <div className="text-white font-semibold">Total Cost</div>
                <div className="mt-3 text-3xl font-semibold text-white">
                  {previewLoading ? '—' : formatCurrency(costPreview.total)}
                </div>
                <div className="mt-1 text-xs text-white/40">preview</div>
              </div>
              <div className="col-span-12 lg:col-span-8 rounded-xl border border-white/10 bg-black/30 px-4 py-4">
                <div className="text-white font-semibold">Cost Trend (90d)</div>
                <div className="mt-3 rounded-lg bg-white/5 border border-white/10 p-2">
                  {previewLoading ? (
                    <div className="h-40 rounded-lg bg-white/5 animate-pulse" />
                  ) : (costPreview.series || []).length ? (
                    <SimpleLineChart
                      height={180}
                      series={costPreview.series}
                      keys={['Cost']}
                      colors={['#f97316']}
                    />
                  ) : (
                    <div className="h-40 flex items-center justify-center text-sm text-white/40">
                      Map <span className="text-white">Cost</span> to see totals. Map an optional <span className="text-white">Date</span> column for a trend.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-white/60">
              Preview isn’t available for this template yet. You can still create the dashboard.
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="rounded-xl border border-white/10 bg-zinc-950/60 px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] space-y-3">
          <div className="text-white font-semibold">Ready to create</div>
          <div className="text-sm text-white/60">
            We’ll generate a dashboard using <span className="text-white">{template.name}</span> with your selected table mappings.
          </div>
        </div>
      )}

      {/* Footer buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as any) : s))}
          disabled={step === 1}
          className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm text-white/80 disabled:opacity-40"
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          {step < 4 ? (
            <button
              onClick={() => setStep((s) => ((s + 1) as any))}
              disabled={!nextEnabled}
              className="px-5 py-2 rounded-xl bg-white text-zinc-900 hover:opacity-90 transition text-sm font-semibold disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              onClick={async () => {
                try {
                  setSaving(true);
                  await onCreate({ dashboardName, mappings });
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 transition text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Dashboard'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


