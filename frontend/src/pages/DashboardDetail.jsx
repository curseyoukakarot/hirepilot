import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function DashboardDetail() {
  const [kpis, setKpis] = useState([]);
  const [showFunnel, setShowFunnel] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showCphTrend, setShowCphTrend] = useState(false);
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const PlotlyMod = await import('plotly.js-dist-min');
        const Plotly = PlotlyMod.default || PlotlyMod;
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
        // Optional UI flags: default hidden unless explicitly requested
        setShowFunnel(url.searchParams.get('showFunnel') === '1');
        setShowCampaigns(url.searchParams.get('showCampaigns') === '1');
        // Build dynamic traces
        const traces = [];
        // If includeDeals, fetch revenue monthly series via Supabase view and add as trace and KPI
        let revenueKpi = 0;
        if (includeDeals) {
          try {
            const { data: revRows } = await supabase
              .from('revenue_monthly')
              .select('month,revenue')
              .order('month', { ascending: true });
            // Range filter
            const startFrom = (() => {
              const now = new Date();
              const d = new Date(now);
              if (range === 'last_30_days') d.setDate(now.getDate() - 30);
              else if (range === 'last_90_days') d.setDate(now.getDate() - 90);
              else if (range === 'last_180_days') d.setDate(now.getDate() - 180);
              else if (range === 'ytd') d.setMonth(0, 1);
              else d.setFullYear(1970, 0, 1);
              return d;
            })();
            const filtered = (revRows || []).filter(r => {
              try { return new Date(r.month) >= startFrom; } catch { return true; }
            });
            const x = filtered.map(r => r.month);
            const y = filtered.map(r => Number(r.revenue || 0));
            if (y.length) {
              if (groupMode === 'time') {
                traces.push({
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Revenue',
                  x,
                  y,
                  line: { width: 3 }
                });
              }
              revenueKpi = y.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
            }
          } catch {}
        }
        if (backendBase && sources.length) {
          const { data: { session } } = await supabase.auth.getSession();
          const authHeader = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
          // Side-by-side metrics (each becomes its own formula chart)
          for (const m of (Array.isArray(metrics) ? metrics : [])) {
            try {
              const r = await fetch(`${backendBase}/api/dashboards/any/widgets/any/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeader },
                body: JSON.stringify({
                  type: 'formulaChart',
                  formula: `${(m.agg || 'SUM').toUpperCase()}(${m.alias}.${m.columnId})`,
                  sources,
                  timeBucket: tb,
                  groupBy
                })
              });
              if (r.ok) {
                const json = await r.json();
                const pts = json?.points || [];
                traces.push({
                  type: 'scatter',
                  mode: 'lines',
                  name: m.alias || m.columnId,
                  x: pts.map(p => p.x),
                  y: pts.map(p => p.value),
                  line: { width: 3 }
                });
              }
            } catch {}
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
                traces.push({
                  type: 'scatter',
                  mode: 'lines',
                  name: formulaLabel || 'Formula',
                  x: pts.map(p => p.x),
                  y: pts.map(p => p.value),
                  line: { width: 3 }
                });
              }
            } catch {}
          }
          // Compute KPI cards (aggregates with no time bucket)
          const k = [];
          for (const m of (Array.isArray(metrics) ? metrics : [])) {
            try {
              const r = await fetch(`${backendBase}/api/dashboards/any/widgets/any/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeader },
                body: JSON.stringify({
                  type: 'formulaMetric',
                  formula: `${(m.agg || 'SUM').toUpperCase()}(${m.alias}.${m.columnId})`,
                  sources,
                  timeBucket: 'none'
                })
              });
              if (r.ok) {
                const j = await r.json();
                k.push({ id: `${m.alias}_${m.columnId}`, label: m.alias || m.columnId, value: j?.value ?? 0, format: /amount|revenue|price|cost|value|total|monthly|yearly/i.test(String(m.columnId)) ? 'currency' : 'number' });
              }
            } catch {}
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
            } catch {}
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
            xaxis: { title: '', showgrid: false, color: axisColor },
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
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-white bg-gradient-to-r from-primary to-secondary rounded-lg">
              <i className="fa-solid fa-gauge-high"></i>
              <span className="font-medium">Dashboard</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition">
              <i className="fa-solid fa-table"></i>
              <span className="font-medium">Tables</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition">
              <i className="fa-solid fa-calculator"></i>
              <span className="font-medium">Formulas</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition">
              <i className="fa-solid fa-robot"></i>
              <span className="font-medium">AI Insights</span>
            </a>
          </nav>
          <div className="p-4 border-t border-slate-200">
            <div className="flex items-center gap-3 px-4 py-3">
              <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Alex Chen</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Admin</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main id="main-content" className="flex-1 flex overflow-hidden">
          <div id="dashboard-area" className="flex-1 overflow-y-auto">
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
          </div>

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


