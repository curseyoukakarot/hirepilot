import React, { useEffect, useRef } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import InteractiveRexPreview from '../components/rex/InteractiveRexPreview';

/* ── data ── */
const operatesGrid = [
  { icon: 'fa-brain', label: 'Plans', desc: 'Breaks down your goal into sourcing, enrichment, personalization, outreach, and pipeline logic.' },
  { icon: 'fa-plug', label: 'Connects Tools', desc: 'Calls Sniper, Apollo, enrichment providers, messaging, and scheduling APIs.' },
  { icon: 'fa-database', label: 'Writes Data', desc: 'Creates and updates leads, candidates, clients, job reqs, and pipeline stages.' },
  { icon: 'fa-chart-bar', label: 'Creates Dashboards', desc: 'Turns activity into structured analytics — placements, revenue, conversion rates.' },
  { icon: 'fa-arrows-spin', label: 'Triggers Workflows', desc: 'If reply \u2192 move stage \u2192 notify team \u2192 schedule meeting. All automatic.' },
];

const commands = [
  'Find 50 VP Sales in Austin in B2B SaaS. Rank best-to-last and draft intros.',
  'Pull top 20 candidates for this job and start outreach.',
  'Move everyone who replied "interested" to Interview stage.',
  'Create a dashboard: meetings booked by persona, last 30 days.',
  'Turn this campaign into a reusable workflow recipe.',
];

const osActions = [
  'Update CRM records',
  'Convert lead \u2192 candidate',
  'Attach job req',
  'Move pipeline stage',
  'Assign tasks to team',
  'Trigger invoice',
  'Log revenue event',
];

const flowSteps = [
  { num: '01', label: 'Intent', title: 'You tell REX the goal', desc: 'Plain English. No forms, no clicks.', icon: 'fa-comment' },
  { num: '02', label: 'Plan', title: 'REX builds the workflow', desc: 'Sourcing, enrichment, personalization, outreach.', icon: 'fa-sitemap' },
  { num: '03', label: 'Execute', title: 'Sniper + HirePilot execute', desc: 'Browser actions, API calls, CRM writes.', icon: 'fa-bolt' },
  { num: '04', label: 'Update', title: 'System of record updates', desc: 'Pipeline, dashboards, revenue — all live.', icon: 'fa-circle-check' },
];

const promptToRevenue = [
  { icon: 'fa-crosshairs', label: 'Source', color: 'from-violet-600 to-purple-600' },
  { icon: 'fa-paper-plane', label: 'Outreach', color: 'from-purple-600 to-fuchsia-600' },
  { icon: 'fa-reply', label: 'Replies', color: 'from-fuchsia-600 to-pink-600' },
  { icon: 'fa-user-check', label: 'Candidate', color: 'from-pink-600 to-rose-500' },
  { icon: 'fa-handshake', label: 'Offer', color: 'from-rose-500 to-orange-500' },
  { icon: 'fa-file-invoice-dollar', label: 'Invoice', color: 'from-orange-500 to-amber-500' },
];

export default function MeetRex() {
  const cmdRef = useRef(null);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('rex-visible'); io.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.rex-reveal').forEach((el) => io.observe(el));

    /* typing animation for command bar */
    let cancelled = false;
    let cmdIdx = 0;
    let charIdx = 0;
    let typing = true;
    let timer;
    const el = cmdRef.current;
    const tick = () => {
      if (cancelled || !el) return;
      const cmd = commands[cmdIdx];
      if (typing) {
        charIdx++;
        el.textContent = cmd.slice(0, charIdx);
        if (charIdx >= cmd.length) {
          typing = false;
          timer = setTimeout(tick, 3000); /* pause 3s so user can read */
        } else {
          timer = setTimeout(tick, 45); /* 45ms per char — readable typing */
        }
      } else {
        el.textContent = '';
        charIdx = 0;
        cmdIdx = (cmdIdx + 1) % commands.length;
        typing = true;
        timer = setTimeout(tick, 600); /* brief pause before next phrase */
      }
    };
    timer = setTimeout(tick, 1000);

    return () => { cancelled = true; io.disconnect(); clearTimeout(timer); };
  }, []);

  return (
    <div className="bg-[#2A1B36] text-[#F3E8FF] font-sans overflow-x-hidden">
      <style>{`
        .rex-reveal{opacity:0;transform:translateY(24px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}
        .rex-reveal.rex-visible{opacity:1;transform:none}
        .glass{background:rgba(255,255,255,.05);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1)}
        .cmd-cursor::after{content:'|';animation:blink 1s step-end infinite;color:#8B5CF6}
        @keyframes blink{50%{opacity:0}}
        .glow-purple{box-shadow:0 0 60px rgba(139,92,246,.15)}
      `}</style>

      <PublicNavbar />

      {/* ══════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════ */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-28 overflow-hidden">
        {/* glow */}
        <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-[radial-gradient(circle,rgba(139,92,246,.18)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute top-1/3 left-8 w-28 h-28 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-8 w-36 h-36 bg-violet-500/10 rounded-full blur-3xl animate-pulse" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 rex-reveal">
            <span className="flex h-2 w-2 rounded-full bg-[#8B5CF6]" />
            <span className="text-sm font-medium text-[#D8B4FE]">The Command Layer of Your Recruiting OS</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight rex-reveal">
            REX turns intent <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-white to-[#D8B4FE] bg-clip-text text-transparent">into execution.</span>
          </h1>

          <p className="mt-6 max-w-3xl mx-auto text-lg md:text-xl text-gray-300 leading-relaxed rex-reveal">
            Tell REX the outcome. REX builds the workflow. HirePilot executes it — and writes everything back to your CRM + ATS.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center rex-reveal">
            <a href="https://app.thehirepilot.com/signup" className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-xl text-white bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 shadow-lg shadow-purple-500/25 transform hover:-translate-y-0.5 transition-all duration-200">
              Launch REX
            </a>
            <a href="#command-examples" className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 border border-white/20 text-base font-semibold rounded-xl text-white bg-transparent hover:bg-white/5 transition-all duration-200 backdrop-blur-sm group">
              <i className="fa-regular fa-circle-play mr-2 group-hover:text-[#8B5CF6] transition-colors" />
              See REX build a workflow
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 1: WHAT HAPPENS WHEN YOU GIVE REX A GOAL?
      ══════════════════════════════════════════════ */}
      <section className="py-20 bg-[#251830]" id="how-rex-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 rex-reveal">
            <span className="text-[#8B5CF6] font-semibold tracking-wider uppercase text-sm">Workflow</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-2">What happens when you give REX a goal?</h2>
            <p className="text-gray-400 mt-4 text-lg">From Intent &rarr; Plan &rarr; Execute &rarr; Update System</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {flowSteps.map((s, i) => (
              <div key={s.num} className="glass rounded-2xl p-6 relative group hover:bg-white/10 transition-all duration-300 rex-reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="text-xs font-mono text-[#8B5CF6] mb-3">{s.num} — {s.label}</div>
                <div className="w-12 h-12 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center text-[#8B5CF6] mb-4 group-hover:scale-110 transition-transform">
                  <i className={`fa-solid ${s.icon} text-xl`} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400">{s.desc}</p>
                {i < 3 && <div className="hidden lg:block absolute top-1/2 -right-3 text-gray-600 text-lg">&rarr;</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 2: REX DOESN'T JUST CHAT. HE OPERATES.
      ══════════════════════════════════════════════ */}
      <section className="py-20" id="operates">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 rex-reveal">
            <h2 className="text-3xl md:text-5xl font-bold">
              REX doesn&rsquo;t just chat.{' '}
              <span className="bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">He operates.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {operatesGrid.map((item, i) => (
              <div key={item.label} className="glass rounded-2xl p-6 text-center hover:bg-white/10 transition-all duration-300 group rex-reveal" style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center text-white text-xl mb-4 mx-auto shadow-lg group-hover:scale-110 transition-transform">
                  <i className={`fa-solid ${item.icon}`} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.label}</h3>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 3: COMMAND EXAMPLES
      ══════════════════════════════════════════════ */}
      <section className="py-20 bg-[#22152b]" id="command-examples">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 rex-reveal">
            <span className="text-[#8B5CF6] font-semibold tracking-wider uppercase text-sm">Command Bar</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-2">This is not chat. This is a business command line.</h2>
          </div>

          {/* Typing command bar */}
          <div className="glass rounded-2xl glow-purple overflow-hidden rex-reveal">
            <div className="bg-[#1a1025] px-5 py-3 border-b border-white/5 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
              </div>
              <span className="text-xs font-mono text-gray-500">rex &gt; command</span>
            </div>
            <div className="p-6 md:p-8">
              <div className="flex items-start gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <i className="fa-solid fa-terminal text-[#8B5CF6] text-sm" />
                </div>
                <p className="text-lg md:text-xl font-mono text-gray-200 cmd-cursor" ref={cmdRef}>&nbsp;</p>
              </div>
              <div className="border-t border-white/5 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {commands.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-500">
                    <i className="fa-solid fa-chevron-right text-[#8B5CF6] mt-0.5 text-xs shrink-0" />
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 4: REX + SNIPER + HIREPILOT DIAGRAM
      ══════════════════════════════════════════════ */}
      <section className="py-20" id="architecture">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 rex-reveal">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Three layers. One system.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 rex-reveal">
            {[
              { icon: 'fa-brain', label: 'REX', role: 'The Brain', desc: 'Decides what to do. Plans workflows, selects tools, writes logic.', color: 'from-violet-600 to-purple-500', border: 'border-violet-500/40' },
              { icon: 'fa-hand-pointer', label: 'Sniper', role: 'The Hands', desc: 'Executes where needed. Browser automation, LinkedIn actions, web scraping.', color: 'from-fuchsia-600 to-pink-500', border: 'border-fuchsia-500/40' },
              { icon: 'fa-server', label: 'HirePilot', role: 'System of Record', desc: 'Stores the truth. CRM, ATS, pipelines, dashboards, revenue.', color: 'from-blue-600 to-cyan-500', border: 'border-blue-500/40' },
            ].map((item, i) => (
              <div key={item.label} className={`glass rounded-2xl p-8 text-center ${item.border} hover:bg-white/10 transition-all duration-300`} style={{ transitionDelay: `${i * 100}ms` }}>
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white text-2xl mb-5 mx-auto shadow-lg`}>
                  <i className={`fa-solid ${item.icon}`} />
                </div>
                <div className="text-xs font-mono text-gray-500 mb-2">{item.role}</div>
                <h3 className="text-2xl font-bold text-white mb-3">{item.label}</h3>
                <p className="text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* connector arrows */}
          <div className="hidden md:flex items-center justify-center gap-4 mt-8 rex-reveal">
            <span className="text-gray-600 text-sm">REX decides</span>
            <i className="fa-solid fa-arrow-right text-[#8B5CF6]" />
            <span className="text-gray-600 text-sm">Sniper executes</span>
            <i className="fa-solid fa-arrow-right text-[#8B5CF6]" />
            <span className="text-gray-600 text-sm">HirePilot stores</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 5: FROM PROMPT → REVENUE
      ══════════════════════════════════════════════ */}
      <section className="py-20 bg-[#251830]" id="prompt-to-revenue">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 rex-reveal">
            <span className="text-[#8B5CF6] font-semibold tracking-wider uppercase text-sm">End to End</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-2">From Prompt &rarr; Revenue</h2>
            <p className="text-gray-400 mt-4 text-lg">One command. Every step connected.</p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 rex-reveal">
            {promptToRevenue.map((step, i) => (
              <React.Fragment key={step.label}>
                <div className="flex flex-col items-center text-center">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white text-xl shadow-lg mb-3`}>
                    <i className={`fa-solid ${step.icon}`} />
                  </div>
                  <span className="text-sm font-semibold text-white">{step.label}</span>
                </div>
                {i < promptToRevenue.length - 1 && (
                  <div className="hidden md:block text-gray-600"><i className="fa-solid fa-arrow-right" /></div>
                )}
                {i < promptToRevenue.length - 1 && (
                  <div className="md:hidden text-gray-600"><i className="fa-solid fa-arrow-down" /></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          OS CONTROL
      ══════════════════════════════════════════════ */}
      <section className="py-20" id="os-control">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="rex-reveal">
              <span className="text-[#8B5CF6] font-semibold tracking-wider uppercase text-sm">OS Control</span>
              <h2 className="text-3xl md:text-5xl font-bold mt-2 mb-6">REX writes to your system of record.</h2>
              <p className="text-lg text-gray-300 mb-8">Every action REX takes updates your CRM, ATS, pipelines, and revenue tracking in real time.</p>
              <ul className="space-y-3">
                {osActions.map((action) => (
                  <li key={action} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center text-[#8B5CF6] shrink-0">
                      <i className="fa-solid fa-check text-xs" />
                    </div>
                    <span className="text-gray-300">{action}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* visual */}
            <div className="rex-reveal">
              <div className="glass rounded-2xl border border-white/10 overflow-hidden">
                <div className="bg-[#1a1025] px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-400">rex_execution_log.json</span>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                  </div>
                </div>
                <div className="p-5 font-mono text-sm space-y-2 text-gray-300">
                  <div><span className="text-[#8B5CF6]">&#10003;</span> Lead created &rarr; <span className="text-white">Sarah Chen</span></div>
                  <div><span className="text-[#8B5CF6]">&#10003;</span> Converted to Candidate</div>
                  <div><span className="text-[#8B5CF6]">&#10003;</span> Attached Job Req &rarr; <span className="text-white">#SR-2847</span></div>
                  <div><span className="text-[#8B5CF6]">&#10003;</span> Pipeline stage &rarr; <span className="text-green-400">Interview</span></div>
                  <div><span className="text-[#8B5CF6]">&#10003;</span> Task assigned &rarr; <span className="text-white">@brandon</span></div>
                  <div><span className="text-[#8B5CF6]">&#10003;</span> Slack notification &rarr; <span className="text-white">#recruiting-leads</span></div>
                  <div><span className="text-yellow-400">&#9679;</span> Revenue event &rarr; <span className="text-white">pending placement</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          DIFFERENTIATOR
      ══════════════════════════════════════════════ */}
      <section className="py-20 bg-[#22152b]" id="differentiator">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 rex-reveal">
            <h2 className="text-3xl md:text-5xl font-bold">
              Most AI tools generate text.<br />
              <span className="bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">REX generates structured business outcomes.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 rex-reveal">
            <div className="glass rounded-2xl p-8 border-red-500/20">
              <h3 className="text-lg font-bold text-gray-400 mb-6 flex items-center gap-2">
                <i className="fa-solid fa-xmark text-red-400" /> Other AI tools
              </h3>
              <ul className="space-y-3 text-gray-500">
                <li className="flex items-center gap-2"><i className="fa-solid fa-minus text-xs" /> Draft messages</li>
                <li className="flex items-center gap-2"><i className="fa-solid fa-minus text-xs" /> Suggest ideas</li>
                <li className="flex items-center gap-2"><i className="fa-solid fa-minus text-xs" /> Summarize resumes</li>
                <li className="flex items-center gap-2"><i className="fa-solid fa-minus text-xs" /> Generate copy</li>
              </ul>
            </div>
            <div className="glass rounded-2xl p-8 border-[#8B5CF6]/40 glow-purple">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <i className="fa-solid fa-check text-[#8B5CF6]" /> REX
              </h3>
              <ul className="space-y-3 text-gray-200">
                <li className="flex items-center gap-2"><i className="fa-solid fa-bolt text-[#8B5CF6] text-xs" /> Executes real actions</li>
                <li className="flex items-center gap-2"><i className="fa-solid fa-bolt text-[#8B5CF6] text-xs" /> Updates pipeline stages</li>
                <li className="flex items-center gap-2"><i className="fa-solid fa-bolt text-[#8B5CF6] text-xs" /> Tracks analytics &amp; revenue</li>
                <li className="flex items-center gap-2"><i className="fa-solid fa-bolt text-[#8B5CF6] text-xs" /> Connects end-to-end workflows</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          BUILT FOR REAL EXECUTION
      ══════════════════════════════════════════════ */}
      <section className="py-20" id="credibility">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center rex-reveal">
          <span className="text-[#8B5CF6] font-semibold tracking-wider uppercase text-sm">Enterprise-Ready</span>
          <h2 className="text-3xl md:text-5xl font-bold mt-2 mb-12">Built for real execution.</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { icon: 'fa-shield-halved', label: 'Guardrails' },
              { icon: 'fa-gauge-high', label: 'Throttling' },
              { icon: 'fa-circle-check', label: 'Verification' },
              { icon: 'fa-clipboard-list', label: 'Audit Logs' },
              { icon: 'fa-clock', label: 'Scheduling Windows' },
            ].map((item) => (
              <div key={item.label} className="glass rounded-xl p-5 text-center hover:bg-white/10 transition-all">
                <i className={`fa-solid ${item.icon} text-2xl text-[#8B5CF6] mb-3`} />
                <p className="text-sm font-medium text-gray-300">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          INTERACTIVE PREVIEW (kept)
      ══════════════════════════════════════════════ */}
      <section id="rex-interactive" className="py-0 bg-[#2A1B36] rex-reveal">
        <InteractiveRexPreview />
      </section>

      {/* ══════════════════════════════════════════════
          SLACK PREVIEW (kept)
      ══════════════════════════════════════════════ */}
      <section id="chat-preview" className="py-20 bg-[#251830] rex-reveal">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">Try REX on Slack</h2>
          <div className="glass rounded-2xl p-8 max-w-2xl mx-auto">
            <div className="mb-6 flex justify-center">
              <img src="/REX-slack.gif" alt="REX Slack Preview" className="rounded-xl max-w-full" />
            </div>
            <a href="https://app.thehirepilot.com/login" className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 transition-all">
              Launch REX
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          CTA
      ══════════════════════════════════════════════ */}
      <section className="py-24 relative overflow-hidden" id="cta">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2A1B36] to-[#3a254a]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#8B5CF6]/10 rounded-full blur-[100px]" />

        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center rex-reveal">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
            Run your business<br />
            <span className="bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">with commands.</span>
          </h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            REX is included in all plans. Stop clicking. Start commanding.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a href="https://app.thehirepilot.com/signup" className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(139,92,246,.3)] transition-all transform hover:-translate-y-1">
              Launch REX Free
            </a>
            <a href="/pricing" className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl backdrop-blur-sm transition-all">
              View Pricing
            </a>
          </div>
          <p className="mt-8 text-sm text-gray-500">No credit card required.</p>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
