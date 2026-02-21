import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined' && window.location.host.endsWith('thehirepilot.com')
    ? 'https://api.thehirepilot.com'
    : 'http://localhost:8080');

type SessionRow = {
  id: string;
  role_title: string;
  company: string | null;
  started_at: string;
  status: 'in_progress' | 'completed';
  score_out_of_10?: number | null;
  prep_pack_id?: string | null;
};

function formatDate(input: string) {
  const value = new Date(input);
  if (Number.isNaN(value.getTime())) return 'Unknown date';
  return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function InterviewHelperHubPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedPrepPackId, setSelectedPrepPackId] = useState('');

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/interview/sessions`, {
        credentials: 'include',
      }).catch(() => null);
      if (!response?.ok) return;
      const payload = await response.json().catch(() => null);
      if (Array.isArray(payload?.sessions)) {
        setSessions(payload.sessions as SessionRow[]);
      }
    };
    void load();
  }, []);

  const analytics = useMemo(() => {
    const completed = sessions.filter((session) => session.status === 'completed');
    const scores = completed
      .map((session) => Number(session.score_out_of_10))
      .filter((score) => Number.isFinite(score));
    const avgScore = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
    return {
      completedCount: completed.length,
      avgScore: avgScore.toFixed(1),
      strongest: 'Structure',
      improved: 'Conciseness',
    };
  }, [sessions]);
  const prepPackSessions = useMemo(
    () => sessions.filter((session) => session.prep_pack_id).slice(0, 10),
    [sessions]
  );
  const latestPrepPack = prepPackSessions[0]?.prep_pack_id || '';

  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#e5e5e5] font-['Inter',sans-serif]">
      <style>{`
        .card-hover { transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.1); }
        .glow-on-hover:hover { box-shadow: 0 0 30px rgba(59, 130, 246, 0.15); }
        .metric-card { background: linear-gradient(135deg, rgba(17, 24, 39, 0.6) 0%, rgba(17, 24, 39, 0.4) 100%); backdrop-filter: blur(10px); }
      `}</style>
      <header id="header" className="h-16 border-b border-white/5 bg-[#0B0F14]/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <a href="#" className="text-xl font-semibold text-white tracking-tight">HirePilot</a>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</a>
              <a href="#" className="text-sm text-blue-400 font-medium">Interview Helper</a>
              <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Resume</a>
              <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Jobs</a>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
              <i className="fa-regular fa-bell text-lg"></i>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 overflow-hidden">
              <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" alt="User" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <section id="hero-section" className="mb-12 md:mb-16">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white mb-3 tracking-tight">Interview Helper</h1>
              <p className="text-base md:text-lg text-gray-400 font-light">Practice smarter. Improve faster.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 flex items-center justify-center gap-2"
                onClick={() =>
                  navigate(
                    `/interview-helper/session/new${
                      selectedPrepPackId ? `?prepPackId=${encodeURIComponent(selectedPrepPackId)}` : ''
                    }`
                  )
                }
              >
                <i className="fa-solid fa-plus"></i>
                <span>Start New Session</span>
              </button>
              <button className="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl font-medium transition-all border border-white/10 flex items-center justify-center gap-2">
                <i className="fa-solid fa-file-arrow-up"></i>
                <span>Upload Resume</span>
              </button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <select
              value={selectedPrepPackId}
              onChange={(e) => setSelectedPrepPackId(e.target.value)}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-200"
            >
              <option value="">Start without prep pack</option>
              {prepPackSessions.map((session) => (
                <option key={`${session.id}-${session.prep_pack_id}`} value={String(session.prep_pack_id)}>
                  {session.role_title} • {session.company || 'Unknown company'} • {formatDate(session.started_at)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!latestPrepPack}
              onClick={() => latestPrepPack && navigate(`/interview-helper/prep/${latestPrepPack}`)}
              className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue Last Prep Pack
            </button>
          </div>
        </section>

        <section id="analytics-strip" className="mb-10 md:mb-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="metric-card border border-white/5 rounded-xl p-4 md:p-5">
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Sessions</div>
              <div className="text-2xl md:text-3xl font-bold text-white mb-1">{analytics.completedCount}</div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
            <div className="metric-card border border-white/5 rounded-xl p-4 md:p-5">
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Avg Score</div>
              <div className="text-2xl md:text-3xl font-bold text-blue-400 mb-1">{analytics.avgScore}</div>
              <div className="text-xs text-green-400 flex items-center gap-1">
                <i className="fa-solid fa-arrow-up text-[10px]"></i>
                <span>Across completed sessions</span>
              </div>
            </div>
            <div className="metric-card border border-white/5 rounded-xl p-4 md:p-5 col-span-2 lg:col-span-1">
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Strongest</div>
              <div className="text-base md:text-lg font-semibold text-white mb-1">{analytics.strongest}</div>
              <div className="text-xs text-gray-500">From coaching patterns</div>
            </div>
            <div className="metric-card border border-white/5 rounded-xl p-4 md:p-5 col-span-2 lg:col-span-1">
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Most Improved</div>
              <div className="text-base md:text-lg font-semibold text-white mb-1">{analytics.improved}</div>
              <div className="text-xs text-gray-500">Session over session</div>
            </div>
          </div>
        </section>

        <section id="session-history" className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-semibold text-white">Recent Sessions</h2>
            <button className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
              <span>View All</span>
              <i className="fa-solid fa-arrow-right text-xs"></i>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {sessions.map((session) => {
              const score = Number(session.score_out_of_10);
              const hasScore = Number.isFinite(score);
              return (
                <div
                  key={session.id}
                  className="card-hover glow-on-hover bg-[#111827] border border-white/5 rounded-xl p-5 cursor-pointer"
                  onClick={() => navigate(`/interview-helper/session/${session.id}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-white mb-1 truncate">{session.role_title}</h3>
                      <p className="text-sm text-gray-400 truncate">{session.company || 'Company not set'}</p>
                    </div>
                    <div className="flex-shrink-0 ml-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center">
                        {hasScore ? (
                          <span className="text-white font-bold text-sm">{score.toFixed(1)}</span>
                        ) : (
                          <i className="fa-solid fa-ellipsis text-white/75"></i>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span className="flex items-center gap-1.5">
                      <i className="fa-regular fa-calendar"></i>
                      <span>{formatDate(session.started_at)}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <i className="fa-regular fa-clock"></i>
                      <span>{session.status === 'completed' ? 'Completed' : 'In progress'}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.status === 'completed' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                        <i className="fa-solid fa-circle-check mr-1.5 text-[10px]"></i>
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                        <i className="fa-solid fa-circle-pause mr-1.5 text-[10px]"></i>
                        In Progress
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="best-answers-library" className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold text-white mb-1">Best Answers Library</h2>
              <p className="text-sm text-gray-500">Your improved responses, ready to use</p>
            </div>
            <button className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
              <span>Export All</span>
              <i className="fa-solid fa-download text-xs"></i>
            </button>
          </div>
          <div className="space-y-4">
            <div className="bg-[#111827] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h3 className="text-base font-medium text-white mb-2">Tell me about a time you had to influence stakeholders without authority</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">Behavioral</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">Leadership</span>
                    <span className="text-xs text-gray-600">•</span>
                    <span className="text-xs text-gray-500">Improved on Dec 18</span>
                  </div>
                </div>
                <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1.5">
                  <i className="fa-regular fa-copy"></i>
                  <span>Copy</span>
                </button>
              </div>
              <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                <p className="text-sm text-gray-300 leading-relaxed">At TechFlow, I needed to convince our engineering team to prioritize a customer-facing analytics dashboard over internal tooling...</p>
              </div>
            </div>
          </div>
        </section>

        <section id="practice-plan" className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold text-white mb-1">Practice Plan</h2>
              <p className="text-sm text-gray-500">Personalized improvement roadmap</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#111827] border border-white/5 rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-white">Week 1 Focus</h3>
                <span className="text-xs px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20 font-medium">Current</span>
              </div>
              <div className="space-y-4 text-sm text-gray-300">
                <div className="p-3 bg-white/5 rounded-lg border border-white/5">Add metrics to 3 answers</div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/5">Reduce filler words</div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/5">Practice 2 technical questions</div>
              </div>
            </div>
            <div className="bg-[#111827] border border-white/5 rounded-xl p-6 opacity-60">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-white">Week 2 Focus</h3>
                <span className="text-xs px-2.5 py-1 bg-white/5 text-gray-500 rounded-full border border-white/5 font-medium">Upcoming</span>
              </div>
              <div className="space-y-4 text-sm text-gray-300">
                <div className="p-3 bg-white/5 rounded-lg border border-white/5">Shorten responses by 15%</div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/5">Master conflict resolution stories</div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/5">Improve closing statements</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer id="footer" className="border-t border-white/5 bg-[#0B0F14] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Powered by</span>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-md border border-blue-500/20">
                <i className="fa-solid fa-bolt text-xs text-blue-400"></i>
                <span className="font-semibold text-blue-400">REX AI</span>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <a href="#" className="hover:text-white transition-colors">Help</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
