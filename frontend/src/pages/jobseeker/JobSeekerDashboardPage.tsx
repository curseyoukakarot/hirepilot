import React from 'react';
import {
  FaWandMagicSparkles,
  FaCrosshairs,
  FaPlay,
  FaArrowUp,
  FaEnvelope,
  FaPaperPlane,
  FaLinkedin,
  FaVideo,
  FaPhone,
  FaHandshake,
} from 'react-icons/fa6';

export default function JobSeekerDashboardPage() {
  return (
    <div id="dashboard-container" className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-64 max-w-4xl rounded-full bg-gradient-to-br from-sky-500/15 via-violet-500/8 to-fuchsia-500/15 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300 backdrop-blur">
              <FaWandMagicSparkles className="text-xs" />
              <span>Job Seeker Mode · Powered by REX</span>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Good evening, Brandon 👋</h1>
              <p className="mt-2 text-sm text-slate-400">
                Your job hunt is in motion. Targeting{' '}
                <span className="font-medium text-slate-200">Head of Sales · B2B SaaS · Remote-first</span>.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Agent running weekly
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-300">
              <FaCrosshairs className="text-xs" />
              Job Seeker
            </div>
            <button className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-xs font-medium text-slate-900 shadow-sm hover:bg-slate-100 transition-colors">
              <FaPlay className="text-xs" />
              Ask REX
            </button>
          </div>
        </header>

        {/* Summary Cards */}
        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Active Applications', value: '8', desc: '3 interviewing · 1 offer' },
            { label: 'Interviews Scheduled', value: '3', desc: 'Next in 2 days' },
            { label: 'Reply Rate', value: '42%', desc: 'Last 14 days' },
            { label: 'Agent Activity', value: '24', desc: 'Contacts this week' },
          ].map((card, idx) => (
            <div
              key={card.label}
              className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-sm backdrop-blur hover:border-slate-700/80 transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">{card.label}</p>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl font-semibold text-slate-50">{card.value}</span>
                  {idx === 2 && <i className="fas fa-arrow-up text-emerald-400 text-xs" />}
                </div>
                <p className="text-xs text-slate-400">{card.desc}</p>
              </div>
            </div>
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          {/* Left column */}
          <div className="space-y-6">
            {/* Pipeline */}
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-sm backdrop-blur">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-50">Pipeline Overview</h2>
                  <p className="text-sm text-slate-400 mt-1">Track every opportunity from saved to signed offer</p>
                </div>
                <button className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-600 transition-colors">
                  View all jobs
                  <FaArrowUp className="text-xs" />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { label: 'Saved', color: 'bg-sky-500', value: '12', desc: 'Companies tracked' },
                  { label: 'Applied', color: 'bg-violet-500', value: '9', desc: 'Applications sent' },
                  { label: 'Interviewing', color: 'bg-emerald-500', value: '3', desc: 'Active interviews' },
                  { label: 'Offer', color: 'bg-amber-500', value: '1', desc: 'Pending decision' },
                  { label: 'Closed', color: 'bg-slate-500', value: '7', desc: 'Completed' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`h-2 w-2 rounded-full ${item.color}`} />
                      <span className="text-sm font-medium text-slate-300">{item.label}</span>
                    </div>
                    <div className="text-2xl font-semibold text-slate-50 mb-1">{item.value}</div>
                    <div className="text-xs text-slate-400">{item.desc}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Focus */}
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-sm backdrop-blur">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-50">This Week&apos;s Focus</h2>
                <p className="text-sm text-slate-400 mt-1">Priority actions to move your applications forward</p>
              </div>
              <div className="space-y-4">
                {[
                  {
                    icon: <FaEnvelope className="text-blue-400 text-sm" />,
                    title: 'Follow up with Sarah @ Nimbus Data',
                    desc: 'Interviewed → Follow-up email about next steps',
                    badge: 'Today',
                    badgeColor: 'bg-red-500/20 text-red-300',
                  },
                  {
                    icon: <FaPaperPlane className="text-green-400 text-sm" />,
                    title: 'Send application for VP Sales @ LumaCloud',
                    desc: 'Deadline in 3 days - tailor for B2B SaaS experience',
                    badge: 'This week',
                    badgeColor: 'bg-amber-500/20 text-amber-300',
                  },
                  {
                    icon: <FaLinkedin className="text-purple-400 text-sm" />,
                    title: 'Ask referral intro for ACME via Jason',
                    desc: 'LinkedIn connection - warm intro to hiring manager',
                    badge: 'This week',
                    badgeColor: 'bg-blue-500/20 text-blue-300',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-4 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700/30">{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200">{item.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      </div>
                    </div>
                    <button className="text-xs text-slate-400 hover:text-slate-300 transition-colors">Ask REX</button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* REX Assistant */}
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-sm backdrop-blur">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-50">REX: Today&apos;s Moves</h3>
                <p className="text-xs text-slate-400 mt-1">AI-powered recommendations for your job search</p>
              </div>
              <div className="space-y-3 mb-4">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="text-sm font-medium text-emerald-200">3 warmed-up leads ready to message</p>
                </div>
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                  <p className="text-sm font-medium text-blue-200">Optimize resume for GTM leadership roles</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 hover:bg-slate-100 transition-colors">
                  Open REX Chat
                </button>
                <button className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-600 transition-colors">
                  Resume Check
                </button>
              </div>
            </section>

            {/* Upcoming Interviews */}
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-sm backdrop-blur">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-50">Upcoming Interviews</h3>
                <p className="text-xs text-slate-400 mt-1">Your scheduled meetings and calls</p>
              </div>
              <div className="space-y-3">
                {[
                  { icon: <FaVideo className="text-red-400 text-sm" />, title: 'Final interview – VP Sales', company: 'LumaCloud', time: 'Thu · 3:00 PM' },
                  { icon: <FaPhone className="text-blue-400 text-sm" />, title: 'Screening call – Head of GTM', company: 'Nimbus Data', time: 'Mon · 11:30 AM' },
                  { icon: <FaHandshake className="text-green-400 text-sm" />, title: 'Recruiter intro – Revenue Lead', company: 'BrightScale', time: 'Tue · 9:00 AM' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700/30">{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200">{item.title}</p>
                      <p className="text-xs text-slate-400">{item.company}</p>
                      <p className="text-xs text-slate-500 mt-1">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Profile Strength */}
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-sm backdrop-blur">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-50">Profile Strength</h3>
                <p className="text-xs text-slate-400 mt-1">Optimize your professional presence</p>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Resume', pct: 80, color: 'bg-emerald-500' },
                  { label: 'LinkedIn', pct: 65, color: 'bg-blue-500' },
                  { label: 'Portfolio', pct: 40, color: 'bg-amber-500' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-300">{item.label}</span>
                      <span className="text-sm font-medium text-slate-200">{item.pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
                <button className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300 hover:border-slate-600 hover:text-slate-200 transition-colors">
                  Go to Prep
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* Bottom Analytics */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-sm backdrop-blur">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Job Search Analytics</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { value: '46', label: 'Messages sent (7 days)', sub: '32 email · 14 LinkedIn' },
                { value: '19', label: 'Responses received', sub: '41% response rate' },
                { value: '4', label: 'Interviews booked', sub: 'From 19 responses' },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <div className="text-2xl font-semibold text-slate-50">{item.value}</div>
                  <div className="text-xs text-slate-400">{item.label}</div>
                  <div className="text-xs text-slate-500 mt-1">{item.sub}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-sm backdrop-blur">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {[
                { color: 'bg-green-400', text: 'Interview scheduled with LumaCloud', time: '2h ago' },
                { color: 'bg-blue-400', text: 'Application sent to BrightScale', time: '5h ago' },
                { color: 'bg-purple-400', text: 'LinkedIn message to Sarah @ Nimbus', time: '1d ago' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <div className={`h-2 w-2 rounded-full ${item.color}`} />
                  <span className="text-slate-300">{item.text}</span>
                  <span className="text-slate-500 text-xs ml-auto">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
