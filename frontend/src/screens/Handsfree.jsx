import React, { useEffect } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

/* ── data ── */
const stats = [
  { value: '500+', label: 'Roles Filled' },
  { value: '14 days', label: 'Avg. Time to Interview' },
  { value: '94%', label: 'Client Retention' },
  { value: '3x', label: 'Faster Than In-House' },
];

const features = [
  { icon: 'fa-crosshairs', title: 'Full-Service Sourcing', desc: 'You send us the job. We find, engage, and qualify top candidates — powered by AI + human recruiters.', color: 'from-blue-600 to-cyan-500' },
  { icon: 'fa-users', title: 'Unlimited Team Access', desc: 'Invite hiring managers, ops, and execs. Everyone sees the same pipeline in real time.', color: 'from-violet-600 to-purple-500' },
  { icon: 'fa-brands fa-slack', title: 'Slack-First Collaboration', desc: 'Review candidates, approve outreach, and track status — all inside Slack.', color: 'from-emerald-500 to-teal-500', iconBase: '' },
  { icon: 'fa-plug', title: 'ATS Integration', desc: 'Seamlessly sync with your existing hiring stack. No migration needed.', color: 'from-amber-500 to-orange-500' },
  { icon: 'fa-calendar-check', title: 'Calendar-Ready Interviews', desc: 'Just show up. We schedule every call, send reminders, and prep the candidate.', color: 'from-rose-500 to-pink-500' },
  { icon: 'fa-chart-line', title: 'Live Reporting Dashboard', desc: 'Track sourcing volume, response rates, interviews booked, and placements in one view.', color: 'from-indigo-500 to-blue-500' },
];

const steps = [
  { num: '01', title: 'Kickoff', desc: 'We align on your goals, culture, ideal candidate profile, and timeline.', icon: 'fa-handshake' },
  { num: '02', title: 'We Source & Engage', desc: 'Our recruiters + REX handle outreach, screening, and qualification at scale.', icon: 'fa-magnifying-glass' },
  { num: '03', title: 'You Interview', desc: 'Qualified, interested candidates show up on your calendar — ready to hire.', icon: 'fa-calendar-check' },
];

const comparison = [
  { feature: 'Candidate Sourcing', self: 'You manage', dfy: 'We handle everything' },
  { feature: 'AI-Powered Outreach', self: true, dfy: true },
  { feature: 'Human Recruiters', self: false, dfy: true },
  { feature: 'Slack Collaboration', self: false, dfy: true },
  { feature: 'ATS Integration', self: false, dfy: true },
  { feature: 'Calendar Scheduling', self: false, dfy: true },
  { feature: 'Dedicated Account Manager', self: false, dfy: true },
];

const testimonials = [
  { name: 'Michael C.', role: 'CTO', quote: "In 30 days, we filled 3 roles — all scheduled on my calendar. Easiest hires I've ever made." },
  { name: 'Sarah W.', role: 'Head of Talent', quote: 'Their team became an extension of ours. The quality of candidates and speed of hiring exceeded our expectations.' },
];

export default function Handsfree() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('ent-visible'); io.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.ent-reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="bg-[#2A1B36] text-[#F3E8FF] font-sans overflow-x-hidden">
      <style>{`
        .ent-reveal{opacity:0;transform:translateY(24px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}
        .ent-reveal.ent-visible{opacity:1;transform:none}
        .glass{background:rgba(255,255,255,.05);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1)}
        .glow-blue{box-shadow:0 0 60px rgba(59,130,246,.12)}
      `}</style>

      <PublicNavbar />

      {/* ══════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════ */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-28 overflow-hidden">
        {/* Glow effects */}
        <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-[radial-gradient(circle,rgba(59,130,246,.15)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute top-1/3 left-8 w-28 h-28 bg-blue-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-8 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 ent-reveal">
            <span className="flex h-2 w-2 rounded-full bg-blue-400" />
            <span className="text-sm font-medium text-blue-200">Done-For-You Recruiting</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight ent-reveal">
            We Find.{' '}
            <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent">You Interview.</span>
          </h1>

          <p className="mt-6 max-w-3xl mx-auto text-lg md:text-xl text-gray-300 leading-relaxed ent-reveal">
            Our recruiters + AI handle sourcing, outreach, and scheduling — so qualified candidates show up on your calendar, ready to hire.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center ent-reveal">
            <a href="https://form.typeform.com/to/UubjS8Rh" target="_blank" rel="noopener" className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-lg shadow-blue-500/25 transform hover:-translate-y-0.5 transition-all duration-200">
              <i className="fa-regular fa-calendar-check mr-2" />
              Schedule Free Consultation
            </a>
            <a href="/pricing" className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 border border-white/20 text-base font-semibold rounded-xl text-white bg-transparent hover:bg-white/5 transition-all duration-200 backdrop-blur-sm">
              Get Started Free
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SOCIAL PROOF BAR
      ══════════════════════════════════════════════ */}
      <section className="py-12 bg-[#251830] border-y border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center ent-reveal">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">{s.value}</div>
                <div className="text-sm text-gray-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          DASHBOARD SHOWCASE
      ══════════════════════════════════════════════ */}
      <section className="py-20" id="dashboard">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 ent-reveal">
            <span className="text-blue-400 font-semibold tracking-wider uppercase text-sm">Your Command Center</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-2">Everything you need to hire fast</h2>
            <p className="text-gray-400 mt-4 text-lg">Track sourcing, collaboration, and success rates in one dashboard.</p>
          </div>

          <div className="ent-reveal">
            <div className="glass rounded-2xl p-2 glow-blue">
              <img src="/dfy-dashboard.png" alt="Client Dashboard" className="w-full rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════════ */}
      <section className="py-20 bg-[#251830]" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 ent-reveal">
            <span className="text-blue-400 font-semibold tracking-wider uppercase text-sm">What&rsquo;s Included</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-2">White-glove recruiting, powered by AI.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={f.title} className="glass rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 group ent-reveal" style={{ transitionDelay: `${i * 60}ms` }}>
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                  <i className={`${f.iconBase !== undefined ? '' : 'fa-solid '}${f.icon} text-xl`} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════ */}
      <section className="py-20" id="process">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 ent-reveal">
            <span className="text-blue-400 font-semibold tracking-wider uppercase text-sm">Process</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-2">Three steps. Zero busywork.</h2>
            <p className="text-gray-400 mt-4 text-lg">From kickoff to interviews — we handle every step.</p>
          </div>

          <div className="relative">
            {/* connector line */}
            <div className="hidden md:block absolute top-8 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-blue-500/30 via-cyan-500/30 to-blue-500/30" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map((s, i) => (
                <div key={s.num} className="relative text-center ent-reveal" style={{ transitionDelay: `${i * 120}ms` }}>
                  <div className="relative z-10 mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-2xl mb-6 shadow-lg shadow-blue-500/30">
                    <i className={`fa-solid ${s.icon}`} />
                  </div>
                  <div className="text-xs font-mono text-blue-400 mb-2">Step {s.num}</div>
                  <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
                  <p className="text-gray-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          WHY DONE-FOR-YOU
      ══════════════════════════════════════════════ */}
      <section className="py-20 bg-[#22152b]" id="why-dfy">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="ent-reveal">
              <span className="text-blue-400 font-semibold tracking-wider uppercase text-sm">Why Done-For-You</span>
              <h2 className="text-3xl md:text-5xl font-bold mt-2 mb-6">
                Your recruiting team,{' '}
                <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">without the overhead.</span>
              </h2>
              <p className="text-lg text-gray-300 mb-8">
                Skip the agency fees, the contract recruiters, and the months of ramp-up. Get a fully operational recruiting engine from day one.
              </p>
              <ul className="space-y-4">
                {[
                  'No agency markups or per-hire fees',
                  'Dedicated team that learns your culture',
                  'AI-powered sourcing at human scale',
                  'Full pipeline visibility in real time',
                  'Cancel anytime — no lock-in contracts',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                      <i className="fa-solid fa-check text-xs" />
                    </div>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* visual — pipeline preview */}
            <div className="ent-reveal">
              <div className="glass rounded-2xl border border-white/10 overflow-hidden glow-blue">
                <div className="bg-[#1a1025] px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-400">dfy_pipeline_status.json</span>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                  </div>
                </div>
                <div className="p-5 font-mono text-sm space-y-2 text-gray-300">
                  <div><span className="text-blue-400">&#10003;</span> Sourced <span className="text-white">247 candidates</span> &rarr; Sr. React Engineer</div>
                  <div><span className="text-blue-400">&#10003;</span> Outreach sent &rarr; <span className="text-white">185 personalized intros</span></div>
                  <div><span className="text-blue-400">&#10003;</span> Replies received &rarr; <span className="text-cyan-400">43 interested</span></div>
                  <div><span className="text-blue-400">&#10003;</span> Screened &rarr; <span className="text-white">28 qualified</span></div>
                  <div><span className="text-blue-400">&#10003;</span> Interviews scheduled &rarr; <span className="text-green-400">12 this week</span></div>
                  <div><span className="text-blue-400">&#10003;</span> Offers extended &rarr; <span className="text-white">3</span></div>
                  <div><span className="text-amber-400">&#9679;</span> Awaiting acceptance &rarr; <span className="text-white">1 pending</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          COMPARISON TABLE
      ══════════════════════════════════════════════ */}
      <section className="py-20" id="comparison">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 ent-reveal">
            <h2 className="text-3xl md:text-5xl font-bold">
              Self-serve or{' '}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">fully managed.</span>
            </h2>
            <p className="text-gray-400 mt-4 text-lg">Choose the plan that fits how your team hires.</p>
          </div>

          <div className="glass rounded-2xl overflow-hidden ent-reveal">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="p-5 text-left text-gray-400 text-sm font-medium">Feature</th>
                  <th className="p-5 text-center text-gray-400 text-sm font-medium">Core Platform</th>
                  <th className="p-5 text-center text-sm font-medium bg-blue-600/10 text-blue-300 relative">
                    Done For You
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-400" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[.02]'}`}>
                    <td className="p-5 text-gray-300 text-sm">{row.feature}</td>
                    <td className="p-5 text-center">
                      {typeof row.self === 'string' ? (
                        <span className="text-sm text-gray-500">{row.self}</span>
                      ) : row.self ? (
                        <i className="fa-solid fa-check text-green-400" />
                      ) : (
                        <i className="fa-solid fa-minus text-gray-600" />
                      )}
                    </td>
                    <td className="p-5 text-center bg-blue-600/5">
                      {typeof row.dfy === 'string' ? (
                        <span className="text-sm text-blue-300 font-medium">{row.dfy}</span>
                      ) : row.dfy ? (
                        <i className="fa-solid fa-check text-blue-400" />
                      ) : (
                        <i className="fa-solid fa-minus text-gray-600" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════ */}
      <section className="py-20 bg-[#251830]" id="testimonials">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 ent-reveal">
            <span className="text-blue-400 font-semibold tracking-wider uppercase text-sm">Results</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-2">Real outcomes. Real teams.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonials.map((t, i) => (
              <div key={t.name} className="glass rounded-2xl p-8 ent-reveal" style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <i key={j} className="fa-solid fa-star text-amber-400 text-sm" />
                  ))}
                </div>
                <p className="text-lg text-gray-200 leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          CTA
      ══════════════════════════════════════════════ */}
      <section className="py-24 relative overflow-hidden" id="cta">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2A1B36] to-[#1a2540]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px]" />

        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center ent-reveal">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
            Stop sourcing.
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Start interviewing.</span>
          </h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Let us run your recruiting process while you focus on closing the best candidates.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a href="https://form.typeform.com/to/UubjS8Rh" target="_blank" rel="noopener" className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(59,130,246,.3)] transition-all transform hover:-translate-y-1">
              <i className="fa-regular fa-calendar mr-2" />
              Book a Consultation
            </a>
            <a href="/pricing" className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl backdrop-blur-sm transition-all">
              View Pricing
            </a>
          </div>
          <p className="mt-8 text-sm text-gray-500">No commitment required. See candidate samples in your first call.</p>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
