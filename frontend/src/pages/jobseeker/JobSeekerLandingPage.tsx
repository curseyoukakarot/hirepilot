import React, { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { JobSeekerPublicNav } from '../../components/jobseeker/JobSeekerPublicNav';
import PublicFooterJobs from '../../components/PublicFooterJobs';

export default function JobSeekerLandingPage() {
  const navigate = useNavigate();
  const jobsCounterRef = useRef<HTMLDivElement | null>(null);
  const managersCounterRef = useRef<HTMLDivElement | null>(null);
  const timeCounterRef = useRef<HTMLDivElement | null>(null);
  const hasAnimatedRef = useRef(false);

  const handleStart = useCallback(() => {
    navigate('/signup');
  }, [navigate]);

  const goToRex = useCallback(() => {
    navigate('/prep/rex-chat');
  }, [navigate]);

  const scrollToId = useCallback(
    (id: string) => {
      if (typeof window === 'undefined') return;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigate(`/#${id}`);
        setTimeout(() => {
          const target = document.getElementById(id);
          if (target) target.scrollIntoView({ behavior: 'smooth' });
        }, 200);
      }
    },
    [navigate]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const animateCounter = (element: HTMLElement | null, target: number, duration: number) => {
      if (!element) return;
      const start = performance.now();
      const step = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const value = Math.floor(progress * target);
        element.textContent = value.toString();
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          element.textContent = target.toString();
        }
      };
      requestAnimationFrame(step);
    };

    const statsSection = document.getElementById('connection-engine');
    if (!statsSection) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          animateCounter(jobsCounterRef.current, 100, 2000);
          animateCounter(managersCounterRef.current, 500, 2000);
          animateCounter(timeCounterRef.current, 30, 2000);
          observer.disconnect();
        }
      });
    });

    observer.observe(statsSection);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-gradient-to-br from-[#0B0F1A] via-[#111827] to-[#0B0F1A] text-white font-sans">
      <style>{`
        ::-webkit-scrollbar { display: none; }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-glow { animation: glow 3s ease-in-out infinite; }
        .animate-slide-up { animation: slideUp 0.8s ease-out forwards; }
        .animate-fade-up { animation: fadeUp 0.7s ease-out both; }
        .glass-panel {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .gradient-border {
          position: relative;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid transparent;
        }
        .gradient-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(236, 72, 153, 0.4));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
        }
        .counter { font-variant-numeric: tabular-nums; }
      `}</style>

      <div className="sticky top-0 z-50">
        <JobSeekerPublicNav variant="dark" />
      </div>

      <section id="hero" className="relative pt-44 sm:pt-32 pb-20 px-6 overflow-hidden h-[900px] flex items-center animate-fade-up">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/20"></div>
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-glow"></div>
        <div
          className="absolute bottom-20 right-10 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-glow"
          style={{ animationDelay: '1.5s' }}
        ></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 animate-slide-up">
              <div className="inline-block">
                <span className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 text-sm font-medium text-purple-300">
                  <i className="fa-solid fa-sparkles mr-2"></i>Career Operating System
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black leading-tight">
                Turn Your Job Search Into a{' '}
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                  High-Performance Campaign
                </span>
              </h1>

              <p className="text-xl text-gray-300 leading-relaxed max-w-2xl">
                HirePilot automates meaningful connections — helping you source opportunities, target hiring managers, and launch
                intelligent outreach campaigns powered by AI.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105"
                  onClick={handleStart}
                >
                  Start Free
                  <i className="fa-solid fa-arrow-right ml-2"></i>
                </button>
                <button
                  type="button"
                  className="px-8 py-4 glass-panel rounded-xl font-semibold text-lg hover:bg-white/10 transition-all"
                  onClick={() => scrollToId('connection-engine')}
                >
                  See Agent in Action
                  <i className="fa-solid fa-play ml-2"></i>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6">
                <div className="flex items-center space-x-3 text-sm">
                  <i className="fa-solid fa-check text-green-400"></i>
                  <span className="text-gray-300">AI Hiring Manager Targeting</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <i className="fa-solid fa-check text-green-400"></i>
                  <span className="text-gray-300">Resume & Microsite Builder</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <i className="fa-solid fa-check text-green-400"></i>
                  <span className="text-gray-300">Smart Outreach Automation</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <i className="fa-solid fa-check text-green-400"></i>
                  <span className="text-gray-300">Background Processing Campaigns</span>
                </div>
              </div>
            </div>

            <div className="relative animate-float" style={{ animationDelay: '0.5s' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 to-pink-600/30 rounded-3xl blur-3xl"></div>
              <div className="relative glass-panel rounded-3xl p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Campaign Dashboard</h3>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">Active</span>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="glass-panel rounded-xl p-4 space-y-2">
                    <div className="text-3xl font-bold text-purple-400 counter">342</div>
                    <div className="text-xs text-gray-400">Jobs Extracted</div>
                  </div>
                  <div className="glass-panel rounded-xl p-4 space-y-2">
                    <div className="text-3xl font-bold text-pink-400 counter">127</div>
                    <div className="text-xs text-gray-400">Managers Found</div>
                  </div>
                  <div className="glass-panel rounded-xl p-4 space-y-2">
                    <div className="text-3xl font-bold text-blue-400 counter">89</div>
                    <div className="text-xs text-gray-400">Sent</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 glass-panel rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
                        <i className="fa-solid fa-building text-purple-400"></i>
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Senior Product Designer</div>
                        <div className="text-xs text-gray-400">Tech Corp</div>
                      </div>
                    </div>
                    <span className="text-xs text-green-400">Responded</span>
                  </div>

                  <div className="flex items-center justify-between p-4 glass-panel rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-pink-600/20 flex items-center justify-center">
                        <i className="fa-solid fa-building text-pink-400"></i>
                      </div>
                      <div>
                        <div className="font-semibold text-sm">UX Lead</div>
                        <div className="text-xs text-gray-400">Innovation Labs</div>
                      </div>
                    </div>
                    <span className="text-xs text-yellow-400">Pending</span>
                  </div>

                  <div className="flex items-center justify-between p-4 glass-panel rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                        <i className="fa-solid fa-building text-blue-400"></i>
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Design Director</div>
                        <div className="text-xs text-gray-400">Creative Studio</div>
                      </div>
                    </div>
                    <span className="text-xs text-purple-400">Processing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 px-6 relative animate-fade-up">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black mb-4">The Old Way vs The HirePilot Way</h2>
            <p className="text-xl text-gray-400">Two approaches. One clear winner.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="glass-panel rounded-3xl p-10 space-y-6 border-l-4 border-red-500/50">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <i className="fa-solid fa-xmark text-red-400 text-xl"></i>
                </div>
                <h3 className="text-3xl font-bold text-red-400">The Old Way</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-start space-x-3 text-gray-300">
                  <i className="fa-solid fa-circle text-red-500 text-xs mt-1.5"></i>
                  <span>Apply to 200+ jobs blindly</span>
                </div>
                <div className="flex items-start space-x-3 text-gray-300">
                  <i className="fa-solid fa-circle text-red-500 text-xs mt-1.5"></i>
                  <span>Compete with 1,000+ applicants per role</span>
                </div>
                <div className="flex items-start space-x-3 text-gray-300">
                  <i className="fa-solid fa-circle text-red-500 text-xs mt-1.5"></i>
                  <span>Resume disappears into ATS black hole</span>
                </div>
                <div className="flex items-start space-x-3 text-gray-300">
                  <i className="fa-solid fa-circle text-red-500 text-xs mt-1.5"></i>
                  <span>Endless ghosting and rejection</span>
                </div>
                <div className="flex items-start space-x-3 text-gray-300">
                  <i className="fa-solid fa-circle text-red-500 text-xs mt-1.5"></i>
                  <span>Wait passively and hope for the best</span>
                </div>
              </div>

              <div className="pt-6 border-t border-red-500/20">
                <div className="text-4xl font-black text-red-400 mb-2">2-5%</div>
                <div className="text-sm text-gray-400">Average response rate</div>
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-10 space-y-6 border-l-4 border-purple-500/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl"></div>

              <div className="flex items-center space-x-3 mb-6 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                  <i className="fa-solid fa-check text-white text-xl"></i>
                </div>
                <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  The HirePilot Way
                </h3>
              </div>

              <div className="space-y-4 relative z-10">
                <div className="flex items-start space-x-3 text-gray-200">
                  <i className="fa-solid fa-circle text-purple-400 text-xs mt-1.5"></i>
                  <span>Identify decision-makers at target companies</span>
                </div>
                <div className="flex items-start space-x-3 text-gray-200">
                  <i className="fa-solid fa-circle text-purple-400 text-xs mt-1.5"></i>
                  <span>Launch intelligent outreach campaigns</span>
                </div>
                <div className="flex items-start space-x-3 text-gray-200">
                  <i className="fa-solid fa-circle text-purple-400 text-xs mt-1.5"></i>
                  <span>Send personalized messages at scale</span>
                </div>
                <div className="flex items-start space-x-3 text-gray-200">
                  <i className="fa-solid fa-circle text-purple-400 text-xs mt-1.5"></i>
                  <span>Track conversations in one dashboard</span>
                </div>
                <div className="flex items-start space-x-3 text-gray-200">
                  <i className="fa-solid fa-circle text-purple-400 text-xs mt-1.5"></i>
                  <span>Iterate with AI-powered insights</span>
                </div>
              </div>

              <div className="pt-6 border-t border-purple-500/20 relative z-10">
                <div className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                  40-60%
                </div>
                <div className="text-sm text-gray-400">Average response rate</div>
              </div>
            </div>
          </div>

          <div className="text-center mt-16">
            <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Stop applying. Start manufacturing conversations.
            </h3>
          </div>
        </div>
      </section>

      <section id="connection-engine" className="py-24 px-6 relative animate-fade-up">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/5 to-transparent"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div>
                <span className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 text-sm font-medium text-purple-300 inline-block mb-6">
                  <i className="fa-solid fa-robot mr-2"></i>Powered by AI
                </span>
                <h2 className="text-5xl font-black mb-6 leading-tight">
                  The Connection{' '}
                  <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Engine</span>
                </h2>
                <p className="text-xl text-gray-300 leading-relaxed">
                  The Job Seeker Agent analyzes job signals, identifies hiring managers, and launches personalized outreach
                  campaigns — automatically.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start space-x-4 p-4 glass-panel rounded-xl hover:bg-white/5 transition-all">
                  <div className="w-12 h-12 rounded-lg bg-purple-600/20 flex items-center justify-center flex-shrink-0">
                    <i className="fa-brands fa-linkedin text-purple-400 text-xl"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Extract job signals from LinkedIn</h4>
                    <p className="text-sm text-gray-400">Automatically capture opportunities that match your criteria</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4 p-4 glass-panel rounded-xl hover:bg-white/5 transition-all">
                  <div className="w-12 h-12 rounded-lg bg-pink-600/20 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-magnifying-glass text-pink-400 text-xl"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Source opportunities via Apollo or LinkedIn</h4>
                    <p className="text-sm text-gray-400">Tap into millions of companies and decision-makers</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4 p-4 glass-panel rounded-xl hover:bg-white/5 transition-all">
                  <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-crosshairs text-blue-400 text-xl"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Identify hiring managers inside target companies</h4>
                    <p className="text-sm text-gray-400">Skip HR and connect directly with decision-makers</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4 p-4 glass-panel rounded-xl hover:bg-white/5 transition-all">
                  <div className="w-12 h-12 rounded-lg bg-green-600/20 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-message text-green-400 text-xl"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Generate personalized outreach messages</h4>
                    <p className="text-sm text-gray-400">AI crafts compelling messages tailored to each recipient</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4 p-4 glass-panel rounded-xl hover:bg-white/5 transition-all">
                  <div className="w-12 h-12 rounded-lg bg-yellow-600/20 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-paper-plane text-yellow-400 text-xl"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Send via LinkedIn or email</h4>
                    <p className="text-sm text-gray-400">Multi-channel outreach for maximum reach</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4 p-4 glass-panel rounded-xl hover:bg-white/5 transition-all">
                  <div className="w-12 h-12 rounded-lg bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-gears text-indigo-400 text-xl"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Process campaigns in the background</h4>
                    <p className="text-sm text-gray-400">Set it and forget it — your agent works 24/7</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-3xl blur-3xl"></div>

              <div className="relative glass-panel rounded-3xl p-8 space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold">Live Campaign Stats</h3>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm text-green-400">Processing</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="gradient-border rounded-2xl p-6 text-center space-y-2">
                    <div ref={jobsCounterRef} className="text-5xl font-black text-purple-400 counter">
                      0
                    </div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">Jobs Extracted</div>
                    <div className="text-xs text-green-400">+12 today</div>
                  </div>

                  <div className="gradient-border rounded-2xl p-6 text-center space-y-2">
                    <div ref={managersCounterRef} className="text-5xl font-black text-pink-400 counter">
                      0
                    </div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">Managers Identified</div>
                    <div className="text-xs text-green-400">+8 today</div>
                  </div>

                  <div className="gradient-border rounded-2xl p-6 text-center space-y-2">
                    <div ref={timeCounterRef} className="text-5xl font-black text-blue-400 counter">
                      0
                    </div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">Min to Launch</div>
                    <div className="text-xs text-purple-400">avg time</div>
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                  <div className="glass-panel rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">Campaign Progress</span>
                      <span className="text-sm text-purple-400">78%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full" style={{ width: '78%' }}></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass-panel rounded-xl p-4 space-y-1">
                      <div className="text-2xl font-bold text-green-400">42</div>
                      <div className="text-xs text-gray-400">Messages Sent</div>
                    </div>
                    <div className="glass-panel rounded-xl p-4 space-y-1">
                      <div className="text-2xl font-bold text-yellow-400">18</div>
                      <div className="text-xs text-gray-400">Responses</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Next batch processing in:</span>
                    <span className="font-mono text-purple-400">04:23</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="positioning" className="py-24 px-6 relative animate-fade-up">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black mb-6">
              Position Yourself As a{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Top Candidate</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Stand out from the crowd with professional tools that showcase your expertise
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            <div className="gradient-border rounded-3xl p-10 space-y-6 hover:scale-105 transition-transform duration-300">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center mb-4">
                <i className="fa-solid fa-file-lines text-white text-2xl"></i>
              </div>

              <h3 className="text-3xl font-bold">Resume Builder</h3>
              <p className="text-gray-400 leading-relaxed">
                Create stunning, ATS-optimized resumes that get you noticed by both humans and algorithms.
              </p>

              <div className="space-y-4 pt-4">
                <div className="flex items-start space-x-3">
                  <i className="fa-solid fa-check text-purple-400 mt-1"></i>
                  <div>
                    <div className="font-semibold">Clean modern templates</div>
                    <div className="text-sm text-gray-400">Professional designs that stand out</div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <i className="fa-solid fa-check text-purple-400 mt-1"></i>
                  <div>
                    <div className="font-semibold">AI rewrite engine</div>
                    <div className="text-sm text-gray-400">Optimize your content with AI assistance</div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <i className="fa-solid fa-check text-purple-400 mt-1"></i>
                  <div>
                    <div className="font-semibold">Structured positioning</div>
                    <div className="text-sm text-gray-400">Highlight what matters most</div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <i className="fa-solid fa-check text-purple-400 mt-1"></i>
                  <div>
                    <div className="font-semibold">Export-ready PDF</div>
                    <div className="text-sm text-gray-400">Download and share instantly</div>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <div className="glass-panel rounded-xl p-4 flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-lg bg-purple-600/20 flex items-center justify-center">
                    <i className="fa-solid fa-file-lines text-purple-300 text-2xl"></i>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">Professional Resume</div>
                    <div className="text-xs text-gray-400">Last edited 2 hours ago</div>
                  </div>
                  <i className="fa-solid fa-arrow-right text-purple-400"></i>
                </div>
              </div>
            </div>

            <div className="gradient-border rounded-3xl p-10 space-y-6 hover:scale-105 transition-transform duration-300">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-600 to-pink-800 flex items-center justify-center mb-4">
                <i className="fa-solid fa-globe text-white text-2xl"></i>
              </div>

              <h3 className="text-3xl font-bold">Personal Landing Page Builder</h3>
              <p className="text-gray-400 leading-relaxed">
                Build a stunning online presence that showcases your work, achievements, and professional story.
              </p>

              <div className="space-y-4 pt-4">
                <div className="flex items-start space-x-3">
                  <i className="fa-solid fa-check text-pink-400 mt-1"></i>
                  <div>
                    <div className="font-semibold">Fully customizable</div>
                    <div className="text-sm text-gray-400">Design your perfect portfolio</div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <i className="fa-solid fa-check text-pink-400 mt-1"></i>
                  <div>
                    <div className="font-semibold">Custom HTML support</div>
                    <div className="text-sm text-gray-400">Full control over your design</div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <i className="fa-solid fa-check text-pink-400 mt-1"></i>
                  <div>
                    <div className="font-semibold">Shareable link</div>
                    <div className="text-sm text-gray-400">Easy to include in outreach</div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <i className="fa-solid fa-check text-pink-400 mt-1"></i>
                  <div>
                    <div className="font-semibold">Showcase achievements</div>
                    <div className="text-sm text-gray-400">Case studies, metrics, and more</div>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <div className="glass-panel rounded-xl p-4 flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-lg bg-pink-600/20 flex items-center justify-center">
                    <i className="fa-solid fa-laptop text-pink-300 text-2xl"></i>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">yourname.hirepilot.com</div>
                    <div className="text-xs text-gray-400">Live and ready to share</div>
                  </div>
                  <i className="fa-solid fa-arrow-right text-pink-400"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <h3 className="text-3xl font-bold">
              Don't just send a resume.{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Send authority.</span>
            </h3>
          </div>
        </div>
      </section>

      <div id="how-it-works"></div>
      <section id="pipeline" className="py-24 px-6 relative animate-fade-up">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-transparent to-pink-900/10"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black mb-6">
              Build Your{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Career Pipeline</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Your job search becomes a living pipeline — not a guessing game.
            </p>
          </div>

          <div className="relative">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 transform -translate-y-1/2 hidden lg:block"></div>

            <div className="grid lg:grid-cols-6 gap-6 relative z-10">
              <div className="glass-panel rounded-2xl p-6 space-y-4 hover:scale-105 transition-transform">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center mx-auto">
                  <span className="text-2xl font-bold">1</span>
                </div>
                <div className="text-center">
                  <h4 className="font-bold mb-2">Define Target Role</h4>
                  <p className="text-sm text-gray-400">Set your career goals and ideal position</p>
                </div>
                <div className="flex justify-center">
                  <i className="fa-solid fa-bullseye text-purple-400 text-2xl"></i>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-6 space-y-4 hover:scale-105 transition-transform">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mx-auto">
                  <span className="text-2xl font-bold">2</span>
                </div>
                <div className="text-center">
                  <h4 className="font-bold mb-2">Source Opportunities</h4>
                  <p className="text-sm text-gray-400">Find relevant jobs and companies</p>
                </div>
                <div className="flex justify-center">
                  <i className="fa-solid fa-magnifying-glass text-pink-400 text-2xl"></i>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-6 space-y-4 hover:scale-105 transition-transform">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-600 to-pink-800 flex items-center justify-center mx-auto">
                  <span className="text-2xl font-bold">3</span>
                </div>
                <div className="text-center">
                  <h4 className="font-bold mb-2">Identify Decision Makers</h4>
                  <p className="text-sm text-gray-400">Find hiring managers and leaders</p>
                </div>
                <div className="flex justify-center">
                  <i className="fa-solid fa-users text-pink-400 text-2xl"></i>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-6 space-y-4 hover:scale-105 transition-transform">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-600 to-blue-600 flex items-center justify-center mx-auto">
                  <span className="text-2xl font-bold">4</span>
                </div>
                <div className="text-center">
                  <h4 className="font-bold mb-2">Launch Outreach</h4>
                  <p className="text-sm text-gray-400">Send personalized campaigns</p>
                </div>
                <div className="flex justify-center">
                  <i className="fa-solid fa-paper-plane text-blue-400 text-2xl"></i>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-6 space-y-4 hover:scale-105 transition-transform">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-green-600 flex items-center justify-center mx-auto">
                  <span className="text-2xl font-bold">5</span>
                </div>
                <div className="text-center">
                  <h4 className="font-bold mb-2">Track Conversations</h4>
                  <p className="text-sm text-gray-400">Monitor all interactions</p>
                </div>
                <div className="flex justify-center">
                  <i className="fa-solid fa-chart-line text-green-400 text-2xl"></i>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-6 space-y-4 hover:scale-105 transition-transform">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-600 to-purple-600 flex items-center justify-center mx-auto">
                  <span className="text-2xl font-bold">6</span>
                </div>
                <div className="text-center">
                  <h4 className="font-bold mb-2">Refine with REX</h4>
                  <p className="text-sm text-gray-400">Optimize your strategy</p>
                </div>
                <div className="flex justify-center">
                  <i className="fa-solid fa-robot text-purple-400 text-2xl"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 text-center">
            <div className="inline-block glass-panel rounded-2xl px-8 py-6">
              <p className="text-xl text-gray-300">
                <i className="fa-solid fa-lightbulb text-yellow-400 mr-3"></i>
                Your job search becomes a <span className="text-purple-400 font-bold">living pipeline</span> — not a guessing game.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="rex" className="py-24 px-6 relative animate-fade-up">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/20"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="gradient-border rounded-3xl p-12 lg:p-16 space-y-12">
            <div className="text-center max-w-4xl mx-auto space-y-6">
              <div className="inline-block">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mx-auto mb-6">
                  <i className="fa-solid fa-robot text-white text-3xl"></i>
                </div>
              </div>

              <h2 className="text-5xl lg:text-6xl font-black mb-6">
                Your Embedded Recruiter:{' '}
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">REX</span>
              </h2>

              <p className="text-2xl text-gray-300 leading-relaxed">
                REX doesn't just answer questions.
                <br />
                <span className="text-white font-semibold">
                  It builds strategy, angles, and outreach campaigns around your goals.
                </span>
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="glass-panel rounded-2xl p-6 space-y-4 hover:bg-white/5 transition-all">
                <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center">
                  <i className="fa-solid fa-file-lines text-purple-400 text-xl"></i>
                </div>
                <h4 className="text-xl font-bold">Resume Optimization</h4>
                <p className="text-gray-400 text-sm">
                  AI-powered suggestions to make your resume stand out and pass ATS filters
                </p>
              </div>

              <div className="glass-panel rounded-2xl p-6 space-y-4 hover:bg-white/5 transition-all">
                <div className="w-12 h-12 rounded-xl bg-pink-600/20 flex items-center justify-center">
                  <i className="fa-brands fa-linkedin text-pink-400 text-xl"></i>
                </div>
                <h4 className="text-xl font-bold">LinkedIn Positioning</h4>
                <p className="text-gray-400 text-sm">
                  Craft compelling headlines, summaries, and experience sections that attract recruiters
                </p>
              </div>

              <div className="glass-panel rounded-2xl p-6 space-y-4 hover:bg-white/5 transition-all">
                <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center">
                  <i className="fa-solid fa-message text-blue-400 text-xl"></i>
                </div>
                <h4 className="text-xl font-bold">Outreach Angle Generation</h4>
                <p className="text-gray-400 text-sm">
                  Create personalized messaging strategies that resonate with hiring managers
                </p>
              </div>

              <div className="glass-panel rounded-2xl p-6 space-y-4 hover:bg-white/5 transition-all">
                <div className="w-12 h-12 rounded-xl bg-green-600/20 flex items-center justify-center">
                  <i className="fa-solid fa-comments text-green-400 text-xl"></i>
                </div>
                <h4 className="text-xl font-bold">Interview Prep</h4>
                <p className="text-gray-400 text-sm">
                  Practice with AI-powered mock interviews and get real-time feedback
                </p>
              </div>

              <div className="glass-panel rounded-2xl p-6 space-y-4 hover:bg-white/5 transition-all">
                <div className="w-12 h-12 rounded-xl bg-yellow-600/20 flex items-center justify-center">
                  <i className="fa-solid fa-handshake text-yellow-400 text-xl"></i>
                </div>
                <h4 className="text-xl font-bold">Negotiation Coaching</h4>
                <p className="text-gray-400 text-sm">Get strategic advice on salary negotiations and offer evaluations</p>
              </div>

              <div className="glass-panel rounded-2xl p-6 space-y-4 hover:bg-white/5 transition-all">
                <div className="w-12 h-12 rounded-xl bg-indigo-600/20 flex items-center justify-center">
                  <i className="fa-solid fa-chart-simple text-indigo-400 text-xl"></i>
                </div>
                <h4 className="text-xl font-bold">Reply Analysis</h4>
                <p className="text-gray-400 text-sm">
                  Analyze responses and get intelligent follow-up recommendations
                </p>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-8 max-w-3xl mx-auto">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-quote-left text-white text-sm"></i>
                </div>
                <div className="space-y-3">
                  <p className="text-gray-300 italic">
                    "REX helped me reposition my entire approach. Instead of applying to 50 jobs a week, I targeted 10
                    decision-makers with personalized outreach. I had 3 interviews within a week."
                  </p>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/30 flex items-center justify-center text-sm font-semibold">
                      AT
                    </div>
                    <div>
                      <div className="font-semibold">Alex Thompson</div>
                      <div className="text-sm text-gray-400">Product Manager</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 px-6 relative animate-fade-up">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black mb-6">
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Manufacture Meaningful Connections
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              A complete career operating system in one powerful platform
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="glass-panel rounded-2xl p-8 space-y-4 hover:scale-105 transition-transform group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-purple-500/50 transition-shadow">
                <i className="fa-solid fa-robot text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold">Job Seeker Agent</h3>
              <p className="text-gray-400 text-sm">AI-powered automation that works 24/7 to advance your career</p>
            </div>

            <div className="glass-panel rounded-2xl p-8 space-y-4 hover:scale-105 transition-transform group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-600 to-pink-800 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-pink-500/50 transition-shadow">
                <i className="fa-solid fa-file-lines text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold">Resume Builder</h3>
              <p className="text-gray-400 text-sm">Professional templates with AI optimization</p>
            </div>

            <div className="glass-panel rounded-2xl p-8 space-y-4 hover:scale-105 transition-transform group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-blue-500/50 transition-shadow">
                <i className="fa-solid fa-globe text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold">Landing Page Builder</h3>
              <p className="text-gray-400 text-sm">Showcase your work with a custom portfolio site</p>
            </div>

            <div className="glass-panel rounded-2xl p-8 space-y-4 hover:scale-105 transition-transform group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-green-500/50 transition-shadow">
                <i className="fa-solid fa-crosshairs text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold">Hiring Manager Targeting</h3>
              <p className="text-gray-400 text-sm">Identify and connect with decision-makers directly</p>
            </div>

            <div className="glass-panel rounded-2xl p-8 space-y-4 hover:scale-105 transition-transform group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-600 to-yellow-800 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-yellow-500/50 transition-shadow">
                <i className="fa-brands fa-linkedin text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold">LinkedIn Outreach</h3>
              <p className="text-gray-400 text-sm">Automated, personalized LinkedIn messaging campaigns</p>
            </div>

            <div className="glass-panel rounded-2xl p-8 space-y-4 hover:scale-105 transition-transform group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-red-500/50 transition-shadow">
                <i className="fa-solid fa-envelope text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold">Email Outreach</h3>
              <p className="text-gray-400 text-sm">Professional email campaigns with tracking</p>
            </div>

            <div className="glass-panel rounded-2xl p-8 space-y-4 hover:scale-105 transition-transform group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-indigo-500/50 transition-shadow">
                <i className="fa-solid fa-magnifying-glass text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold">Apollo Sourcing</h3>
              <p className="text-gray-400 text-sm">Access millions of companies and contacts</p>
            </div>

            <div className="glass-panel rounded-2xl p-8 space-y-4 hover:scale-105 transition-transform group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-purple-500/50 transition-shadow">
                <i className="fa-solid fa-comments text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold">Interview Coaching</h3>
              <p className="text-gray-400 text-sm">AI-powered practice and feedback</p>
            </div>

            <div className="glass-panel rounded-2xl p-8 space-y-4 hover:scale-105 transition-transform group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-teal-500/50 transition-shadow">
                <i className="fa-solid fa-handshake text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold">Negotiation Support</h3>
              <p className="text-gray-400 text-sm">Strategic guidance for salary discussions</p>
            </div>
          </div>
        </div>
      </section>

      <section id="final-cta" className="py-32 px-6 relative overflow-hidden animate-fade-up">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-pink-900/30 to-purple-900/30"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-glow"></div>
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-glow"
          style={{ animationDelay: '1.5s' }}
        ></div>

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-10">
          <div className="space-y-6">
            <h2 className="text-6xl lg:text-7xl font-black leading-tight">
              The Job Board Era{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Is Over</span>
            </h2>

            <p className="text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Build Conversations That Lead to Offers.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-8">
            <button
              type="button"
              className="px-12 py-5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl font-bold text-xl hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-110"
              onClick={handleStart}
            >
              Start Free
              <i className="fa-solid fa-rocket ml-3"></i>
            </button>
            <button
              type="button"
              className="px-12 py-5 glass-panel rounded-2xl font-semibold text-xl hover:bg-white/10 transition-all"
              onClick={goToRex}
            >
              Try REX Chat
              <i className="fa-solid fa-robot ml-3"></i>
            </button>
          </div>

          <div className="pt-8">
            <div className="inline-flex items-center space-x-3 px-6 py-3 glass-panel rounded-full">
              <i className="fa-solid fa-sparkles text-yellow-400"></i>
              <span className="text-sm text-gray-300">Complete onboarding → Earn bonus credits</span>
            </div>
          </div>

        </div>
      </section>

      <PublicFooterJobs />
    </div>
  );
}
