import React, { useEffect, useMemo, useState } from 'react';
import {
  FaRocket,
  FaBell,
  FaBriefcase,
  FaEye,
  FaComments,
  FaClock,
  FaMagnifyingGlass,
  FaUserPen,
  FaFileLines,
  FaChartLine,
} from 'react-icons/fa6';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { supabase } from '../../lib/supabaseClient';

const placeholders = [
  'Find senior React dev roles at startups',
  'Help me message a CTO',
  'What should I say to this recruiter?',
  'Find hiring managers for product roles',
];

export default function JobSeekerDashboardPage() {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const navigate = useNavigate();
  const { progress, loading, completedKeys } = useOnboardingProgress();
  const [profileName, setProfileName] = useState('there');
  const [stats, setStats] = useState({ opportunities: 0, outreach: 0, interviews: 0 });
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  const completionPct = useMemo(() => {
    if (!progress?.total_steps) return 0;
    return Math.round((progress.total_completed / progress.total_steps) * 100);
  }, [progress]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: profile } = await supabase
            .from('users')
            .select('first_name,last_name,full_name,email')
            .eq('id', user.id)
            .maybeSingle();
          const meta = user.user_metadata || {};
          const parts = [
            profile?.first_name || meta.first_name || meta.firstName || '',
            profile?.last_name || meta.last_name || meta.lastName || '',
          ].filter(Boolean);
          const derived = (profile?.full_name || meta.full_name || parts.join(' ') || user.email || '').trim();
          setProfileName(derived || 'there');
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const base = import.meta.env.VITE_BACKEND_URL || '';

        // Opportunities (job req count)
        let opportunities = 0;
        try {
          const resp = await fetch(`${base}/api/jobs`, { headers: { Authorization: `Bearer ${token}` } });
          const js = await resp.json();
          opportunities = Array.isArray(js?.jobs) ? js.jobs.length : (Array.isArray(js) ? js.length : 0);
          setRecentJobs(Array.isArray(js?.jobs) ? js.jobs.slice(0, 3) : []);
        } catch {}

        // Outreach count — using candidate_jobs as proxy for outreach
        let outreach = 0;
        try {
          const resp = await fetch(`${base}/api/pipelines/candidates/count`, { headers: { Authorization: `Bearer ${token}` } });
          const js = await resp.json();
          outreach = js?.count || 0;
        } catch {}

        // Interviews count + upcoming
        let interviews = 0;
        const upcomingList: any[] = [];
        try {
          const resp = await fetch(`${base}/api/pipelines/interviews`, { headers: { Authorization: `Bearer ${token}` } });
          const js = await resp.json();
          interviews = js?.count || 0;
          if (Array.isArray(js?.items)) {
            upcomingList.push(...js.items.slice(0, 5));
          }
        } catch {}

        setStats({ opportunities, outreach, interviews });
        setUpcoming(upcomingList);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % placeholders.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = (e.target as HTMLInputElement).value.trim();
      if (!value) return;
      try {
        sessionStorage.setItem('rexPrompt', value);
      } catch {}
      window.location.href = '/rex-chat?source=dashboard';
    }
  };

  return (
    <div className="bg-[#0b1220] text-gray-100 min-h-screen font-sans">
      {/* Main Dashboard */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Welcome back, {profileName || 'there'}</h1>
              <p className="text-gray-400">Ready to accelerate your career journey?</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Today</div>
              <div className="text-lg font-semibold text-white">December 12, 2024</div>
            </div>
          </div>
        </section>

        {/* REX Quick Chat */}
        <section className="mb-12">
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/10 bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm text-gray-400 font-medium">HirePilot AI Assistant</span>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-violet-400 font-mono font-semibold">$</span>
                  <span className="text-lg font-semibold text-white">REX</span>
                </div>
              </div>

              <div className="relative">
                <input
                  type="text"
                  onKeyDown={handleKeyPress}
                  placeholder={placeholders[placeholderIndex]}
                  className="w-full bg-transparent border-none outline-none text-white text-lg placeholder-gray-500 py-3 pr-20"
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <span className="text-xs text-gray-500 bg-[#1a1a1a] px-2 py-1 rounded">Press Enter to chat →</span>
                </div>
              </div>
              <div className="text-white text-lg animate-pulse">|</div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick stats */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: <FaBriefcase className="text-blue-400" />, value: stats.opportunities, label: 'Job Opportunities', delta: '' },
                { icon: <FaEye className="text-green-400" />, value: stats.outreach, label: 'Job Outreach', delta: '' },
                { icon: <FaComments className="text-violet-400" />, value: stats.interviews, label: 'Interviews', delta: '' },
              ].map((item) => (
                <div key={item.label} className="bg-[#1a1a1a] rounded-xl p-6 border border-[#262626]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-slate-800/50 rounded-lg flex items-center justify-center">{item.icon}</div>
                    <span className="text-2xl font-bold text-white">{item.value}</span>
                  </div>
                  <h3 className="text-gray-400 text-sm">{item.label}</h3>
                  {item.delta && <p className="text-xs text-green-400 mt-1">{item.delta}</p>}
                </div>
              ))}
            </section>

            {/* Recent Jobs */}
            <section className="bg-[#1a1a1a] rounded-xl p-6 border border-[#262626]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Recent Jobs</h2>
                <button className="text-violet-400 text-sm hover:text-violet-300" onClick={() => navigate('/jobs')}>View all</button>
              </div>
              <div className="space-y-4">
                {(recentJobs || []).length === 0 && (
                  <p className="text-sm text-gray-400">No recent jobs yet.</p>
                )}
                {(recentJobs || []).map((job, idx) => {
                  const letter = String(job.title || 'J').charAt(0).toUpperCase();
                  const status = job.status || 'Offer';
                  return (
                    <div key={job.id || idx} className="flex items-center space-x-4 p-4 bg-[#262626] rounded-lg">
                      <div className={`w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center`}>
                        <span className="text-white font-bold">{letter}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-medium">{job.title || 'Job'}</h3>
                        <p className="text-gray-400 text-sm">{job.company || job.location || '—'}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-green-400 text-sm">{status}</span>
                        <p className="text-gray-500 text-xs">{job.updated_at ? new Date(job.updated_at).toLocaleDateString() : ''}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-8">
          {/* Onboarding progress */}
          <motion.section
            whileHover={{ y: -2 }}
            className="bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-blue-500/5 rounded-xl p-6 border border-white/5 shadow-lg shadow-indigo-500/10"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-indigo-100/70">Job search setup</div>
                <h2 className="text-xl font-semibold text-white mt-1">Onboarding wizard</h2>
                <p className="text-sm text-zinc-200/80">
                  {progress?.total_completed ?? 0} of {progress?.total_steps ?? 7} steps complete
                </p>
              </div>
              <button
                onClick={() => navigate('/onboarding')}
                className="px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 border border-white/10 text-sm font-medium"
              >
                Continue
              </button>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500 transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-zinc-200/80">
              <span>Credits earned: {progress?.total_credits_awarded ?? 0} / 100</span>
              <span>{completionPct}%</span>
            </div>
          </motion.section>

            {/* Upcoming Interviews */}
            <section className="bg-[#1a1a1a] rounded-xl p-6 border border-[#262626]">
              <h2 className="text-xl font-semibold text-white mb-6">Upcoming Interviews</h2>
              <div className="space-y-4">
                {(upcoming || []).length === 0 && <p className="text-sm text-gray-400">No interviews yet.</p>}
                {(upcoming || []).map((item, idx) => (
                  <div key={item.id || idx} className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-white font-medium">{item.job_title || 'Interview'}</h3>
                      <span className="text-xs text-violet-400 bg-violet-500/20 px-2 py-1 rounded">{item.when || 'Soon'}</span>
                    </div>
                    <p className="text-gray-400 text-sm mb-2">{item.company || item.location || '—'}</p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <FaClock />
                      <span>{item.time || ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Quick Actions */}
            <section className="bg-[#1a1a1a] rounded-xl p-6 border border-[#262626]">
              <h2 className="text-xl font-semibold text-white mb-6">Quick Actions</h2>
              <div className="space-y-3">
                {[
                  { icon: <FaMagnifyingGlass className="text-blue-400" />, label: 'Browse Jobs', href: '/jobs' },
                  { icon: <FaUserPen className="text-green-400" />, label: 'Update Profile', href: '/prep/landing-page' },
                  { icon: <FaFileLines className="text-violet-400" />, label: 'Upload Resume', href: '/prep' },
                  { icon: <FaChartLine className="text-orange-400" />, label: 'View Analytics', href: '/analytics' },
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.href)}
                    className="w-full text-left p-3 bg-[#262626] hover:bg-[#404040] rounded-lg transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      {action.icon}
                      <span className="text-white">{action.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
