import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

export default function Dashboards() {
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [revenueTableId, setRevenueTableId] = useState('');
  const [expensesTableId, setExpensesTableId] = useState('');
  const [hiresTableId, setHiresTableId] = useState('');
  const [timeRange, setTimeRange] = useState('last_90_days');
  const [includeLeads, setIncludeLeads] = useState(false);
  const [includeCampaigns, setIncludeCampaigns] = useState(false);
  const [includeJobs, setIncludeJobs] = useState(false);
  const [includeDeals, setIncludeDeals] = useState(false);
  const [includeCandidates, setIncludeCandidates] = useState(false);
  // Metric selections
  const [revValueCol, setRevValueCol] = useState('');
  const [revDateCol, setRevDateCol] = useState('');
  const [expValueCol, setExpValueCol] = useState('');
  const [expDateCol, setExpDateCol] = useState('');
  const [hiresDateCol, setHiresDateCol] = useState('');
  const [sideBySide, setSideBySide] = useState(true);
  const [addFormulaSeries, setAddFormulaSeries] = useState(true);
  const [formulaExpr, setFormulaExpr] = useState('Revenue - Expenses');
  const [tablesError, setTablesError] = useState(null);
  const [dashboards, setDashboards] = useState([]);
  const [dashboardsLoading, setDashboardsLoading] = useState(false);
  const [selectedDashIds, setSelectedDashIds] = useState([]);
  const [editingDashboardId, setEditingDashboardId] = useState(null);

  const resetBuilderState = useCallback(() => {
    setRevenueTableId('');
    setExpensesTableId('');
    setHiresTableId('');
    setTimeRange('last_90_days');
    setIncludeLeads(false);
    setIncludeCampaigns(false);
    setIncludeJobs(false);
    setIncludeDeals(false);
    setIncludeCandidates(false);
    setRevValueCol('');
    setRevDateCol('');
    setExpValueCol('');
    setExpDateCol('');
    setHiresDateCol('');
    setSideBySide(true);
    setAddFormulaSeries(true);
    setFormulaExpr('Revenue - Expenses');
  }, []);

  const hydrateBuilderFromLayout = useCallback((layout = {}) => {
    resetBuilderState();
    const sourceByAlias = {};
    if (Array.isArray(layout.sources)) {
      layout.sources.forEach((s) => { sourceByAlias[s.alias] = s; });
      setRevenueTableId(sourceByAlias['Revenue']?.tableId || '');
      setExpensesTableId(sourceByAlias['Expenses']?.tableId || '');
      setHiresTableId(sourceByAlias['Hires']?.tableId || '');
    }
    if (Array.isArray(layout.metrics) && layout.metrics.length) {
      setSideBySide(true);
      const revMetric = layout.metrics.find((m) => m.alias === 'Revenue');
      const expMetric = layout.metrics.find((m) => m.alias === 'Expenses');
      if (revMetric) {
        setRevValueCol(revMetric.columnId || '');
        setRevDateCol(revMetric.dateColumn || '');
      }
      if (expMetric) {
        setExpValueCol(expMetric.columnId || '');
        setExpDateCol(expMetric.dateColumn || '');
      }
    } else {
      setSideBySide(false);
    }
    if (layout.hiresDateCol) setHiresDateCol(layout.hiresDateCol);
    else setHiresDateCol('');
    if (layout.formula) {
      setAddFormulaSeries(true);
      setFormulaExpr(layout.formula);
    } else {
      setAddFormulaSeries(false);
      setFormulaExpr('');
    }
    if (layout.range) setTimeRange(layout.range);
    setIncludeDeals(Boolean(layout.includeDeals));
    setIncludeLeads(Boolean(layout.includeLeads));
    setIncludeCandidates(Boolean(layout.includeCandidates));
    setIncludeJobs(Boolean(layout.includeJobs));
    setIncludeCampaigns(Boolean(layout.includeCampaigns));
  }, [resetBuilderState]);

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
      setTables(Array.isArray(data) ? data : []);
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
    } catch {
      // swallow for now; could show toast
    }
  }, [loadDashboards]);

  const deleteSelectedDashboards = useCallback(async () => {
    await deleteDashboardsByIds(selectedDashIds);
  }, [deleteDashboardsByIds, selectedDashIds]);

  const viewDashboard = useCallback((dashboard) => {
    const qs = buildParamsFromLayout(dashboard.layout || {});
    navigate(`/dashboards/${dashboard.id}?${qs}`);
  }, [buildParamsFromLayout, navigate]);

  const startEditDashboard = useCallback(async (dashboard) => {
    hydrateBuilderFromLayout(dashboard.layout || {});
    setEditingDashboardId(dashboard.id);
    setIsCreateOpen(true);
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
        const PlotlyMod = await import('plotly.js-dist-min');
        const Plotly = PlotlyMod.default || PlotlyMod;
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e)=>{ if (e.target===e.currentTarget) closeModal(); }}>
            <motion.div initial={{ scale: 0.97, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.98, y: 6, opacity: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 22 }} className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl border border-indigo-200/40 dark:border-indigo-900/40">
              <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Create Custom Dashboard</h2>
                    <p className="opacity-90 mt-1">Choose data sources and timeframe. We’ll assemble widgets and charts.</p>
                  </div>
                  <button className="text-white/90 hover:text-white" onClick={closeModal}><i className="fa-solid fa-xmark text-2xl"></i></button>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Data Sources</h3>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <i className="fa-solid fa-table" style={{ color: '#9CA3AF' }}></i>
                          <span className="font-medium">Tables</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {loadingTables ? 'Loading…' : `${tables.length} available`}
                          {(!loadingTables && tables.length === 0 && !tablesError) ? <span className="ml-2">(none)</span> : null}
                          {tablesError ? <button onClick={loadTables} className="ml-2 underline">Retry</button> : null}
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Revenue */}
                        <div>
                          <label className="text-xs text-slate-500">Revenue Table</label>
                          <select value={revenueTableId} onChange={(e)=>{ setRevenueTableId(e.target.value); setRevValueCol(''); setRevDateCol(''); }} className="mt-1 w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200"><option value="">Select</option>{tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                          {revenueTableId && (
                            <div className="mt-2 space-y-2">
                              <select value={revValueCol} onChange={(e)=>setRevValueCol(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200">
                                <option value="">Value Column</option>
                                {(tables.find(t=>t.id===revenueTableId)?.schema_json||[]).filter(c=>['number','money','formula'].includes(String(c.type))).map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
                              </select>
                              <select value={revDateCol} onChange={(e)=>setRevDateCol(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200">
                                <option value="">Date Column (optional)</option>
                                {(tables.find(t=>t.id===revenueTableId)?.schema_json||[]).filter(c=>String(c.type)==='date' || /date|created/i.test(String(c.name))).map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                        {/* Expenses */}
                        <div>
                          <label className="text-xs text-slate-500">Expenses Table</label>
                          <select value={expensesTableId} onChange={(e)=>{ setExpensesTableId(e.target.value); setExpValueCol(''); setExpDateCol(''); }} className="mt-1 w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200"><option value="">Select</option>{tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                          {expensesTableId && (
                            <div className="mt-2 space-y-2">
                              <select value={expValueCol} onChange={(e)=>setExpValueCol(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200">
                                <option value="">Value Column</option>
                                {(tables.find(t=>t.id===expensesTableId)?.schema_json||[]).filter(c=>['number','money','formula'].includes(String(c.type))).map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
                              </select>
                              <select value={expDateCol} onChange={(e)=>setExpDateCol(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200">
                                <option value="">Date Column (optional)</option>
                                {(tables.find(t=>t.id===expensesTableId)?.schema_json||[]).filter(c=>String(c.type)==='date' || /date|created/i.test(String(c.name))).map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                        {/* Hires */}
                        <div>
                          <label className="text-xs text-slate-500">Hires Table</label>
                          <select value={hiresTableId} onChange={(e)=>{ setHiresTableId(e.target.value); setHiresDateCol(''); }} className="mt-1 w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200"><option value="">Select</option>{tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                          {hiresTableId && (
                            <div className="mt-2">
                              <select value={hiresDateCol} onChange={(e)=>setHiresDateCol(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200">
                                <option value="">Date Column (optional)</option>
                                {(tables.find(t=>t.id===hiresTableId)?.schema_json||[]).filter(c=>String(c.type)==='date' || /date|created/i.test(String(c.name))).map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeLeads} onChange={(e)=>setIncludeLeads(e.target.checked)} />Leads</label>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeCampaigns} onChange={(e)=>setIncludeCampaigns(e.target.checked)} />Campaigns</label>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeJobs} onChange={(e)=>setIncludeJobs(e.target.checked)} />Job Reqs</label>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeDeals} onChange={(e)=>setIncludeDeals(e.target.checked)} />Deals & Revenue</label>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeCandidates} onChange={(e)=>setIncludeCandidates(e.target.checked)} />Candidates</label>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">We’ll auto-suggest KPIs and charts from each source. Tables can be used directly or in formulas.</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Time Range</h3>
                    <select value={timeRange} onChange={(e)=>setTimeRange(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-slate-200">
                      <option value="last_30_days">Last 30 Days</option>
                      <option value="last_90_days">Last 90 Days</option>
                      <option value="last_180_days">Last 180 Days</option>
                      <option value="ytd">Year to Date</option>
                      <option value="all_time">All Time</option>
                    </select>
                    <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-fuchsia-50 dark:from-slate-800 dark:to-slate-800/50 border border-slate-200 dark:border-slate-800 p-4">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">What you’ll get</h4>
                      <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                        <li>• KPI cards (Net Profit, Cost per Hire, LTV, etc.)</li>
                        <li>• Charts with multiple metrics and time buckets</li>
                        <li>• Optional REX insights for summaries and suggestions</li>
                      </ul>
                      <div className="mt-4 space-y-2">
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sideBySide} onChange={(e)=>setSideBySide(e.target.checked)} />Show selected metrics side-by-side</label>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={addFormulaSeries} onChange={(e)=>setAddFormulaSeries(e.target.checked)} />Add formula series</label>
                        {addFormulaSeries && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-600 dark:text-slate-400">Formula</span>
                            <input value={formulaExpr} onChange={(e)=>setFormulaExpr(e.target.value)} placeholder="Revenue - Expenses" className="flex-1 px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 dark:text-slate-200 text-sm" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 px-6 pb-6">
                <div className="flex items-center justify-end gap-3">
                  <button className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200" onClick={closeModal}>Cancel</button>
                  <button className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700" onClick={async ()=>{
                    const params = new URLSearchParams();
                    // Sources (aliases fixed)
                    const sources = [];
                    if (revenueTableId) sources.push({ alias: 'Revenue', tableId: revenueTableId });
                    if (expensesTableId) sources.push({ alias: 'Expenses', tableId: expensesTableId });
                    if (hiresTableId) sources.push({ alias: 'Hires', tableId: hiresTableId });
                    if (sources.length) params.set('sources', encodeURIComponent(JSON.stringify(sources)));
                    // Metrics (side-by-side)
                    const metrics = [];
                    if (sideBySide) {
                      if (revenueTableId && revValueCol) metrics.push({ alias: 'Revenue', columnId: revValueCol, agg: 'SUM', dateColumn: revDateCol || undefined });
                      if (expensesTableId && expValueCol) metrics.push({ alias: 'Expenses', columnId: expValueCol, agg: 'SUM', dateColumn: expDateCol || undefined });
                    }
                    if (metrics.length) params.set('metrics', encodeURIComponent(JSON.stringify(metrics)));
                    // Optional formula expression
                    if (addFormulaSeries && (formulaExpr || (revValueCol && expValueCol))) {
                      let expr = formulaExpr || '';
                      // If plain aliases used, expand to include selected column names
                      if (/Revenue\b/.test(expr) && revValueCol) expr = expr.replace(/Revenue\b/g, `SUM(Revenue.${revValueCol})`);
                      if (/Expenses\b/.test(expr) && expValueCol) expr = expr.replace(/Expenses\b/g, `SUM(Expenses.${expValueCol})`);
                      params.set('formula', expr);
                    }
                    // Time bucket & grouping strategy
                    let tb = 'none';
                    let groupAlias = '';
                    let groupCol = '';
                    let groupMode = 'row';
                    if (revDateCol) {
                      groupAlias = 'Revenue';
                      groupCol = revDateCol;
                      groupMode = 'time';
                      tb = 'month';
                    } else if (expDateCol) {
                      groupAlias = 'Expenses';
                      groupCol = expDateCol;
                      groupMode = 'time';
                      tb = 'month';
                    } else if (hiresDateCol) {
                      groupAlias = 'Hires';
                      groupCol = hiresDateCol;
                      groupMode = 'time';
                      tb = 'month';
                    } else if (sources.length) {
                      groupAlias = sources[0].alias;
                      groupCol = '__row__';
                      groupMode = 'row';
                      tb = 'none';
                    }
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
                      const layout = {
                        sources,
                        metrics,
                        formula: params.get('formula') || '',
                        tb,
                        groupAlias: params.get('groupAlias') || '',
                        groupCol: params.get('groupCol') || '',
                        groupMode,
                        includeDeals: includeDeals ? 1 : 0,
                        includeLeads: includeLeads ? 1 : 0,
                        includeCandidates: includeCandidates ? 1 : 0,
                        includeJobs: includeJobs ? 1 : 0,
                        includeCampaigns: includeCampaigns ? 1 : 0,
                        range: timeRange,
                        hiresDateCol
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
                        navigate(`/dashboards/${targetId}?${params.toString()}`);
                        return;
                      }
                    } catch {}
                    // Fallback to demo if save fails
                    navigate(`/dashboards/demo?${params.toString()}`);
                  }}>Build Dashboard</button>
                </div>
              </div>
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
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Custom Dashboard</h4>
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


