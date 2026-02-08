import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { JobSeekerPublicNav } from '../../components/jobseeker/JobSeekerPublicNav';
import PublicFooterJobs from '../../components/PublicFooterJobs';
import JobSeekerLiveActivityDemo from '../../components/jobseeker/JobSeekerLiveActivityDemo';

const badges = [
  'Auto-extract job signals',
  'Hiring manager targeting',
  'Smart outreach (LinkedIn + email)',
  'Runs in the background',
];

const oldWay = ['Apply and wait', 'ATS black hole', 'Ghosting', 'Compete with 1000+ applicants'];
const newWay = ['Launch campaigns', 'Identify decision-makers', 'Build a conversation pipeline', 'Outreach when ready (scheduled or manual)'];

const flowSteps = [
  'Paste LinkedIn job search URL (or choose Apollo sourcing)',
  'Agent extracts job signals',
  'Agent identifies hiring managers / likely decision-makers',
  'Builds target list + match scoring',
  'Outreach can be scheduled or manual',
  'Results trackable in real time',
];

const controlBullets = [
  'Define role + location + seniority',
  'Choose job limit and priority',
  'Approve outreach before sending OR schedule outreach cadences',
  'REX can refine messaging angles',
];

const outreachCards = [
  {
    title: 'LinkedIn outreach',
    description: 'Connection + message workflows with hiring managers.',
    icon: 'fa-brands fa-linkedin',
  },
  {
    title: 'Email outreach',
    description: 'Templates from Messages Center with scheduling options.',
    icon: 'fa-solid fa-envelope',
  },
];

export default function JobSeekerAgentLandingPage() {
  const navigate = useNavigate();

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

  return (
    <div className="bg-gradient-to-br from-[#0B0F1A] via-[#111827] to-[#0B0F1A] text-white font-sans min-h-screen">
      <div className="sticky top-0 z-50">
        <JobSeekerPublicNav variant="dark" />
      </div>

      <main>
        <section id="hero" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-transparent to-pink-900/30"></div>
          <div className="absolute -top-10 right-0 w-80 h-80 bg-purple-500/20 blur-3xl rounded-full"></div>
          <div className="absolute -bottom-20 left-10 w-96 h-96 bg-pink-500/20 blur-3xl rounded-full"></div>

          <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-16">
            <div className="space-y-8 text-center">
              <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-purple-200">
                <i className="fa-solid fa-robot text-purple-300"></i>
                <span>Fully autonomous Job Seeker Agent</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
                Launch Autonomous Job Search Campaigns
              </h1>
              <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto">
                HirePilot’s Job Seeker Agent finds job signals, identifies hiring managers, and builds your outreach target
                list automatically — while you sleep.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-500/50 transition-all"
                  onClick={() => navigate('/campaigns/job-seeker-agent')}
                >
                  Launch Your First Campaign
                </button>
                <button
                  className="px-8 py-4 border border-white/20 rounded-xl text-slate-200 hover:bg-white/10 transition-colors"
                  onClick={() => scrollToId('live-activity')}
                >
                  Watch Live Activity
                </button>
              </div>
              <div className="flex flex-wrap justify-center gap-3 pt-4">
                {badges.map((badge) => (
                  <span
                    key={badge}
                    className="px-3 py-2 rounded-full bg-slate-900/70 border border-slate-800 text-xs text-slate-300"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="comparison" className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold">The Old Way vs The HirePilot Way</h2>
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-xl font-semibold text-red-300 mb-4">The Old Way</h3>
                <ul className="space-y-3 text-slate-300">
                  {oldWay.map((item) => (
                    <li key={item} className="flex items-start">
                      <i className="fa-solid fa-xmark text-red-400 mt-1 mr-3"></i>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-2xl p-6">
                <h3 className="text-xl font-semibold text-purple-200 mb-4">The HirePilot Way</h3>
                <ul className="space-y-3 text-slate-200">
                  {newWay.map((item) => (
                    <li key={item} className="flex items-start">
                      <i className="fa-solid fa-check text-green-400 mt-1 mr-3"></i>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="text-center text-lg text-slate-200 mt-8 font-semibold">Stop applying. Start conversations.</p>
          </div>
        </section>

        <section id="how-it-works" className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold">From Job Signal → Hiring Manager → Conversation</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {flowSteps.map((step, index) => (
                <div key={step} className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-sm font-semibold text-indigo-200 mb-4">
                    {index + 1}
                  </div>
                  <p className="text-slate-200">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="live-activity" className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold">Watch Your Campaigns Run</h2>
              <p className="text-slate-300 mt-3">
                Real-time progress, managers found, and updates — even while processing happens in the background.
              </p>
            </div>
            <JobSeekerLiveActivityDemo />
          </div>
        </section>

        <section id="control" className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">Autonomous Execution. Strategic Control.</h2>
                <p className="text-slate-300 mb-6">
                  The agent handles the busywork. You set the strategy and control the timing of outreach.
                </p>
                <ul className="space-y-3 text-slate-200">
                  {controlBullets.map((item) => (
                    <li key={item} className="flex items-start">
                      <i className="fa-solid fa-check text-green-400 mt-1 mr-3"></i>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 to-pink-500/10 border border-indigo-500/30 p-8">
                <div className="space-y-4 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Campaign status</span>
                    <span className="text-green-400 font-semibold">Running</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Managers matched</span>
                    <span className="text-white font-semibold">142</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Outreach mode</span>
                    <span className="text-purple-300 font-semibold">Schedule</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800">
                    <div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: '62%' }}></div>
                  </div>
                  <p className="text-slate-400 text-xs">Campaign updates continue in the background while you focus on interviews.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="outreach" className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold">Outreach Where It Works</h2>
              <p className="text-slate-300 mt-3">Schedule or send manually.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {outreachCards.map((card) => (
                <div key={card.title} className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <i className={`${card.icon} text-xl text-indigo-200`}></i>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{card.title}</h3>
                  <p className="text-slate-300">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="final-cta" className="py-16">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-10">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Stop Applying. Launch Campaigns.</h2>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  className="px-8 py-3 bg-white text-slate-900 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
                  onClick={() => navigate('/signup')}
                >
                  Start Free
                </button>
                <button
                  className="px-8 py-3 bg-slate-900/80 text-white rounded-xl font-semibold border border-white/20 hover:bg-slate-900 transition-colors"
                  onClick={() => navigate('/campaigns/job-seeker-agent')}
                >
                  Launch a Campaign
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooterJobs />
    </div>
  );
}
