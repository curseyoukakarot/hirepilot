import React, { useMemo } from "react";
import { motion } from "framer-motion";
import PublicNavbar from "../components/PublicNavbar";
import PublicFooter from "../components/PublicFooter";

const FORM_CTA_URL = "https://app.thehirepilot.com/f/gtm-strategy";

export default function GtmStrategyLandingPage() {
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="min-h-screen">
      <PublicNavbar />

      <style>{`
        :root {
          --bg0: #070a12;
          --bg1: #0a1022;
          --card: rgba(18, 24, 45, 0.72);
          --stroke: rgba(255, 255, 255, 0.08);
          --stroke2: rgba(255, 255, 255, 0.12);
          --text: rgba(255, 255, 255, 0.92);
          --muted: rgba(255, 255, 255, 0.68);
          --muted2: rgba(255, 255, 255, 0.52);
          --brand: #7c5cff;
          --brand2: #38bdf8;
          --brand3: #22c55e;
          --warn: #f59e0b;
        }
        body {
          background:
            radial-gradient(1200px 900px at 20% 10%, rgba(124,92,255,.18), transparent 55%),
            radial-gradient(900px 700px at 80% 20%, rgba(56,189,248,.14), transparent 55%),
            radial-gradient(900px 700px at 50% 95%, rgba(34,197,94,.10), transparent 55%),
            linear-gradient(180deg, var(--bg0), var(--bg1));
          color: var(--text);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        }
        .glass {
          background: var(--card);
          border: 1px solid var(--stroke);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }
        .glow-border { position: relative; }
        .glow-border:before {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: 1.25rem;
          background: linear-gradient(120deg, rgba(124,92,255,.55), rgba(56,189,248,.35), rgba(34,197,94,.35));
          filter: blur(14px);
          opacity: .28;
          z-index: -1;
        }
        .btn-grad { background: linear-gradient(90deg, rgba(124,92,255,1), rgba(56,189,248,1)); }
        .subtle-grid {
          background-image:
            linear-gradient(to right, rgba(255,255,255,.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,.06) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: radial-gradient(ellipse at center, rgba(0,0,0,1), rgba(0,0,0,0.2) 55%, rgba(0,0,0,0) 75%);
          -webkit-mask-image: radial-gradient(ellipse at center, rgba(0,0,0,1), rgba(0,0,0,0.2) 55%, rgba(0,0,0,0) 75%);
        }
        .floaty { animation: floaty 10s ease-in-out infinite; }
        @keyframes floaty {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .shine { position: relative; overflow: hidden; }
        .shine:after {
          content: "";
          position: absolute;
          top: -60%;
          left: -40%;
          width: 50%;
          height: 220%;
          transform: rotate(20deg);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent);
          animation: shine 3.5s ease-in-out infinite;
          opacity: .55;
        }
        @keyframes shine {
          0% { transform: translateX(-120%) rotate(20deg); }
          60% { transform: translateX(320%) rotate(20deg); }
          100% { transform: translateX(320%) rotate(20deg); }
        }
        .pill { border: 1px solid rgba(255,255,255,.10); background: rgba(255,255,255,.06); }
        .muted { color: var(--muted); }
        .muted2 { color: var(--muted2); }
      `}</style>

      {/* Background grid overlay */}
      <div className="pointer-events-none fixed inset-0 subtle-grid opacity-[0.35]" />

      <motion.main
        className="relative z-10 pt-24"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-12 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left hero copy */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 pill rounded-full px-3 py-1.5 text-xs">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                <span className="muted">Outreach Operating System for Agencies & Small Teams</span>
              </div>
              <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
                The{" "}
                <span
                  style={{
                    background: "linear-gradient(90deg, var(--brand), var(--brand2))",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  GTM Strategy Guide
                </span>{" "}
                that turns outreach into a repeatable engine.
              </h1>
              <p className="mt-5 text-lg muted leading-relaxed max-w-2xl">
                A plug-and-play playbook built from real execution — showing how to run daily outbound, multi-channel
                touches, and dashboards that reveal exactly what’s working. Designed so a founder + 1–2 reps can run{" "}
                <span className="text-white/90 font-semibold">20–30 hrs/week</span> and generate{" "}
                <span className="text-white/90 font-semibold">50–100 meetings/quarter</span> (without spreadsheet chaos).
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="pill rounded-full px-3 py-1.5 text-xs muted">Automate 80–90% of the flow</span>
                <span className="pill rounded-full px-3 py-1.5 text-xs muted">Safety-first, deliverability-first</span>
                <span className="pill rounded-full px-3 py-1.5 text-xs muted">Built for recruiting + services</span>
                <span className="pill rounded-full px-3 py-1.5 text-xs muted">Designed for revenue visibility</span>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a
                  href={FORM_CTA_URL}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl btn-grad shadow-glow font-semibold shine"
                >
                  Get early access
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10.293 15.707a1 1 0 010-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
                <a
                  href="#what-you-get"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition font-semibold"
                >
                  See what's inside
                </a>
              </div>
              <div className="mt-6 text-sm muted2">No spam. One email to unlock the guide + templates. Unsubscribe anytime.</div>
            </div>

            {/* Right hero card */}
            <div className="lg:col-span-5">
              <div className="glass glow-border rounded-3xl p-5 shadow-card floaty">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Expected outcomes</div>
                    <div className="text-xs muted2 mt-1">What agencies can build with this system</div>
                  </div>
                  <span className="pill rounded-full px-3 py-1.5 text-xs muted">2026 Blueprint</span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <div className="glass rounded-2xl p-4 border border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">Predictable pipeline</div>
                        <div className="text-sm muted mt-1">
                          Build a repeatable outbound cadence that produces meetings weekly — not random bursts.
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20">
                        Core
                      </span>
                    </div>
                  </div>
                  <div className="glass rounded-2xl p-4 border border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">Revenue visibility</div>
                        <div className="text-sm muted mt-1">
                          Dashboards that show what’s converting, where you’re leaking, and how to fix it.
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-lg bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/20">
                        Command
                      </span>
                    </div>
                  </div>
                  <div className="glass rounded-2xl p-4 border border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">Agency upside</div>
                        <div className="text-sm muted mt-1">
                          Use the playbook to drive $10k–$50k/mo retainers or win placement fees faster.
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-lg bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/20">
                        $$
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="glass rounded-2xl p-4 border border-white/10">
                    <div className="text-xs muted2">Designed for</div>
                    <div className="mt-1 text-sm font-semibold">1 founder + 1–2 reps</div>
                  </div>
                  <div className="glass rounded-2xl p-4 border border-white/10">
                    <div className="text-xs muted2">Weekly time</div>
                    <div className="mt-1 text-sm font-semibold">20–30 hours</div>
                  </div>
                  <div className="glass rounded-2xl p-4 border border-white/10">
                    <div className="text-xs muted2">Target output</div>
                    <div className="mt-1 text-sm font-semibold">50–100 meetings / Q</div>
                  </div>
                  <div className="glass rounded-2xl p-4 border border-white/10">
                    <div className="text-xs muted2">Automation goal</div>
                    <div className="mt-1 text-sm font-semibold">80–90% hands-free</div>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="text-xs muted2">Includes templates, cadences, KPI dashboards, and plug-and-play sequences.</div>
                  <a href={FORM_CTA_URL} className="text-sm font-semibold text-white hover:opacity-90">
                    Unlock →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Outcomes */}
        <section id="outcomes" className="mx-auto max-w-6xl px-6 py-10">
          <div className="glass rounded-3xl p-6 sm:p-8 border border-white/10 shadow-soft">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  What the guide helps you accomplish:
                </h2>
                <p className="mt-2 muted max-w-2xl">
                  The full guide includes exact sequences, scheduling logic, dashboard templates, and automation maps.
                </p>
              </div>
              <div className="pill rounded-2xl px-4 py-2 text-sm muted">Built for agencies, recruiters, and B2B services</div>
            </div>
            <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass rounded-2xl p-5 border border-white/10">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20 items-center justify-center">
                    ✓
                  </span>
                  <div className="font-semibold">Daily cadence engine</div>
                </div>
                <p className="mt-3 text-sm muted">
                  Run email + LinkedIn + ABM touches with repeatable rules so you don’t guess every morning.
                </p>
                <div className="mt-4 text-xs muted2">
                  Includes: scheduling rules, limits, follow-up loops, and “what to automate vs what to keep human.”
                </div>
              </div>
              <div className="glass rounded-2xl p-5 border border-white/10">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 rounded-xl bg-sky-500/15 ring-1 ring-sky-500/20 items-center justify-center">
                    ↗
                  </span>
                  <div className="font-semibold">Deal pipeline visibility</div>
                </div>
                <p className="mt-3 text-sm muted">Know exactly where leads drop, which offers win, and how many meetings you need for target revenue.</p>
                <div className="mt-4 text-xs muted2">Includes: KPI dashboards, pipeline pacing, conversion math, weekly report templates.</div>
              </div>
              <div className="glass rounded-2xl p-5 border border-white/10">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 rounded-xl bg-purple-500/15 ring-1 ring-purple-500/20 items-center justify-center">
                    $
                  </span>
                  <div className="font-semibold">Agency revenue expansion</div>
                </div>
                <p className="mt-3 text-sm muted">
                  Turn consistent meetings into retainers, projects, or placement revenue with pricing + packaging guidance.
                </p>
                <div className="mt-4 text-xs muted2">
                  Includes: offer templates, scope guardrails, “price ladder” examples, and services positioning angles.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What you get */}
        <section id="what-you-get" className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">
              <div className="glass rounded-3xl p-6 sm:p-8 border border-white/10 shadow-soft">
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight">What you get when you request access</h3>
                <p className="mt-2 muted">Enough to deploy the system quickly — but not the entire vault in this teaser.</p>
                <div className="mt-6 space-y-4">
                  <div className="flex gap-3">
                    <div className="mt-0.5 h-8 w-8 rounded-xl bg-white/5 ring-1 ring-white/10 grid place-items-center text-sm">
                      1
                    </div>
                    <div>
                      <div className="font-semibold">GTM Strategy Guide (full page)</div>
                      <div className="text-sm muted mt-1">
                        The full blueprint: daily cadence, weekly rhythm, monthly + quarterly motions, and how to systemize it in
                        HirePilot.
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-0.5 h-8 w-8 rounded-xl bg-white/5 ring-1 ring-white/10 grid place-items-center text-sm">
                      2
                    </div>
                    <div>
                      <div className="font-semibold">Plug-and-play sequences + templates</div>
                      <div className="text-sm muted mt-1">
                        Funding signals, event bridge sequences, ABM multi-touch templates, plus follow-up rules.
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-0.5 h-8 w-8 rounded-xl bg-white/5 ring-1 ring-white/10 grid place-items-center text-sm">
                      3
                    </div>
                    <div>
                      <div className="font-semibold">Dashboards that make decisions obvious</div>
                      <div className="text-sm muted mt-1">
                        Executive view, pipeline pacing, and cost/effort drivers — so you can scale what works.
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-0.5 h-8 w-8 rounded-xl bg-white/5 ring-1 ring-white/10 grid place-items-center text-sm">
                      4
                    </div>
                    <div>
                      <div className="font-semibold">Automation map (what to automate vs keep human)</div>
                      <div className="text-sm muted mt-1">
                        A practical “80–90% automated” map that keeps safety + deliverability as non-negotiables.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-7 p-4 rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-xl bg-amber-500/15 ring-1 ring-amber-500/25 grid place-items-center">
                      ⚡
                    </div>
                    <div>
                      <div className="font-semibold">This is built to drive revenue (not vanity)</div>
                      <div className="text-sm muted mt-1">
                        If you run the cadence consistently, you should be able to forecast: meetings → proposals → wins → monthly
                        revenue — and tighten the system over time.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-5">
              <div id="proof" className="glass glow-border rounded-3xl p-6 sm:p-8 border border-white/10 shadow-card">
                <h3 className="text-xl font-extrabold tracking-tight">A realistic upside for agencies</h3>
                <p className="mt-2 muted">This teaser doesn’t promise magic — it shows the *math* behind consistent outreach.</p>
                <div className="mt-6 grid grid-cols-1 gap-3">
                  <div className="glass rounded-2xl p-4 border border-white/10">
                    <div className="text-xs muted2">Example path</div>
                    <div className="mt-1 font-semibold">5 meetings/week → 20/month</div>
                    <div className="mt-2 text-sm muted">
                      With good positioning + follow-up, even modest conversion can produce retainers.
                    </div>
                  </div>
                  <div className="glass rounded-2xl p-4 border border-white/10">
                    <div className="text-xs muted2">Example offer</div>
                    <div className="mt-1 font-semibold">$7.5k–$15k/mo retainer</div>
                    <div className="mt-2 text-sm muted">
                      The guide includes packaging options that pair well with agency workflows.
                    </div>
                  </div>
                  <div className="glass rounded-2xl p-4 border border-white/10">
                    <div className="text-xs muted2">Example outcome</div>
                    <div className="mt-1 font-semibold">2 retainers = $180k–$360k/yr</div>
                    <div className="mt-2 text-sm muted">
                      And if you’re recruiting/placement-based, the same engine drives fee-based wins too.
                    </div>
                  </div>
                </div>
                <div className="mt-6 text-xs muted2">
                  Disclaimer: results vary based on offer, ICP, list quality, and execution consistency.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA / access */}
        <section id="access" className="mx-auto max-w-6xl px-6 pt-10 pb-16">
          <div className="glass glow-border rounded-3xl p-6 sm:p-10 border border-white/10 shadow-glow">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Want the full GTM Strategy Guide?</h2>
                <p className="mt-3 muted max-w-2xl">
                  Request access and we’ll send you the full blueprint + templates. You’ll use it to build a repeatable outreach
                  system inside HirePilot — then measure everything with dashboards.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="pill rounded-full px-3 py-1.5 text-xs muted">Full playbook + templates</span>
                  <span className="pill rounded-full px-3 py-1.5 text-xs muted">Dashboards + KPI pacing</span>
                  <span className="pill rounded-full px-3 py-1.5 text-xs muted">Automation map + safety rules</span>
                </div>
              </div>
              <div className="lg:col-span-5">
                <div className="glass rounded-2xl p-5 border border-white/10">
                  <div className="text-sm font-semibold">Get access</div>
                  <div className="text-xs muted2 mt-1">Open the form and we’ll send the guide.</div>
                  <a
                    href={FORM_CTA_URL}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl btn-grad shadow-glow font-semibold shine"
                  >
                    Request the guide
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10.293 15.707a1 1 0 010-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </a>
                  <div className="mt-3 text-[11px] muted2 leading-relaxed">
                    This button goes to the public form at{" "}
                    <a href={FORM_CTA_URL} className="underline">
                      app.thehirepilot.com/f/gtm-strategy
                    </a>
                    .
                  </div>
                </div>
                <div className="mt-3 text-[11px] muted2">
                  You’ll also get updates as we release more templates + automation improvements.
                </div>
              </div>
            </div>
          </div>

          <footer className="mt-10 text-center text-xs muted2">
            © <span>{year}</span> HirePilot · Built for founders who want predictable pipeline.
          </footer>
        </section>
      </motion.main>

      <PublicFooter />
    </div>
  );
}


