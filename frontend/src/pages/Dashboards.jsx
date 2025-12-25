import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import TemplateGallery from '../components/dashboards/TemplateGallery';
import TemplateWizard from '../components/dashboards/TemplateWizard';
import { DASHBOARD_TEMPLATES } from '../lib/dashboards/templates';
import PlotlyImport from 'plotly.js-dist-min';

const Plotly = PlotlyImport?.default || PlotlyImport;

export default function Dashboards() {
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewSeries, setPreviewSeries] = useState([]);
  const isSafeIdentifier = (s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(s || ''));
  const aggRef = (alias, columnId) => {
    const a = String(alias || '').trim();
    const c = String(columnId || '');
    // Use bracket JSON-string form when the column name is not a safe identifier (spaces, punctuation, etc).
    // Backend formula engine supports both: A.col and A["Column Name"].
    return isSafeIdentifier(c) ? `${a}.${c}` : `${a}[${JSON.stringify(c)}]`;
  };
  const createMetricBlock = () => ({
    id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `metric-${Date.now()}-${Math.random()}`),
    alias: '',
    tableId: '',
    columnId: '',
    agg: 'SUM',
    dateColumn: ''
  });
  const [metricBlocks, setMetricBlocks] = useState([createMetricBlock()]);
  const [timeRange, setTimeRange] = useState('last_90_days');
  const [includeLeads, setIncludeLeads] = useState(false);
  const [includeCampaigns, setIncludeCampaigns] = useState(false);
  const [includeJobs, setIncludeJobs] = useState(false);
  const [includeDeals, setIncludeDeals] = useState(false);
  const [includeCandidates, setIncludeCandidates] = useState(false);
  const [addFormulaSeries, setAddFormulaSeries] = useState(true);
  const [formulaExpr, setFormulaExpr] = useState('');
  const [formulaLabel, setFormulaLabel] = useState('Formula');
  const [tablesError, setTablesError] = useState(null);
  const [dashboards, setDashboards] = useState([]);
  const [dashboardName, setDashboardName] = useState('Custom Dashboard');
  const [dashboardsLoading, setDashboardsLoading] = useState(false);
  const [selectedDashIds, setSelectedDashIds] = useState([]);
  const [editingDashboardId, setEditingDashboardId] = useState(null);
  const [builderError, setBuilderError] = useState('');
  const [createMode, setCreateMode] = useState('gallery'); // gallery | wizard | custom
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateMappings, setTemplateMappings] = useState({});
  const [templateTableId, setTemplateTableId] = useState('');

  const backendBase = (import.meta?.env && import.meta.env.VITE_BACKEND_URL) || 'https://api.thehirepilot.com';
  const mapRangeToWidgetRange = (range, rangeStartDate) => {
    if (range === 'last_7_days') return { range: '7d' };
    if (range === 'last_30_days') return { range: '30d' };
    if (range === 'last_90_days') return { range: '90d' };
    if (range === 'ytd') return { range: 'ytd' };
    if (range === 'all_time') return { range: 'all_time' };
    if (range === 'last_180_days' && rangeStartDate) {
      return { range: 'custom', range_start: rangeStartDate.toISOString(), range_end: new Date().toISOString() };
    }
    return { range: '90d' };
  };

  const genId = () => {
    try { return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `col_${Date.now()}_${Math.random().toString(16).slice(2)}`; } catch { return `col_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
  };
  const toKey = (label) => {
    const base = String(label || '').trim().toLowerCase()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return base || 'col';
  };
  const colLabel = (c) => String(c?.label || c?.name || '');
  const ensureUniqueKey = (schemaIn, desired, colIdToSkip) => {
    const taken = new Set((schemaIn || []).map(c => String(c?.key || '').toLowerCase()).filter(Boolean));
    if (colIdToSkip) {
      const current = (schemaIn || []).find(c => String(c?.id || '') === String(colIdToSkip));
      if (current?.key) taken.delete(String(current.key).toLowerCase());
    }
    if (!taken.has(String(desired).toLowerCase())) return desired;
    let i = 2;
    while (taken.has(`${desired}_${i}`.toLowerCase())) i += 1;
    return `${desired}_${i}`;
  };
  const normalizeSchema = (schemaIn) => {
    const raw = Array.isArray(schemaIn) ? schemaIn : [];
    const firstPass = raw.map((c) => {
      const label = colLabel(c) || 'Column';
      const id = c?.id ? String(c.id) : genId();
      const keyBase = c?.key ? String(c.key) : toKey(label);
      const key = ensureUniqueKey(raw, keyBase, id);
      return { ...c, id, key, label, name: label };
    });
    const fixed = [];
    for (const c of firstPass) {
      const key = ensureUniqueKey(fixed, String(c.key), String(c.id));
      fixed.push({ ...c, key });
    }
    return fixed;
  };

  const migrateDashboardLayoutToStableIds = async (dashboard) => {
    const layout = dashboard?.layout || {};
    const sources = Array.isArray(layout.sources) ? layout.sources : [];
    const metrics = Array.isArray(layout.metrics) ? layout.metrics : [];
    if (!sources.length || !metrics.length) return { changed: false, layout };
    const hasLegacy = metrics.some(m => m && (m.columnId || m.dateColumn) && !(m.column_id || m.date_column_id));
    if (!hasLegacy) return { changed: false, layout };
    // Fetch schemas for referenced tables
    const tableIds = Array.from(new Set(sources.map(s => s.tableId).filter(Boolean)));
    const schemasByTable = {};
    for (const tid of tableIds) {
      try {
        const { data } = await supabase.from('custom_tables').select('schema_json').eq('id', tid).maybeSingle();
        const schemaRaw = Array.isArray(data?.schema_json) ? data.schema_json : [];
        const normalized = normalizeSchema(schemaRaw);
        schemasByTable[tid] = normalized;
        // Persist schema normalization (ids/keys) without touching rows.
        if (JSON.stringify(schemaRaw) !== JSON.stringify(normalized)) {
          await supabase.from('custom_tables').update({ schema_json: normalized, updated_at: new Date().toISOString() }).eq('id', tid);
        }
      } catch {}
    }
    const resolveColId = (tableId, q) => {
      const sch = schemasByTable[tableId] || [];
      const s = String(q || '').trim();
      if (!s) return '';
      const found = sch.find(c => String(c?.id||'')===s || String(c?.key||'')===s || String(c?.label||c?.name||'')===s || String(c?.name||'')===s);
      return found ? String(found.id || found.key || found.name) : '';
    };
    const nextMetrics = metrics.map((m) => {
      const tableId = sources.find(s => s.alias === m.alias)?.tableId || sources[0]?.tableId;
      const colLegacy = m.columnId || '';
      const dateLegacy = m.dateColumn || '';
      const colId = m.column_id || resolveColId(tableId, colLegacy);
      const dateId = m.date_column_id || (dateLegacy ? resolveColId(tableId, dateLegacy) : undefined);
      return { ...m, column_id: colId, date_column_id: dateId, columnId: undefined, dateColumn: undefined };
    });
    const nextLayout = { ...layout, metrics: nextMetrics };
    return { changed: true, layout: nextLayout };
  };
  const announceOverlayToggle = useCallback((label, enabled) => {
    if (enabled) toast.success(`${label} enabled`);
    else toast(`${label} hidden`);
  }, []);

  const resetBuilderState = useCallback(() => {
    setMetricBlocks([createMetricBlock()]);
    setTimeRange('last_90_days');
    setIncludeLeads(false);
    setIncludeCampaigns(false);
    setIncludeJobs(false);
    setIncludeDeals(false);
    setIncludeCandidates(false);
    setAddFormulaSeries(true);
    setFormulaExpr('');
    setFormulaLabel('Formula');
    setBuilderError('');
    setDashboardName('Custom Dashboard');
    setCreateMode('gallery');
    setSelectedTemplateId('');
    setTemplateMappings({});
    setTemplateTableId('');
  }, []);

  const hydrateBuilderFromLayout = useCallback((layout = {}) => {
    resetBuilderState();
    if (Array.isArray(layout.metrics) && layout.metrics.length) {
      const derivedBlocks = layout.metrics.map((m, idx) => {
        const sourceTableId = layout.sources?.find((s) => s.alias === m.alias)?.tableId || '';
        return {
          id: `metric-${idx}-${Date.now()}`,
          alias: m.alias || `Metric ${idx + 1}`,
          tableId: sourceTableId,
          // Support both legacy layouts (columnId/dateColumn) and new layouts (column_id/date_column_id)
          columnId: m.column_id || m.columnId || '',
          agg: m.agg || 'SUM',
          dateColumn: m.date_column_id || m.dateColumn || ''
        };
      });
      setMetricBlocks(derivedBlocks);
    } else {
      setMetricBlocks([createMetricBlock()]);
    }
    if (layout.formula) {
      setAddFormulaSeries(true);
      setFormulaExpr(layout.formula);
    } else {
      setAddFormulaSeries(false);
      setFormulaExpr('');
    }
    if (layout.formulaLabel) {
      setFormulaLabel(layout.formulaLabel);
    } else {
      setFormulaLabel(layout.formula ? 'Formula' : '');
    }
    if (layout.range) setTimeRange(layout.range);
    setIncludeDeals(Boolean(layout.includeDeals));
    setIncludeLeads(Boolean(layout.includeLeads));
    setIncludeCandidates(Boolean(layout.includeCandidates));
    setIncludeJobs(Boolean(layout.includeJobs));
    setIncludeCampaigns(Boolean(layout.includeCampaigns));
    setDashboardName(layout.name || 'Custom Dashboard');
  }, [resetBuilderState]);

  const updateMetricBlock = useCallback((id, patch) => {
    setMetricBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  }, []);

  const removeMetricBlock = useCallback((id) => {
    setMetricBlocks((prev) => (prev.length === 1 ? prev : prev.filter((block) => block.id !== id)));
  }, []);

  const addMetricBlock = useCallback(() => {
    setMetricBlocks((prev) => [...prev, createMetricBlock()]);
  }, []);

  const ensureSession = async () => {
    const { data } = await supabase.auth.getSession();
    if (data?.session) return data.session;
    return new Promise((resolve) => {
      const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
        if (session) {
          try { sub.subscription?.unsubscribe(); } catch {}
          resolve(session);
        }
      });
    });
  };

  // -------------------- Live preview (custom builder) --------------------
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setPreviewError('');
        const valid = metricBlocks.map((b) => ({ ...b, alias: (b.alias || '').trim() })).filter((b) => b.alias && b.tableId && b.columnId);
        if (!valid.length) {
          setPreviewSeries([]);
          setPreviewLoading(false);
          return;
        }

        const tableId = valid[0].tableId;
        const multiTable = valid.some((b) => b.tableId !== tableId);
        if (multiTable) {
          setPreviewSeries([]);
          setPreviewError('Live preview currently supports a single table. Use the template wizard for multi-table patterns.');
          setPreviewLoading(false);
          return;
        }

        const dateBlock = valid.find((b) => b.dateColumn);
        if (!dateBlock) {
          setPreviewSeries([]);
          setPreviewError('Select a Date column on at least one series to preview a trend.');
          setPreviewLoading(false);
          return;
        }

        setPreviewLoading(true);
        await ensureSession().catch(() => {});
        const { data: { session } } = await supabase.auth.getSession();
        const authHeader = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
        const rangeStart = (() => {
          if (timeRange === 'last_180_days') {
            const d = new Date();
            d.setDate(d.getDate() - 180);
            return d;
          }
          return null;
        })();
        const rangeCfg = mapRangeToWidgetRange(timeRange, rangeStart);

        const resp = await fetch(`${backendBase}/api/dashboards/widgets/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            table_id: tableId,
            metrics: valid.slice(0, 3).map((b) => ({ alias: b.alias, agg: (b.agg || 'SUM').toUpperCase(), column_id: b.columnId })),
            date_column_id: dateBlock.dateColumn,
            time_bucket: 'month',
            ...rangeCfg
          })
        });
        if (!resp.ok) throw new Error('Preview query failed');
        const json = await resp.json();
        if (cancelled) return;
        setPreviewSeries(Array.isArray(json?.series) ? json.series : []);
      } catch (e) {
        if (cancelled) return;
        setPreviewSeries([]);
        setPreviewError(e?.message || 'Failed to load preview');
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [metricBlocks, timeRange]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const el = document.getElementById('builder-preview-chart');
        if (!el) return;
        if (!previewSeries || previewSeries.length === 0) return;
        if (cancelled) return;

        const xs = previewSeries.map((r) => r.t);
        const keys = previewSeries?.[0] ? Object.keys(previewSeries[0]).filter((k) => k !== 't') : [];
        const isDark = document?.documentElement?.classList?.contains?.('dark');
        const axisColor = isDark ? '#e5e7eb' : '#0f172a';
        const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.10)';

        const traces = keys.slice(0, 3).map((k, idx) => ({
          type: 'scatter',
          mode: xs.length <= 1 ? 'lines+markers' : 'lines',
          name: k,
          x: xs,
          y: previewSeries.map((r) => Number(r?.[k]) || 0),
          line: { width: 3 },
          marker: { size: xs.length <= 1 ? 10 : 6 }
        }));

        await Plotly.newPlot('builder-preview-chart', traces, {
          margin: { t: 10, r: 10, b: 40, l: 55 },
          plot_bgcolor: 'rgba(0,0,0,0)',
          paper_bgcolor: 'rgba(0,0,0,0)',
          xaxis: { title: '', showgrid: false, color: axisColor, type: 'category' },
          yaxis: { title: '', gridcolor: gridColor, color: axisColor },
          showlegend: true,
          legend: { orientation: 'h', y: -0.25 }
        }, { responsive: true, displayModeBar: false, displaylogo: false });
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [previewSeries]);

  const loadTables = async () => {
    try {
      setLoadingTables(true);
      setTablesError(null);
      await ensureSession().catch(() => {});
      const { data, error } = await supabase
        .from('custom_tables')
        .select('id,name,schema_json')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      const list = Array.isArray(data) ? data : [];
      // Ensure schema_json columns have stable {id,key,label}. This enables reliable dashboards without requiring user to open the table editor.
      const normalizedList = await Promise.all(list.map(async (t) => {
        const schemaRaw = Array.isArray(t?.schema_json) ? t.schema_json : [];
        const normalized = normalizeSchema(schemaRaw);
        try {
          if (JSON.stringify(schemaRaw) !== JSON.stringify(normalized)) {
            await supabase.from('custom_tables').update({ schema_json: normalized, updated_at: new Date().toISOString() }).eq('id', t.id);
          }
        } catch {}
        return { ...t, schema_json: normalized };
      }));
      setTables(normalizedList);
    } catch (e) {
      setTables([]);
      setTablesError(e?.message || 'Failed to load tables');
    } finally {
      setLoadingTables(false);
    }
  };

  const loadDashboards = useCallback(async () => {
    try {
      setDashboardsLoading(true);
      const { data } = await supabase
        .from('user_dashboards')
        .select('id, layout, updated_at')
        .order('updated_at', { ascending: false });
      setDashboards(Array.isArray(data) ? data : []);
    } catch {
      setDashboards([]);
    } finally {
      setDashboardsLoading(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    setIsCreateOpen(false);
    setEditingDashboardId(null);
  }, []);

  const buildParamsFromLayout = useCallback((layout = {}) => {
    const params = new URLSearchParams();
    if (Array.isArray(layout.sources) && layout.sources.length) params.set('sources', encodeURIComponent(JSON.stringify(layout.sources)));
    if (Array.isArray(layout.metrics) && layout.metrics.length) params.set('metrics', encodeURIComponent(JSON.stringify(layout.metrics)));
    if (layout.formula) params.set('formula', layout.formula);
    if (layout.formulaLabel) params.set('formulaLabel', layout.formulaLabel);
    if (layout.template_id) params.set('tpl', String(layout.template_id));
    if (layout.template_table_id) params.set('tpl_table', String(layout.template_table_id));
    if (layout.template_mappings) params.set('tpl_map', encodeURIComponent(JSON.stringify(layout.template_mappings)));
    if (layout.tb) params.set('tb', layout.tb);
    if (layout.groupAlias) params.set('groupAlias', layout.groupAlias);
    if (layout.groupCol) params.set('groupCol', layout.groupCol);
    if (layout.groupMode) params.set('groupMode', layout.groupMode);
    if (layout.range) params.set('range', layout.range);
    if (layout.includeDeals) params.set('includeDeals', String(layout.includeDeals));
    if (layout.includeLeads) params.set('includeLeads', String(layout.includeLeads));
    if (layout.includeCandidates) params.set('includeCandidates', String(layout.includeCandidates));
    if (layout.includeJobs) params.set('includeJobs', String(layout.includeJobs));
    if (layout.includeCampaigns) params.set('includeCampaigns', String(layout.includeCampaigns));
    return params.toString();
  }, []);

  const toggleSelectDashboard = useCallback((id) => {
    setSelectedDashIds((prev) => (
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    ));
  }, []);

  const selectAllDashboards = useCallback((checked) => {
    if (checked) {
      setSelectedDashIds(dashboards.map((d) => d.id));
    } else {
      setSelectedDashIds([]);
    }
  }, [dashboards]);

  const deleteDashboardsByIds = useCallback(async (ids) => {
    if (!ids.length) return;
    try {
      await supabase.from('user_dashboards').delete().in('id', ids);
      setSelectedDashIds([]);
      await loadDashboards();
      toast.success(ids.length > 1 ? 'Dashboards deleted' : 'Dashboard deleted');
    } catch {
      toast.error('Failed to delete dashboard');
    }
  }, [loadDashboards]);

  const deleteSelectedDashboards = useCallback(async () => {
    await deleteDashboardsByIds(selectedDashIds);
  }, [deleteDashboardsByIds, selectedDashIds]);

  const viewDashboard = useCallback(async (dashboard) => {
    try {
      const { changed, layout } = await migrateDashboardLayoutToStableIds(dashboard);
      if (changed) {
        await supabase.from('user_dashboards').update({ layout }).eq('id', dashboard.id);
        toast('Migrated dashboard to stable column IDs.');
      }
      const qs = buildParamsFromLayout(layout || dashboard.layout || {});
      navigate(`/dashboards/${dashboard.id}?${qs}`);
    } catch {
      const qs = buildParamsFromLayout(dashboard.layout || {});
      navigate(`/dashboards/${dashboard.id}?${qs}`);
    }
  }, [buildParamsFromLayout, navigate]);

  const startEditDashboard = useCallback(async (dashboard) => {
    hydrateBuilderFromLayout(dashboard.layout || {});
    setEditingDashboardId(dashboard.id);
    setIsCreateOpen(true);
    setCreateMode((dashboard.layout || {})?.template_id ? 'wizard' : 'custom');
    setSelectedTemplateId((dashboard.layout || {})?.template_id || '');
    setTemplateTableId((dashboard.layout || {})?.template_table_id || '');
    setTemplateMappings((dashboard.layout || {})?.template_mappings || {});
    await loadTables();
  }, [hydrateBuilderFromLayout, loadTables]);

  const handleDeleteDashboard = useCallback(async (dashboardId) => {
    await deleteDashboardsByIds([dashboardId]);
  }, [deleteDashboardsByIds]);

  const openCreate = async () => {
    setEditingDashboardId(null);
    resetBuilderState();
    setIsCreateOpen(true);
    await loadTables();
  };
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (!isMounted) return;
        const sparklineConfigs = [
          { id: 'sparkline-1', data: [12.3, 14.1, 13.8, 15.2, 14.9, 16.1, 15.7, 17.2, 16.8, 18.3, 17.9, 19.1], color: '#10b981' },
          { id: 'sparkline-2', data: [4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 6, 6], color: '#8b5cf6' },
          { id: 'sparkline-3', data: [2.1, 2.3, 2.8, 3.1, 2.9, 3.2, 3.4, 3.6, 3.2, 3.8, 3.5, 3.4], color: '#6366f1' },
          { id: 'sparkline-4', data: [128, 124, 130, 126, 132, 129, 127, 125, 123, 126, 124, 124], color: '#ef4444' },
          { id: 'sparkline-5', data: [98, 105, 112, 118, 125, 132, 128, 135, 142, 139, 145, 142], color: '#ec4899' },
          { id: 'sparkline-6', data: [22.1, 23.4, 24.8, 26.2, 25.9, 27.1, 26.8, 28.2, 27.9, 28.8, 28.1, 28.4], color: '#059669' },
        ];
        const layout = {
          margin: { t: 0, r: 0, b: 0, l: 0 },
          showlegend: false,
          xaxis: { visible: false, fixedrange: true },
          yaxis: { visible: false, fixedrange: true },
          plot_bgcolor: 'rgba(0,0,0,0)',
          paper_bgcolor: 'rgba(0,0,0,0)'
        };
        const plotConfig = { responsive: true, displayModeBar: false, displaylogo: false, staticPlot: true };
        sparklineConfigs.forEach(cfg => {
          const el = document.getElementById(cfg.id);
          if (!el) return;
          const trace = {
            type: 'scatter',
            mode: 'lines',
            x: Array.from({ length: cfg.data.length }, (_, i) => i),
            y: cfg.data,
            line: { color: cfg.color, width: 2, shape: 'spline' },
            fill: 'tozeroy',
            fillcolor: `${cfg.color}20`,
            hoverinfo: 'none'
          };
          Plotly.newPlot(cfg.id, [trace], layout, plotConfig);
        });
      } catch (e) {
        const ids = ['sparkline-1','sparkline-2','sparkline-3','sparkline-4','sparkline-5','sparkline-6'];
        ids.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.innerHTML = '<div class=\"flex items-center justify-center h-full text-gray-400 text-xs\">Chart unavailable</div>';
        });
      }
    })();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    loadDashboards();
  }, [loadDashboards]);

  useEffect(() => {
    setSelectedDashIds((prev) => prev.filter((id) => dashboards.some((d) => d.id === id)));
  }, [dashboards]);

  return (
    <div className="bg-gray-50 dark:bg-slate-900 font-sans min-h-screen">
      <style>{'::-webkit-scrollbar { display: none; }'}</style>
      {/* Header */}
      <header id="header" className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-chart-line text-white text-sm"></i>
              </div>
              <span className="text-xl font-semibold text-gray-900 dark:text-slate-100">Analytics</span>
            </div>
            <nav className="hidden md:flex space-x-6">
              <a href="#" className="text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 px-3 py-2 text-sm font-medium">Tables</a>
              <a href="#" className="text-blue-600 bg-blue-50 dark:text-indigo-300 dark:bg-slate-800/50 px-3 py-2 rounded-lg text-sm font-medium">Dashboards</a>
              <a href="#" className="text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 px-3 py-2 text-sm font-medium">Reports</a>
              <a href="#" className="text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 px-3 py-2 text-sm font-medium">Settings</a>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <i className="fa-solid fa-bell text-lg"></i>
            </button>
            <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg" alt="Profile" className="w-8 h-8 rounded-full" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="p-6">
        {/* Top Action Bar */}
        <div id="top-action-bar" className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Dashboards</h1>
            <p className="text-gray-600 dark:text-slate-300 mt-1">Create and manage your analytics dashboards</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <select className="px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option>All Owners</option>
                <option>Created by me</option>
                <option>Shared with me</option>
              </select>
              <select className="px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option>All Teams</option>
                <option>Sales Team</option>
                <option>Marketing Team</option>
                <option>Finance Team</option>
              </select>
              <select className="px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option>All Data Sources</option>
                <option>Revenue Table</option>
                <option>Expenses Table</option>
                <option>Campaigns Table</option>
              </select>
            </div>
            <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2">
              <i className="fa-solid fa-plus"></i>
              <span>Create Dashboard</span>
            </button>
          </div>
        </div>

        {/* Ghost CTA (no dashboards) */}
        <div onClick={openCreate} className="mb-6 border-2 border-dashed border-indigo-300 dark:border-indigo-700/60 bg-gradient-to-br from-indigo-50 to-fuchsia-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-8 cursor-pointer hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">Create your first dashboard</h3>
              <p className="text-indigo-900/70 dark:text-slate-300 mt-2">Blend data from Tables, Leads, Campaigns, Jobs, Deals, Revenue, and Candidates.</p>
            </div>
            <button className="px-5 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow">
              <i className="fa-solid fa-magic-wand-sparkles mr-2"></i>Create Custom
            </button>
          </div>
        </div>
        {/* Dashboard Grid (hidden until real saved dashboards) */}
        {false && (
        <div id="dashboard-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Dashboard Card 1 */}
          <div id="dashboard-card-1" className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Revenue Analytics</h3>
                <p className="text-gray-600 dark:text-slate-300 text-sm mt-1">Monthly revenue tracking and forecasting</p>
              </div>
              <div className="flex items-center space-x-1">
                <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <i className="fa-solid fa-ellipsis-vertical"></i>
                </button>
              </div>
            </div>
            {/* Key Stats Preview */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-green-600 text-xs font-medium uppercase tracking-wide">Net Profit</div>
                <div className="text-green-900 text-xl font-bold mt-1">$12,340</div>
                <div className="text-green-600 text-xs mt-1 flex items-center">
                  <i className="fa-solid fa-arrow-up mr-1"></i>
                  +12.5%
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-blue-600 text-xs font-medium uppercase tracking-wide">Total Revenue</div>
                <div className="text-blue-900 text-xl font-bold mt-1">$45,230</div>
                <div className="text-blue-600 text-xs mt-1 flex items-center">
                  <i className="fa-solid fa-arrow-up mr-1"></i>
                  +8.2%
                </div>
              </div>
            </div>
            {/* Mini Sparkline */}
            <div className="h-12 bg-gray-50 dark:bg-slate-700 rounded-lg" id="sparkline-1"></div>
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-slate-400">
              <span>Updated 2 hours ago</span>
              <span className="flex items-center">
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" alt="Creator" className="w-5 h-5 rounded-full mr-2" />
                John Smith
              </span>
            </div>
          </div>

          {/* Dashboard Card 2 */}
          <div id="dashboard-card-2" className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">HR Metrics</h3>
                <p className="text-gray-600 dark:text-slate-300 text-sm mt-1">Employee hiring and retention analytics</p>
              </div>
              <div className="flex items-center space-x-1">
                <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <i className="fa-solid fa-ellipsis-vertical"></i>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="text-purple-600 text-xs font-medium uppercase tracking-wide">New Hires</div>
                <div className="text-purple-900 text-xl font-bold mt-1">6</div>
                <div className="text-purple-600 text-xs mt-1">This month</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <div className="text-orange-600 text-xs font-medium uppercase tracking-wide">Retention Rate</div>
                <div className="text-orange-900 text-xl font-bold mt-1">94.2%</div>
                <div className="text-orange-600 text-xs mt-1 flex items-center">
                  <i className="fa-solid fa-arrow-up mr-1"></i>
                  +2.1%
                </div>
              </div>
            </div>
            <div className="h-12 bg-gray-50 dark:bg-slate-700 rounded-lg" id="sparkline-2"></div>
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-slate-400">
              <span>Updated 5 hours ago</span>
              <span className="flex items-center">
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg" alt="Creator" className="w-5 h-5 rounded-full mr-2" />
                Sarah Wilson
              </span>
            </div>
          </div>

          {/* Dashboard Card 3 */}
          <div id="dashboard-card-3" className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Campaign Performance</h3>
                <p className="text-gray-600 dark:text-slate-300 text-sm mt-1">Marketing campaign tracking and ROI</p>
              </div>
              <div className="flex items-center space-x-1">
                <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <i className="fa-solid fa-ellipsis-vertical"></i>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-indigo-50 rounded-lg p-3">
                <div className="text-indigo-600 text-xs font-medium uppercase tracking-wide">Conversion Rate</div>
                <div className="text-indigo-900 text-xl font-bold mt-1">3.4%</div>
                <div className="text-indigo-600 text-xs mt-1 flex items-center">
                  <i className="fa-solid fa-arrow-up mr-1"></i>
                  +0.8%
                </div>
              </div>
              <div className="bg-teal-50 rounded-lg p-3">
                <div className="text-teal-600 text-xs font-medium uppercase tracking-wide">Ad Spend</div>
                <div className="text-teal-900 text-xl font-bold mt-1">$8,420</div>
                <div className="text-teal-600 text-xs mt-1">This week</div>
              </div>
            </div>
            <div className="h-12 bg-gray-50 dark:bg-slate-700 rounded-lg" id="sparkline-3"></div>
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-slate-400">
              <span>Updated 1 hour ago</span>
              <span className="flex items-center">
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg" alt="Creator" className="w-5 h-5 rounded-full mr-2" />
                Mike Johnson
              </span>
            </div>
          </div>

          {/* Dashboard Card 4 */}
          <div id="dashboard-card-4" className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Sales Pipeline</h3>
                <p className="text-gray-600 dark:text-slate-300 text-sm mt-1">Lead tracking and sales forecasting</p>
              </div>
              <div className="flex items-center space-x-1">
                <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <i className="fa-solid fa-ellipsis-vertical"></i>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-red-600 text-xs font-medium uppercase tracking-wide">Pipeline Value</div>
                <div className="text-red-900 text-xl font-bold mt-1">$124K</div>
                <div className="text-red-600 text-xs mt-1 flex items-center">
                  <i className="fa-solid fa-arrow-down mr-1"></i>
                  -3.2%
                </div>
              </div>
              <div className="bg-cyan-50 rounded-lg p-3">
                <div className="text-cyan-600 text-xs font-medium uppercase tracking-wide">Close Rate</div>
                <div className="text-cyan-900 text-xl font-bold mt-1">24.8%</div>
                <div className="text-cyan-600 text-xs mt-1 flex items-center">
                  <i className="fa-solid fa-arrow-up mr-1"></i>
                  +1.4%
                </div>
              </div>
            </div>
            <div className="h-12 bg-gray-50 dark:bg-slate-700 rounded-lg" id="sparkline-4"></div>
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-slate-400">
              <span>Updated 3 hours ago</span>
              <span className="flex items-center">
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-7.jpg" alt="Creator" className="w-5 h-5 rounded-full mr-2" />
                Emily Davis
              </span>
            </div>
          </div>

          {/* Dashboard Card 5 */}
          <div id="dashboard-card-5" className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Customer Analytics</h3>
                <p className="text-gray-600 dark:text-slate-300 text-sm mt-1">Customer acquisition and retention metrics</p>
              </div>
              <div className="flex items-center space-x-1">
                <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <i className="fa-solid fa-ellipsis-vertical"></i>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-pink-50 rounded-lg p-3">
                <div className="text-pink-600 text-xs font-medium uppercase tracking-wide">New Customers</div>
                <div className="text-pink-900 text-xl font-bold mt-1">142</div>
                <div className="text-pink-600 text-xs mt-1 flex items-center">
                  <i className="fa-solid fa-arrow-up mr-1"></i>
                  +18.2%
                </div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <div className="text-amber-600 text-xs font-medium uppercase tracking-wide">LTV</div>
                <div className="text-amber-900 text-xl font-bold mt-1">$1,240</div>
                <div className="text-amber-600 text-xs mt-1 flex items-center">
                  <i className="fa-solid fa-arrow-up mr-1"></i>
                  +5.7%
                </div>
              </div>
            </div>
            <div className="h-12 bg-gray-50 dark:bg-slate-700 rounded-lg" id="sparkline-5"></div>
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-slate-400">
              <span>Updated 4 hours ago</span>
              <span className="flex items-center">
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-8.jpg" alt="Creator" className="w-5 h-5 rounded-full mr-2" />
                Alex Chen
              </span>
            </div>
          </div>

          {/* Dashboard Card 6 */}
          <div id="dashboard-card-6" className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Financial Overview</h3>
                <p className="text-gray-600 dark:text-slate-300 text-sm mt-1">Comprehensive financial performance tracking</p>
              </div>
              <div className="flex items-center space-x-1">
                <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <i className="fa-solid fa-ellipsis-vertical"></i>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-emerald-50 rounded-lg p-3">
                <div className="text-emerald-600 text-xs font-medium uppercase tracking-wide">Cash Flow</div>
                <div className="text-emerald-900 text-xl font-bold mt-1">$28,450</div>
                <div className="text-emerald-600 text-xs mt-1 flex items-center">
                  <i className="fa-solid fa-arrow-up mr-1"></i>
                  +15.3%
                </div>
              </div>
              <div className="bg-violet-50 rounded-lg p-3">
                <div className="text-violet-600 text-xs font-medium uppercase tracking-wide">Expenses</div>
                <div className="text-violet-900 text-xl font-bold mt-1">$16,890</div>
                <div className="text-violet-600 text-xs mt-1 flex items-center">
                  <i className="fa-solid fa-arrow-down mr-1"></i>
                  -4.1%
                </div>
              </div>
            </div>
            <div className="h-12 bg-gray-50 dark:bg-slate-700 rounded-lg" id="sparkline-6"></div>
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-slate-400">
              <span>Updated 6 hours ago</span>
              <span className="flex items-center">
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-9.jpg" alt="Creator" className="w-5 h-5 rounded-full mr-2" />
                David Lee
              </span>
            </div>
          </div>
        </div>
        )}
      </main>
      {/* Create Dashboard Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={(e)=>{ if (e.target===e.currentTarget) closeModal(); }}>
            <motion.div initial={{ scale: 0.97, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.98, y: 6, opacity: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 22 }} className="w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-950/80 backdrop-blur">
              <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-white text-2xl font-semibold">{editingDashboardId ? 'Edit Dashboard' : 'New Dashboard'}</div>
                  <div className="text-white/50 text-sm mt-1">Template-first. Map once. Get an executive dashboard instantly.</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center rounded-xl border border-white/10 bg-white/5 p-1">
                    <button
                      onClick={() => setCreateMode('gallery')}
                      className={`px-3 py-1.5 rounded-lg text-sm transition ${
                        createMode === 'gallery'
                          ? 'bg-white/15 text-white border border-white/15 shadow-sm'
                          : 'text-white/70 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      Templates
                    </button>
                    <button
                      onClick={() => setCreateMode('custom')}
                      className={`px-3 py-1.5 rounded-lg text-sm transition ${
                        createMode === 'custom'
                          ? 'bg-white/15 text-white border border-white/15 shadow-sm'
                          : 'text-white/70 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                  <button className="text-white/60 hover:text-white" onClick={closeModal} aria-label="Close">
                    <i className="fa-solid fa-xmark text-xl"></i>
                  </button>
                </div>
              </div>

              {/* Template Gallery / Wizard */}
              {(createMode === 'gallery' || createMode === 'wizard') && (
                <div className="p-6">
                  {createMode === 'gallery' && (
                    <TemplateGallery
                      templates={DASHBOARD_TEMPLATES}
                      onSelect={(tplId) => { setSelectedTemplateId(tplId); setCreateMode('wizard'); }}
                      onSelectCustom={() => setCreateMode('custom')}
                    />
                  )}
                  {createMode === 'wizard' && (
                    <TemplateWizard
                      template={DASHBOARD_TEMPLATES.find(t => t.id === selectedTemplateId) || DASHBOARD_TEMPLATES[0]}
                      tables={tables}
                      loadingTables={loadingTables}
                      onBack={() => setCreateMode('gallery')}
                      onCreate={async ({ dashboardName: name, mappings }) => {
                        try {
                          const tpl = DASHBOARD_TEMPLATES.find(t => t.id === selectedTemplateId) || DASHBOARD_TEMPLATES[0];
                          const getMap = (id) => (mappings && mappings[id]) ? mappings[id] : { tableId: '', columnId: '' };
                          const getCol = (id) => String(getMap(id)?.columnId || '');
                          const getTable = (id) => String(getMap(id)?.tableId || '');
                          const sharedDateCol = getCol('date');

                          const sources = [];
                          const metrics = [];
                          const pushSource = (alias, tId) => {
                            if (!alias || !tId) return;
                            sources.push({ alias, tableId: tId });
                          };
                          const pushMetric = (alias, agg, colId, dateColId) => {
                            if (!alias || !colId) return;
                            metrics.push({ alias, agg, column_id: colId, date_column_id: dateColId || undefined });
                          };

                          if (tpl.id === 'exec_overview_v1') {
                            const revenueTableId = getTable('revenue');
                            const costTableId = getTable('cost');
                            const revenueCol = getCol('revenue');
                            const costCol = getCol('cost');
                            const revenueDateCol = getCol('revenue_date') || sharedDateCol;
                            const costDateCol = getCol('cost_date') || sharedDateCol;

                            pushSource('Revenue', revenueTableId);
                            pushSource('Cost', costTableId);
                            pushMetric('Revenue', 'SUM', revenueCol, revenueDateCol);
                            pushMetric('Cost', 'SUM', costCol, costDateCol);
                          } else if (tpl.id === 'cost_drivers_v1') {
                            const costTableId = getTable('cost');
                            const costCol = getCol('cost');
                            const dateCol = getCol('date');
                            pushSource('T', costTableId);
                            pushMetric('Cost', 'SUM', costCol, dateCol);
                          } else if (tpl.id === 'pipeline_health_v1') {
                            // Basic count metric. Template rendering will handle richer widgets later.
                            const dateTableId = getTable('date');
                            const dateCol = getCol('date');
                            pushSource('T', dateTableId);
                            if (dateCol) pushMetric('Count', 'COUNT', dateCol, dateCol);
                          }

                          const primaryTableId =
                            getTable('revenue') ||
                            getTable('cost') ||
                            getTable('date') ||
                            (sources[0] ? String(sources[0].tableId) : '');

                          const anyDateCol = sharedDateCol || getCol('revenue_date') || getCol('cost_date') || getCol('date') || '';

                          const layout = {
                            name,
                            template_id: tpl.id,
                            template_table_id: primaryTableId,
                            template_table_ids: Array.from(new Set(sources.map(s => s.tableId).filter(Boolean))),
                            template_mappings: mappings,
                            sources,
                            metrics,
                            tb: 'month',
                            groupAlias: sources[0]?.alias || 'T',
                            groupCol: anyDateCol,
                            groupMode: anyDateCol ? 'time' : 'row',
                            range: 'last_90_days'
                          };

                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user?.id) throw new Error('Not signed in');
                          let targetId = editingDashboardId || null;
                          if (editingDashboardId) {
                            const { data: updated, error } = await supabase
                              .from('user_dashboards')
                              .update({ layout })
                              .eq('id', editingDashboardId)
                              .select('id')
                              .single();
                            if (error) throw error;
                            targetId = updated?.id || editingDashboardId;
                          } else {
                            const { data: inserted, error } = await supabase
                              .from('user_dashboards')
                              .insert({ user_id: user.id, layout })
                              .select('id')
                              .single();
                            if (error) throw error;
                            targetId = inserted?.id;
                          }
                          if (targetId) {
                            await loadDashboards();
                            closeModal();
                            toast.success(editingDashboardId ? 'Dashboard updated' : 'Dashboard created');
                            navigate(`/dashboards/${targetId}?${buildParamsFromLayout(layout)}`);
                          }
                        } catch {
                          toast.error('Failed to create dashboard');
                        }
                      }}
                    />
                  )}
                </div>
              )}

              {/* Custom Builder (existing) */}
              {createMode === 'custom' && (
                <>
                  <div className="bg-white dark:bg-slate-900 p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Dashboard name</label>
                      <input
                        value={dashboardName}
                        onChange={(e)=>setDashboardName(e.target.value)}
                        placeholder="e.g. Recruiting Performance"
                        className="mt-1 w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200 text-sm"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Metrics & Sources</h3>
                      <button className="text-sm px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={addMetricBlock}>
                        <i className="fa-solid fa-plus mr-1"></i>Add metric
                      </button>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <i className="fa-solid fa-table text-slate-400"></i>
                          <span className="font-medium text-slate-900 dark:text-slate-100">Pick any table</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {loadingTables ? 'Loading…' : `${tables.length} available`}
                          {tablesError ? <button onClick={loadTables} className="ml-2 underline">Retry</button> : null}
                        </div>
                      </div>
                      <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
                        {metricBlocks.map((block, idx) => {
                          const selectedTable = tables.find((t) => t.id === block.tableId);
                          const schema = Array.isArray(selectedTable?.schema_json) ? selectedTable.schema_json : [];
                          const colLabel = (c) => String(c?.label || c?.name || '');
                          const colId = (c) => String(c?.id || c?.key || c?.name || '');
                          const numericColumns = schema.filter((c) => ['number', 'money', 'formula'].includes(String(c.type)));
                          const dateColumns = schema.filter((c) => String(c.type) === 'date' || /date|created/i.test(String(colLabel(c))));
                          return (
                            <div key={block.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900/40">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Series {idx + 1}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Alias used in formulas and labels</p>
                                </div>
                                {metricBlocks.length > 1 && (
                                  <button className="text-xs text-red-500 hover:text-red-400" onClick={() => removeMetricBlock(block.id)}>Remove</button>
                                )}
                              </div>
                              <div className="grid md:grid-cols-2 gap-3">
                                <input
                                  value={block.alias}
                                  onChange={(e)=>updateMetricBlock(block.id, { alias: e.target.value })}
                                  placeholder="Alias (e.g. Expenses)"
                                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200 text-sm"
                                />
                                <select
                                  value={block.tableId}
                                  onChange={(e)=>updateMetricBlock(block.id, { tableId: e.target.value, columnId: '', dateColumn: '' })}
                                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200 text-sm"
                                >
                                  <option value="">Select table</option>
                                  {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                              </div>
                              <div className="grid lg:grid-cols-3 gap-3">
                                <select
                                  value={block.columnId}
                                  onChange={(e)=>updateMetricBlock(block.id, { columnId: e.target.value })}
                                  disabled={!block.tableId}
                                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200 text-sm disabled:opacity-50"
                                >
                                  <option value="">{block.tableId ? 'Value column' : 'Select table first'}</option>
                                  {numericColumns.map((c) => <option key={colId(c)} value={colId(c)}>{colLabel(c)}</option>)}
                                </select>
                                <select
                                  value={block.agg}
                                  onChange={(e)=>updateMetricBlock(block.id, { agg: e.target.value })}
                                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200 text-sm"
                                >
                                  {['SUM','AVG','COUNT','MIN','MAX'].map((agg) => <option key={agg} value={agg}>{agg}</option>)}
                                </select>
                                <select
                                  value={block.dateColumn}
                                  onChange={(e)=>updateMetricBlock(block.id, { dateColumn: e.target.value })}
                                  disabled={!block.tableId}
                                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200 text-sm disabled:opacity-50"
                                >
                                  <option value="">Date column (optional)</option>
                                  {dateColumns.map((c) => <option key={colId(c)} value={colId(c)}>{colLabel(c)}</option>)}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">App data overlays</h4>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Optional</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={includeLeads} onChange={(e)=>{ const checked = e.target.checked; setIncludeLeads(checked); announceOverlayToggle('Leads overlay', checked); }} />
                          Leads
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={includeCampaigns} onChange={(e)=>{ const checked = e.target.checked; setIncludeCampaigns(checked); announceOverlayToggle('Campaign overlay', checked); }} />
                          Campaigns
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={includeJobs} onChange={(e)=>{ const checked = e.target.checked; setIncludeJobs(checked); announceOverlayToggle('Job Req overlay', checked); }} />
                          Job Reqs
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={includeDeals} onChange={(e)=>{ const checked = e.target.checked; setIncludeDeals(checked); announceOverlayToggle('Deals & Revenue overlay', checked); }} />
                          Deals & Revenue
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={includeCandidates} onChange={(e)=>{ const checked = e.target.checked; setIncludeCandidates(checked); announceOverlayToggle('Candidate overlay', checked); }} />
                          Candidates
                        </label>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Use these toggles to overlay system metrics like Close Won revenue or candidate counts alongside your custom tables.</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Time Range</h3>
                      <select value={timeRange} onChange={(e)=>setTimeRange(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200">
                        <option value="last_30_days">Last 30 Days</option>
                        <option value="last_90_days">Last 90 Days</option>
                        <option value="last_180_days">Last 180 Days</option>
                        <option value="ytd">Year to Date</option>
                        <option value="all_time">All Time</option>
                      </select>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-fuchsia-50 dark:from-slate-800 dark:to-slate-800/50 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Formula (optional)</h4>
                        <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={addFormulaSeries} onChange={(e)=>setAddFormulaSeries(e.target.checked)} />Enable</label>
                      </div>
                      {addFormulaSeries && (
                        <>
                          <input value={formulaLabel} onChange={(e)=>setFormulaLabel(e.target.value)} placeholder="Label (e.g. Net Profit)" className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-900/60 text-sm" />
                          <textarea value={formulaExpr} onChange={(e)=>setFormulaExpr(e.target.value)} placeholder="Example: Revenue - Expenses" className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-900/60 text-sm min-h-[70px]" />
                          <p className="text-xs text-slate-600 dark:text-slate-400">Use aliases exactly as defined above. We’ll translate them into safe expressions.</p>
                          <div className="flex flex-wrap gap-2">
                            {metricBlocks.filter((b) => b.alias.trim()).map((b) => (
                              <span key={`alias-${b.id}`} className="text-xs px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">{b.alias || 'Alias'}</span>
                            ))}
                            {!metricBlocks.some((b) => b.alias.trim()) && <span className="text-xs text-slate-500">Add an alias to see tokens</span>}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Preview summary</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">We’ll build {metricBlocks.filter((b)=>b.alias && b.tableId && b.columnId).length} metric series, {addFormulaSeries && formulaExpr ? 'plus a formula output.' : 'with no formula output yet.'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Charts will bucket by the first metric with a date column, otherwise fall back to row order.</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Live preview</h4>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Auto-refresh</span>
                      </div>
                      {previewError ? (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-200 rounded-lg px-3 py-2 text-sm">
                          {previewError}
                        </div>
                      ) : null}
                      {previewLoading ? (
                        <div className="animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 h-[220px]" />
                      ) : previewSeries && previewSeries.length ? (
                        <div id="builder-preview-chart" className="h-[220px]" />
                      ) : (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          Add an alias + value column (and at least one date column) to preview.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 px-6 pb-6">
                {builderError && <p className="text-sm text-red-500 mb-3">{builderError}</p>}
                <div className="flex items-center justify-end gap-3">
                  <button className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200" onClick={closeModal}>Cancel</button>
                  <button className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700" onClick={async ()=>{
                    const params = new URLSearchParams();
                    const preparedBlocks = metricBlocks.map((b) => ({ ...b, alias: (b.alias || '').trim() }));
                    const validMetrics = preparedBlocks.filter((b) => b.alias && b.tableId && b.columnId);
                    if (!validMetrics.length) {
                      const msg = 'Add at least one metric with an alias, table, and value column.';
                      setBuilderError(msg);
                      toast.error(msg);
                      return;
                    }
                    const aliasSet = new Set();
                    for (const block of validMetrics) {
                      if (aliasSet.has(block.alias)) {
                        const msg = 'Aliases must be unique. Rename duplicates to continue.';
                        setBuilderError(msg);
                        toast.error(msg);
                        return;
                      }
                      aliasSet.add(block.alias);
                    }
                    setBuilderError('');
                    const sources = validMetrics.map((block) => ({ alias: block.alias, tableId: block.tableId }));
                    // Persist stable identifiers in layout (column_id/date_column_id) to avoid breakage on label renames.
                    const metrics = validMetrics.map((block) => ({
                      alias: block.alias,
                      column_id: block.columnId,
                      agg: block.agg || 'SUM',
                      date_column_id: block.dateColumn || undefined
                    }));
                    params.set('sources', encodeURIComponent(JSON.stringify(sources)));
                    params.set('metrics', encodeURIComponent(JSON.stringify(metrics)));
                    let formulaPayload = '';
                    if (addFormulaSeries && formulaExpr.trim()) {
                      formulaPayload = formulaExpr;
                      validMetrics.forEach((block) => {
                        const pattern = new RegExp(`\\b${block.alias}\\b`, 'g');
                        formulaPayload = formulaPayload.replace(pattern, `${(block.agg || 'SUM').toUpperCase()}(${aggRef(block.alias, block.columnId)})`);
                      });
                      params.set('formula', formulaPayload);
                      if (formulaLabel.trim()) params.set('formulaLabel', formulaLabel.trim());
                    }
                    // Time bucket & grouping strategy
                    const dateMetric = validMetrics.find((block) => block.dateColumn);
                    const tb = dateMetric ? 'month' : 'none';
                    const groupAlias = dateMetric ? dateMetric.alias : validMetrics[0].alias;
                    const groupCol = dateMetric ? dateMetric.dateColumn : '';
                    const groupMode = dateMetric ? 'time' : 'row';
                    params.set('tb', tb);
                    if (groupAlias) params.set('groupAlias', groupAlias);
                    if (groupCol) params.set('groupCol', groupCol);
                    params.set('groupMode', groupMode);
                    // App datapoint flags
                    if (includeDeals) params.set('includeDeals', '1');
                    if (includeLeads) params.set('includeLeads', '1');
                    if (includeCandidates) params.set('includeCandidates', '1');
                    if (includeJobs) params.set('includeJobs', '1');
                    if (includeCampaigns) params.set('includeCampaigns', '1');
                    if (timeRange) params.set('range', timeRange);
                    // Save dashboard to Supabase so it appears in Custom Dashboards
                    try {
                      const resolvedName = String(dashboardName || '').trim() || 'Custom Dashboard';
                      const layout = {
                        name: resolvedName,
                        sources,
                        metrics,
                        formula: formulaPayload || '',
                        formulaLabel: formulaLabel || '',
                        tb,
                        groupAlias: params.get('groupAlias') || '',
                        groupCol: params.get('groupCol') || '',
                        groupMode,
                        includeDeals: includeDeals ? 1 : 0,
                        includeLeads: includeLeads ? 1 : 0,
                        includeCandidates: includeCandidates ? 1 : 0,
                        includeJobs: includeJobs ? 1 : 0,
                        includeCampaigns: includeCampaigns ? 1 : 0,
                        range: timeRange
                      };
                      const { data: { user } } = await supabase.auth.getUser();
                      let targetId = editingDashboardId || null;
                      if (editingDashboardId) {
                        const { data: updated, error } = await supabase
                          .from('user_dashboards')
                          .update({ layout })
                          .eq('id', editingDashboardId)
                          .select('id')
                          .single();
                        if (!error && updated?.id) {
                          targetId = updated.id;
                        }
                      } else if (user?.id) {
                        const { data: inserted, error } = await supabase
                          .from('user_dashboards')
                          .insert({ user_id: user.id, layout })
                          .select('id')
                          .single();
                        if (!error && inserted?.id) {
                          targetId = inserted.id;
                        }
                      }
                      if (targetId) {
                        await loadDashboards();
                        closeModal();
                        toast.success(editingDashboardId ? 'Dashboard updated' : 'Dashboard created');
                        navigate(`/dashboards/${targetId}?${params.toString()}`);
                        return;
                      }
                      toast.error('Failed to save dashboard');
                    } catch {
                      toast.error('Failed to save dashboard');
                    }
                    // Fallback to demo if save fails
                    navigate(`/dashboards/demo?${params.toString()}`);
                  }}>Build Dashboard</button>
                </div>
              </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Saved Custom Dashboards */}
      <SavedDashboards
        items={dashboards}
        loading={dashboardsLoading}
        selectedIds={selectedDashIds}
        onToggle={toggleSelectDashboard}
        onToggleAll={selectAllDashboards}
        onDeleteSelected={deleteSelectedDashboards}
        onView={viewDashboard}
        onEdit={startEditDashboard}
        onDelete={handleDeleteDashboard}
      />
    </div>
  );
}

function SavedDashboards({
  items,
  loading,
  selectedIds,
  onToggle,
  onToggleAll,
  onDeleteSelected,
  onView,
  onEdit,
  onDelete
}) {
  const [menuOpenId, setMenuOpenId] = useState(null);
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const handleSelectAllChange = (e) => onToggleAll?.(e.target.checked);
  const handleDeleteSelected = () => onDeleteSelected?.();
  const toggleMenu = (id, e) => {
    e?.stopPropagation();
    setMenuOpenId((prev) => prev === id ? null : id);
  };
  const closeMenu = () => setMenuOpenId(null);
  useEffect(() => {
    const handler = () => setMenuOpenId(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);
  if (!items.length) {
    return (
      <div className="mt-10 text-center text-slate-500">
        {loading ? 'Loading custom dashboards…' : 'No custom dashboards yet.'}
      </div>
    );
  }
  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Custom Dashboards</h3>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" className="w-4 h-4" checked={allSelected} onChange={handleSelectAllChange} />
            Select All
          </label>
          <button
            onClick={handleDeleteSelected}
            disabled={!selectedIds.length}
            className={`px-3 py-2 rounded-lg text-sm ${selectedIds.length ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
          >
            Delete Selected
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((d) => (
          <div key={d.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition relative cursor-pointer" onClick={() => onView?.(d)}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{String(d?.layout?.name || '').trim() || 'Custom Dashboard'}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Updated {new Date(d.updated_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4" checked={selectedIds.includes(d.id)} onChange={(e) => { e.stopPropagation(); onToggle?.(d.id); }} />
                <button onClick={(e) => toggleMenu(d.id, e)} className="text-slate-400 hover:text-slate-200">
                  <i className="fa-solid fa-ellipsis-vertical"></i>
                </button>
              </div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {Array.isArray(d?.layout?.sources) && d.layout.sources.length ? d.layout.sources.map(s=>s.alias).join(', ') : '—'}
            </div>
            <button className="text-indigo-500 text-sm font-medium" onClick={(e) => { e.stopPropagation(); onView?.(d); }}>View Dashboard</button>
            {menuOpenId === d.id && (
              <div className="absolute right-4 top-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg w-40 z-20">
                <button className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={(e)=>{ e.stopPropagation(); closeMenu(); onView?.(d); }}>View</button>
                <button className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={async (e)=>{ e.stopPropagation(); closeMenu(); await onEdit?.(d); }}>Edit</button>
                <button className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-slate-800" onClick={(e)=>{ e.stopPropagation(); closeMenu(); onDelete?.(d.id); }}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


