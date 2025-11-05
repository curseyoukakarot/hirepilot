import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart } from 'chart.js/auto';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('deals');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Widget Details');
  const [modalType, setModalType] = useState('deals'); // category fallback
  const [modalWidget, setModalWidget] = useState(null); // exact widget name
  const [showExportMenu, setShowExportMenu] = useState(false);
  const chartRef = useRef(null);
  const chartInstancesRef = useRef({});
  const navigate = useNavigate();
  const [modalData, setModalData] = useState(null);

  const widgetTypeMap = useMemo(() => ({
    'Reply Rate Chart': 'reply-rate',
    'Open Rate Widget': 'open-rate',
    'Conversion Trends': 'conversion-trends',
    'Revenue Forecast': 'revenue-forecast',
    'Win Rate KPI': 'win-rate',
    'Engagement Breakdown': 'engagement',
    'Pipeline Velocity': 'pipeline-velocity',
    'Team Performance': 'team-performance',
    'Activity Overview': 'activity-overview',
    'Deal Pipeline': 'deal-pipeline',
    'Hiring Funnel': 'hiring-funnel',
  }), []);

  const apiFetch = async (url, init = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const headers = { 'Content-Type': 'application/json', ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const resp = await fetch(url, { ...init, headers, credentials: 'include' });
    if (!resp.ok) throw new Error(await resp.text());
    return resp;
  };

  const widgetData = useMemo(() => ({
    deals: [
      { name: 'Revenue Forecast', icon: 'fa-chart-line', color: 'purple' },
      { name: 'Deal Pipeline', icon: 'fa-funnel-dollar', color: 'blue' },
      { name: 'Win Rate KPI', icon: 'fa-trophy', color: 'green' },
      { name: 'Engagement Breakdown', icon: 'fa-chart-pie', color: 'orange' }
    ],
    jobs: [
      { name: 'Hiring Funnel', icon: 'fa-filter', color: 'blue' },
      { name: 'Candidate Flow Viz', icon: 'fa-users', color: 'green' },
      { name: 'Pipeline Velocity', icon: 'fa-tachometer-alt', color: 'purple' },
      { name: 'Team Performance', icon: 'fa-chart-bar', color: 'orange' }
    ],
    outreach: [
      { name: 'Reply Rate Chart', icon: 'fa-reply', color: 'green' },
      { name: 'Open Rate Widget', icon: 'fa-envelope-open', color: 'blue' },
      { name: 'Conversion Trends', icon: 'fa-chart-area', color: 'indigo' },
      { name: 'Activity Overview', icon: 'fa-chart-bar', color: 'teal' }
    ],
    rex: [
      { name: 'Hires by Source', icon: 'fa-robot', color: 'purple', ai: true },
      { name: 'Q4 Revenue Projection', icon: 'fa-robot', color: 'purple', ai: true },
      { name: 'Candidate Quality Score', icon: 'fa-robot', color: 'purple', ai: true },
      { name: 'Outreach Optimization', icon: 'fa-robot', color: 'purple', ai: true }
    ]
  }), []);

  const widgets = useMemo(() => widgetData[activeTab] || widgetData.deals, [activeTab, widgetData]);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  const openModal = async (title) => {
    setModalTitle(title);
    setModalWidget(title);
    const type = activeTab === 'deals' ? 'deals' : activeTab === 'jobs' ? 'jobs' : activeTab === 'outreach' ? 'outreach' : 'deals';
    setModalType(type);
    setIsModalOpen(true);
    setShowExportMenu(false);
    try {
      const wtype = widgetTypeMap[title];
      if (wtype) {
        if (wtype === 'revenue-forecast') {
          // Defer to revenue fetcher effect which uses backend endpoints
          setModalData([]);
        } else if (wtype === 'deal-pipeline') {
          // Fetch directly from Supabase to avoid SPA HTML from /api/widgets on Vercel
        const { data: { user } } = await supabase.auth.getUser();
          if (!user) { setModalData([{ pipelineValue:0,bestCaseValue:0,commitValue:0,closedWonValue:0,pipelineDeals:0,bestCaseDeals:0,commitDeals:0,closedWonDeals:0,totalActiveDeals:0,totalValue:0 }]); return; }
          const { data: me } = await supabase.from('users').select('role, team_id').eq('id', user.id).maybeSingle();
          const role = String((me||{}).role || '').toLowerCase();
          const teamId = (me||{}).team_id || null;
          const isSuper = ['super_admin','superadmin'].includes(role);
          const isTeamAdmin = role === 'team_admin';
          let base = supabase.from('opportunities').select('stage,value,owner_id');
          if (!isSuper) {
            if (isTeamAdmin && teamId) {
              const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', teamId);
              const ids = (teamUsers || []).map((u)=>u.id);
              base = base.in('owner_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
        } else {
              base = base.eq('owner_id', user.id);
      }
          }
          const { data: opps } = await base;
          const stageOf = (o) => {
            const s = String(o.stage||'');
            if (['Closed Won','Won'].includes(s)) return 'Close Won';
            return s;
          };
          const sum = (st) => (opps||[]).filter(o => stageOf(o) === st).reduce((s,o)=> s + (Number(o.value)||0), 0);
          const cnt = (st) => (opps||[]).filter(o => stageOf(o) === st).length;
          const pipelineValue = sum('Pipeline');
          const bestCaseValue = sum('Best Case');
          const commitValue = sum('Commit');
          const closedWonValue = sum('Close Won');
          const dataRow = {
            pipelineValue,
            bestCaseValue,
            commitValue,
            closedWonValue,
            pipelineDeals: cnt('Pipeline'),
            bestCaseDeals: cnt('Best Case'),
            commitDeals: cnt('Commit'),
            closedWonDeals: cnt('Close Won'),
            totalActiveDeals: (opps||[]).filter(o=>['Pipeline','Best Case','Commit'].includes(stageOf(o))).length,
            totalValue: pipelineValue + bestCaseValue + commitValue + closedWonValue,
          };
          setModalData([dataRow]);
        } else {
          const r = await apiFetch(`/api/widgets/${encodeURIComponent(wtype)}`);
          const j = await r.json();
          setModalData(Array.isArray(j.data) ? j.data : []);
        }
      } else {
        setModalData(null);
      }
    } catch { setModalData(null); }
  };

  const addWidgetToDashboard = async (widgetName) => {
    try {
      // Prefer direct Supabase save to avoid 405 on deployed /api routes
      let existingLayout = [];
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: row } = await supabase.from('user_dashboards').select('layout').eq('user_id', user.id).maybeSingle();
          existingLayout = Array.isArray(row?.layout) ? row.layout : [];
      }
      } catch {}
      const already = existingLayout.some(w => (w.widget_id || w) === widgetName);
      const layout = already ? existingLayout : [...existingLayout, { widget_id: widgetName, position: { x: 0, y: 0 }, config: {} }].slice(0,6);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: existing } = await supabase.from('user_dashboards').select('user_id').eq('user_id', user.id).maybeSingle();
          if (existing) {
            const { error } = await supabase.from('user_dashboards').update({ layout, updated_at: new Date().toISOString() }).eq('user_id', user.id);
            if (error) throw new Error(error.message);
          } else {
            const { error } = await supabase.from('user_dashboards').insert({ user_id: user.id, layout, updated_at: new Date().toISOString() });
            if (error) throw new Error(error.message);
          }
        }
      } catch {
        // Final fallback: call API route if present
        await fetch('/api/dashboard/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout }) });
      }
      setIsModalOpen(false);
      navigate('/dashboard');
    } catch (_) {
      // fallback local only
      const key = 'dashboard_widgets_local';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      if (!existing.includes(widgetName)) localStorage.setItem(key, JSON.stringify([...existing, widgetName].slice(0,6)));
      setIsModalOpen(false);
      navigate('/dashboard');
    }
  };

  // Initialize/destroy chart when outreach modal opens/closes (exact dataset from source)
  useEffect(() => {
    // helper to destroy all charts
    const destroyAll = () => {
      Object.values(chartInstancesRef.current || {}).forEach((inst) => {
        try { inst.destroy(); } catch (_) {}
      });
      chartInstancesRef.current = {};
      if (chartRef.current) { try { chartRef.current.destroy(); } catch (_) {}; chartRef.current = null; }
    };

    if (isModalOpen) {
      // wait for DOM
      const init = () => {
        destroyAll();
        // Initialize charts per modalWidget
        if (modalWidget === 'Reply Rate Chart') {
          const ctx = document.getElementById('chart-reply');
          if (ctx) {
            chartInstancesRef.current.reply = new Chart(ctx, {
        type: 'line',
        data: {
                labels: (modalData||[{period:'Week 1'},{period:'Week 2'},{period:'Week 3'},{period:'Week 4'}]).map(d=>d.period||''),
                datasets: [{ label: 'Reply Rate %', data: (modalData||[]).map(d=>d.replyRate||0), borderColor: '#6B46C1', backgroundColor: 'rgba(107,70,193,0.1)', borderWidth: 3, fill: true, tension: 0.4, pointBackgroundColor: '#6B46C1', pointBorderColor: '#ffffff', pointBorderWidth: 2, pointRadius: 6 }]
              },
              options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, grid: { color: '#f3f4f6' } }, x: { grid: { color: '#f3f4f6' } } }, interaction: { intersect: false, mode: 'index' } }
            });
          }
        }
        if (modalWidget === 'Revenue Forecast') {
          const ctx = document.getElementById('chart-revenue');
          if (ctx) {
            chartInstancesRef.current.revenue = new Chart(ctx, {
              type: 'line',
              data: { labels: [], datasets: [
                { label: 'Actual', data: [], borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.10)', borderWidth: 3, fill: true, tension: 0.35 },
                { label: 'Projected', data: [], borderColor: '#6B46C1', backgroundColor: 'rgba(107,70,193,0.08)', borderWidth: 3, fill: true, tension: 0.35, borderDash: [6,4] }
              ] },
              options: { responsive: true, plugins: { legend: { display: true, position: 'bottom' } }, scales: { y: { beginAtZero: true, grid: { color: '#f3f4f6' } }, x: { grid: { color: '#f3f4f6' } } } }
            });
          }
        }
        if (modalWidget === 'Win Rate KPI') {
          const ctx = document.getElementById('chart-winrate');
          if (ctx) {
            const wr = Math.round(((modalData?.[0]?.win_rate ?? 68) + Number.EPSILON)*10)/10;
            chartInstancesRef.current.winrate = new Chart(ctx, {
              type: 'doughnut',
              data: { labels: ['Won', 'Lost'], datasets: [{ data: [wr, Math.max(0, 100-wr)], backgroundColor: ['#10B981', '#E5E7EB'], borderWidth: 0 }] },
              options: { cutout: '70%', plugins: { legend: { display: false } } }
            });
          }
        }
        if (modalWidget === 'Engagement Breakdown') {
          const ctx = document.getElementById('chart-engagement');
          if (ctx) {
            chartInstancesRef.current.engagement = new Chart(ctx, {
              type: 'pie',
              data: { labels: (modalData||[{metric:'open'},{metric:'reply'},{metric:'bounce'},{metric:'click'}]).map(d=>String(d.metric||'').toUpperCase()), datasets: [{ data: (modalData||[]).map(d=>d.pct||0), backgroundColor: ['#6366F1', '#10B981', '#F59E0B', '#6B46C1'] }] },
              options: { plugins: { legend: { position: 'bottom' } } }
            });
          }
        }
        if (modalWidget === 'Pipeline Velocity') {
          const ctx = document.getElementById('chart-velocity');
          if (ctx) {
            chartInstancesRef.current.velocity = new Chart(ctx, {
              type: 'bar',
              data: { labels: (modalData||[{stage:'Applied'},{stage:'Screen'},{stage:'Interview'},{stage:'Offer'},{stage:'Hired'}]).map(d=>d.stage||''), datasets: [{ label: 'Days in Stage', data: (modalData||[]).map(d=>d.days||0), backgroundColor: '#6B46C1' }] },
              options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
            });
          }
        }
        if (modalWidget === 'Open Rate Widget') {
          const ctx = document.getElementById('chart-openrate');
          if (ctx) {
            chartInstancesRef.current.openrate = new Chart(ctx, {
              type: 'line',
              data: { labels: (modalData||[{bucket:'1'},{bucket:'2'},{bucket:'3'},{bucket:'4'}]).map(d=>d.bucket||''), datasets: [{ label: 'Open %', data: (modalData||[]).map(d=>d.openRate||0), borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.12)', fill: true, tension: 0.35 }] },
              options: { plugins: { legend: { display: false } }, responsive: true }
            });
          }
        }
        if (modalWidget === 'Conversion Trends') {
          const ctx = document.getElementById('chart-conversion');
          if (ctx) {
            chartInstancesRef.current.conversion = new Chart(ctx, {
              type: 'line',
              data: { labels: (modalData||[{quarter:'Q1'},{quarter:'Q2'},{quarter:'Q3'},{quarter:'Q4'}]).map(d=>d.quarter||''), datasets: [{ label: 'Conversion %', data: (modalData||[]).map(d=>d.conversion||0), borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.35 }] },
              options: { plugins: { legend: { display: false } }, responsive: true, scales: { y: { beginAtZero: true } } }
            });
          }
        }
        if (modalWidget === 'Activity Overview') {
          const ctx = document.getElementById('chart-activity');
          if (ctx) {
            chartInstancesRef.current.activity = new Chart(ctx, {
              type: 'bar',
              data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], datasets: [{ label: 'Activities', data: [120, 150, 90, 180, 130], backgroundColor: '#14B8A6' }] },
              options: { plugins: { legend: { display: false } }, responsive: true }
            });
          }
        }
      };
      const id = requestAnimationFrame(init);
      return () => cancelAnimationFrame(id);
    }
    // cleanup when closing
    return () => {
      if (!isModalOpen) {
        Object.values(chartInstancesRef.current || {}).forEach((inst) => { try { inst.destroy(); } catch (_) {} });
        chartInstancesRef.current = {};
        if (chartRef.current) { try { chartRef.current.destroy(); } catch (_) {}; chartRef.current = null; }
      }
    };
  }, [isModalOpen, modalWidget]);

  // Update Revenue Forecast chart when data changes
  useEffect(() => {
    if (!(isModalOpen && modalWidget === 'Revenue Forecast')) return;
    const inst = chartInstancesRef.current.revenue;
    if (!inst) return;
    const rows = Array.isArray(modalData) ? modalData : [];
    const months = Array.from(new Set(rows.map(r => String(r.month||'')))).sort();
    const sumBy = (m, projected) => rows.filter(r => String(r.month) === m && Boolean(r.projected) === projected)
      .reduce((s, r) => s + (Number(r.revenue)||0), 0);
    const actual = months.map(m => sumBy(m, false));
    const projected = months.map(m => sumBy(m, true));
    inst.data.labels = months;
    if (inst.data.datasets.length < 2) {
      inst.data.datasets = [
        { label: 'Actual', data: actual, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.10)', borderWidth: 3, fill: true, tension: 0.35 },
        { label: 'Projected', data: projected, borderColor: '#6B46C1', backgroundColor: 'rgba(107,70,193,0.08)', borderWidth: 3, fill: true, tension: 0.35, borderDash: [6,4] }
      ];
        } else {
      inst.data.datasets[0].data = actual;
      inst.data.datasets[1].data = projected;
    }
    try { inst.update(); } catch (_) {}
  }, [modalData, isModalOpen, modalWidget]);

  const renderDealsVariant = () => (
    <div id="deals-modal" className="modal-variant">
      <div id="deals-header" className="flex justify-between items-start p-6 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-purple-900">Deal Pipeline</h2>
          <p className="text-gray-600 mt-1">Explore Your Data—Filter, Export, Add to Dashboard</p>
            </div>
        <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-purple-600 transition-all duration-300 hover:rotate-90">
          <i className="fas fa-times text-xl"></i>
        </button>
          </div>

      <div id="deals-filters" className="p-6 border-b border-gray-100">
        <div className="flex flex-wrap gap-4">
          <select className="border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded-md p-2 min-w-32">
            <option>All Owners</option>
            <option>Sarah Johnson</option>
            <option>Mike Chen</option>
            <option>Lisa Rodriguez</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Sort by:</label>
            <label className="flex items-center gap-1">
              <input type="radio" name="sort" value="value" defaultChecked className="text-purple-600" />
              <span className="text-sm">Value</span>
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="sort" value="date" className="text-purple-600" />
              <span className="text-sm">Date</span>
            </label>
        </div>
          <button className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Apply</button>
        </div>
      </div>

      <div id="deals-body" className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-100 rounded-lg p-6 hover:scale-105 transition-transform cursor-pointer group">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-blue-800">Pipeline</h3>
                <div className="text-3xl font-bold text-blue-900 mt-2">${(modalData?.[0]?.pipelineValue||0).toLocaleString()}</div>
                <div className="text-blue-700 text-sm">{modalData?.[0]?.pipelineDeals||0} deals</div>
          </div>
              <i className="fas fa-funnel text-blue-600 text-xl"></i>
          </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 text-xs text-blue-800">Top deal: Enterprise Exec $20K</div>
          </div>

          <div className="bg-purple-100 rounded-lg p-6 hover:scale-105 transition-transform cursor-pointer group">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-purple-800">Best Case</h3>
                <div className="text-3xl font-bold text-purple-900 mt-2">${(modalData?.[0]?.bestCaseValue||0).toLocaleString()}</div>
                <div className="text-purple-700 text-sm">{modalData?.[0]?.bestCaseDeals||0} deals</div>
          </div>
              <i className="fas fa-star text-purple-600 text-xl"></i>
          </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 text-xs text-purple-800">Avg deal size: $4K</div>
        </div>

          <div className="bg-yellow-100 rounded-lg p-6 hover:scale-105 transition-transform cursor-pointer group">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-yellow-800">Commit</h3>
                <div className="text-3xl font-bold text-yellow-900 mt-2">${(modalData?.[0]?.commitValue||0).toLocaleString()}</div>
                <div className="text-yellow-700 text-sm">{modalData?.[0]?.commitDeals||0} deals</div>
              </div>
              <i className="fas fa-handshake text-yellow-600 text-xl"></i>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 text-xs text-yellow-800">Close rate: 85%</div>
        </div>

          <div className="bg-green-100 rounded-lg p-6 hover:scale-105 transition-transform cursor-pointer group">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-green-800">Closed Won</h3>
                <div className="text-3xl font-bold text-green-900 mt-2">${(modalData?.[0]?.closedWonValue||0).toLocaleString()}</div>
                <div className="text-green-700 text-sm">{modalData?.[0]?.closedWonDeals||0} deals</div>
              </div>
              <i className="fas fa-trophy text-green-600 text-xl"></i>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 text-xs text-green-800">This month's revenue</div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-neutral-bg rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Active Deals: {modalData?.[0]?.totalActiveDeals||0}</span>
            <span className="text-purple-900 font-semibold">Total Value: ${(modalData?.[0]?.totalValue||0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div id="deals-footer" className="p-6 border-t border-gray-200 flex justify-end gap-4">
        <button className="border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-md px-4 py-2 transition-colors">Go to Source</button>
        <button onClick={() => addWidgetToDashboard('Deal Pipeline')} className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Add to Dashboard</button>
        <div className="relative">
          <button onClick={() => setShowExportMenu((s) => !s)} className="bg-gray-600 text-white hover:bg-gray-700 rounded-md px-4 py-2 transition-colors">
            <i className="fas fa-download mr-2"></i>Export
          </button>
          {showExportMenu && (
            <div className="absolute right-0 bottom-full mb-2 bg-white shadow-lg rounded-md p-2 min-w-48">
              <a href="#" className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"><i className="fas fa-file-csv text-green-600"></i>Export as CSV</a>
              <a href="#" className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"><i className="fas fa-file-pdf text-red-600"></i>Export as PDF</a>
              <a href="#" className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"><i className="fas fa-file-image text-blue-600"></i>Export as PNG</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderJobsVariant = () => (
    <div id="jobs-modal" className="modal-variant">
      <div id="jobs-header" className="flex justify-between items-start p-6 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-purple-900">Hiring Pipeline</h2>
          <p className="text-gray-600 mt-1">Explore Your Data—Filter, Export, Add to Dashboard</p>
        </div>
        <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-purple-600 transition-all duration-300 hover:rotate-90">
          <i className="fas fa-times text-xl"></i>
        </button>
      </div>

      <div id="jobs-filters" className="p-6 border-b border-gray-100">
        <div className="flex flex-wrap gap-4">
          <select className="border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded-md p-2 min-w-48">
            <option>All Job Reqs</option>
            <option>BDD-Milwaukee</option>
            <option>Frontend-Remote</option>
            <option>Backend-NYC</option>
              </select>
          <input type="text" placeholder="Last 30 Days" className="border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded-md p-2" />
          <button className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Apply</button>
        </div>
      </div>

      <div id="jobs-body" className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500 to-purple-300 rounded-full text-white group hover:scale-105 transition-transform cursor-pointer">
            <span className="font-semibold">Applied</span>
            <span className="font-bold">342</span>
            <div className="opacity-0 group-hover:opacity-100 absolute bg-white text-gray-800 p-2 rounded shadow-md text-xs -mt-8">Conversion: 75% to next stage</div>
          </div>
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-400 to-purple-200 rounded-full text-white group hover:scale-105 transition-transform cursor-pointer">
            <span className="font-semibold">Screened</span>
            <span className="font-bold">256</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-300 to-purple-100 rounded-full text-purple-800 group hover:scale-105 transition-transform cursor-pointer">
            <span className="font-semibold">Interview</span>
            <span className="font-bold">154</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-300 to-green-100 rounded-full text-green-800 group hover:scale-105 transition-transform cursor-pointer">
            <span className="font-semibold">Offer</span>
            <span className="font-bold">86</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500 to-green-300 rounded-full text-white group hover:scale-105 transition-transform cursor-pointer">
            <span className="font-semibold">Hired</span>
            <span className="font-bold">52</span>
          </div>
        </div>

        <div className="mt-6 p-4 bg-neutral-bg rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Active Candidates: 890</span>
            <span className="text-purple-900 font-semibold">Hire Rate: 15.2%</span>
          </div>
        </div>
      </div>

      <div id="jobs-footer" className="p-6 border-t border-gray-200 flex justify-end gap-4">
        <button className="border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-md px-4 py-2 transition-colors">Go to Source</button>
        <button onClick={() => addWidgetToDashboard('Hiring Funnel')} className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Add to Dashboard</button>
        <div className="relative">
          <button onClick={() => setShowExportMenu((s) => !s)} className="bg-gray-600 text-white hover:bg-gray-700 rounded-md px-4 py-2 transition-colors">
            <i className="fas fa-download mr-2"></i>Export
                </button>
        </div>
      </div>
    </div>
  );

  const renderOutreachVariant = () => (
    <div id="outreach-modal" className="modal-variant">
      <div id="outreach-header" className="flex justify-between items-start p-6 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-purple-900">{modalWidget === 'Reply Rate Chart' ? 'Reply Rate Chart' : modalWidget}</h2>
          <p className="text-gray-600 mt-1">Explore Your Data—Filter, Export, Add to Dashboard</p>
        </div>
        <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-purple-600 transition-all duration-300 hover:rotate-90">
          <i className="fas fa-times text-xl"></i>
                </button>
              </div>

      <div id="outreach-filters" className="p-6 border-b border-gray-100">
        <div className="flex flex-wrap gap-4">
          {modalWidget !== 'Activity Overview' && (
            <select className="border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded-md p-2 min-w-48">
              <option>By Template</option>
              <option>Template A</option>
              <option>Template B</option>
              <option>Custom Template</option>
          </select>
          )}
          {modalWidget === 'Reply Rate Chart' || modalWidget === 'Open Rate Widget' ? (
            <select value={replyRange} onChange={(e)=>setReplyRange(e.target.value)} className="border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded-md p-2">
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="6m">Last 6 Months</option>
              </select>
          ) : (
            <input type="text" placeholder="Last 30 Days" className="border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded-md p-2" />
          )}
          <button className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Apply</button>
        </div>
      </div>

      <div id="outreach-body" className="p-6">
        {modalWidget === 'Reply Rate Chart' && (
            <>
            <div className="bg-white p-6 rounded-lg border">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Reply Rate Trend</h3>
                <div className="flex items-center text-green-600">
                  <i className="fas fa-arrow-up mr-1"></i>
                  <span className="font-semibold">+2.3%</span>
                </div>
              </div>
              <canvas id="chart-reply" width="400" height="200"></canvas>
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-purple-50 p-4 rounded-lg text-center"><div className="text-2xl font-bold text-purple-900">{(replySummary.avgReplyRate||0).toFixed(1)}%</div><div className="text-sm text-purple-700">Average Reply Rate</div></div>
              <div className="bg-blue-50 p-4 rounded-lg text-center"><div className="text-2xl font-bold text-blue-900">{(replySummary.openRate||0).toFixed(1)}%</div><div className="text-sm text-blue-700">Open Rate</div></div>
              <div className="bg-green-50 p-4 rounded-lg text-center"><div className="text-2xl font-bold text-green-900">{(replySummary.totalSent||0).toLocaleString('en-US')}</div><div className="text-sm text-green-700">Total Sent</div></div>
            </div>
            </>
          )}

        {modalWidget === 'Open Rate Widget' && (
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Open Rate</h3>
              <div className="flex items-center text-blue-600">
                <i className="fas fa-arrow-up mr-1"></i>
                <span className="font-semibold">+1.8%</span>
                </div>
                </div>
            <canvas id="chart-openrate" width="400" height="200"></canvas>
              </div>
        )}

        {modalWidget === 'Conversion Trends' && (
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Conversion Trends</h3>
              <div className="flex items-center text-green-600">
                <i className="fas fa-arrow-up mr-1"></i>
                <span className="font-semibold">+0.6%</span>
          </div>
                </div>
            <canvas id="chart-conversion" width="400" height="200"></canvas>
                </div>
        )}

        {modalWidget === 'Activity Overview' && (
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Activity Overview</h3>
              <div className="flex items-center text-teal-600">
                <i className="fas fa-chart-bar mr-1"></i>
                <span className="font-semibold">Weekly</span>
              </div>
            </div>
            <canvas id="chart-activity" width="400" height="200"></canvas>
          </div>
        )}
            </div>

      <div id="outreach-footer" className="p-6 border-t border-gray-200 flex justify-end gap-4">
        <button className="border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-md px-4 py-2 transition-colors">Go to Source</button>
        <button onClick={() => addWidgetToDashboard(modalWidget || 'Reply Rate Chart')} className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Add to Dashboard</button>
        <div className="relative">
          <button onClick={() => setShowExportMenu((s) => !s)} className="bg-gray-600 text-white hover:bg-gray-700 rounded-md px-4 py-2 transition-colors">
            <i className="fas fa-download mr-2"></i>Export
          </button>
          </div>
      </div>
    </div>
  );

  // Revenue Forecast (Deals) - line chart
  const [revenueMode, setRevenueMode] = useState('paid'); // 'paid'|'closewon'|'blended'
  const [revenueHorizon, setRevenueHorizon] = useState('eoy'); // 'eoy'|'12m'
  const [revenueSummary, setRevenueSummary] = useState({ nextMonth: 0, quarter: 0, ytd: 0 });
  const [replySummary, setReplySummary] = useState({ avgReplyRate: 0, openRate: 0, totalSent: 0 });
  const [replyRange, setReplyRange] = useState('30d'); // '30d' | '90d' | '6m'

  useEffect(() => {
    const refetch = async () => {
      if (!(isModalOpen && modalWidget === 'Revenue Forecast')) return;
      const fromProcess = (typeof process !== 'undefined' && process.env) ? (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL) : '';
      const fromVite = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_BACKEND_URL) : '';
      const fromWindow = (typeof window !== 'undefined' && window.__BACKEND_URL__) ? window.__BACKEND_URL__ : '';
      const base = String(fromProcess || fromVite || fromWindow || '').replace(/\/$/, '');
      if (!base) { setModalData([]); setRevenueSummary({ nextMonth: 0, quarter: 0, ytd: 0 }); return; }
      const toMonthKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const now = new Date();

      try {
        // Helper to compute summary metrics
        const computeSummary = (combined) => {
          const idx = new Map(combined.map((r) => [r.month, r]));
          const nm = new Date(now.getFullYear(), now.getMonth()+1, 1);
          const q2 = new Date(now.getFullYear(), now.getMonth()+2, 1);
          const q3 = new Date(now.getFullYear(), now.getMonth()+3, 1);
          const keys = [toMonthKey(nm), toMonthKey(q2), toMonthKey(q3)];
          const nextMonth = (idx.get(keys[0])?.revenue || 0);
          const quarter = keys.reduce((s,k)=> s + (idx.get(k)?.revenue || 0), 0);
          const ytd = combined
            .filter(r => Number(r.month.split('-')[0]) === now.getFullYear() && Number(r.month.split('-')[1]) <= (now.getMonth()+1) && !r.projected)
            .reduce((s,r)=> s + (r.revenue||0), 0);
          return { nextMonth, quarter, ytd };
        };

        const useCloseWon = async () => {
          const [mRes, pRes] = await Promise.all([
            apiFetch(`${base}/api/revenue/closewon-monthly?range=1y`),
            apiFetch(`${base}/api/revenue/closewon-projected?horizon=${encodeURIComponent(revenueHorizon)}`),
          ]);
          const m = await mRes.json();
          const p = await pRes.json();
          const actual = (m.series||[]).map(r=>({ month: r.month, revenue: Number(r.revenue)||0 }));
          const projected = (p.series||[]).filter(r=>r.projected).map(r=>({ month: r.month, revenue: Number(r.revenue)||0, projected: true }));
          const combined = [...actual, ...projected];
          setModalData(combined);
          setRevenueSummary(computeSummary(combined));
        };

        if (revenueMode === 'closewon') { await useCloseWon(); return; }
        if (revenueMode === 'blended') {
          // Combine paid actuals with stage-weighted projections
          const [paidRes, projRes] = await Promise.all([
            apiFetch(`${base}/api/revenue/monthly`),
            apiFetch(`${base}/api/revenue/monthly-projected`),
          ]);
          const paid = await paidRes.json();
          const proj = await projRes.json();
          const actual = (paid||[]).map(r=>({ month: r.month, revenue: Number(r.paid)||0 }));
          const projected = (proj||[]).map(r=>({ month: r.month, revenue: Number(r.forecasted)||0, projected: true }));
          const combined = [...actual, ...projected];
          setModalData(combined);
          setRevenueSummary(computeSummary(combined));
          return;
        }

        // Paid mode with fallback to Close Won
        const [paidRes, projRes] = await Promise.all([
          apiFetch(`${base}/api/revenue/monthly`),
          apiFetch(`${base}/api/revenue/monthly-projected`),
        ]);
        const paid = await paidRes.json();
        const proj = await projRes.json();
        const actual = (paid||[]).map(r=>({ month: r.month, revenue: Number(r.paid)||0 }));
        const projected = (proj||[]).map(r=>({ month: r.month, revenue: Number(r.forecasted)||0, projected: true }));
        const sumPaid = actual.reduce((s,r)=>s+(r.revenue||0),0);
        if (sumPaid === 0) { await useCloseWon(); return; }
        const combined = [...actual, ...projected];
        setModalData(combined);
        setRevenueSummary(computeSummary(combined));
      } catch {
        setModalData([]);
        setRevenueSummary({ nextMonth: 0, quarter: 0, ytd: 0 });
      }
    };
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revenueMode, revenueHorizon, isModalOpen, modalWidget]);

  // Engagement Breakdown – load from backend performance (or Supabase fallback)
  useEffect(() => {
    const loadEngagement = async () => {
      if (!(isModalOpen && modalWidget === 'Engagement Breakdown')) return;
      try {
        const fromProcess = (typeof process !== 'undefined' && process.env) ? (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL) : '';
        const fromVite = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_BACKEND_URL) : '';
        const fromWindow = (typeof window !== 'undefined' && window.__BACKEND_URL__) ? window.__BACKEND_URL__ : '';
        const base = String(fromProcess || fromVite || fromWindow || '').replace(/\/$/, '');
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const hdrs = token ? { Authorization: `Bearer ${token}` } : {};

        let payload = null;
        if (base) {
          const uid = session?.user?.id || '';
          const r = await fetch(`${base}/api/campaigns/all/performance?user_id=${encodeURIComponent(uid)}`, { headers: hdrs });
          const ct = r.headers?.get?.('content-type') || '';
          if (r.ok && ct.includes('application/json')) {
            const p = await r.json();
            const sent = Number(p.sent || 0);
            const opens = Number(p.opens || 0);
            const replies = Number(p.replies || 0);
            const conversions = Number(p.conversions || 0);
            const openPct = sent ? (opens / sent) * 100 : 0;
            const replyPct = sent ? (replies / sent) * 100 : 0;
            const bouncePct = sent ? (Math.max(0, sent - opens) / sent) * 100 : 0; // proxy if bounce unavailable
            const clickPct = sent ? (conversions / sent) * 100 : 0; // proxy if clicks unavailable
            payload = [
              { metric: 'open', pct: Math.round(openPct * 10) / 10 },
              { metric: 'reply', pct: Math.round(replyPct * 10) / 10 },
              { metric: 'bounce', pct: Math.round(bouncePct * 10) / 10 },
              { metric: 'click', pct: Math.round(clickPct * 10) / 10 },
            ];
          }
        }

        if (!payload) {
          const { data: rows } = await supabase
            .from('email_events')
            .select('event_type,event_timestamp')
            .eq('user_id', session?.user?.id)
            .gte('event_timestamp', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());
          const agg = { open: 0, reply: 0, bounce: 0, click: 0 };
          (rows || []).forEach((r) => { const ev = r && r.event_type; if (ev && (ev in agg)) agg[ev] = (agg[ev] || 0) + 1; });
          const total = Object.values(agg).reduce((a, b) => a + b, 0) || 1;
          payload = Object.entries(agg).map(([k, v]) => ({ metric: k, pct: Math.round(((v / total) * 1000)) / 10 }));
        }

        setModalData(payload);
      } catch {
        setModalData([
          { metric: 'open', pct: 0 },
          { metric: 'reply', pct: 0 },
          { metric: 'bounce', pct: 0 },
          { metric: 'click', pct: 0 },
        ]);
      }
    };
    loadEngagement();
  }, [isModalOpen, modalWidget]);

  // Update Engagement chart when data arrives
  useEffect(() => {
    if (!(isModalOpen && modalWidget === 'Engagement Breakdown')) return;
    const inst = (chartInstancesRef.current || {}).engagement;
    if (!inst || !Array.isArray(modalData)) return;
    const labels = (modalData || []).map((d) => String((d && d.metric) || '').toUpperCase());
    const vals = (modalData || []).map((d) => Number((d && d.pct) || 0));
    inst.data.labels = labels;
    if (inst.data.datasets && inst.data.datasets[0]) inst.data.datasets[0].data = vals;
    try { inst.update(); } catch {}
  }, [modalData, isModalOpen, modalWidget]);

  // Update Reply Rate chart when data arrives
  useEffect(() => {
    if (!(isModalOpen && modalWidget === 'Reply Rate Chart')) return;
    const inst = (chartInstancesRef.current || {}).reply;
    if (!inst || !Array.isArray(modalData)) return;
    const labels = (modalData || []).map((d) => String((d && d.period) || ''));
    const vals = (modalData || []).map((d) => Number((d && d.replyRate) || 0));
    inst.data.labels = labels;
    if (inst.data.datasets && inst.data.datasets[0]) inst.data.datasets[0].data = vals;
    try { inst.update(); } catch {}
  }, [modalData, isModalOpen, modalWidget]);

  // Open Rate Widget – compute weekly series from email_events (same source as reply chart)
  useEffect(() => {
    const loadOpenSeries = async () => {
      if (!(isModalOpen && modalWidget === 'Open Rate Widget')) return;
      try {
        const rangeDays = replyRange==='30d' ? 30 : replyRange==='90d' ? 90 : 180;
        const { data: rows } = await supabase
          .from('email_events')
          .select('event_timestamp,event_type')
          .gte('event_timestamp', new Date(Date.now() - rangeDays*24*3600*1000).toISOString());
        const weekMs = 7*24*3600*1000;
        const bucketCount = replyRange==='30d' ? 4 : replyRange==='90d' ? 12 : 24;
        const labels = Array.from({ length: bucketCount }, (_, i) => `Week ${i+1}`);
        const sent = Array.from({ length: bucketCount }, () => 0);
        const opens = Array.from({ length: bucketCount }, () => 0);
        (rows||[]).forEach((r) => {
          const ts = r && r.event_timestamp ? new Date(r.event_timestamp) : null; if (!ts) return;
          const diff = Date.now() - ts.getTime();
          const idxFromEnd = Math.min(bucketCount-1, Math.floor(diff / weekMs));
          const bucket = bucketCount - 1 - idxFromEnd; if (bucket < 0 || bucket >= bucketCount) return;
          const et = r && r.event_type;
          if (et === 'sent') sent[bucket]++; if (et === 'open') opens[bucket]++;
        });
        const series = labels.map((name, i) => ({ period: name, openRate: sent[i] ? Math.round((opens[i]/sent[i])*1000)/10 : 0 }));
        setModalData(series);
      } catch { setModalData([]); }
    };
    loadOpenSeries();
  }, [isModalOpen, modalWidget, replyRange]);

  // Update Open Rate chart when data arrives
  useEffect(() => {
    if (!(isModalOpen && modalWidget === 'Open Rate Widget')) return;
    const inst = (chartInstancesRef.current || {}).openrate;
    if (!inst || !Array.isArray(modalData)) return;
    const labels = (modalData || []).map((d) => String((d && d.period) || ''));
    const vals = (modalData || []).map((d) => Number((d && d.openRate) || 0));
    inst.data.labels = labels;
    if (inst.data.datasets && inst.data.datasets[0]) inst.data.datasets[0].data = vals;
    try { inst.update(); } catch {}
  }, [modalData, isModalOpen, modalWidget]);

  // Pipeline Velocity – update chart when data arrives
  useEffect(() => {
    if (!(isModalOpen && modalWidget === 'Pipeline Velocity')) return;
    const inst = (chartInstancesRef.current || {}).velocity;
    if (!inst || !Array.isArray(modalData)) return;
    const labels = (modalData || []).map((d)=>String((d && d.stage) || ''));
    const vals = (modalData || []).map((d)=>Number((d && d.days) || 0));
    inst.data.labels = labels;
    if (inst.data.datasets && inst.data.datasets[0]) inst.data.datasets[0].data = vals;
    try { inst.update(); } catch {}
  }, [modalData, isModalOpen, modalWidget]);

  // Reply Rate Chart – fetch performance summary for tiles
  useEffect(() => {
    const loadReplySummary = async () => {
      if (!(isModalOpen && modalWidget === 'Reply Rate Chart')) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const rangeDays = replyRange==='30d' ? 30 : replyRange==='90d' ? 90 : 180;
        const { data: rows } = await supabase
          .from('email_events')
          .select('event_timestamp,event_type')
          .eq('user_id', session?.user?.id)
          .gte('event_timestamp', new Date(Date.now() - rangeDays*24*3600*1000).toISOString());
        let sent = 0, opens = 0, replies = 0;
        (rows||[]).forEach((r)=>{
          const t = r && r.event_type;
          if (t==='sent') sent++;
          else if (t==='open') opens++;
          else if (t==='reply') replies++;
        });
        const avgReplyRate = sent ? (replies/sent)*100 : 0;
        const openRate = sent ? (opens/sent)*100 : 0;
        setReplySummary({ avgReplyRate, openRate, totalSent: sent });
      } catch {}
    };
    loadReplySummary();
  }, [isModalOpen, modalWidget, replyRange]);

  // Reply Rate Chart – compute series locally (fallback if API returns HTML)
  useEffect(() => {
    const loadReplySeries = async () => {
      if (!(isModalOpen && modalWidget === 'Reply Rate Chart')) return;
      try {
        // Try API route first
        try {
          const r = await apiFetch('/api/widgets/reply-rate');
          const j = await r.json();
          if (Array.isArray(j.data)) { setModalData(j.data); return; }
        } catch {}
        // Fallback to Supabase email_events aggregation (last 4 weeks)
        const rangeDays = replyRange==='30d' ? 30 : replyRange==='90d' ? 90 : 180;
        const { data: rows } = await supabase
          .from('email_events')
          .select('event_timestamp,event_type')
          .gte('event_timestamp', new Date(Date.now() - rangeDays*24*3600*1000).toISOString());
        const weekMs = 7*24*3600*1000;
        const bucketCount = replyRange==='30d' ? 4 : replyRange==='90d' ? 12 : 24;
        const labels = Array.from({ length: bucketCount }, (_, i) => `Week ${i+1}`);
        const sent = Array.from({ length: bucketCount }, () => 0);
        const replies = Array.from({ length: bucketCount }, () => 0);
        (rows||[]).forEach((r) => {
          const ts = r && r.event_timestamp ? new Date(r.event_timestamp) : null;
          if (!ts) return;
          const diff = Date.now() - ts.getTime();
          const idxFromEnd = Math.min(bucketCount-1, Math.floor(diff / weekMs));
          const bucket = bucketCount - 1 - idxFromEnd; // oldest -> newest
          if (bucket < 0 || bucket >= bucketCount) return;
          const et = r && r.event_type;
          if (et === 'sent') sent[bucket]++;
          if (et === 'reply') replies[bucket]++;
        });
        const series = labels.map((name, i) => ({ period: name, replyRate: sent[i] ? Math.round((replies[i]/sent[i])*1000)/10 : 0 }));
        setModalData(series);
      } catch { setModalData([]); }
    };
    loadReplySeries();
  }, [isModalOpen, modalWidget, replyRange]);
  // Deal Pipeline modal data loader – avoid /api/widgets route to prevent HTML responses
  useEffect(() => {
    const loadDealPipeline = async () => {
      if (!(isModalOpen && modalWidget === 'Deal Pipeline')) return;
      try {
        const fromProcess = (typeof process !== 'undefined' && process.env) ? (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL) : '';
        const fromVite = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_BACKEND_URL) : '';
        const fromWindow = (typeof window !== 'undefined' && window.__BACKEND_URL__) ? window.__BACKEND_URL__ : '';
        const base = String(fromProcess || fromVite || fromWindow || '').replace(/\/$/, '');
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const hdrs = token ? { Authorization: `Bearer ${token}` } : {};

        let rows = [];
        if (base) {
          const r = await fetch(`${base}/api/opportunity-pipeline`, { headers: hdrs });
          rows = r.ok ? await r.json() : [];
        }
        if (!Array.isArray(rows) || !rows.length) {
          // Supabase fallback with same scope
          const { data: me } = await supabase.from('users').select('role, team_id').eq('id', session?.user?.id).maybeSingle();
          const role = String((me||{}).role||'').toLowerCase();
          const teamId = (me||{}).team_id || null;
          const isSuper = ['super_admin','superadmin'].includes(role);
          const isTeamAdmin = role === 'team_admin';
          let baseQ = supabase.from('opportunities').select('stage,value,owner_id');
          if (!isSuper) {
            if (isTeamAdmin && teamId) {
              const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', teamId);
              const ids = (teamUsers||[]).map(u=>u.id);
              baseQ = baseQ.in('owner_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
            } else {
              baseQ = baseQ.eq('owner_id', session?.user?.id);
            }
          }
          const { data: opps } = await baseQ;
          const stageOf = (o)=>{ const s=String(o.stage||''); return ['Closed Won','Won'].includes(s)?'Close Won':s; };
          const agg = (st)=> (opps||[]).filter(o=>stageOf(o)===st);
          rows = [
            { stage:'Pipeline', items: agg('Pipeline'), total: agg('Pipeline').reduce((s,o)=>s+(Number(o.value)||0),0) },
            { stage:'Best Case', items: agg('Best Case'), total: agg('Best Case').reduce((s,o)=>s+(Number(o.value)||0),0) },
            { stage:'Commit', items: agg('Commit'), total: agg('Commit').reduce((s,o)=>s+(Number(o.value)||0),0) },
            { stage:'Close Won', items: agg('Close Won'), total: agg('Close Won').reduce((s,o)=>s+(Number(o.value)||0),0) },
          ];
        }
        const get = (name)=> rows.find(r=>String(r.stage||'')===name) || { total:0, items:[] };
        const payload = [{
          pipelineValue: Number(get('Pipeline').total||0),
          bestCaseValue: Number(get('Best Case').total||0),
          commitValue: Number(get('Commit').total||0),
          closedWonValue: Number((get('Close Won').total||0) || (get('Closed Won').total||0)),
          pipelineDeals: (get('Pipeline').items||[]).length,
          bestCaseDeals: (get('Best Case').items||[]).length,
          commitDeals: (get('Commit').items||[]).length,
          closedWonDeals: (get('Close Won').items||[]).length || (get('Closed Won').items||[]).length,
          totalActiveDeals: ['Pipeline','Best Case','Commit'].reduce((s,k)=> s + ((get(k).items||[]).length), 0),
          totalValue: ['Pipeline','Best Case','Commit','Close Won'].reduce((s,k)=> s + Number((get(k).total||0)), 0)
        }];
        setModalData(payload);
      } catch { setModalData([{ pipelineValue:0,bestCaseValue:0,commitValue:0,closedWonValue:0,pipelineDeals:0,bestCaseDeals:0,commitDeals:0,closedWonDeals:0,totalActiveDeals:0,totalValue:0 }]); }
    };
    loadDealPipeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, modalWidget]);

  const renderRevenueForecast = () => (
    <div className="modal-variant">
      <div className="flex justify-between items-start p-6 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-purple-900">Revenue Forecast</h2>
          <p className="text-gray-600 mt-1">Projected revenue based on pipeline and historical close rates</p>
            </div>
        <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-purple-600 transition-all duration-300 hover:rotate-90"><i className="fas fa-times text-xl"></i></button>
      </div>
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="text-sm text-gray-600">Source:</label>
          <select className="border rounded-md p-2 text-sm" value={revenueMode} onChange={e=>setRevenueMode(e.target.value)}>
            <option value="paid">Paid Invoices</option>
            <option value="closewon">Close Won Deals</option>
            <option value="blended">Blended (Stage-Weighted)</option>
          </select>
          <label className="text-sm text-gray-600 ml-2">Horizon:</label>
          <select className="border rounded-md p-2 text-sm" value={revenueHorizon} onChange={e=>setRevenueHorizon(e.target.value)}>
            <option value="eoy">Pace to End of Year</option>
            <option value="12m">Rolling 12 Months</option>
          </select>
        </div>
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">6-Month Forecast</h3>
            <div className="flex items-center text-purple-600">
              <i className="fas fa-arrow-up mr-1"></i>
              <span className="font-semibold">+18%</span>
            </div>
          </div>
          <canvas id="chart-revenue" width="400" height="220"></canvas>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-50 p-4 rounded-lg text-center"><div className="text-2xl font-bold text-purple-900">{revenueSummary.nextMonth.toLocaleString('en-US',{style:'currency',currency:'USD'})}</div><div className="text-sm text-purple-700">Next Month</div></div>
          <div className="bg-blue-50 p-4 rounded-lg text-center"><div className="text-2xl font-bold text-blue-900">{revenueSummary.quarter.toLocaleString('en-US',{style:'currency',currency:'USD'})}</div><div className="text-sm text-blue-700">Quarter</div></div>
          <div className="bg-green-50 p-4 rounded-lg text-center"><div className="text-2xl font-bold text-green-900">{revenueSummary.ytd.toLocaleString('en-US',{style:'currency',currency:'USD'})}</div><div className="text-sm text-green-700">Year to Date</div></div>
        </div>
      </div>
      <div className="p-6 border-t border-gray-200 flex justify-end gap-4">
        <button className="border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-md px-4 py-2 transition-colors">Go to Source</button>
        <button onClick={() => addWidgetToDashboard('Revenue Forecast')} className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Add to Dashboard</button>
      </div>
    </div>
  );

  // Win Rate KPI (Deals) - donut KPI
  const renderWinRateKPI = () => (
    <div className="modal-variant">
      <div className="flex justify-between items-start p-6 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-purple-900">Win Rate KPI</h2>
          <p className="text-gray-600 mt-1">Won vs lost distribution and trend</p>
        </div>
        <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-purple-600 transition-all duration-300 hover:rotate-90"><i className="fas fa-times text-xl"></i></button>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="bg-white p-6 rounded-lg border flex items-center justify-center">
          <div className="relative w-56 h-56">
            <canvas id="chart-winrate" width="224" height="224"></canvas>
            <div className="absolute inset-0 flex items-center justify-center">
              <div>
                <div className="text-3xl font-bold text-green-600 text-center">68%</div>
                <div className="text-xs text-gray-500 text-center">Win Rate</div>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg"><span className="text-green-800 font-medium">Won</span><span className="text-green-900 font-semibold">34</span></div>
          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"><span className="text-gray-700 font-medium">Lost</span><span className="text-gray-900 font-semibold">16</span></div>
          <div className="flex items-center justify-between bg-purple-50 p-3 rounded-lg"><span className="text-purple-800 font-medium">In Pipeline</span><span className="text-purple-900 font-semibold">27</span></div>
        </div>
      </div>
      <div className="p-6 border-t border-gray-200 flex justify-end gap-4">
        <button className="border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-md px-4 py-2 transition-colors">Go to Source</button>
        <button onClick={() => addWidgetToDashboard('Win Rate KPI')} className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Add to Dashboard</button>
      </div>
    </div>
  );

  // Engagement Breakdown (Deals) - pie with legend
  const renderEngagementBreakdown = () => (
    <div className="modal-variant">
      <div className="flex justify-between items-start p-6 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-purple-900">Engagement Breakdown</h2>
          <p className="text-gray-600 mt-1">Distribution of engagement events</p>
        </div>
        <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-purple-600 transition-all duration-300 hover:rotate-90"><i className="fas fa-times text-xl"></i></button>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="bg-white p-6 rounded-lg border flex items-center justify-center"><canvas id="chart-engagement" width="260" height="260"></canvas></div>
        <div className="space-y-2">
          {(() => {
            const getPct = (k) => {
              const row = (Array.isArray(modalData) ? modalData : []).find((d) => String(d && d.metric) === k);
              const v = Number(row && row.pct) || 0;
              return `${Math.round(v * 10) / 10}%`;
            };
            return (
              <>
                <div className="flex items-center justify-between"><span className="text-indigo-700 font-medium">Opens</span><span className="text-gray-900 font-semibold">{getPct('open')}</span></div>
                <div className="flex items-center justify-between"><span className="text-green-700 font-medium">Replies</span><span className="text-gray-900 font-semibold">{getPct('reply')}</span></div>
                <div className="flex items-center justify-between"><span className="text-amber-700 font-medium">Bounces</span><span className="text-gray-900 font-semibold">{getPct('bounce')}</span></div>
                <div className="flex items-center justify-between"><span className="text-purple-700 font-medium">Clicks</span><span className="text-gray-900 font-semibold">{getPct('click')}</span></div>
              </>
            );
          })()}
        </div>
      </div>
      <div className="p-6 border-t border-gray-200 flex justify-end gap-4">
        <button className="border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-md px-4 py-2 transition-colors">Go to Source</button>
        <button onClick={() => addWidgetToDashboard('Engagement Breakdown')} className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Add to Dashboard</button>
      </div>
    </div>
  );

  // Candidate Flow Viz (Jobs) - simplified staged bars
  const renderCandidateFlowViz = () => (
    <div className="modal-variant">
      <div className="flex justify-between items-start p-6 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-purple-900">Candidate Flow Viz</h2>
          <p className="text-gray-600 mt-1">Volume across stages</p>
        </div>
        <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-purple-600 transition-all duration-300 hover:rotate-90"><i className="fas fa-times text-xl"></i></button>
      </div>
      <div className="p-6 space-y-3">
        {(() => {
          const rows = Array.isArray(modalData) && modalData.length ? modalData : [
            { stage: 'Applied', value: 0 },
            { stage: 'Screened', value: 0 },
            { stage: 'Interview', value: 0 },
            { stage: 'Offer', value: 0 },
            { stage: 'Hired', value: 0 },
          ];
          const color = (name) => name==='Hired' || name==='Offer' ? ['from-green-500','to-green-300','text-white'] : name==='Applied' ? ['from-purple-500','to-purple-300','text-white'] : name==='Screened' ? ['from-purple-400','to-purple-200','text-white'] : ['from-purple-300','to-purple-100','text-purple-800'];
          return rows.map((s) => {
            const [from,to,text] = color(s.stage);
            return (
              <div key={s.stage} className={`flex items-center justify-between p-4 bg-gradient-to-r ${from} ${to} rounded-full ${text}`}>
                <span className="font-semibold">{s.stage}</span>
                <span className="font-bold">{s.value}</span>
              </div>
            );
          });
        })()}
      </div>
      <div className="p-6 border-t border-gray-200 flex justify-end gap-4">
        <button className="border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-md px-4 py-2 transition-colors">Go to Source</button>
        <button onClick={() => addWidgetToDashboard('Candidate Flow Viz')} className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Add to Dashboard</button>
      </div>
    </div>
  );

  // Pipeline Velocity (Jobs) - bar chart
  const renderPipelineVelocity = () => (
    <div className="modal-variant">
      <div className="flex justify-between items-start p-6 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-purple-900">Pipeline Velocity</h2>
          <p className="text-gray-600 mt-1">Average days per stage</p>
        </div>
        <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-purple-600 transition-all duration-300 hover:rotate-90"><i className="fas fa-times text-xl"></i></button>
      </div>
      <div className="p-6">
        <div className="bg-white p-6 rounded-lg border"><canvas id="chart-velocity" width="400" height="220"></canvas></div>
      </div>
      <div className="p-6 border-t border-gray-200 flex justify-end gap-4">
        <button className="border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-md px-4 py-2 transition-colors">Go to Source</button>
        <button onClick={() => addWidgetToDashboard('Pipeline Velocity')} className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Add to Dashboard</button>
      </div>
    </div>
  );

  // Team Performance (Jobs) - table
  const renderTeamPerformance = () => (
    <div className="modal-variant">
      <div className="flex justify-between items-start p-6 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-purple-900">Team Performance</h2>
          <p className="text-gray-600 mt-1">Key metrics by recruiter</p>
        </div>
        <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-purple-600 transition-all duration-300 hover:rotate-90"><i className="fas fa-times text-xl"></i></button>
      </div>
      <div className="p-6 overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Opens</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Replies</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hires</th>
                  </tr>
                </thead>
          <tbody className="divide-y">
            {[
              { name: 'Sarah Johnson', sent: 420, opens: 330, replies: 88, hires: 6 },
              { name: 'Mike Chen', sent: 380, opens: 295, replies: 72, hires: 5 },
              { name: 'Lisa Rodriguez', sent: 410, opens: 320, replies: 81, hires: 7 },
            ].map((r) => (
              <tr key={r.name} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-800">{r.name}</td>
                <td className="px-4 py-2">{r.sent}</td>
                <td className="px-4 py-2">{r.opens}</td>
                <td className="px-4 py-2">{r.replies}</td>
                <td className="px-4 py-2">{r.hires}</td>
                      </tr>
            ))}
                </tbody>
              </table>
            </div>
      <div className="p-6 border-t border-gray-200 flex justify-end gap-4">
        <button className="border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-md px-4 py-2 transition-colors">Go to Source</button>
        <button onClick={() => addWidgetToDashboard('Team Performance')} className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Add to Dashboard</button>
        </div>
    </div>
  );

  return (
    <div className="bg-gray-50 min-h-screen">
      <main id="main-content" className="flex-1 flex flex-col overflow-hidden">
        <header id="header" className="bg-white border-b border-gray-200 p-6">
            <div className="flex items-center justify-between">
                          <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics & Widgets</h1>
              <p className="text-gray-600 mt-1">Browse and add insights to your dashboard</p>
              <p className="text-purple-600 text-sm mt-2 font-medium">Unlock insights with widgets—customize or let REX build for you!</p>
                          </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input type="text" placeholder="Search widgets..." className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                <i className="fa-solid fa-search absolute left-3 top-3 text-gray-400"></i>
                        </div>
              <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                <i className="fa-solid fa-plus mr-2"></i>Create Custom
              </button>
          </div>
          </div>
        </header>

        <div id="content-area" className="flex-1 overflow-y-auto p-6">
          <div id="tabs-container" className="mb-8">
            <nav className="flex space-x-8 border-b border-gray-200">
              <button
                className={`pb-4 px-1 font-semibold text-sm border-b-2 ${activeTab === 'deals' ? 'text-purple-700 border-purple-600' : 'text-gray-500 hover:text-gray-700 border-transparent hover:border-gray-300'}`}
                onClick={() => setActiveTab('deals')}
                data-tab="deals"
              >
                <i className="fa-solid fa-dollar-sign mr-2"></i>Deals
              </button>
              <button
                className={`pb-4 px-1 font-semibold text-sm border-b-2 ${activeTab === 'jobs' ? 'text-purple-700 border-purple-600' : 'text-gray-500 hover:text-gray-700 border-transparent hover:border-gray-300'}`}
                onClick={() => setActiveTab('jobs')}
                data-tab="jobs"
              >
                <i className="fa-solid fa-briefcase mr-2"></i>Jobs
              </button>
              <button
                className={`pb-4 px-1 font-semibold text-sm border-b-2 ${activeTab === 'outreach' ? 'text-purple-700 border-purple-600' : 'text-gray-500 hover:text-gray-700 border-transparent hover:border-gray-300'}`}
                onClick={() => setActiveTab('outreach')}
                data-tab="outreach"
              >
                <i className="fa-solid fa-paper-plane mr-2"></i>Outreach
              </button>
              <button
                className={`pb-4 px-1 font-semibold text-sm border-b-2 ${activeTab === 'rex' ? 'text-purple-700 border-purple-600' : 'text-purple-600 hover:text-purple-700 border-transparent hover:border-purple-300'}`}
                onClick={() => setActiveTab('rex')}
                data-tab="rex"
              >
                <i className="fa-solid fa-robot mr-2"></i>REX Templates
              </button>
            </nav>
            </div>

          <div id="widgets-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {widgets.map((widget) => (
              <div key={widget.name} className="widget-card bg-white rounded-lg shadow-md p-6 cursor-pointer" data-widget={widget.name}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-purple-900">{widget.name}</h3>
                  <button className="text-gray-400 hover:text-gray-600 hover:rotate-90 transition-transform">
                    <i className="fa-solid fa-cog"></i>
                  </button>
                </div>
                <div className={`h-32 bg-gradient-to-r from-${widget.color}-100 to-${widget.color}-200 rounded-lg mb-4 flex items-center justify-center`}>
                  <i className={`fa-solid ${widget.icon} text-4xl text-${widget.color}-600`}></i>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => addWidgetToDashboard(widget.name)} className="flex-1 bg-purple-600 text-white py-2 px-3 rounded-lg text-sm hover:bg-purple-700 transition-colors">
                    <i className="fa-solid fa-plus mr-1"></i>Add to Dashboard
                  </button>
                  <button
                    className="px-3 py-2 border border-purple-300 text-purple-600 rounded-lg text-sm hover:bg-purple-50 transition-colors"
                    onClick={(e) => { e.stopPropagation(); openModal(widget.name); }}
                  >
                    <i className="fa-solid fa-expand mr-1"></i>View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <button id="help-button" className="fixed bottom-6 right-6 bg-purple-600 text-white w-14 h-14 rounded-full shadow-lg hover:bg-purple-700 transition-colors flex items-center justify-center z-50">
        <i className="fa-solid fa-question text-xl"></i>
      </button>

      {isModalOpen && (
        <div id="modal-overlay" className="fixed inset-0 bg-black/50 modal z-40" onClick={(e) => { if (e.target === e.currentTarget) { setIsModalOpen(false); setShowExportMenu(false); } }}>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div id="modal-content" className={`bg-white rounded-xl shadow-2xl w-full md:w-3/4 lg:w-2/3 max-w-6xl max-h-[90vh] overflow-auto transform transition-transform duration-300 ${isModalOpen ? 'scale-100' : 'scale-95'}`}>
              {/* Render per-widget redesigns */}
              {modalWidget === 'Deal Pipeline' && renderDealsVariant()}
              {modalWidget === 'Hiring Funnel' && renderJobsVariant()}
              {['Reply Rate Chart','Open Rate Widget','Conversion Trends','Activity Overview'].includes(modalWidget) && renderOutreachVariant()}
              {modalWidget === 'Revenue Forecast' && renderRevenueForecast()}
              {modalWidget === 'Win Rate KPI' && renderWinRateKPI()}
              {modalWidget === 'Engagement Breakdown' && renderEngagementBreakdown()}
              {modalWidget === 'Candidate Flow Viz' && renderCandidateFlowViz()}
              {modalWidget === 'Pipeline Velocity' && renderPipelineVelocity()}
              {modalWidget === 'Team Performance' && renderTeamPerformance()}
              {/* Fallbacks by category if unknown */}
              {!modalWidget && modalType === 'deals' && renderDealsVariant()}
              {!modalWidget && modalType === 'jobs' && renderJobsVariant()}
              {!modalWidget && modalType === 'outreach' && renderOutreachVariant()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 