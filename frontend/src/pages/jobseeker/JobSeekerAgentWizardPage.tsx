import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

type JobSeekerRun = {
  id: string;
  status: string;
  search_url: string;
  job_limit: number;
  priority: string;
  created_at: string;
  stats_json?: any;
  progress_json?: any;
};

type JobSeekerTarget = {
  id: string;
  target_profile_url: string | null;
  target_name: string | null;
  target_title: string | null;
  match_score: number | null;
  company: string | null;
  title: string | null;
  location: string | null;
  job_url: string | null;
};

function resolveApiBase() {
  const env = String((import.meta as any)?.env?.VITE_BACKEND_URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.host.endsWith('thehirepilot.com')) return 'https://api.thehirepilot.com';
  return 'http://localhost:8080';
}

export default function JobSeekerAgentWizardPage() {
  const navigate = useNavigate();
  const apiBase = useMemo(() => resolveApiBase(), []);
  const [activeTab, setActiveTab] = useState<'job-intent' | 'live-activity' | 'results'>('job-intent');
  const [jobSearchUrl, setJobSearchUrl] = useState('');
  const [jobContext, setJobContext] = useState('');
  const [jobLimit, setJobLimit] = useState('100');
  const [priority, setPriority] = useState('high');
  const [working, setWorking] = useState(false);
  const [runs, setRuns] = useState<JobSeekerRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [targets, setTargets] = useState<JobSeekerTarget[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<Record<string, boolean>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [agentModeEnabled, setAgentModeEnabled] = useState<boolean | null>(null);

  const isPaid = useMemo(() => {
    const role = String(userRole || '').toLowerCase();
    if (!role) return true;
    return role !== 'job_seeker_free';
  }, [userRole]);

  const tabButtonClass = (isActive: boolean) =>
    isActive
      ? 'flex-1 px-6 py-3 rounded-lg font-semibold text-sm transition-all bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
      : 'flex-1 px-6 py-3 rounded-lg font-semibold text-sm transition-all text-slate-400 hover:bg-slate-800 hover:text-white';

  const fetchBootstrapRole = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return null;
      const resp = await fetch(`${apiBase}/api/auth/bootstrap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      const json = await resp.json().catch(() => ({}));
      return json?.role || null;
    } catch {
      return null;
    }
  }, [apiBase]);

  const apiFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const headers = {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      const resp = await fetch(`${apiBase}${path}`, { ...init, headers, credentials: 'include' });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || 'request_failed');
      return json;
    },
    [apiBase]
  );

  const loadRuns = useCallback(async () => {
    const list = await apiFetch('/api/jobseeker/agent/runs?limit=50');
    setRuns(Array.isArray(list) ? list : []);
    if (!selectedRunId && Array.isArray(list) && list.length) {
      setSelectedRunId(list[0].id);
    }
  }, [apiFetch, selectedRunId]);

  const loadTargets = useCallback(
    async (runId: string) => {
      const list = await apiFetch(`/api/jobseeker/agent/runs/${encodeURIComponent(runId)}/items?type=target&limit=500`);
      setTargets(Array.isArray(list) ? list : []);
    },
    [apiFetch]
  );

  useEffect(() => {
    (async () => {
      const role = await fetchBootstrapRole();
      setUserRole(role);
    })();
  }, [fetchBootstrapRole]);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch('/api/agent-mode');
        setAgentModeEnabled(!!data?.agent_mode_enabled);
      } catch {
        setAgentModeEnabled(false);
      }
    })();
  }, [apiFetch]);

  useEffect(() => {
    if (activeTab === 'live-activity' || activeTab === 'results') {
      loadRuns().catch(() => {});
      const id = setInterval(() => {
        loadRuns().catch(() => {});
      }, 8000);
      return () => clearInterval(id);
    }
    return undefined;
  }, [activeTab, loadRuns]);

  useEffect(() => {
    if (activeTab === 'results' && selectedRunId) {
      loadTargets(selectedRunId).catch(() => {});
    }
  }, [activeTab, selectedRunId, loadTargets]);

  const handleLaunch = async () => {
    if (agentModeEnabled === false) {
      window.alert('Agent Mode must be enabled before launching Job Seeker Agent.');
      return;
    }
    if (!isPaid) {
      window.alert('Upgrade required to launch Job Seeker Agent.');
      return;
    }
    setWorking(true);
    try {
      const payload = {
        search_url: jobSearchUrl,
        job_limit: Number(jobLimit || 100),
        priority,
        context: jobContext
      };
      const out = await apiFetch('/api/jobseeker/agent/runs', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const run = out?.run;
      if (run?.id) {
        setSelectedRunId(run.id);
      }
      setActiveTab('live-activity');
      await loadRuns();
    } catch (e: any) {
      window.alert(e?.message || 'Failed to launch campaign.');
    } finally {
      setWorking(false);
    }
  };

  const activeRuns = runs.filter((r) => ['running', 'queued'].includes(String(r.status)));
  const completedRuns = runs.filter((r) => String(r.status) === 'succeeded');

  return (
    <div className="bg-slate-950">
      <style>{`
        ::-webkit-scrollbar { display: none;}
        * { font-family: 'Inter', sans-serif; }
      `}</style>

      {agentModeEnabled === false && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="text-lg font-bold text-gray-900">Agent Mode Required</div>
            <div className="mt-2 text-sm text-gray-600">
              To use Job Seeker Agent, you must enable Agent Mode in Settings.
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => navigate('/settings/integrations')}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Agent Settings
              </button>
            </div>
          </div>
        </div>
      )}

      <main id="main-content" className="max-w-7xl mx-auto px-6 py-8">
        <section id="wizard-header" className="mb-8">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
            <div className="relative z-10">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <i className="fa-solid fa-wand-magic-sparkles text-2xl"></i>
                </div>
                <h2 className="text-3xl font-bold">Job Seeker Agent</h2>
              </div>
              <p className="text-lg text-indigo-100 mb-6 max-w-3xl">Launch intelligent job hunting campaigns powered by AI. Find jobs, identify hiring managers, and reach out—all automatically.</p>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <i className="fa-solid fa-check-circle text-emerald-300"></i>
                  <span className="text-sm">Auto-extract job signals</span>
                </div>
                <div className="flex items-center space-x-2">
                  <i className="fa-solid fa-check-circle text-emerald-300"></i>
                  <span className="text-sm">Find hiring managers</span>
                </div>
                <div className="flex items-center space-x-2">
                  <i className="fa-solid fa-check-circle text-emerald-300"></i>
                  <span className="text-sm">Smart outreach</span>
                </div>
                <div className="flex items-center space-x-2">
                  <i className="fa-solid fa-check-circle text-emerald-300"></i>
                  <span className="text-sm">Background processing</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="tabs-navigation" className="mb-8">
          <div className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-2">
            <div className="flex items-center space-x-2">
              <button onClick={() => setActiveTab('job-intent')} id="tab-job-intent" className={tabButtonClass(activeTab === 'job-intent')}>
                <i className="fa-solid fa-bullseye mr-2"></i>Job Intent
              </button>
              <button onClick={() => setActiveTab('live-activity')} id="tab-live-activity" className={tabButtonClass(activeTab === 'live-activity')}>
                <i className="fa-solid fa-chart-line mr-2"></i>Live Activity
              </button>
              <button onClick={() => setActiveTab('results')} id="tab-results" className={tabButtonClass(activeTab === 'results')}>
                <i className="fa-solid fa-trophy mr-2"></i>Results
              </button>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => navigate('/settings/cloud-engine')}
              className="rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
            >
              Agent Settings
            </button>
          </div>
        </section>

        <div id="content-job-intent" className={`tab-content${activeTab !== 'job-intent' ? ' hidden' : ''}`}>
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <section id="job-search-input" className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-8 mb-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">LinkedIn Job Search URL</h3>
                    <p className="text-sm text-slate-400">Paste your LinkedIn Jobs search results URL. We'll extract all matching jobs and analyze them for you.</p>
                  </div>
                  <div className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-semibold rounded-full border border-blue-500/30">
                    Required
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-300 mb-3">LinkedIn Jobs Search URL</label>
                  <div className="relative">
                    <i className="fa-brands fa-linkedin absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg"></i>
                    <input
                      type="text"
                      id="jobSearchUrl"
                      placeholder="https://www.linkedin.com/jobs/search/?keywords=product%20manager&location=..."
                      className="w-full pl-12 pr-4 py-4 bg-slate-800 border-2 border-slate-700 rounded-lg focus:border-indigo-500 focus:outline-none text-sm text-white placeholder-slate-500 transition-colors"
                      value={jobSearchUrl}
                      onChange={(e) => setJobSearchUrl(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2 flex items-center">
                    <i className="fa-solid fa-lightbulb text-amber-400 mr-2"></i>
                    Go to LinkedIn Jobs, apply your filters (location, experience, etc.), then copy the URL from your browser
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-300 mb-3">Additional Context for Job Seeker Agent</label>
                  <textarea
                    id="jobContext"
                    rows={8}
                    placeholder="Tell the AI about your ideal role, what you're looking for, your experience, preferences, and any specific requirements...

Example: I'm looking for a Senior Product Manager role in fintech or SaaS companies. I have 7 years of experience leading B2B products. I prefer remote or hybrid positions in the SF Bay Area. I'm interested in early-stage startups (Series A-C) where I can have significant impact on product strategy. Strong preference for companies with good work-life balance and collaborative cultures."
                    className="w-full px-4 py-4 bg-slate-800 border-2 border-slate-700 rounded-lg focus:border-indigo-500 focus:outline-none text-sm text-white placeholder-slate-500 transition-colors resize-none"
                    value={jobContext}
                    onChange={(e) => setJobContext(e.target.value)}
                  ></textarea>
                  <p className="text-xs text-slate-500 mt-2 flex items-start">
                    <i className="fa-solid fa-magic text-purple-400 mr-2 mt-1"></i>
                    <span>The more context you provide, the better the AI can identify relevant hiring managers and personalize outreach messages</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-3">Job Limit</label>
                    <select
                      id="jobLimit"
                      className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 rounded-lg focus:border-indigo-500 focus:outline-none text-sm text-white transition-colors"
                      value={jobLimit}
                      onChange={(e) => setJobLimit(e.target.value)}
                    >
                      <option value="25">25 jobs</option>
                      <option value="50">50 jobs</option>
                      <option value="100">100 jobs</option>
                      <option value="200">200 jobs</option>
                      <option value="500">500 jobs (Premium)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-3">Processing Priority</label>
                    <select
                      id="priority"
                      className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 rounded-lg focus:border-indigo-500 focus:outline-none text-sm text-white transition-colors"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="standard">Standard (1-2 hours)</option>
                      <option value="high">High (30 min)</option>
                      <option value="urgent">Urgent (10 min) +$5</option>
                    </select>
                  </div>
                </div>

                <button
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-lg font-semibold text-base hover:shadow-xl hover:shadow-indigo-500/50 transition-all flex items-center justify-center space-x-2"
                  onClick={handleLaunch}
                  disabled={working}
                >
                  <i className="fa-solid fa-rocket"></i>
                  <span>Launch Job Seeker Campaign</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </section>
            </div>

            <div className="col-span-1">
              <section id="campaign-stats" className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-6 mb-6">
                <h3 className="text-lg font-bold text-white mb-4">Campaign Overview</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-lg border border-blue-500/30">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/50">
                        <i className="fa-solid fa-briefcase text-white"></i>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Jobs to Extract</p>
                        <p className="text-2xl font-bold text-white">{jobLimit}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/50">
                        <i className="fa-solid fa-user-tie text-white"></i>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Est. Managers</p>
                        <p className="text-2xl font-bold text-white">~{Math.max(1, Math.round(Number(jobLimit || 0) * 5))}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg border border-green-500/30">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center shadow-lg shadow-green-500/50">
                        <i className="fa-solid fa-clock text-white"></i>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Est. Duration</p>
                        <p className="text-2xl font-bold text-white">{priority === 'urgent' ? '10m' : priority === 'high' ? '30m' : '2h'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg border border-amber-500/30">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/50">
                        <i className="fa-solid fa-coins text-white"></i>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Credits Used</p>
                        <p className="text-2xl font-bold text-white">{Math.max(1, Math.round(Number(jobLimit || 0) * 2.5))}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section id="tips-panel" className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-xl shadow-2xl shadow-purple-500/30 p-6 text-white">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-lightbulb text-xl"></i>
                  </div>
                  <h3 className="text-lg font-bold">Pro Tips</h3>
                </div>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start space-x-2">
                    <i className="fa-solid fa-star text-amber-300 mt-1"></i>
                    <span>Use specific job titles and locations for better targeting</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <i className="fa-solid fa-star text-amber-300 mt-1"></i>
                    <span>Provide detailed context about your experience and preferences</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <i className="fa-solid fa-star text-amber-300 mt-1"></i>
                    <span>Review results in the Results tab before launching outreach</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <i className="fa-solid fa-star text-amber-300 mt-1"></i>
                    <span>Set up notifications to act on high-priority matches quickly</span>
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </div>

        <div id="content-live-activity" className={`tab-content${activeTab !== 'live-activity' ? ' hidden' : ''}`}>
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <section id="active-campaigns" className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Active Campaigns</h3>
                  <div className="flex items-center space-x-2 px-3 py-1 bg-green-500/20 text-green-300 text-sm font-semibold rounded-full border border-green-500/30">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span>{activeRuns.length} Running</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {activeRuns.map((run) => {
                    const extracted = Number(run.progress_json?.job_index || 0);
                    const total = Number(run.job_limit || 0) || 100;
                    const percent = Math.min(100, Math.round((extracted / Math.max(total, 1)) * 100));
                    const managersFound = Number(run.stats_json?.targets_found || 0);
                    return (
                      <div
                        key={run.id}
                        className="p-6 border-2 border-indigo-500 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl cursor-pointer hover:shadow-xl hover:shadow-indigo-500/20 transition-shadow"
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="text-lg font-bold text-white mb-1">{run.search_url.slice(0, 40)}...</h4>
                            <p className="text-sm text-slate-400">Started {new Date(run.created_at).toLocaleString()}</p>
                          </div>
                          <span className="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full flex items-center space-x-2 shadow-lg shadow-blue-500/50">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            <span>{run.status === 'queued' ? 'Queued' : 'Running'}</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                            <p className="text-xs text-slate-400 mb-1">Jobs Extracted</p>
                            <p className="text-2xl font-bold text-white">
                              {extracted}
                              <span className="text-sm font-normal text-slate-500">/{total}</span>
                            </p>
                          </div>
                          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                            <p className="text-xs text-slate-400 mb-1">Signals Analyzed</p>
                            <p className="text-2xl font-bold text-white">
                              {extracted}
                              <span className="text-sm font-normal text-slate-500">/{total}</span>
                            </p>
                          </div>
                          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                            <p className="text-xs text-slate-400 mb-1">Managers Found</p>
                            <p className="text-2xl font-bold text-white">{managersFound}</p>
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                            <span>Overall Progress</span>
                            <span className="font-semibold text-white">{percent}%</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2">
                            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full shadow-lg shadow-indigo-500/50" style={{ width: `${percent}%` }}></div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 text-sm text-slate-400">
                            <i className="fa-solid fa-clock text-blue-400"></i>
                            <span>Est. running</span>
                          </div>
                          <button className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-700 hover:text-white transition-colors">
                            <i className="fa-solid fa-eye mr-2"></i>View Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section id="completed-campaigns" className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-8 mt-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Completed Campaigns</h3>
                  <button className="text-sm text-indigo-400 font-medium hover:text-indigo-300">View All</button>
                </div>

                <div className="space-y-3">
                  {completedRuns.map((run) => (
                    <div key={run.id} className="p-4 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer border border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-base font-semibold text-white">{run.search_url.slice(0, 40)}...</span>
                        <span className="px-3 py-1 bg-green-500/20 text-green-300 text-xs font-semibold rounded-full border border-green-500/30">Complete</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>{run.stats_json?.jobs_found || 0} jobs • {run.stats_json?.targets_found || 0} managers found</span>
                        <span>{new Date(run.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="col-span-1">
              <section id="activity-stats" className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-6 mb-6">
                <h3 className="text-lg font-bold text-white mb-4">Activity Stats</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-lg border border-blue-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400 font-medium">Total Campaigns</span>
                      <i className="fa-solid fa-rocket text-blue-400"></i>
                    </div>
                    <p className="text-3xl font-bold text-white">{runs.length}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg border border-green-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400 font-medium">Jobs Analyzed</span>
                      <i className="fa-solid fa-briefcase text-green-400"></i>
                    </div>
                    <p className="text-3xl font-bold text-white">{runs.reduce((sum, r) => sum + Number(r.stats_json?.jobs_found || 0), 0)}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400 font-medium">Managers Found</span>
                      <i className="fa-solid fa-users text-purple-400"></i>
                    </div>
                    <p className="text-3xl font-bold text-white">{runs.reduce((sum, r) => sum + Number(r.stats_json?.targets_found || 0), 0)}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg border border-amber-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400 font-medium">Avg. Success Rate</span>
                      <i className="fa-solid fa-chart-line text-amber-400"></i>
                    </div>
                    <p className="text-3xl font-bold text-white">87%</p>
                  </div>
                </div>
              </section>

              <section id="notifications-panel" className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl shadow-2xl shadow-purple-500/30 p-6 text-white">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-bell text-xl"></i>
                  </div>
                  <h3 className="text-lg font-bold">Recent Updates</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-white bg-opacity-10 rounded-lg backdrop-blur-sm">
                    <p className="font-semibold mb-1">High-priority match found</p>
                    <p className="text-xs text-indigo-200">VP of Product at TechCorp - 98% match</p>
                    <p className="text-xs text-indigo-300 mt-1">2 min ago</p>
                  </div>
                  <div className="p-3 bg-white bg-opacity-10 rounded-lg backdrop-blur-sm">
                    <p className="font-semibold mb-1">Campaign completed</p>
                    <p className="text-xs text-indigo-200">Data Analyst - NYC finished successfully</p>
                    <p className="text-xs text-indigo-300 mt-1">2 hours ago</p>
                  </div>
                  <div className="p-3 bg-white bg-opacity-10 rounded-lg backdrop-blur-sm">
                    <p className="font-semibold mb-1">New managers identified</p>
                    <p className="text-xs text-indigo-200">47 hiring managers added to results</p>
                    <p className="text-xs text-indigo-300 mt-1">3 hours ago</p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        <div id="content-results" className={`tab-content${activeTab !== 'results' ? ' hidden' : ''}`}>
          <section id="results-header" className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Hiring Manager Results</h3>
                <p className="text-sm text-slate-400">Review, rank, and add targets to your leads or launch outreach campaigns</p>
              </div>
              <div className="flex items-center space-x-3">
                <button className="px-4 py-2 bg-slate-800 text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-700 hover:text-white transition-colors border border-slate-700">
                  <i className="fa-solid fa-filter mr-2"></i>Filter Results
                </button>
                <button className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-lg hover:shadow-xl hover:shadow-indigo-500/50 transition-all">
                  <i className="fa-solid fa-download mr-2"></i>Export All
                </button>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-4 gap-6 mb-6">
            <div className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400 font-medium">Total Managers</span>
                <i className="fa-solid fa-users text-blue-400"></i>
              </div>
              <p className="text-3xl font-bold text-white">{targets.length}</p>
            </div>
            <div className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400 font-medium">High Match</span>
                <i className="fa-solid fa-star text-amber-400"></i>
              </div>
              <p className="text-3xl font-bold text-white">{targets.filter((t) => Number(t.match_score || 0) >= 85).length}</p>
            </div>
            <div className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400 font-medium">Added to Leads</span>
                <i className="fa-solid fa-check-circle text-green-400"></i>
              </div>
              <p className="text-3xl font-bold text-white">0</p>
            </div>
            <div className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400 font-medium">In Outreach</span>
                <i className="fa-solid fa-paper-plane text-purple-400"></i>
              </div>
              <p className="text-3xl font-bold text-white">0</p>
            </div>
          </div>

          <section id="results-table" className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-500/50">All Results</button>
                <button className="px-4 py-2 text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-800 hover:text-white">High Match ({targets.filter((t) => Number(t.match_score || 0) >= 85).length})</button>
                <button className="px-4 py-2 text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-800 hover:text-white">Medium Match ({targets.filter((t) => Number(t.match_score || 0) >= 60 && Number(t.match_score || 0) < 85).length})</button>
                <button className="px-4 py-2 text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-800 hover:text-white">Low Match ({targets.filter((t) => Number(t.match_score || 0) < 60).length})</button>
              </div>
              <div className="flex items-center space-x-2">
                <select className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
                  <option>Sort by: Relevance</option>
                  <option>Sort by: Match Score</option>
                  <option>Sort by: Seniority</option>
                  <option>Sort by: Company</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {targets.map((t) => (
                <div key={t.id} className="p-5 border border-slate-700 bg-slate-800/50 rounded-lg hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/20 transition-all cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-indigo-600 rounded border-slate-600 focus:ring-indigo-500 mt-1 bg-slate-700"
                        checked={Boolean(selectedTargets[t.id])}
                        onChange={(e) => setSelectedTargets((prev) => ({ ...prev, [t.id]: e.target.checked }))}
                      />
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-indigo-500 shadow-lg shadow-indigo-500/50">
                        <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg" alt="Manager" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-lg font-bold text-white">{t.target_name || 'Hiring Manager'}</h4>
                          <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-full flex items-center space-x-1 border border-amber-500/30">
                            <i className="fa-solid fa-star text-xs"></i>
                            <span>{Math.round(Number(t.match_score || 0))}% Match</span>
                          </span>
                          <a href={t.target_profile_url || '#'} className="text-blue-400 hover:text-blue-300" target="_blank" rel="noreferrer">
                            <i className="fa-brands fa-linkedin text-lg"></i>
                          </a>
                        </div>
                        <p className="text-sm text-slate-300 font-medium mb-1">{t.target_title || 'Hiring Manager'} • {t.company || 'Company'}</p>
                        <p className="text-sm text-slate-400 mb-3">{t.location || 'Location'} • Hiring for {t.title || 'Role'}</p>
                        <div className="flex items-center space-x-4 text-xs text-slate-500">
                          <span className="flex items-center space-x-1">
                            <i className="fa-solid fa-briefcase"></i>
                            <span>Hiring for: {t.title || 'Role'}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <i className="fa-solid fa-building"></i>
                            <span>{t.company || 'Company'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <button className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-lg hover:shadow-xl hover:shadow-indigo-500/50 transition-all">
                        <i className="fa-solid fa-paper-plane mr-2"></i>Launch Outreach
                      </button>
                      <button className="px-4 py-2 bg-green-500/20 text-green-300 text-sm font-medium rounded-lg hover:bg-green-500/30 transition-colors border border-green-500/30">
                        <i className="fa-solid fa-plus mr-2"></i>Add to Leads
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button className="px-4 py-2 bg-slate-800 text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-700 hover:text-white border border-slate-700">
                    <i className="fa-solid fa-plus mr-2"></i>Add Selected to Leads ({Object.values(selectedTargets).filter(Boolean).length})
                  </button>
                  <button className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-lg hover:shadow-xl hover:shadow-indigo-500/50">
                    <i className="fa-solid fa-paper-plane mr-2"></i>Launch Outreach Campaign
                  </button>
                </div>
                <div className="flex items-center space-x-2 text-sm text-slate-400">
                  <button className="px-3 py-2 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white">
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>
                  <span>Page 1 of 27</span>
                  <button className="px-3 py-2 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white">
                    <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section id="outreach-templates" className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl shadow-2xl shadow-purple-500/30 p-8 mt-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <i className="fa-solid fa-envelope text-2xl"></i>
                  </div>
                  <h3 className="text-2xl font-bold">Saved Email Templates</h3>
                </div>
                <p className="text-lg text-purple-100 mb-6">Launch outreach campaigns using your pre-saved templates from Messages Center</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-white bg-opacity-10 rounded-lg backdrop-blur-sm hover:bg-opacity-20 transition-all cursor-pointer border border-white/10">
                    <h4 className="font-bold mb-1">Cold Intro Template</h4>
                    <p className="text-sm text-purple-200">Professional first-touch message</p>
                  </div>
                  <div className="p-4 bg-white bg-opacity-10 rounded-lg backdrop-blur-sm hover:bg-opacity-20 transition-all cursor-pointer border border-white/10">
                    <h4 className="font-bold mb-1">Warm Follow-up</h4>
                    <p className="text-sm text-purple-200">Second touch with value add</p>
                  </div>
                  <div className="p-4 bg-white bg-opacity-10 rounded-lg backdrop-blur-sm hover:bg-opacity-20 transition-all cursor-pointer border border-white/10">
                    <h4 className="font-bold mb-1">Coffee Chat Request</h4>
                    <p className="text-sm text-purple-200">Casual meeting invitation</p>
                  </div>
                </div>
              </div>
              <button className="px-6 py-3 bg-white text-purple-600 font-bold rounded-lg hover:bg-purple-50 transition-colors shadow-lg">
                <i className="fa-solid fa-plus mr-2"></i>New Template
              </button>
            </div>
          </section>
        </div>
      </main>

    </div>
  );
}
