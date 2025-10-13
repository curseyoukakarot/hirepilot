import React, { useRef, useState, useEffect } from 'react';
import { Chart } from 'chart.js/auto';
import { supabase } from '../lib/supabaseClient';
import { usePlan } from '../context/PlanContext';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function Analytics() {
  const { isFree } = usePlan();
  const navigate = useNavigate();
  // Block free users from accessing analytics
  useEffect(() => {
    if (isFree) {
      navigate('/billing', { replace: true });
    }
  }, [isFree, navigate]);

  const chartRef = useRef(null);
  const [viewMode, setViewMode] = useState('chart');
  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [metrics, setMetrics] = useState([]); // Array of { campaignId, sent, opens, open_rate, replies, reply_rate, conversions }
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadPage, setLeadPage] = useState(0); // pagination state
  const LEADS_PER_PAGE = 2;
  
  // Time series data for chart and table
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [timeSeriesLoading, setTimeSeriesLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  // Messaging analytics
  const [viewEntity, setViewEntity] = useState('templates'); // 'templates' | 'sequences'
  const [tplMetrics, setTplMetrics] = useState([]);
  const [seqMetrics, setSeqMetrics] = useState([]);
  const [selectedTpl, setSelectedTpl] = useState('all');
  const [selectedSeq, setSelectedSeq] = useState('all');
  const [tplList, setTplList] = useState([]);
  const [seqList, setSeqList] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    const fetchUserAndCampaigns = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
        const response = await fetch(`${BACKEND_URL}/api/getCampaigns?user_id=${data.user.id}`);
        const result = await response.json();
        if (response.ok && result.campaigns) {
          // Add 'All Campaigns' option
          const allCampaignsOption = { id: 'all', title: 'All Campaigns' };
          const campaignsWithAll = [allCampaignsOption, ...result.campaigns];
          setCampaigns(campaignsWithAll);
          // Fetch metrics for each campaign, including 'all'
          const metricsArr = await Promise.all(
            campaignsWithAll.map(async (c) => {
              try {
                const res = await fetch(`${BACKEND_URL}/api/campaigns/${c.id}/performance?user_id=${data.user.id}`);
                if (!res.ok) {
                  const errorData = await res.json();
                  console.error(`[campaignPerformance] Error for campaign ${c.id}:`, errorData.error);
                  return { campaignId: c.id, sent: 0, opens: 0, open_rate: 0, replies: 0, reply_rate: 0 };
                }
                const perf = await res.json();
                return { campaignId: c.id, ...perf };
              } catch (error) {
                console.error(`[campaignPerformance] Error for campaign ${c.id}:`, error);
                return { campaignId: c.id, sent: 0, opens: 0, open_rate: 0, replies: 0, reply_rate: 0 };
              }
            })
          );
          setMetrics(metricsArr);
        } else {
          setCampaigns([]);
          setMetrics([]);
        }
      }
      setLoading(false);
    };
    fetchUserAndCampaigns();
  }, []);

  useEffect(() => {
    const fetchLeads = async () => {
      setLeadsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const from = leadPage * LEADS_PER_PAGE;
        const to = from + LEADS_PER_PAGE - 1;
        const { data, error, count } = await supabase
          .from('leads')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) {
          console.error('RLS error on leads query:', error);
          // Don't throw - just set empty data to prevent page from breaking
          setLeads([]);
          setLeadsTotal(0);
        } else {
          setLeads(data || []);
          setLeadsTotal(count || (data ? data.length : 0));
        }
      } catch (err) {
        console.error('Error fetching leads:', err);
        setLeads([]);
        setLeadsTotal(0);
      } finally {
        setLeadsLoading(false);
      }
    };
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadPage]);

  // Aggregate metrics for all campaigns
  const total = metrics.reduce((acc, m) => {
    acc.sent += m.sent || 0;
    acc.opens += m.opens || 0;
    acc.replies += m.replies || 0;
    acc.converted_candidates += m.converted_candidates || 0;
    acc.total_leads += m.total_leads || 0;
    return acc;
  }, { sent: 0, opens: 0, replies: 0, converted_candidates: 0, total_leads: 0 });
  // KPI cards context switch: if a template/sequence is selected, derive KPIs from that row
  let openRate = total.sent ? (total.opens / total.sent) * 100 : 0;
  let replyRate = total.sent ? (total.replies / total.sent) * 100 : 0;
  let conversionRate = total.total_leads ? (total.converted_candidates / total.total_leads) * 100 : 0;
  if (viewEntity === 'templates' && selectedTpl !== 'all') {
    const t = (tplMetrics||[]).find(x=>x.template_id===selectedTpl);
    if (t) {
      total.sent = t.sent||0; total.opens = t.opens||0; total.replies = t.replies||0;
      openRate = total.sent ? (total.opens/total.sent)*100 : 0;
      replyRate = total.sent ? (total.replies/total.sent)*100 : 0;
    }
  } else if (viewEntity === 'sequences' && selectedSeq !== 'all') {
    const s = (seqMetrics||[]).find(x=>x.sequence_id===selectedSeq);
    if (s) {
      total.sent = s.sent||0; total.opens = s.opens||0; total.replies = s.replies||0;
      openRate = total.sent ? (total.opens/total.sent)*100 : 0;
      replyRate = total.sent ? (total.replies/total.sent)*100 : 0;
    }
  }

  // Add state for selected campaign
  const [selectedCampaignId, setSelectedCampaignId] = useState('all');

  // Fetch time series data for chart and table
  const fetchTimeSeriesData = async () => {
    setTimeSeriesLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      let url;
      if (viewEntity === 'templates' && selectedTpl !== 'all') {
        url = `${BACKEND_URL}/api/analytics/time-series?entity=template&id=${selectedTpl}&days=${selectedTimeRange.replace(/\D/g,'')||30}`;
      } else if (viewEntity === 'sequences' && selectedSeq !== 'all') {
        url = `${BACKEND_URL}/api/analytics/time-series?entity=sequence&id=${selectedSeq}&days=${selectedTimeRange.replace(/\D/g,'')||30}`;
      } else {
        // Keep prior behavior for campaign-level (optional); default to empty for now
        setTimeSeriesData([]);
        setTimeSeriesLoading(false);
        return;
      }
      const response = await fetch(url, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      const result = await response.json();
      setTimeSeriesData(Array.isArray(result.data) ? result.data : []);
    } catch (e) {
      setTimeSeriesData([]);
    } finally {
      setTimeSeriesLoading(false);
    }
  };

  // Filter metrics for selected campaign
  const selectedMetrics = metrics.find(m => m.campaignId === selectedCampaignId) || { sent: 0, opens: 0, open_rate: 0, replies: 0, reply_rate: 0, conversions: 0, conversion_rate: 0 };

  useEffect(() => {
    fetchTimeSeriesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewEntity, selectedTpl, selectedSeq, selectedTimeRange]);

  React.useEffect(() => {
    // Initialize chart with real data
    const ctx = document.getElementById('performanceChart')?.getContext('2d');
    if (ctx && !timeSeriesLoading) {
      // Destroy existing chart if it exists
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      // Prepare data from timeSeriesData
      const labels = timeSeriesData.map(item => item.period);
      const openRateData = timeSeriesData.map(item => item.openRate);
      const replyRateData = timeSeriesData.map(item => item.replyRate);
      const conversionRateData = timeSeriesData.map(item => item.conversionRate);

      // Create new chart instance with real data
      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Open Rate',
              data: openRateData,
              borderColor: 'rgb(59, 130, 246)',
              tension: 0.4,
              fill: false
            },
            {
              label: 'Reply Rate',
              data: replyRateData,
              borderColor: 'rgb(34, 197, 94)',
              tension: 0.4,
              fill: false
            },
            {
              label: 'Conversion Rate',
              data: conversionRateData,
              borderColor: 'rgb(168, 85, 247)',
              tension: 0.4,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: Math.max(100, Math.max(...openRateData, ...replyRateData, ...conversionRateData) + 10),
              ticks: {
                callback: value => `${value}%`
              }
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
  }, [timeSeriesData, timeSeriesLoading]);

  // Fetch messaging analytics (templates/sequences)
  useEffect(() => {
    const fetchAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
        if (viewEntity === 'templates') {
          const r = await fetch(`${BACKEND_URL}/api/analytics/templates`, { headers, credentials: 'include' });
          const j = await r.json();
          setTplMetrics(Array.isArray(j.data) ? j.data : []);
          // populate list
          const lst = await fetch(`${BACKEND_URL}/api/analytics/template-list`, { headers, credentials: 'include' }).then(r=>r.json()).catch(()=>({data:[]}));
          setTplList(Array.isArray(lst.data)?lst.data:[]);
        } else {
          const r = await fetch(`${BACKEND_URL}/api/analytics/sequences`, { headers, credentials: 'include' });
          const j = await r.json();
          setSeqMetrics(Array.isArray(j.data) ? j.data : []);
          const lst = await fetch(`${BACKEND_URL}/api/analytics/sequence-list`, { headers, credentials: 'include' }).then(r=>r.json()).catch(()=>({data:[]}));
          setSeqList(Array.isArray(lst.data)?lst.data:[]);
        }
      } catch (e) {
        if (viewEntity === 'templates') setTplMetrics([]); else setSeqMetrics([]);
      } finally {
        setAnalyticsLoading(false);
      }
    };
    fetchAnalytics();
    // reset any selection when switching view
    setSelectedTpl('all');
    setSelectedSeq('all');
  }, [viewEntity]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="px-6 py-4 mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-semibold text-gray-900">Campaign Performance</h1>
              <span className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-full">Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-8 mx-auto max-w-7xl">
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
          <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-xs sm:text-sm font-medium text-gray-500">Leads Messaged</h3>
            <p className="mt-2 text-xl sm:text-2xl font-semibold text-gray-900">{loading ? <span className="animate-pulse">...</span> : selectedMetrics.sent}</p>
          </div>
          <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-xs sm:text-sm font-medium text-gray-500">Open Rate</h3>
            <p className="mt-2 text-xl sm:text-2xl font-semibold text-gray-900">{loading ? <span className="animate-pulse">...</span> : `${selectedMetrics.open_rate?.toFixed(1) || 0}%`}</p>
          </div>
          <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-xs sm:text-sm font-medium text-gray-500">Reply Rate</h3>
            <p className="mt-2 text-xl sm:text-2xl font-semibold text-gray-900">{loading ? <span className="animate-pulse">...</span> : `${selectedMetrics.reply_rate?.toFixed(1) || 0}%`}</p>
          </div>
          <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-xs sm:text-sm font-medium text-gray-500">Conversion Rate</h3>
            <p className="mt-2 text-xl sm:text-2xl font-semibold text-gray-900">{loading ? <span className="animate-pulse">...</span> : `${selectedMetrics.conversion_rate?.toFixed(1) || 0}%`}</p>
          </div>
          <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-xs sm:text-sm font-medium text-gray-500">Converted Candidates</h3>
            <p className="mt-2 text-xl sm:text-2xl font-semibold text-gray-900">{loading ? <span className="animate-pulse">...</span> : total.converted_candidates}</p>
            <div className="text-[10px] sm:text-xs text-green-500">{loading ? <span className="animate-pulse">...</span> : `${conversionRate.toFixed(1)}% Conversion Rate`}</div>
          </div>
        </div>

        {/* Campaign Selector */}
        <div className="mb-6 flex items-center gap-4">
          <label htmlFor="campaign-select" className="text-sm font-medium text-gray-700">Campaign:</label>
          <select
            id="campaign-select"
            className="px-3 py-2 border border-gray-300 rounded-lg"
            value={selectedCampaignId}
            onChange={e => setSelectedCampaignId(e.target.value)}
          >
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* Performance Chart */}
        <div className="p-6 mb-8 bg-white rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Performance Overview</h2>
            <div className="flex items-center space-x-4">
              <select 
                className="px-3 py-2 border border-gray-300 rounded-lg"
                value={selectedTimeRange}
                onChange={e => setSelectedTimeRange(e.target.value)}
              >
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">This year</option>
              </select>
              <div className="flex p-1 bg-gray-100 rounded-lg">
                <button 
                  className={`px-3 py-1 rounded ${viewMode === 'chart' ? 'bg-white text-gray-700' : 'text-gray-500 hover:bg-gray-50'}`}
                  onClick={() => setViewMode('chart')}
                >
                  Chart
                </button>
                <button 
                  className={`px-3 py-1 rounded ${viewMode === 'table' ? 'bg-white text-gray-700' : 'text-gray-500 hover:bg-gray-50'}`}
                  onClick={() => setViewMode('table')}
                >
                  Table
                </button>
              </div>

        {/* Messaging Analytics */}
        <div className="mb-6 flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Messaging Analytics:</label>
          <select className="px-3 py-2 border border-gray-300 rounded-lg" value={viewEntity} onChange={e=>setViewEntity(e.target.value)}>
            <option value="templates">By Template</option>
            <option value="sequences">By Sequence</option>
          </select>
          {viewEntity === 'templates' && (
            <>
              <span className="text-sm text-gray-500">Template:</span>
              <select className="px-3 py-2 border border-gray-300 rounded-lg" value={selectedTpl} onChange={e=>setSelectedTpl(e.target.value)}>
                <option value="all">All</option>
                {(tplList||tplMetrics||[]).map((t)=> (
                  <option key={t.id || t.template_id} value={t.id || t.template_id}>{t.name || t.template_name || t.template_id}</option>
                ))}
              </select>
            </>
          )}
          {viewEntity === 'sequences' && (
            <>
              <span className="text-sm text-gray-500">Sequence:</span>
              <select className="px-3 py-2 border border-gray-300 rounded-lg" value={selectedSeq} onChange={e=>setSelectedSeq(e.target.value)}>
                <option value="all">All</option>
                {(seqList||seqMetrics||[]).map((s)=> (
                  <option key={s.id || s.sequence_id} value={s.id || s.sequence_id}>{s.name || s.sequence_name || s.sequence_id}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {viewEntity === 'templates' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(tplMetrics||[]).filter(t => selectedTpl==='all' || t.template_id===selectedTpl).map((t)=> (
              <div key={t.template_id} className="rounded-2xl border p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm">{t.template_name || `Template ${t.template_id}`}</div>
                  <div className="text-xs text-gray-500">Sent {t.sent}</div>
                </div>
                <div className="flex gap-3 text-sm">
                  <div className="flex-1"><div className="text-gray-500 text-xs">Open</div><div className="font-semibold">{t.open_rate}%</div></div>
                  <div className="flex-1"><div className="text-gray-500 text-xs">Reply</div><div className="font-semibold">{t.reply_rate}%</div></div>
                  <div className="flex-1"><div className="text-gray-500 text-xs">Bounce</div><div className="font-semibold">{t.bounce_rate}%</div></div>
                </div>
              </div>
            ))}
            {analyticsLoading && <div className="text-sm text-gray-500">Loading…</div>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(seqMetrics||[]).filter(s => selectedSeq==='all' || s.sequence_id===selectedSeq).map((s)=> (
              <div key={s.sequence_id} className="rounded-2xl border p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm">{s.sequence_name || `Sequence ${s.sequence_id}`}</div>
                  <div className="text-xs text-gray-500">Sent {s.sent}</div>
                </div>
                <div className="flex gap-3 text-sm">
                  <div className="flex-1"><div className="text-gray-500 text-xs">Open</div><div className="font-semibold">{s.open_rate}%</div></div>
                  <div className="flex-1"><div className="text-gray-500 text-xs">Reply</div><div className="font-semibold">{s.reply_rate}%</div></div>
                  <div className="flex-1"><div className="text-gray-500 text-xs">Bounce</div><div className="font-semibold">{s.bounce_rate}%</div></div>
                </div>
              </div>
            ))}
            {analyticsLoading && <div className="text-sm text-gray-500">Loading…</div>}
          </div>
        )}
            </div>
          </div>
          
          {viewMode === 'chart' ? (
            <div className="h-[400px]">
              <canvas id="performanceChart"></canvas>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Open Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reply Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conversion Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {timeSeriesLoading ? (
                    <tr><td colSpan="5" className="text-center py-8 text-gray-400">Loading performance data...</td></tr>
                  ) : timeSeriesData.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-8 text-gray-400">No performance data found.</td></tr>
                  ) : (
                    timeSeriesData.map((item, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 text-gray-900">{item.period}</td>
                        <td className="px-6 py-4 text-gray-900">{item.openRate}%</td>
                        <td className="px-6 py-4 text-gray-900">{item.replyRate}%</td>
                        <td className="px-6 py-4 text-gray-900">{item.conversionRate}%</td>
                        <td className={`px-6 py-4 ${item.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.growth >= 0 ? '+' : ''}{item.growth}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lead Status Breakdown */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Lead Status Breakdown</h2>
              <div className="flex items-center space-x-3">
                <button className="flex items-center px-3 py-2 text-gray-600 bg-gray-100 rounded-lg">
                  <i className="mr-2 fa-solid fa-filter"></i>Filter
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leadsLoading ? (
                  <tr><td colSpan="5" className="text-center py-8 text-gray-400">Loading leads...</td></tr>
                ) : leads.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-8 text-gray-400">No leads found.</td></tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <img src={lead.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.first_name || lead.name || 'Lead')}&background=random`} className="w-8 h-8 mr-3 rounded-full" alt={lead.first_name || lead.name || 'Lead'} />
                          <div>
                            <div className="font-medium text-gray-900">{lead.first_name || lead.name} {lead.last_name || ''}</div>
                            <div className="text-sm text-gray-500">{lead.title || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-sm font-medium rounded-full ${lead.status === 'Interested' ? 'text-green-700 bg-green-100' : lead.status === 'Pending' ? 'text-yellow-700 bg-yellow-100' : 'text-gray-700 bg-gray-100'}`}>{lead.status || '-'}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{lead.last_contacted ? new Date(lead.last_contacted).toLocaleDateString() : '-'}</td>
                      <td className="px-6 py-4 text-gray-500">{lead.response || '-'}</td>
                      <td className="px-6 py-4">
                        <button className="text-gray-400 hover:text-gray-600"><i className="fa-solid fa-ellipsis"></i></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <div className="text-sm text-gray-500">Showing {leads.length} of {leadsTotal} leads</div>
            <div className="flex items-center space-x-2">
              <button
                className="px-3 py-1 text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setLeadPage((p) => Math.max(0, p - 1))}
                disabled={leadPage === 0}
              >
                Previous
              </button>
              <button
                className="px-3 py-1 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setLeadPage((p) => (p + 1) * LEADS_PER_PAGE < leadsTotal ? p + 1 : p)}
                disabled={(leadPage + 1) * LEADS_PER_PAGE >= leadsTotal}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 