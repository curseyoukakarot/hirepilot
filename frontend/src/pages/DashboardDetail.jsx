import React, { useEffect } from 'react';

export default function DashboardDetail() {
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const PlotlyMod = await import('plotly.js-dist-min');
        const Plotly = PlotlyMod.default || PlotlyMod;
        if (!isMounted) return;
        // Revenue vs Expenses
        try {
          await Plotly.newPlot('revenue-chart', [{
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
            plot_bgcolor: '#ffffff',
            paper_bgcolor: '#ffffff',
            xaxis: { title: '', showgrid: false },
            yaxis: { title: 'Amount ($)', gridcolor: '#f1f5f9' },
            showlegend: true,
            legend: { orientation: 'h', y: -0.15 }
          }, { responsive: true, displayModeBar: false, displaylogo: false });
        } catch {}
        // Funnel
        try {
          await Plotly.newPlot('funnel-chart', [{
            type: 'funnel',
            y: ['Leads', 'Candidates', 'Screening', 'Interviews', 'Offers', 'Hires'],
            x: [2450, 1820, 1050, 420, 198, 142],
            marker: { color: ['#6366f1', '#7c3aed', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe'] }
          }], {
            margin: { t: 20, r: 20, b: 40, l: 100 },
            plot_bgcolor: '#ffffff',
            paper_bgcolor: '#ffffff'
          }, { responsive: true, displayModeBar: false, displaylogo: false });
        } catch {}
        // Campaign performance
        try {
          await Plotly.newPlot('campaign-chart', [{
            type: 'bar',
            x: ['LinkedIn', 'Email', 'Referrals', 'Job Boards', 'Events'],
            y: [58, 42, 28, 10, 4],
            marker: { color: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'] }
          }], {
            margin: { t: 20, r: 20, b: 60, l: 60 },
            plot_bgcolor: '#ffffff',
            paper_bgcolor: '#ffffff',
            xaxis: { title: '', showgrid: false },
            yaxis: { title: 'Hires', gridcolor: '#f1f5f9' }
          }, { responsive: true, displayModeBar: false, displaylogo: false });
        } catch {}
        // Cost Per Hire trend
        try {
          await Plotly.newPlot('cph-chart', [{
            type: 'scatter',
            mode: 'lines',
            x: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
            y: [2280, 2240, 2195, 2150, 2120, 2085, 2055, 2030, 2004],
            line: { color: '#10b981', width: 3 },
            fill: 'tozeroy',
            fillcolor: 'rgba(16, 185, 129, 0.1)'
          }], {
            margin: { t: 20, r: 20, b: 40, l: 60 },
            plot_bgcolor: '#ffffff',
            paper_bgcolor: '#ffffff',
            xaxis: { title: '', showgrid: false },
            yaxis: { title: 'Cost ($)', gridcolor: '#f1f5f9' },
            showlegend: false
          }, { responsive: true, displayModeBar: false, displaylogo: false });
        } catch {}
      } catch (e) {
        console.error('Chart error:', e);
      }
    })();
    // Panel open/close and staged content reveal
    const askBtn = document.getElementById('ask-rex-btn');
    const closeBtn = document.getElementById('close-panel-btn');
    const onAsk = () => {
      const panel = document.getElementById('insights-panel');
      if (!panel) return;
      panel.classList.remove('hidden');
      setTimeout(() => {
        const hide = (id) => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); };
        const show = (id) => { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); };
        hide('loading-state');
        show('summary-section');
        show('insights-section');
        show('suggestions-section');
        show('query-section');
      }, 1500);
    };
    const onClose = () => {
      const panel = document.getElementById('insights-panel');
      if (!panel) return;
      panel.classList.add('hidden');
    };
    askBtn?.addEventListener('click', onAsk);
    closeBtn?.addEventListener('click', onClose);
    return () => {
      isMounted = false;
      try { askBtn?.removeEventListener('click', onAsk); } catch {}
      try { closeBtn?.removeEventListener('click', onClose); } catch {}
    };
  }, []);

  return (
    <div className="bg-slate-50 min-h-screen">
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
        <aside id="sidebar" className="w-64 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-chart-line text-white text-lg"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">REX Analytics</h1>
                <p className="text-xs text-slate-500">AI-Powered Insights</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-white bg-gradient-to-r from-primary to-secondary rounded-lg">
              <i className="fa-solid fa-gauge-high"></i>
              <span className="font-medium">Dashboard</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-lg transition">
              <i className="fa-solid fa-table"></i>
              <span className="font-medium">Tables</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-lg transition">
              <i className="fa-solid fa-calculator"></i>
              <span className="font-medium">Formulas</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-lg transition">
              <i className="fa-solid fa-robot"></i>
              <span className="font-medium">AI Insights</span>
            </a>
          </nav>
          <div className="p-4 border-t border-slate-200">
            <div className="flex items-center gap-3 px-4 py-3">
              <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">Alex Chen</p>
                <p className="text-xs text-slate-500">Admin</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main id="main-content" className="flex-1 flex overflow-hidden">
          <div id="dashboard-area" className="flex-1 overflow-y-auto">
            {/* Header */}
            <header id="header" className="bg-white border-b border-slate-200 sticky top-0 z-10">
              <div className="px-8 py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Recruiting Performance</h2>
                    <p className="text-sm text-slate-500 mt-1">Last 90 days • Updated 5 min ago</p>
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

            {/* KPIs */}
            <div id="kpi-section" className="p-8">
              <div className="grid grid-cols-4 gap-6">
                {/* KPI 1 */}
                <div id="kpi-card-1" className="bg-white rounded-xl p-6 border border-slate-200 insight-card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                      <i className="fa-solid fa-dollar-sign text-blue-600 text-xl"></i>
                    </div>
                    <button className="text-slate-400 hover:text-slate-600">
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Net Profit</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-2">$284,500</h3>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-green-600 text-sm font-semibold flex items-center gap-1">
                      <i className="fa-solid fa-arrow-up"></i>
                      12.3%
                    </span>
                    <span className="text-xs text-slate-400">vs prev period</span>
                  </div>
                </div>
                {/* KPI 2 */}
                <div id="kpi-card-2" className="bg-white rounded-xl p-6 border border-slate-200 insight-card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                      <i className="fa-solid fa-users text-purple-600 text-xl"></i>
                    </div>
                    <button className="text-slate-400 hover:text-slate-600">
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Total Hires</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-2">142</h3>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-green-600 text-sm font-semibold flex items-center gap-1">
                      <i className="fa-solid fa-arrow-up"></i>
                      8.4%
                    </span>
                    <span className="text-xs text-slate-400">vs prev period</span>
                  </div>
                </div>
                {/* KPI 3 */}
                <div id="kpi-card-3" className="bg-white rounded-xl p-6 border border-slate-200 insight-card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-pink-50 rounded-lg flex items-center justify-center">
                      <i className="fa-solid fa-money-bill-trend-up text-pink-600 text-xl"></i>
                    </div>
                    <button className="text-slate-400 hover:text-slate-600">
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Cost Per Hire</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-2">$2,004</h3>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-red-600 text-sm font-semibold flex items-center gap-1">
                      <i className="fa-solid fa-arrow-down"></i>
                      5.2%
                    </span>
                    <span className="text-xs text-slate-400">improvement</span>
                  </div>
                </div>
                {/* KPI 4 */}
                <div id="kpi-card-4" className="bg-white rounded-xl p-6 border border-slate-200 insight-card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
                      <i className="fa-solid fa-chart-line text-amber-600 text-xl"></i>
                    </div>
                    <button className="text-slate-400 hover:text-slate-600">
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Conversion Rate</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-2">18.7%</h3>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-green-600 text-sm font-semibold flex items-center gap-1">
                      <i className="fa-solid fa-arrow-up"></i>
                      3.1%
                    </span>
                    <span className="text-xs text-slate-400">vs prev period</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div id="charts-section" className="px-8 pb-8">
              <div className="grid grid-cols-2 gap-6">
                <div id="chart-card-1" className="bg-white rounded-xl p-6 border border-slate-200 insight-card">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900">Revenue vs Expenses</h3>
                    <button className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2">
                      <i className="fa-solid fa-lightbulb"></i>
                      Explain
                    </button>
                  </div>
                  <div id="revenue-chart" style={{ height: '300px' }}></div>
                </div>
                <div id="chart-card-2" className="bg-white rounded-xl p-6 border border-slate-200 insight-card">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900">Recruiting Funnel</h3>
                    <button className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2">
                      <i className="fa-solid fa-lightbulb"></i>
                      Explain
                    </button>
                  </div>
                  <div id="funnel-chart" style={{ height: '300px' }}></div>
                </div>
                <div id="chart-card-3" className="bg-white rounded-xl p-6 border border-slate-200 insight-card">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900">Campaign Performance</h3>
                    <button className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2">
                      <i className="fa-solid fa-lightbulb"></i>
                      Explain
                    </button>
                  </div>
                  <div id="campaign-chart" style={{ height: '300px' }}></div>
                </div>
                <div id="chart-card-4" className="bg-white rounded-xl p-6 border border-slate-200 insight-card">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900">Cost Per Hire Trend</h3>
                    <button className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2">
                      <i className="fa-solid fa-lightbulb"></i>
                      Explain
                    </button>
                  </div>
                  <div id="cph-chart" style={{ height: '300px' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Insights Panel */}
          <aside id="insights-panel" className="w-96 bg-white border-l border-slate-200 overflow-y-auto hidden">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-sparkles text-white"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">REX Insights</h3>
                    <p className="text-xs text-slate-500">AI-powered analysis</p>
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


