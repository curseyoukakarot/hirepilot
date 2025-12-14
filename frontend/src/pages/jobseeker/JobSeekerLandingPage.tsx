import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaInbox,
  FaGhost,
  FaUsers,
  FaUpload,
  FaBullseye,
  FaLightbulb,
  FaGlobe,
  FaRobot,
  FaRegFileAlt,
  FaLinkedin,
  FaEnvelope,
  FaCrosshairs,
  FaComments,
  FaHandshake,
  FaUserTie,
  FaRocket,
  FaStar,
} from 'react-icons/fa';
import { JobSeekerPublicNav } from '../../components/jobseeker/JobSeekerPublicNav';
import PublicFooter from '../../components/PublicFooter';

const primary = '#3b82f6';

function Pill({ num, color, label, description }: { num: number; color: string; label: string; description: string }) {
  return (
    <div className="bg-gray-800 p-8 rounded-2xl text-center border border-gray-700">
      <div
        className="text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold"
        style={{ background: color }}
      >
        {num}
      </div>
      <h3 className="text-xl font-bold text-white mb-4">{label}</h3>
      <p className="text-gray-300">{description}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-gray-900 p-6 rounded-xl border border-gray-700">
      <div className="text-2xl mb-4 text-[#3b82f6]">{icon}</div>
      <h4 className="font-semibold text-white mb-2">{title}</h4>
      <p className="text-gray-300">{description}</p>
    </div>
  );
}

export default function JobSeekerLandingPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');

  const rexPrompts = useMemo(
    () => [
      'Help me rewrite my resume for a software engineer role',
      'Write an outreach message to a hiring manager at Google',
      'Help me prepare for a product manager interview',
    ],
    []
  );

  const handleStart = useCallback(() => {
    navigate('/signup');
  }, [navigate]);

  const goToRex = useCallback(
    (text?: string) => {
      const prefill = text || prompt;
      const search = prefill ? `?prefill=${encodeURIComponent(prefill)}` : '';
      navigate(`/prep/rex-chat${search}`);
    },
    [navigate, prompt]
  );

  const handleSend = useCallback(() => {
    if (!prompt.trim()) return;
    goToRex(prompt.trim());
  }, [goToRex, prompt]);

  return (
    <div className="bg-gray-900 font-sans text-white">
      {/* Header */}
      <div className="sticky top-0 z-50">
        <JobSeekerPublicNav variant="dark" />
      </div>

      {/* Hero */}
      <section id="hero" className="bg-gradient-to-b from-gray-800 to-gray-900 py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
              Stop applying. Start conversations with hiring managers.
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              HirePilot Jobs helps you generate a pro resume, build a personal landing page, and use REX to craft direct
              outreach that gets replies.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
              <button
                className="bg-[#3b82f6] text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-600"
                onClick={handleStart}
              >
                Start Free
              </button>
              <button
                className="border border-[#3b82f6] text-[#3b82f6] px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800"
                onClick={() => goToRex()}
              >
                Try REX Chat
              </button>
            </div>
            <p className="text-sm text-gray-400">Built by recruiters. Designed for job seekers.</p>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="py-16 bg-gray-800">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-8">The job board game is broken</h2>
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-700">
              <FaInbox className="text-red-400 text-2xl mb-4" />
              <p className="text-gray-300">Applications disappear into ATS black holes</p>
            </div>
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-700">
              <FaGhost className="text-red-400 text-2xl mb-4" />
              <p className="text-gray-300">Endless ghosting and automated rejections</p>
            </div>
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-700">
              <FaUsers className="text-red-400 text-2xl mb-4" />
              <p className="text-gray-300">Competing with 1000+ other applicants</p>
            </div>
          </div>
          <p className="text-lg font-semibold text-white">The fastest path is direct outreach.</p>
        </div>
      </section>

      {/* Method */}
      <section id="method" className="py-20 bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">The HirePilot Jobs method</h2>
            <p className="text-xl text-gray-300">This is the playbook recruiters use — now you have it.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Pill num={1} color="#3b82f6" label="Position" description="Resume + LinkedIn rewrite that positions you as the perfect candidate" />
            <Pill num={2} color="#22c55e" label="Package" description="Personal landing page that showcases your value proposition" />
            <Pill num={3} color="#a855f7" label="Prospect" description="Direct outreach scripts that get hiring managers to respond" />
          </div>
        </div>
      </section>

      {/* Walkthrough */}
      <section id="walkthrough" className="py-20 bg-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Your 5-step journey to job success</h2>
            <p className="text-xl text-gray-300">Simple, guided, and effective</p>
          </div>
          <div className="grid md:grid-cols-5 gap-6">
            <FeatureCard icon={<FaUpload />} title="Upload resume" description="Get instant rewrite" />
            <FeatureCard icon={<FaBullseye />} title="Set target role" description="Define your goals" />
            <FeatureCard icon={<FaLightbulb />} title="Generate angles" description="Outreach strategies" />
            <FeatureCard icon={<FaGlobe />} title="Build landing page" description="Professional showcase" />
            <FeatureCard icon={<FaRobot />} title="Chat with REX" description="Refine everything" />
          </div>
          <div className="text-center mt-8">
            <p className="text-lg font-semibold text-green-400">🎁 Bonus credits for completing setup</p>
          </div>
        </div>
      </section>

      {/* REX preview (revamped) */}
      <section id="rex-demo" className="py-16 bg-[#020617] text-slate-100">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 flex flex-col gap-4">
          {/* Header bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-2">
              <div className="px-3 py-1 w-fit rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs">
                REX · Job Prep Assistant
              </div>
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-semibold text-slate-100 leading-snug">Ask REX anything about your job search</h2>
                <p className="text-sm text-slate-400">
                  Optimize your resume, LinkedIn, outreach messages, and interview prep with an AI coach tuned to your targets.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs sm:text-sm">
                Target: Head of Sales · B2B SaaS
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <span className="hidden sm:inline">Mode:</span>
                <select
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 text-xs"
                  value="General"
                  disabled
                >
                  {['General', 'Resume', 'LinkedIn', 'Outreach', 'Interview'].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)_minmax(0,1.1fr)] pointer-events-none select-none">
            {/* Left panel */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 space-y-4 text-xs">
              <div className="space-y-2">
                <h3 className="font-medium text-slate-200">Current context</h3>
                <div className="space-y-1 text-slate-400">
                  <div className="flex justify-between">
                    <span>Role:</span>
                    <span className="text-slate-300">Head of Sales</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Industry:</span>
                    <span className="text-slate-300">B2B SaaS</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Focus:</span>
                    <span className="text-slate-300">Leadership · Remote-first</span>
                  </div>
                </div>
                <button className="text-sky-400 hover:text-sky-300 text-xs">Edit job target</button>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-slate-200">Attached assets</h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-300">
                    <i className="fa-solid fa-check text-emerald-400 text-xs" />
                    <span>Resume: Brandon_Wells_Resume.pdf</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <i className="fa-solid fa-check text-emerald-400 text-xs" />
                    <span>LinkedIn: /in/brandon</span>
                  </div>
                </div>
                <p className="text-slate-500 text-xs">REX will use these when rewriting content.</p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-slate-200">Try asking</h3>
                <div className="space-y-2">
                  {[
                    'Rewrite my resume summary for a Head of Sales role.',
                    'Give me 3 stronger bullets for my VP of Sales experience.',
                    "Tighten this LinkedIn 'About' section.",
                    'Draft an outreach email to a VP of Sales recruiter.',
                  ].map((q) => (
                    <button
                      key={q}
                      className="w-full text-left p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 text-slate-300 text-xs transition-colors"
                      onClick={() => setPrompt(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chat panel */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 flex flex-col h-full relative">
              <div id="messages-area" className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
                <div className="flex justify-end">
                  <div className="max-w-[70%]">
                    <div className="bg-sky-500 text-slate-50 rounded-3xl rounded-br-lg px-4 py-3 message-bubble">
                      Can you rewrite my resume summary for a Head of Sales role?
                    </div>
                    <div className="text-xs text-slate-500 mt-1 text-right">2:34 PM</div>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[80%]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300 flex-shrink-0">
                        RX
                      </div>
                      <div className="bg-slate-800 text-slate-100 rounded-3xl rounded-bl-lg px-4 py-3 message-bubble">
                        <p>Here&apos;s a rewritten summary tailored for Head of Sales positions in B2B SaaS:</p>
                        <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                          <p className="text-sm">
                            Results-driven sales executive with 8+ years leading high-performing teams in B2B SaaS environments. Proven track record of scaling revenue from $2M to $15M+ while building remote-first sales organizations. Expert in enterprise deal cycles, strategic partnerships, and implementing data-driven sales processes that consistently exceed targets by 20-30%.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 ml-11">2:34 PM</div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[70%]">
                    <div className="bg-sky-500 text-slate-50 rounded-3xl rounded-br-lg px-4 py-3 message-bubble">
                      Now give me 3 bullets for my Nimbus Data experience.
                    </div>
                    <div className="text-xs text-slate-500 mt-1 text-right">2:36 PM</div>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[80%]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300 flex-shrink-0">
                        RX
                      </div>
                      <div className="bg-slate-800 text-slate-100 rounded-3xl rounded-bl-lg px-4 py-3 message-bubble">
                        <p>Here are 3 strong bullets for your Nimbus Data experience:</p>
                        <ul className="mt-3 space-y-2 text-sm">
                          <li className="flex items-start gap-2">
                            <span className="text-sky-400 mt-1">•</span>
                            <span>Scaled enterprise sales team from 5 to 15 reps, driving 340% revenue growth ($3M to $13.2M ARR) over 18 months</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-sky-400 mt-1">•</span>
                            <span>Implemented Salesforce automation and lead scoring system, reducing sales cycle by 25% and improving conversion rates by 35%</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-sky-400 mt-1">•</span>
                            <span>Secured 3 enterprise deals worth $2M+ each by developing strategic partnerships with Fortune 500 technology integrators</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 ml-11">2:37 PM</div>
                  </div>
                </div>

                {/* Thinking message */}
                <div className="flex justify-start">
                  <div className="max-w-[80%]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300 flex-shrink-0">
                        RX
                      </div>
                      <div className="bg-slate-800 text-slate-100 rounded-3xl rounded-bl-lg px-4 py-3 message-bubble">
                        <div className="flex gap-1 mb-2 typing-dots">
                          <span className="w-2 h-2 bg-slate-400 rounded-full" />
                          <span className="w-2 h-2 bg-slate-400 rounded-full" />
                          <span className="w-2 h-2 bg-slate-400 rounded-full" />
                        </div>
                        <p className="text-sm text-slate-400">Analyzing attached resume...</p>
                        <div className="mt-2 h-1 w-full rounded-full bg-slate-700">
                          <div className="h-full w-1/2 rounded-full bg-sky-500 transition-all" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Input */}
              <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
                <div className="rounded-2xl border border-slate-700 bg-slate-950/90 px-3 py-2 flex items-end gap-2">
                  <textarea
                    rows={1}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ask REX to improve your resume, LinkedIn, or outreach copy..."
                    className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 resize-none outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <button className="text-slate-400 hover:text-slate-200 p-2">
                    <i className="fa-solid fa-sparkles" />
                  </button>
                  <button
                    className="bg-sky-500 hover:bg-sky-400 text-slate-50 rounded-full w-10 h-10 flex items-center justify-center transition-colors"
                    onClick={handleSend}
                  >
                    <i className="fa-solid fa-arrow-up" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right panel */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 flex flex-col h-full text-xs">
              <div className="space-y-2 mb-4">
                <h3 className="font-medium text-slate-200">REX status</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-500 rounded-full" />
                  <span className="text-slate-400">Idle · Ready for your next question</span>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <h4 className="font-medium text-slate-300">Processing steps</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center">
                      <i className="fa-solid fa-check text-slate-900 text-xs" />
                    </div>
                    <span className="text-slate-300">Analyze your request</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-sky-400 animate-spin">
                      <div className="w-2 h-2 bg-slate-900 rounded-full ml-1 mt-1" />
                    </div>
                    <span className="text-slate-200">Pull in resume / profile context</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-slate-600" />
                    <span className="text-slate-500">Draft and refine response</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <button className="w-full rounded-full bg-slate-950 border border-slate-700 text-slate-200 hover:border-rose-500 hover:text-rose-300 py-2 px-4 transition-colors">
                  <i className="fa-solid fa-stop mr-2" />
                  Stop generating
                </button>
                <p className="text-slate-500 text-xs mt-2 text-center">Stopping keeps partial drafts visible in the thread.</p>
              </div>

              <div className="mt-auto">
                <h4 className="font-medium text-slate-300 mb-2">Recent actions</h4>
                <ul className="space-y-1 text-slate-400">
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-circle text-xs text-emerald-400" />
                    Rewrote resume summary for Head of Sales
                  </li>
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-circle text-xs text-emerald-400" />
                    Generated 3 new experience bullets for Nimbus Data
                  </li>
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-circle text-xs text-slate-600" />
                    Tightened LinkedIn About section
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="py-20 bg-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">What can REX help with?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard icon={<FaRegFileAlt />} title="Resume rewrite" description="Transform your resume into a compelling story that hiring managers can't ignore." />
            <FeatureCard icon={<FaLinkedin />} title="LinkedIn rewrite" description="Optimize your LinkedIn profile to attract recruiters and showcase your value." />
            <FeatureCard icon={<FaEnvelope />} title="Outreach scripts" description="Craft personalized messages that get hiring managers to respond and engage." />
            <FeatureCard icon={<FaCrosshairs />} title="Hiring manager targeting" description="Find the right people to contact and learn how to approach them effectively." />
            <FeatureCard icon={<FaComments />} title="Interview prep" description="Practice answers, learn company insights, and prepare for any interview scenario." />
            <FeatureCard icon={<FaHandshake />} title="Negotiation coaching" description="Get the salary and benefits you deserve with proven negotiation strategies." />
          </div>
        </div>
      </section>

      {/* Credibility */}
      <section id="credibility" className="py-16 bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <FaUserTie className="text-[#3b82f6] text-3xl mb-4 mx-auto" />
              <h4 className="font-semibold text-white mb-2">Built from real recruiter workflows</h4>
            </div>
            <div>
              <FaRocket className="text-[#3b82f6] text-3xl mb-4 mx-auto" />
              <h4 className="font-semibold text-white mb-2">Designed for direct outreach</h4>
            </div>
            <div>
              <FaStar className="text-[#3b82f6] text-3xl mb-4 mx-auto" />
              <h4 className="font-semibold text-white mb-2">"Finally something that doesn't just spam job boards."</h4>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white text-center mb-16">Frequently asked questions</h2>
          <div className="space-y-8">
            <div className="border-b border-gray-700 pb-6">
              <h4 className="text-lg font-semibold text-white mb-2">Do you auto-apply to jobs?</h4>
              <p className="text-gray-300">
                No. We don&apos;t believe in it. HirePilot Jobs focuses on direct outreach to hiring managers, not mass applications.
              </p>
            </div>
            <div className="border-b border-gray-700 pb-6">
              <h4 className="text-lg font-semibold text-white mb-2">What makes this different?</h4>
              <p className="text-gray-300">
                Direct outreach playbook + REX coaching. We teach you the strategies recruiters use to connect candidates with opportunities.
              </p>
            </div>
            <div className="border-b border-gray-700 pb-6">
              <h4 className="text-lg font-semibold text-white mb-2">Do I need a resume already?</h4>
              <p className="text-gray-300">
                You can upload anything - even a basic resume or LinkedIn profile. REX will help you transform it into something powerful.
              </p>
            </div>
            <div className="border-b border-gray-700 pb-6">
              <h4 className="text-lg font-semibold text-white mb-2">Is this for executives or entry-level?</h4>
              <p className="text-gray-300">
                Both! Our targeting-based approach works for any level. REX adapts strategies based on your experience and goals.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white mb-2">Does it work with LinkedIn?</h4>
              <p className="text-gray-300">
                Yes, we have a LinkedIn extension that helps you research prospects and send personalized outreach directly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="final-cta" className="py-20 bg-gradient-to-r from-[#3b82f6] to-blue-700 text-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to transform your job search?</h2>
          <p className="text-xl mb-8 opacity-90">Stop applying. Start having conversations with hiring managers.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
            <button
              className="bg-white text-[#3b82f6] px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100"
              onClick={handleStart}
            >
              Start Free
            </button>
            <button
              className="border-2 border-white text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white hover:text-[#3b82f6]"
              onClick={() => goToRex()}
            >
              Try REX Chat
            </button>
          </div>
          <p className="text-sm opacity-75">✨ Complete onboarding → earn bonus credits</p>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
