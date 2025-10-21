// src/pages/IntegrationsAndWorkflows.jsx
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

/**
 * Integrations & Workflows — HirePilot
 * - Hero
 * - Integrations Grid
 * - Filterable Workflow Library (25 recipes)
 * - Animated Recipe Modal
 * - Final CTA
 *
 * Tailwind + Framer Motion
 */

export default function IntegrationsAndWorkflows() {
  const categories = [
    "All",
    "Sourcing",
    "Messaging",
    "Pipeline",
    "Billing",
    "REX Intelligence",
    "Client Experience",
  ];

  const integrations = [
    { name: "Apollo", icon: "/icons/apollo.svg", desc: "Source and enrich B2B leads instantly." },
    { name: "LinkedIn Sales Navigator", icon: "/linkedin-sn.png", desc: "Find top talent and decision-makers." },
    { name: "Chrome Extension", icon: "/icons/chrome.svg", desc: "Save any LinkedIn profile into HirePilot." },
    { name: "Slack", icon: "/icons/slack.svg", desc: "Real-time notifications and team collaboration." },
    { name: "SendGrid", icon: "/icons/sendgrid.svg", desc: "Deliver, track, and analyze outbound sequences." },
    { name: "Zapier", icon: "/icons/zapier.svg", desc: "Connect HirePilot with 5,000+ apps effortlessly." },
    { name: "Make.com", icon: "/icons/make.svg", desc: "Advanced workflow orchestration for recruiters." },
    { name: "Stripe", icon: "/stripe.png", desc: "Automate billing and client payments securely." },
    { name: "DocuSign", icon: "/docusign.png", desc: "Send and sign placement agreements instantly." },
    { name: "Google Calendar", icon: "/icons/google-calendar.svg", desc: "Schedule interviews seamlessly." },
    { name: "Notion", icon: "/icons/notion.svg", desc: "Create shared client workspaces and trackers." },
    { name: "Monday.com", icon: "/monday.png", desc: "Visualize hiring pipelines and task boards." },
    { name: "Clay", icon: "/clay.png", desc: "Score, segment, and prioritize leads." },
    { name: "Hunter", icon: "/hunter.png", desc: "Find verified professional emails." },
    { name: "Skrapp", icon: "/skrapp.png", desc: "Enrich lead emails & company data." },
    { name: "Decodo", icon: "/icons/proxy.svg", desc: "Reliable proxy layer for LinkedIn scraping." },
  ];

  // ---------- 25 Workflow Recipes ----------
  const workflows = [
    // 1–3 Sourcing
    {
      id: 1,
      title: "Auto-Enrich New Lead (Apollo → HirePilot)",
      category: "Sourcing",
      trigger: "New lead found in Apollo",
      action: "Enrich via Hunter/Skrapp → Add to campaign",
      tools: ["Apollo", "Hunter", "Skrapp", "HirePilot"],
      desc: "Turns raw lead data into outreach-ready contacts automatically.",
    },
    {
      id: 2,
      title: "LinkedIn Profile → Candidate Card",
      category: "Sourcing",
      trigger: "Chrome Extension scrape",
      action: "Create enriched candidate in HirePilot",
      tools: ["Chrome Extension", "Decodo", "HirePilot"],
      desc: "Turn any LinkedIn profile into a live candidate instantly.",
    },
    {
      id: 3,
      title: "Lead Scoring via Clay + HirePilot",
      category: "Sourcing",
      trigger: "Campaign launch",
      action: "Send leads to Clay for scoring & segmentation",
      tools: ["Clay", "HirePilot"],
      desc: "Identify top prospects by seniority, size, and funding.",
    },

    // 4–6 Messaging
    {
      id: 4,
      title: "Lead Reply → Slack Alert",
      category: "Messaging",
      trigger: "message_reply",
      action: "Notify recruiter in Slack with candidate link",
      tools: ["HirePilot", "Slack"],
      desc: "Never miss a reply again—get instant Slack pings.",
    },
    {
      id: 5,
      title: "Campaign Send → SendGrid Attribution",
      category: "Messaging",
      trigger: "message_sent",
      action: "Track SendGrid IDs for analytics",
      tools: ["HirePilot", "SendGrid"],
      desc: "Monitor opens, clicks, and replies across campaigns.",
    },
    {
      id: 6,
      title: "New Candidate → Client Email (HTML submission)",
      category: "Messaging",
      trigger: "candidate_created",
      action: "Send styled candidate email to client",
      tools: ["HirePilot", "SendGrid"],
      desc: "Auto-send beautiful candidate submissions to clients.",
    },

    // 7–9 Pipeline/Client
    {
      id: 7,
      title: "Candidate Hired → Stripe Invoice",
      category: "Billing",
      trigger: "candidate_hired",
      action: "Create invoice in Stripe → send to client",
      tools: ["HirePilot", "Stripe"],
      desc: "Bill clients automatically when hires are made.",
    },
    {
      id: 8,
      title: "Pipeline Stage Updated → Monday.com Task",
      category: "Pipeline",
      trigger: "pipeline_stage_updated",
      action: "Update task board in Monday.com",
      tools: ["HirePilot", "Monday.com"],
      desc: "Keep client boards perfectly in sync with every stage move.",
    },
    {
      id: 9,
      title: "Job REQ Created → Slack Channel",
      category: "Client Experience",
      trigger: "pipeline_created",
      action: "Create dedicated Slack channel for that REQ",
      tools: ["HirePilot", "Slack", "Zapier"],
      desc: "Instant collaboration channels per open role.",
    },

    // 10–11 Billing/Admin
    {
      id: 10,
      title: "Candidate Offered → DocuSign Contract",
      category: "Billing",
      trigger: "candidate_offered",
      action: "Auto-generate placement agreement in DocuSign",
      tools: ["HirePilot", "DocuSign"],
      desc: "Send contracts instantly at offer stage.",
    },
    {
      id: 11,
      title: "Client Signed → Stripe Subscription Setup",
      category: "Billing",
      trigger: "client_created",
      action: "Create subscription in Stripe",
      tools: ["HirePilot", "Stripe"],
      desc: "Automate recurring billing for retained clients.",
    },

    // 12–15 REX Core
    {
      id: 12,
      title: "REX Scheduler → Weekly Sourcing Run",
      category: "REX Intelligence",
      trigger: "Every Monday 9:00 AM",
      action: "Run Apollo searches + build new campaign",
      tools: ["REX", "Apollo", "HirePilot"],
      desc: "Fully autonomous sourcing with weekly reports.",
    },
    {
      id: 13,
      title: "REX Assist → Job Matching Intelligence",
      category: "REX Intelligence",
      trigger: "Upload resume or job description",
      action: "Match candidate to best REQ via embeddings",
      tools: ["REX", "Supabase", "HirePilot"],
      desc: "Instant fit analysis between job and resume using AI embeddings.",
    },
    {
      id: 14,
      title: "REX Workflow → Candidate Enrichment Loop",
      category: "REX Intelligence",
      trigger: "Lead imported without email",
      action: "Try Skrapp → Hunter → Apollo until enriched",
      tools: ["REX", "Skrapp", "Hunter", "Apollo"],
      desc: "Smart cascading enrichment using your credit logic.",
    },
    {
      id: 15,
      title: "REX Daily Digest → Slack Summary",
      category: "REX Intelligence",
      trigger: "Daily at 5:00 PM",
      action: "Summarize replies, updates, and hires to Slack",
      tools: ["REX", "Slack"],
      desc: "Your recruiting day, summarized automatically.",
    },

    // 16–18 Intelligence & Alerts
    {
      id: 16,
      title: "Weekly Hiring Analytics → Slack + Email",
      category: "REX Intelligence",
      trigger: "Every Friday 5:00 PM",
      action: "Compile KPIs → send Slack summary + HTML email",
      tools: ["HirePilot", "REX", "Slack", "SendGrid"],
      desc: "From raw pipeline data to a clean weekly report—no spreadsheets.",
    },
    {
      id: 17,
      title: "Job Market Intelligence → Auto Brief",
      category: "REX Intelligence",
      trigger: "New Job REQ created",
      action: "Scan sources → build insights (salary, demand, volume)",
      tools: ["HirePilot", "REX", "Apollo", "Browserless"],
      desc: "Instant market context for smarter searches.",
    },
    {
      id: 18,
      title: "REX Alert → Pipeline Bottleneck",
      category: "REX Intelligence",
      trigger: "Candidate count drops below threshold",
      action: "Send Slack alert + suggest sourcing run",
      tools: ["REX", "Slack"],
      desc: "Proactive alerts before your pipeline dries up.",
    },

    // 19–21 Messaging & Meetings
    {
      id: 19,
      title: "Auto Follow-Up (No Reply After 5 Days)",
      category: "Messaging",
      trigger: "message_sent with no reply after 5 days",
      action: "Send next sequence message automatically",
      tools: ["HirePilot", "SendGrid"],
      desc: "Polite persistence that boosts reply rates hands-free.",
    },
    {
      id: 20,
      title: "Hot Lead Keywords → Calendar Invite",
      category: "Messaging",
      trigger: "lead_responded containing 'interested'/'let’s chat'",
      action: "Create calendar invite + send confirmation",
      tools: ["HirePilot", "Google Calendar", "SendGrid"],
      desc: "Instantly converts interest into a scheduled call.",
    },
    {
      id: 21,
      title: "Candidate Declined → Nurture Campaign",
      category: "Messaging",
      trigger: "candidate_rejected",
      action: "Add to re-engagement campaign",
      tools: ["HirePilot", "Zapier"],
      desc: "Keep relationships warm even after a no.",
    },

    // 22–23 Client Experience
    {
      id: 22,
      title: "New Client → Shared Slack + Notion Space",
      category: "Client Experience",
      trigger: "client_created",
      action: "Create shared Slack channel + Notion workspace",
      tools: ["HirePilot", "Slack", "Notion", "Zapier"],
      desc: "Onboard clients with a ready-to-use collaboration hub.",
    },
    {
      id: 23,
      title: "Invoice Paid → Thank-You Email",
      category: "Client Experience",
      trigger: "Stripe webhook invoice.paid",
      action: "Send custom thank-you email with next steps",
      tools: ["Stripe", "SendGrid"],
      desc: "Polished post-payment touch that strengthens relationships.",
    },

    // 24–25 Candidate Management
    {
      id: 24,
      title: "Resume Uploaded → Auto-Screening Summary",
      category: "Pipeline",
      trigger: "candidate resume upload",
      action: "REX parses resume → generate summary (skills, fit, YOE)",
      tools: ["HirePilot", "REX"],
      desc: "Transforms raw resumes into structured insights automatically.",
    },
    {
      id: 25,
      title: "Move to Interview → Confirmation Email",
      category: "Pipeline",
      trigger: "candidate_interviewed",
      action: "Send confirmation + prep resources",
      tools: ["HirePilot", "SendGrid"],
      desc: "Deliver a professional candidate experience, automatically.",
    },
  ];

  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(
    () => (filter === "All" ? workflows : workflows.filter((w) => w.category === filter)),
    [filter, workflows]
  );

  // Small component: pill list of tool logos (fallback to text if icon missing)
  const ToolPills = ({ tools }) => (
    <div className="flex flex-wrap gap-2 mt-3">
      {tools.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-700 text-slate-200 text-xs"
        >
          <img
            src={`/icons/${slugify(t)}.svg`}
            alt={t}
            className="w-4 h-4"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          {t}
        </span>
      ))}
    </div>
  );

  return (
    <div className="text-white bg-slate-950">
      {/* HERO */}
      <section className="relative py-24 bg-gradient-to-br from-indigo-700 via-slate-900 to-purple-700 text-center overflow-hidden">
        <BackgroundBeams />
        <div className="relative max-w-5xl mx-auto px-6">
          <h1 className="text-5xl font-bold mb-4">Connect. Automate. Hire Faster.</h1>
          <p className="text-lg text-slate-200 mb-8">
            Integrate HirePilot with your favorite tools to run recruiting on autopilot.
          </p>
          <div className="flex justify-center gap-4">
            <a href="#workflows" className="px-6 py-3 rounded-xl bg-white text-indigo-700 font-semibold shadow-lg hover:scale-105 transition">
              Explore Workflows
            </a>
            <a href="/docs/api" className="px-6 py-3 rounded-xl bg-slate-800 font-semibold hover:bg-slate-700 transition">
              View API Docs
            </a>
          </div>
        </div>
      </section>

      {/* INTEGRATIONS GRID */}
      <section className="py-20 bg-slate-950">
        <div className="max-w-6xl mx-auto text-center mb-12 px-4">
          <h2 className="text-4xl font-bold mb-3">Powerful Integrations That Just Work</h2>
          <p className="text-slate-400">HirePilot connects your stack into one unified recruiting engine.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-6 max-w-6xl mx-auto">
          {integrations.map((tool) => (
            <motion.div
              key={tool.name}
              whileHover={{ scale: 1.04 }}
              className="bg-slate-800 rounded-2xl p-6 hover:bg-slate-700 transition-all shadow-lg"
            >
              <img src={tool.icon} alt={tool.name} className="w-12 h-12 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-1">{tool.name}</h3>
              <p className="text-slate-400 text-sm">{tool.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CATEGORY FILTER */}
      <section id="workflows" className="max-w-6xl mx-auto px-6">
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <LayoutGroup id="filters">
            {categories.map((cat) => (
              <motion.button
                key={cat}
                layout
                onClick={() => setFilter(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  filter === cat ? "bg-indigo-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
                whileTap={{ scale: 0.98 }}
              >
                {cat}
              </motion.button>
            ))}
          </LayoutGroup>
        </div>

        {/* WORKFLOW GRID */}
        <LayoutGroup id="workflow-cards">
          <motion.div
            layout
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pb-24"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((w) => (
                <motion.div
                  key={w.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="bg-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:shadow-xl transition"
                >
                  <div>
                    <h3 className="text-xl font-semibold mb-1">{w.title}</h3>
                    <p className="text-slate-400 text-sm mb-3">{w.desc}</p>
                    <div className="text-slate-500 text-xs space-y-1">
                      <p><strong>Trigger:</strong> {w.trigger}</p>
                      <p><strong>Action:</strong> {w.action}</p>
                    </div>
                    <ToolPills tools={w.tools} />
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <button
                      onClick={() => setSelected(w)}
                      className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-white text-sm font-semibold"
                    >
                      View Recipe
                    </button>
                    <button
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-semibold"
                      onClick={() => alert('Login required to add workflows.')}
                    >
                      Add to My Workflows
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </section>

      {/* MODAL — Recipe Viewer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-slate-900 rounded-3xl max-w-xl w-full p-8 shadow-2xl relative"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <button
                onClick={() => setSelected(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-3">
                <img
                  src={`/icons/${slugify((selected.tools?.[0] || "workflow"))}.svg`}
                  alt=""
                  className="w-6 h-6"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
                <h2 className="text-2xl font-bold">{selected.title}</h2>
              </div>
              <p className="text-slate-300 mb-6">{selected.desc}</p>

              <div className="bg-slate-800 rounded-xl p-4 mb-6 text-sm space-y-2">
                <p className="text-slate-400">
                  <strong>Trigger:</strong> {selected.trigger}
                </p>
                <p className="text-slate-400">
                  <strong>Action:</strong> {selected.action}
                </p>
                <div className="pt-2">
                  <p className="text-slate-400 mb-2"><strong>Tools:</strong></p>
                  <ToolPills tools={selected.tools || []} />
                </div>
              </div>

              <div className="flex gap-3 flex-wrap">
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="px-4 py-2 bg-indigo-500 rounded-lg text-white font-semibold hover:bg-indigo-600"
                >
                  Deploy via Zapier
                </a>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="px-4 py-2 bg-slate-700 rounded-lg text-white font-semibold hover:bg-slate-600"
                >
                  Trigger via REX
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FINAL CTA */}
      <section className="py-24 bg-gradient-to-r from-indigo-600 to-purple-600 text-center text-white">
        <h2 className="text-4xl font-bold mb-4">Ready to Automate Your Recruiting?</h2>
        <p className="text-lg text-white/90 mb-8">
          Connect your favorite tools and let HirePilot run the workflows for you.
        </p>
        <a
          href="/signup"
          className="inline-block px-8 py-4 bg-white text-indigo-700 font-bold rounded-xl shadow-xl hover:shadow-2xl transition"
        >
          Get Started Free
        </a>
      </section>
    </div>
  );
}

/* ---------- Helpers / Tiny Components ---------- */

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// Subtle animated background beams for hero
function BackgroundBeams() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <svg className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-30" width="1400" height="600">
        <defs>
          <radialGradient id="g1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.25" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="300" cy="120" r="180" fill="url(#g1)">
          <animate attributeName="cx" values="260;340;260" dur="12s" repeatCount="indefinite" />
        </circle>
        <circle cx="900" cy="260" r="220" fill="url(#g1)">
          <animate attributeName="cy" values="240;300;240" dur="14s" repeatCount="indefinite" />
        </circle>
        <circle cx="650" cy="420" r="200" fill="url(#g1)">
          <animate attributeName="cx" values="620;700;620" dur="16s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}


