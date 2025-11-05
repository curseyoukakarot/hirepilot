import React, { useRef, useState, useEffect } from 'react';
import { Chart } from 'chart.js/auto';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import QuickActionsRexCard from '../components/QuickActionsRexCard';
import { usePlan } from '../context/PlanContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Helper function to generate avatar URL
const getAvatarUrl = (name) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

export default function Dashboard() {
  const chartRef = useRef(null);
  const dashChartsRef = useRef({});
  const [user, setUser] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [rexEnabled, setRexEnabled] = useState(false);
  const [customWidgets, setCustomWidgets] = useState([]);
  const navigate = useNavigate();
  const { isFree } = usePlan();

  useEffect(() => {
    const fetchUserAndMetrics = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        // If this is a guest collaborator, redirect to their most recent invited job
        try {
          const { data: guestJobs } = await supabase
            .from('job_guest_collaborators')
            .select('job_id, created_at')
            .eq('email', data.user.email)
            .order('created_at', { ascending: false })
            .limit(1);
          const target = (guestJobs || [])[0]?.job_id;
          if (target) {
            navigate(`/job/${target}`, { replace: true });
            return; // Skip rest of dashboard load
          }
        } catch {}
        setUser(data.user);
        try {
          // Fetch overall metrics for all messages to leads
          const response = await fetch(`${BACKEND_URL}/api/campaigns/all/performance?user_id=${data.user.id}`);
          const result = await response.json();
          setMetrics(result);
        } catch (err) {
          setMetrics(null);
        }
        try {
          // Determine REX enabled from integrations
          const { data: integ } = await supabase
            .from('integrations')
            .select('status')
            .eq('user_id', data.user.id)
            .eq('provider', 'rex')
            .maybeSingle();
          const integEnabled = ['enabled','connected','on','true'].includes(String(integ?.status || '').toLowerCase());
          // Also enable for privileged roles (Team Admin and above)
          let roleEnabled = false;
          try {
            const { data: userRow } = await supabase
              .from('users')
              .select('role')
              .eq('id', data.user.id)
              .maybeSingle();
            const roleLc = String(userRow?.role || data.user.user_metadata?.role || '').toLowerCase();
            roleEnabled = ['teamadmin','team_admin','superadmin','super_admin','admin','recruitpro','member'].includes(roleLc);
          } catch {}
          setRexEnabled(integEnabled || roleEnabled);
        } catch {
          setRexEnabled(false);
        }
      }
      setLoading(false);
    };
    fetchUserAndMetrics();
  }, []);

  // Load per-user dashboard widgets from API (fallback to localStorage)
  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const r = await fetch('/api/dashboard/layout', { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
        if (r.ok) {
          const j = await r.json();
          const names = (Array.isArray(j.layout) ? j.layout : []).map(w => w.widget_id || w).slice(0,6);
          setCustomWidgets(names);
          return;
        }
      } catch {}
      // Supabase fallback under RLS
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u?.user?.id;
        if (uid) {
          const { data: row } = await supabase.from('user_dashboards').select('layout').eq('user_id', uid).maybeSingle();
          if (row?.layout) {
            const names = (Array.isArray(row.layout) ? row.layout : []).map(w => w.widget_id || w).slice(0,6);
            setCustomWidgets(names);
            return;
          }
        }
      } catch {}
      const { data } = await supabase.auth.getUser();
      const key = `dashboard_widgets_${data?.user?.id || 'anon'}`;
      const localKey = 'dashboard_widgets_local';
      const arr = JSON.parse(localStorage.getItem(key) || localStorage.getItem(localKey) || '[]');
      setCustomWidgets(Array.isArray(arr) ? arr.slice(0, 6) : []);
    };
    load();
  }, []);

  // Initialize snapshot charts with real data when widgets change
  useEffect(() => {
    Object.values(dashChartsRef.current || {}).forEach((c) => { try { c.destroy(); } catch (_) {} });
    dashChartsRef.current = {};
    const fetchWithAuth = async (path) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      return fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
    };
    (async () => {
      if (customWidgets.includes('Reply Rate Chart')) {
        try {
          const r = await fetchWithAuth('/api/widgets/reply-rate'); const j = r.ok ? await r.json() : { data: [] };
          const labels = (j.data||[]).map(d=>d.period||''); const vals = (j.data||[]).map(d=>d.replyRate||0);
          const ctx = document.getElementById('dash-reply-rate'); if (ctx) {
            dashChartsRef.current.reply = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ data: vals, borderColor: '#6B46C1', backgroundColor: 'rgba(107,70,193,0.08)', fill:true, tension:0.35, borderWidth:2 }] }, options: { plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ display:false } }, x:{ ticks:{ display:false } } }, responsive:true, maintainAspectRatio:false } });
          }
        } catch {}
      }
      if (customWidgets.includes('Open Rate Widget')) {
        try {
          const r = await fetchWithAuth('/api/widgets/open-rate'); const j = r.ok ? await r.json() : { data: [] };
          const labels = (j.data||[]).map(d=>d.bucket||''); const vals = (j.data||[]).map(d=>d.openRate||0);
          const ctx = document.getElementById('dash-open-rate'); if (ctx) {
            dashChartsRef.current.open = new Chart(ctx, { type:'bar', data:{ labels, datasets:[{ data: vals, backgroundColor:'#6B46C1' }] }, options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ display:false }, x:{ display:false } }, responsive:true, maintainAspectRatio:false } });
          }
        } catch {}
      }
      if (customWidgets.includes('Revenue Forecast')) {
        try {
          const fromProcess = (typeof process !== 'undefined' && process.env) ? (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL) : '';
          const fromVite = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_BACKEND_URL) : '';
          const fromWindow = (typeof window !== 'undefined' && window.__BACKEND_URL__) ? window.__BACKEND_URL__ : '';
          const base = String(fromProcess || fromVite || fromWindow || '').replace(/\/$/, '');
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          const hdrs = token ? { Authorization: `Bearer ${token}` } : {};
          const [paidRes, projRes] = await Promise.all([
            fetch(`${base}/api/revenue/monthly`, { headers: hdrs }),
            fetch(`${base}/api/revenue/monthly-projected`, { headers: hdrs }),
          ]);
          let actual = []; let projected = [];
          if (paidRes.ok) { const paid = await paidRes.json(); actual = (paid||[]).map(r=>({ month: r.month, revenue: Number(r.paid)||0 })); }
          if (projRes.ok) { const p = await projRes.json(); projected = (p||[]).map(r=>({ month: r.month, revenue: Number(r.forecasted)||0 })); }
          if (!actual.length || actual.reduce((s,r)=>s+r.revenue,0)===0) {
            // Fallback to Close Won monthly
            const cw = await fetch(`${base}/api/revenue/closewon-monthly?range=1y`, { headers: hdrs });
            const js = cw.ok ? await cw.json() : { series: [] };
            actual = (js.series||[]).map(r=>({ month:r.month, revenue:Number(r.revenue)||0 }));
          }
          const months = (actual.concat(projected)).map(r=>r.month);
          const uniqueMonths = Array.from(new Set(months)).slice(-6); // last 6 for snapshot
          const idx = new Map(uniqueMonths.map((m,i)=>[m,i]));
          const valsArr = new Array(uniqueMonths.length).fill(0);
          actual.forEach(r=>{ const i = idx.get(r.month); if (i!==undefined) valsArr[i] += r.revenue; });
          projected.forEach(r=>{ const i = idx.get(r.month); if (i!==undefined) valsArr[i] += r.revenue; });
          const ctx = document.getElementById('dash-revenue'); if (ctx) {
            dashChartsRef.current.revenue = new Chart(ctx, { type:'bar', data:{ labels: uniqueMonths, datasets:[{ data: valsArr, backgroundColor:'#3B82F6' }] }, options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ ticks:{ color:'#6b7280' } }, x:{ ticks:{ color:'#6b7280' } } }, responsive:true, maintainAspectRatio:false } });
          }
        } catch {}
      }
    })();
    return () => { Object.values(dashChartsRef.current || {}).forEach((c) => { try { c.destroy(); } catch (_) {} }); dashChartsRef.current = {}; };
  }, [customWidgets]);

  useEffect(() => {
    const fetchJobs = async () => {
      setJobsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const { data: jobsData, error } = await supabase
          .from('job_requisitions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);
        if (error) throw error;
        const jobs = jobsData || [];
        // Fetch candidate counts for these jobs
        const jobIds = jobs.map(j => j.id);
        let countsMap = {};
        if (jobIds.length > 0) {
          const { data: candidateRows, error: candidateError } = await supabase
            .from('candidate_jobs')
            .select('job_id')
            .in('job_id', jobIds);
          if (!candidateError && candidateRows) {
            countsMap = jobIds.reduce((acc, jobId) => {
              acc[jobId] = (candidateRows || []).filter(row => row.job_id === jobId).length;
              return acc;
            }, {});
          }
        }
        // Map counts into jobs
        const jobsWithCounts = jobs.map(j => ({ ...j, candidates_count: countsMap[j.id] || 0 }));
        setJobs(jobsWithCounts);
      } catch (err) {
        setJobs([]);
      } finally {
        setJobsLoading(false);
      }
    };
    fetchJobs();
  }, []);

  useEffect(() => {
    const fetchCampaigns = async () => {
      setCampaignsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const response = await fetch(`${BACKEND_URL}/api/getCampaigns?user_id=${user.id}`);
        const result = await response.json();
        if (response.ok && result.campaigns) {
          // Show latest 3 (active or inactive)
          setCampaigns(result.campaigns.slice(0, 3));
        } else {
          setCampaigns([]);
        }
      } catch (err) {
        setCampaigns([]);
      } finally {
        setCampaignsLoading(false);
      }
    };
    fetchCampaigns();
  }, []);

  React.useEffect(() => {
    // Initialize chart
    const ctx = document.getElementById('replyTrendChart')?.getContext('2d');
    if (ctx) {
      // Destroy existing chart if it exists
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      // Create new chart instance
      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Replies',
            data: [65, 59, 80, 81, 56, 55, 40],
            fill: false,
            borderColor: 'rgb(59, 130, 246)',
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              display: false
            },
            x: {
              display: false
            }
          }
        }
      });
    }

    // Cleanup function
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, []);

  // Calculate reply rate and conversion rate
  const replyRate = metrics && metrics.sent ? (metrics.replies / metrics.sent) * 100 : 0;
  const conversionRate = metrics && metrics.total_leads ? (metrics.converted_candidates / metrics.total_leads) * 100 : 0;

  const renderCustomSnapshots = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {customWidgets.includes('Hiring Funnel') && (
        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">Hiring Pipeline</h3><span className="text-gray-400">⋯</span></div>
          <div className="space-y-3">
            {[
              { label:'Applied', val:342, from:'from-purple-600', to:'to-purple-400', text:'text-white' },
              { label:'Screened', val:256, from:'from-purple-500', to:'to-purple-300', text:'text-white' },
              { label:'Interview', val:154, from:'from-purple-300', to:'to-purple-100', text:'text-purple-900' },
              { label:'Offer', val:86, from:'from-green-400', to:'to-green-300', text:'text-white' },
              { label:'Hired', val:52, from:'from-green-500', to:'to-green-400', text:'text-white' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 w-24">{s.label}</span>
                <div className={`flex-1 ml-3 h-6 bg-gradient-to-r ${s.from} ${s.to} ${s.text} rounded-full px-3 flex items-center justify-end text-xs font-semibold`}>{s.val}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <select className="border rounded-md p-2 text-gray-600"><option>All Job Reqs</option></select>
            <select className="border rounded-md p-2 text-gray-600"><option>Last 30 Days</option></select>
          </div>
        </div>
      )}
      {customWidgets.includes('Reply Rate Chart') && (
        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">Reply Rate Chart</h3><span className="text-gray-400">⚙️</span></div>
          <div className="h-32"><canvas id="dash-reply-rate"></canvas></div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <select className="border rounded-md p-2 text-gray-600"><option>By Template</option></select>
            <button className="bg-purple-600 text-white px-3 py-2 rounded-md text-sm">Export</button>
          </div>
        </div>
      )}
      {customWidgets.includes('Open Rate Widget') && (
        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex justify-between items-center mb-1"><h3 className="text-lg font-semibold">Open Rate</h3><span className="text-gray-400">⚙️</span></div>
          <div className="text-4xl font-bold text-purple-700">54.5%</div>
          <div className="text-green-600 text-sm mt-1">↑ +2.3% vs last week</div>
          <div className="h-16 mt-3"><canvas id="dash-open-rate"></canvas></div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <select className="border rounded-md p-2 text-gray-600"><option>All Providers</option></select>
            <select className="border rounded-md p-2 text-gray-600"><option>3</option></select>
          </div>
        </div>
      )}
      {customWidgets.includes('Revenue Forecast') && (
        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">Revenue Forecast</h3><span className="text-gray-400">⚙️</span></div>
          <div className="h-40"><canvas id="dash-revenue"></canvas></div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <select className="border rounded-md p-2 text-gray-600"><option>All Clients</option></select>
            <div className="flex items-center gap-4 text-gray-600"><label className="flex items-center gap-2 text-sm"><input type="radio" defaultChecked /> Quarter</label><label className="flex items-center gap-2 text-sm"><input type="radio" /> Year</label></div>
          </div>
        </div>
      )}
      {customWidgets.includes('Deal Pipeline') && (
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Deal Pipeline</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-4 bg-blue-100"><div className="text-sm text-blue-700">Pipeline</div><div className="text-2xl font-bold text-blue-900">$45K</div><div className="text-xs text-blue-600">12 deals</div></div>
            <div className="rounded-lg p-4 bg-purple-100"><div className="text-sm text-purple-700">Best Case</div><div className="text-2xl font-bold text-purple-900">$32K</div><div className="text-xs text-purple-600">8 deals</div></div>
            <div className="rounded-lg p-4 bg-yellow-100"><div className="text-sm text-yellow-700">Commit</div><div className="text-2xl font-bold text-yellow-900">$20K</div><div className="text-xs text-yellow-700">5 deals</div></div>
            <div className="rounded-lg p-4 bg-green-100"><div className="text-sm text-green-700">Closed Won</div><div className="text-2xl font-bold text-green-900">$15K</div><div className="text-xs text-green-700">3 deals</div></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <select className="border rounded-md p-2 text-gray-600"><option>All Owners</option></select>
            <select className="border rounded-md p-2 text-gray-600"><option>Sort by Value</option></select>
          </div>
        </div>
      )}
      {customWidgets.includes('Team Performance') && (
        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">Team Performance</h3><span className="text-gray-400">⚙️</span></div>
          <div className="space-y-3">
            {[
              { name:'Sarah Chen', pct: '94%', hires:'23 hires', avatar:'https://i.pravatar.cc/40?img=5' },
              { name:'Mike Rodriguez', pct: '87%', hires:'19 hires', avatar:'https://i.pravatar.cc/40?img=12' },
              { name:'Alex Kumar', pct: '81%', hires:'15 hires', avatar:'https://i.pravatar.cc/40?img=30' },
            ].map(r => (
              <div key={r.name} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  <img src={r.avatar} className="w-8 h-8 rounded-full" />
                  <span className="font-medium text-gray-800">{r.name}</span>
                </div>
                <div className="text-right"><div className="text-green-600 font-semibold">{r.pct}</div><div className="text-xs text-gray-500">{r.hires}</div></div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <select className="border rounded-md p-2 text-gray-600"><option>This Month</option></select>
            <button onClick={()=>navigate('/rex')} className="bg-purple-600 text-white px-3 py-2 rounded-md text-sm">REX Insights</button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="bg-gray-50 px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <button className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700" onClick={() => navigate('/analytics')}>Customize Dashboard</button>
        </div>
        {customWidgets.length > 0 ? (
          renderCustomSnapshots()
        ) : (
        <>
        {isFree && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
            You are on the Free plan. Upgrade anytime from Billing to unlock premium features and higher limits.
          </div>
        )}
        {/* Sourcing Snapshot Section - hidden on small screens */}
        <section className="mb-6 hidden sm:block">
          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Sourcing Snapshot</h2>
              <span className="text-sm text-gray-500">Last 7 days</span>
            </div>
            <div className="grid grid-cols-3 gap-8 mb-6">
              {/* Leads Contacted */}
              <div className="text-center">
                <div className="text-3xl font-semibold text-gray-900">{loading ? <span className="animate-pulse">...</span> : metrics?.sent ?? 0}</div>
                <div className="text-sm text-gray-500">Leads Contacted</div>
              </div>
              {/* Replies Received */}
              <div className="text-center">
                <div className="text-3xl font-semibold text-gray-900">{loading ? <span className="animate-pulse">...</span> : metrics?.replies ?? 0}</div>
                <div className="text-sm text-gray-500">Replies Received</div>
                <div className="text-xs text-blue-500">{loading ? <span className="animate-pulse">...</span> : `${replyRate.toFixed(1)}% Reply Rate`}</div>
              </div>
              {/* Conversions */}
              <div className="text-center">
                <div className="text-3xl font-semibold text-gray-900">{loading ? <span className="animate-pulse">...</span> : metrics?.converted_candidates ?? 0}</div>
                <div className="text-sm text-gray-500">Converted to Candidates</div>
                <div className="text-xs text-green-500">{loading ? <span className="animate-pulse">...</span> : `${conversionRate.toFixed(1)}% Conversion Rate`}</div>
              </div>
            </div>
            {/* Chart */}
            <div className="h-[100px] mb-4">
              <canvas id="replyTrendChart"></canvas>
            </div>
            <div className="flex justify-end">
              <span
                className="text-sm text-blue-600 hover:underline cursor-pointer"
                onClick={() => navigate('/leads')}
              >
                View All Leads →
              </span>
            </div>
          </div>
        </section>
        {/* Second Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Job Requisitions */}
          <section className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Active Job Requisitions</h2>
              <span
                className="text-sm text-blue-600 hover:underline cursor-pointer"
                onClick={() => navigate('/jobs')}
              >
                View All Jobs →
              </span>
            </div>
            <div className="space-y-4">
              {jobsLoading ? (
                <div className="text-gray-400">Loading jobs...</div>
              ) : jobs.length === 0 ? (
                <div className="text-gray-400">No jobs found.</div>
              ) : (
                jobs.map((job) => (
                  <div key={job.id} className="p-4 border border-gray-100 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                        <h3 className="font-medium text-gray-900">{job.title}</h3>
                        <p className="text-sm text-gray-500">{job.department || '-'}</p>
                  </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${job.status === 'open' ? 'bg-green-100 text-green-800' : job.status === 'closed' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{job.status ? job.status.charAt(0).toUpperCase() + job.status.slice(1) : '-'}</span>
                </div>
                    <div className="mt-2 text-sm text-gray-600">{job.candidates_count ?? 0} candidates</div>
                  </div>
                ))
              )}
            </div>
          </section>
          {/* Campaigns */}
          <section className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Campaigns</h2>
              <span
                className="text-sm text-blue-600 hover:underline cursor-pointer"
                onClick={() => navigate('/campaigns')}
              >
                View All Campaigns →
              </span>
            </div>
            <div className="space-y-4">
              {campaignsLoading ? (
                <div className="text-gray-400">Loading campaigns...</div>
              ) : campaigns.length === 0 ? (
                <div className="text-gray-400">No campaigns found.</div>
              ) : (
                campaigns.map((campaign) => (
                  <div key={campaign.id} className="p-4 border border-gray-100 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                        <h3 className="font-medium text-gray-900">{campaign.name || campaign.title || 'Untitled Campaign'}</h3>
                        <p className="text-sm text-gray-500">
                          {(() => {
                            const desc = campaign.role || campaign.description || '';
                            if (desc.length > 100) return desc.slice(0, 100) + '...';
                            return desc;
                          })()}
                        </p>
                  </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${campaign.status === 'active' || campaign.status === 'live' ? 'bg-blue-100 text-blue-800' : campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' : campaign.status === 'draft' ? 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800'}`}>{campaign.status}</span>
              </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* REX Quick Actions - visible only if REX enabled */}
        {rexEnabled && (
          <div className="mt-6">
            <QuickActionsRexCard />
          </div>
        )}
        </>
        )}
      </main>
    </div>
  );
}
