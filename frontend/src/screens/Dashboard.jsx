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
  const [user, setUser] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [rexEnabled, setRexEnabled] = useState(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="bg-gray-50 px-8 py-6">
        {isFree && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
            You are on the Free plan. Upgrade anytime from Billing to unlock premium features and higher limits.
          </div>
        )}
        {/* Sourcing Snapshot Section */}
        <section className="mb-6">
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
        <div className="grid grid-cols-2 gap-6">
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
      </main>
    </div>
  );
}
