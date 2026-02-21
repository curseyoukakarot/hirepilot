import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

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
  const location = useLocation();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionTitle, setSessionTitle] = useState('Senior Product Manager');
  const [selectedPrepPackId, setSelectedPrepPackId] = useState('');
  const [rexContext, setRexContext] = useState('');
  const [includeContextInInterview, setIncludeContextInInterview] = useState(true);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeStatus, setResumeStatus] = useState('');
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadSessions = async () => {
    const sessionResult = await supabase.auth.getSession().catch(() => null);
    const accessToken = sessionResult?.data?.session?.access_token || '';
    const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/interview/sessions`, {
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: 'include',
    }).catch(() => null);
    if (!response?.ok) return;
    const payload = await response.json().catch(() => null);
    if (Array.isArray(payload?.sessions)) {
      setSessions(payload.sessions as SessionRow[]);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const fromQuery = (params.get('rexContext') || '').trim();
      if (fromQuery) {
        setRexContext(fromQuery);
        localStorage.setItem('interview_helper_rex_context', fromQuery);
        return;
      }
      const saved = localStorage.getItem('interview_helper_rex_context') || '';
      if (saved) setRexContext(saved);
      const savedTitle = localStorage.getItem('interview_helper_session_title') || '';
      if (savedTitle) setSessionTitle(savedTitle);
      const includeContextRaw = localStorage.getItem('interview_helper_include_context');
      if (includeContextRaw != null) setIncludeContextInInterview(includeContextRaw === '1');
    } catch {
      // no-op
    }
  }, [location.search]);

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
  const startNewSession = () => {
    const params = new URLSearchParams();
    if (selectedPrepPackId) params.set('prepPackId', selectedPrepPackId);
    const normalizedTitle = sessionTitle.trim() || 'Interview Practice Session';
    params.set('sessionTitle', normalizedTitle);
    params.set('includeContext', includeContextInInterview ? '1' : '0');
    const trimmedContext = rexContext.trim();
    if (trimmedContext && includeContextInInterview) {
      try {
        localStorage.setItem('interview_helper_rex_context', trimmedContext);
      } catch {
        // no-op
      }
    } else {
      try {
        localStorage.removeItem('interview_helper_rex_context');
      } catch {
        // no-op
      }
    }
    try {
      localStorage.setItem('interview_helper_session_title', normalizedTitle);
      localStorage.setItem('interview_helper_include_context', includeContextInInterview ? '1' : '0');
    } catch {
      // no-op
    }
    navigate(`/interview-helper/session/new${params.toString() ? `?${params.toString()}` : ''}`);
  };
  const handleUploadResumeClick = () => {
    fileInputRef.current?.click();
  };
  const handleResumeFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingResume(true);
    setResumeStatus('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const form = new FormData();
      form.append('file', file);
      const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/rex/uploads`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: form,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setResumeStatus('Upload failed. Please try again.');
        return;
      }
      const uploadedName = String(payload?.name || file.name || 'resume');
      const extracted = String(payload?.text || '').trim();
      const excerpt = extracted
        ? extracted.replace(/\s+/g, ' ').slice(0, 2600)
        : `Resume file "${uploadedName}" uploaded. Ask targeted questions based on this candidate's likely experience.`;
      const resumeContextBlock = `Candidate resume (${uploadedName}) context:\n${excerpt}`;
      setRexContext((prev) => {
        const base = prev.trim();
        const merged = base ? `${base}\n\n${resumeContextBlock}` : resumeContextBlock;
        const capped = merged.slice(0, 4000);
        try {
          localStorage.setItem('interview_helper_rex_context', capped);
        } catch {
          // no-op
        }
        return capped;
      });
      setResumeStatus(`Uploaded ${uploadedName}. REX now has resume context for this session.`);
    } catch {
      setResumeStatus('Upload failed. Please try again.');
    } finally {
      setUploadingResume(false);
      if (event.target) event.target.value = '';
      void loadSessions();
    }
  };
  const handleEditSession = async (session: SessionRow) => {
    const nextTitle = window.prompt('Rename session', session.role_title || '')?.trim();
    if (!nextTitle || nextTitle === session.role_title) return;
    const sessionResult = await supabase.auth.getSession().catch(() => null);
    const accessToken = sessionResult?.data?.session?.access_token || '';
    const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/interview/sessions/${encodeURIComponent(session.id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ role_title: nextTitle }),
    }).catch(() => null);
    if (!response?.ok) return;
    setOpenMenuSessionId(null);
    await loadSessions();
  };
  const handleDeleteSession = async (session: SessionRow) => {
    const confirmed = window.confirm(`Delete session "${session.role_title}"? This cannot be undone.`);
    if (!confirmed) return;
    const sessionResult = await supabase.auth.getSession().catch(() => null);
    const accessToken = sessionResult?.data?.session?.access_token || '';
    const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/interview/sessions/${encodeURIComponent(session.id)}`, {
      method: 'DELETE',
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: 'include',
    }).catch(() => null);
    if (!response?.ok) return;
    setOpenMenuSessionId(null);
    await loadSessions();
  };
  const handleClearInterviewContext = () => {
    setRexContext('');
    setResumeStatus('');
    try {
      localStorage.removeItem('interview_helper_rex_context');
    } catch {
      // no-op
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#e5e5e5] font-['Inter',sans-serif]">
      <style>{`
        .card-hover { transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.1); }
        .glow-on-hover:hover { box-shadow: 0 0 30px rgba(59, 130, 246, 0.15); }
        .metric-card { background: linear-gradient(135deg, rgba(17, 24, 39, 0.6) 0%, rgba(17, 24, 39, 0.4) 100%); backdrop-filter: blur(10px); }
      `}</style>
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
                onClick={startNewSession}
              >
                <i className="fa-solid fa-plus"></i>
                <span>Start New Session</span>
              </button>
              <button
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl font-medium transition-all border border-white/10 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleUploadResumeClick}
                disabled={uploadingResume}
              >
                <i className="fa-solid fa-file-arrow-up"></i>
                <span>{uploadingResume ? 'Uploading Resume...' : 'Upload Resume'}</span>
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleResumeFileSelected} />
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-3">
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-2">Session Title</label>
            <input
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="Name this interview session"
              maxLength={160}
              className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 mb-3"
            />
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-2">Additional REX Interview Context</label>
            <textarea
              value={rexContext}
              onChange={(e) => setRexContext(e.target.value)}
              placeholder="Example: Focus on PM leadership at fintech scale, ask stricter follow-ups on metrics and stakeholder influence."
              maxLength={4000}
              className="w-full min-h-[92px] rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <div className="mt-1 flex items-center justify-between">
              <button
                type="button"
                onClick={handleClearInterviewContext}
                disabled={!rexContext}
                className="text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear context
              </button>
              <div className="text-xs text-gray-500">{rexContext.length}/4000</div>
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={includeContextInInterview}
                onChange={(e) => setIncludeContextInInterview(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-black/40"
              />
              <span>Add context to interview</span>
            </label>
            {resumeStatus ? <div className="text-xs text-blue-300 mt-2">{resumeStatus}</div> : null}
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
                  className="card-hover glow-on-hover relative bg-[#111827] border border-white/5 rounded-xl p-5 cursor-pointer"
                  onClick={() => navigate(`/interview-helper/session/${session.id}`)}
                >
                  <button
                    type="button"
                    className="absolute top-3 right-3 h-8 w-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuSessionId((prev) => (prev === session.id ? null : session.id));
                    }}
                    aria-label="Session actions"
                  >
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                  </button>
                  {openMenuSessionId === session.id ? (
                    <div
                      className="absolute top-12 right-3 z-20 min-w-[120px] rounded-lg border border-white/10 bg-[#0f172a] shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10"
                        onClick={() => void handleEditSession(session)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-white/10"
                        onClick={() => void handleDeleteSession(session)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
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
