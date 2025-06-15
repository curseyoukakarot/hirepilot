import React, { useRef, useState, useEffect } from 'react';
import { Chart } from 'chart.js/auto';
import { supabase } from '../lib/supabase';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function Analytics() {
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
        if (error) throw error;
        setLeads(data || []);
        setLeadsTotal(count || (data ? data.length : 0));
      } catch (err) {
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
  const openRate = total.sent ? (total.opens / total.sent) * 100 : 0;
  const replyRate = total.sent ? (total.replies / total.sent) * 100 : 0;
  const conversionRate = total.total_leads ? (total.converted_candidates / total.total_leads) * 100 : 0;

  // Add state for selected campaign
  const [selectedCampaignId, setSelectedCampaignId] = useState('all');

  // Filter metrics for selected campaign
  const selectedMetrics = metrics.find(m => m.campaignId === selectedCampaignId) || { sent: 0, opens: 0, open_rate: 0, replies: 0, reply_rate: 0 };

  React.useEffect(() => {
    // Initialize chart
    const ctx = document.getElementById('performanceChart')?.getContext('2d');
    if (ctx) {
      // Destroy existing chart if it exists
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      // Create new chart instance
      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar'],
          datasets: [
            {
              label: 'Open Rate',
              data: [68, 72, 75],
              borderColor: 'rgb(59, 130, 246)',
              tension: 0.4,
              fill: false
            },
            {
              label: 'Reply Rate',
              data: [42, 45, 48],
              borderColor: 'rgb(34, 197, 94)',
              tension: 0.4,
              fill: false
            },
            {
              label: 'Interested Rate',
              data: [16, 18, 20],
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
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
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
  }, []);

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
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Leads Messaged</h3>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{loading ? <span className="animate-pulse">...</span> : selectedMetrics.sent}</p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Open Rate</h3>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{loading ? <span className="animate-pulse">...</span> : `${selectedMetrics.open_rate?.toFixed(1) || 0}%`}</p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Reply Rate</h3>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{loading ? <span className="animate-pulse">...</span> : `${selectedMetrics.reply_rate?.toFixed(1) || 0}%`}</p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Interested Rate</h3>
            <p className="mt-2 text-2xl font-semibold text-gray-900">—</p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Converted Candidates</h3>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{loading ? <span className="animate-pulse">...</span> : total.converted_candidates}</p>
            <div className="text-xs text-green-500">{loading ? <span className="animate-pulse">...</span> : `${conversionRate.toFixed(1)}% Conversion Rate`}</div>
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
              <select className="px-3 py-2 border border-gray-300 rounded-lg">
                <option>Last 30 days</option>
                <option>Last 90 days</option>
                <option>This year</option>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interested Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 text-gray-900">Jan 2024</td>
                    <td className="px-6 py-4 text-gray-900">68%</td>
                    <td className="px-6 py-4 text-gray-900">42%</td>
                    <td className="px-6 py-4 text-gray-900">16%</td>
                    <td className="px-6 py-4 text-green-600">+5.2%</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-900">Feb 2024</td>
                    <td className="px-6 py-4 text-gray-900">72%</td>
                    <td className="px-6 py-4 text-gray-900">45%</td>
                    <td className="px-6 py-4 text-gray-900">18%</td>
                    <td className="px-6 py-4 text-green-600">+3.8%</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-900">Mar 2024</td>
                    <td className="px-6 py-4 text-gray-900">75%</td>
                    <td className="px-6 py-4 text-gray-900">48%</td>
                    <td className="px-6 py-4 text-gray-900">20%</td>
                    <td className="px-6 py-4 text-green-600">+4.1%</td>
                  </tr>
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