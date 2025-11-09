// src/pages/IntegrationsAndWorkflows.jsx
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { FaStripeS, FaLinkedin, FaMagnifyingGlass, FaDiagramProject, FaBrain } from "react-icons/fa6";
import PublicNavbar from "../components/PublicNavbar";
import PublicFooter from "../components/PublicFooter";

/**
 * Integrations & Workflows — HirePilot
 * - Hero
 * - Integrations Grid
 * - Filterable Workflow Library (Public 18 recipes)
 * - Animated Recipe Modal
 * - Final CTA
 *
 * Tailwind + Framer Motion
 */

export default function IntegrationsAndWorkflows() {
  const categories = [
    "All",
    "Discovery + Lead Intelligence",
    "CRM, Pipeline, Client Activation",
    "REX Intelligence Engine",
  ];

  const integrations = [
    { name: "Apollo", icon: "/apollo-logo-v2.png", desc: "Source and enrich B2B leads instantly." },
    { name: "LinkedIn Sales Navigator", reactIcon: <FaLinkedin className="w-12 h-12 mx-auto mb-4 text-[#0A66C2]" />, desc: "Find top talent and decision-makers." },
    { name: "Chrome Extension", icon: "/chrome.png", desc: "Save any LinkedIn profile into HirePilot." },
    { name: "Slack", reactIcon: (
      <i className="fa-brands fa-slack text-white text-[28px] md:text-[32px] mx-auto mb-4 opacity-95" aria-label="Slack" />
    ), desc: "Real-time notifications and team collaboration." },
    { name: "SendGrid", icon: "/sendgrid.png", desc: "Deliver, track, and analyze outbound sequences." },
    { name: "Zapier", icon: "/zapier-icon.png", desc: "Connect HirePilot with 5,000+ apps effortlessly." },
    { name: "Make.com", icon: "/make-logo-v1.png", desc: "Advanced workflow orchestration for recruiters." },
    { name: "Stripe", reactIcon: <FaStripeS className="w-12 h-12 mx-auto mb-4 text-indigo-500" />, desc: "Automate billing and client payments securely." },
    { name: "DocuSign", icon: "/docusign.png", desc: "Send and sign placement agreements instantly." },
    { name: "Google Calendar", icon: "/google.png", desc: "Schedule interviews seamlessly." },
    { name: "Notion", icon: "/Notion.png", desc: "Create shared client workspaces and trackers." },
    { name: "Monday.com", icon: "/monday.png", desc: "Visualize hiring pipelines and task boards." },
    { name: "Clay", icon: "/clay.png", desc: "Score, segment, and prioritize leads." },
    { name: "Hunter", icon: "/hunter.png", desc: "Find verified professional emails." },
    { name: "Skrapp", icon: "/skrapp.png", desc: "Enrich lead emails & company data." },
    { name: "Decodo", icon: "/decodo.png", desc: "Reliable proxy layer for LinkedIn scraping." },
  ];

  // Category icons (public /workflows)
  const categoryIcon = (cat) => {
    const base = "w-3.5 h-3.5";
    switch (cat) {
      case "Discovery + Lead Intelligence":
        return <FaMagnifyingGlass className={`${base}`} aria-hidden />;
      case "CRM, Pipeline, Client Activation":
        return <FaDiagramProject className={`${base}`} aria-hidden />;
      case "REX Intelligence Engine":
        return <FaBrain className={`${base}`} aria-hidden />;
      default:
        return null;
    }
  };

  // ---------- Public Workflow Library (exact 18) ----------
  const workflows = [
    // Tranche 1 — Discovery + Lead Intelligence (6)
    {
      id: 1,
      title: "Website Visitor → Auto-Enrich → Auto Email",
      category: "Discovery + Lead Intelligence",
      light: [
        "Capture website visitor data automatically",
        "Auto-enrich: name, title, company, verified email, LinkedIn",
        "Send a personalized email instantly",
      ],
      zap: [
        "Trigger: RB2B New Visitor → Webhook (POST)",
        "Action: POST /api/leads/:id/enrich",
        "Action (Code): JSON Flattening → extract first_name, company, email, title",
        "Action: SendGrid → Send Personalized Intro Email",
      ],
    },
    {
      id: 2,
      title: "LinkedIn Sales Navigator Scraper → Enrich → Queue Outreach",
      category: "Discovery + Lead Intelligence",
      light: [
        "Paste Sales Navigator search URL",
        "AI extracts profiles + enriches with contact info",
        "Add directly to your outreach queue or campaign",
      ],
      zap: [
        "Trigger: Chrome Extension → “Scrape SalesNav Search”",
        "Action: POST scraped leads to /api/leads/bulk-create",
        "Action: For each lead → /api/leads/:id/enrich",
        "Action: Add to campaign via /api/campaigns/:id/addLead",
      ],
    },
    {
      id: 3,
      title: "Sniper Target Captured → Convert to Candidate + Enrich",
      category: "Discovery + Lead Intelligence",
      light: [
        "When a Sniper search returns a promising lead",
        "Auto-create candidate profile",
        "Run enrichment + attach to an open job req",
      ],
      zap: [
        "Trigger: sniper_target_captured event (HirePilot Zap Trigger)",
        "Action: POST /api/candidates/createFromLead",
        "Action: POST /api/candidates/:id/enrich",
        "Action: Add candidate to Job REQ via /api/pipeline/addCandidate",
      ],
    },
    {
      id: 4,
      title: "Lead Replied → Slack Alert",
      category: "Discovery + Lead Intelligence",
      light: [
        "When a lead replies",
        "See message instantly in Slack",
        "Includes name, email, and the full reply",
      ],
      zap: [
        "Trigger: HirePilot → message_reply",
        "Action: Slack → Send message to channel",
        "Action: Optionally tag in CRM via /api/leads/:id/tag",
      ],
    },
    {
      id: 5,
      title: "Hunter Verified → Send Intro Email",
      category: "Discovery + Lead Intelligence",
      light: [
        "When Hunter finds a working email",
        "Send your intro automatically",
        "Track delivery + open events",
      ],
      zap: [
        "Trigger: Hunter.io → Email Verified",
        "Action: Create or update lead in HP via /api/leads/create",
        "Action: SendGrid → Send welcome/intro template",
      ],
    },
    {
      id: 6,
      title: "Sales Nav Saved Lead → Create Sniper Target",
      category: "Discovery + Lead Intelligence",
      light: [
        "Save a lead in Sales Navigator",
        "HirePilot instantly adds it to Sniper targets",
        "Auto-enrich optional",
      ],
      zap: [
        "Trigger: Chrome Extension → “Saved Lead Detected”",
        "Action: POST /api/sniper/targets/create",
        "Optional: POST /api/leads/:id/enrich",
      ],
    },

    // Tranche 2 — CRM, Pipeline, Client Activation (6)
    {
      id: 7,
      title: "Lead Tagged ‘Hiring Manager’ → Create Client in CRM",
      category: "CRM, Pipeline, Client Activation",
      light: [
        "Tag ANY lead as “Hiring Manager”",
        "HirePilot auto-creates a Client record",
        "Pushes into your CRM or project system",
      ],
      zap: [
        "Trigger: HirePilot → lead_tagged event (Filter: tag = “Hiring Manager”)",
        "Action: POST /api/clients/create",
        "Action: Create Monday.com record (or Notion card)",
      ],
    },
    {
      id: 8,
      title: "Client Created → Auto-Enrich + Slack Welcome",
      category: "CRM, Pipeline, Client Activation",
      light: [
        "New client is detected",
        "HirePilot enriches the company",
        "Slack announces with logo, team size, funding",
      ],
      zap: [
        "Trigger: HirePilot → client_created",
        "Action: /api/clients/:id/enrich",
        "Action: Slack → Post “New client added” summary",
        "Optional: Add to Deals pipeline via /api/deals/create",
      ],
    },
    {
      id: 9,
      title: "Client Updated → Sync to Notion CRM",
      category: "CRM, Pipeline, Client Activation",
      light: [
        "Anytime a client is updated (status/notes/owner)",
        "Automagically keep Notion in sync (no duplicates!)",
      ],
      zap: [
        "Trigger: HirePilot → client_updated",
        "Action: Notion → Find Page",
        "Action: Notion → Update Page",
        "Optional: Add date-stamped timeline entry",
      ],
    },
    {
      id: 10,
      title: "Candidate Rejected → Send “Keep Warm” Message",
      category: "CRM, Pipeline, Client Activation",
      light: [
        "When a hiring manager rejects a candidate",
        "HirePilot sends a soft, relationship-preserving message",
        "Keeps candidate in loop & warm",
      ],
      zap: [
        "Trigger: HirePilot → candidate_rejected",
        "Action: SendGrid → Send “Keep Warm” template",
        "Action: /api/candidates/:id/addTag “Keep Warm”",
        "Optional: Log note in Job REQ timeline",
      ],
    },
    {
      id: 11,
      title: "Candidate Hired → Create Stripe Invoice + Win Alert",
      category: "CRM, Pipeline, Client Activation",
      light: [
        "Auto-create a Stripe invoice",
        "Announce hiring win in Slack with 🎉 emojis",
        "Update your revenue dashboard",
      ],
      zap: [
        "Trigger: HirePilot → candidate_hired",
        "Action: /api/invoices/create with correct billing_type",
        "Action: Stripe → Create invoice object",
        "Action: Slack → “WIN! Candidate hired!”",
      ],
    },
    {
      id: 12,
      title: "Candidate Submitted → Create DocuSign Offer Letter",
      category: "CRM, Pipeline, Client Activation",
      light: [
        "When candidate is submitted to hiring manager",
        "Auto-generate offer letter",
        "Send via DocuSign to candidate & client",
      ],
      zap: [
        "Trigger: HirePilot → candidate_submitted",
        "Action: DocuSign → Create envelope",
        "Action: Fill fields dynamically (salary, start date, role)",
        "Action: Update candidate timeline via POST /api/candidates/:id/log",
      ],
    },

    // Tranche 3 — REX Intelligence Engine (6)
    {
      id: 13,
      title: "REX Chat → Generate Daily Summary in Notion",
      category: "REX Intelligence Engine",
      light: [
        "Daily end-of-day summary: leads, replies, candidates, campaigns, deal movement, red flags",
        "REX writes and ships to Notion automatically",
      ],
      zap: [
        "Trigger: Schedule → Every day at 6 PM",
        "Action: HirePilot → /rex/summarize_day",
        "Action: Notion → Create Page in “Daily Recruiting Summary” database",
        "Action: Notion → Append campaign stats & candidate notes",
      ],
    },
    {
      id: 14,
      title: "REX Detects Unresponsive Campaign → Suggest A/B Test",
      category: "REX Intelligence Engine",
      light: [
        "Detects low performance (open/reply rates)",
        "Analyzes subject, timing, personalization",
        "Drafts improved variant for A/B test",
      ],
      zap: [
        "Trigger: HirePilot Event → campaign_low_reply_rate (reply rate < 3% after 2+ sends)",
        "Action: HirePilot → /rex/optimizeSubjectLine",
        "Action: HirePilot → /rex/buildABTestVariant",
        "Action: Slack/Email → Send recommended A/B variant",
      ],
    },
    {
      id: 15,
      title: "REX Detects Hiring Gap → Build Outreach Sequence",
      category: "REX Intelligence Engine",
      light: [
        "Detects candidate gap on a Job REQ",
        "Builds fresh outreach sequence + message copy",
        "Suggests sourcing tactics; can auto-launch",
      ],
      zap: [
        "Trigger: HirePilot → jobreq_needs_candidates (0 candidates or >7 days inactivity)",
        "Action: HirePilot → /rex/generateOutreachSequence",
        "Action: HirePilot → /api/campaigns/create",
        "Action: Slack → “New sequence drafted for {Role}”",
      ],
    },
    {
      id: 16,
      title: "Sales Navigator Saved Lead → Create Sniper Target",
      category: "REX Intelligence Engine",
      light: [
        "User clicks “Save Lead” on Sales Navigator",
        "Chrome extension captures event",
        "HirePilot creates Sniper Target + starts enrichment",
      ],
      zap: [
        "Trigger: Chrome Extension Event → sales_nav_saved_lead",
        "Action: HirePilot → /sniper/targets/create",
        "Action: HirePilot → /sniper/enrich",
        "Optional: Add to “Role Fit” folder",
      ],
    },
    {
      id: 17,
      title: "Lead Replied → Update Candidate Profile in Notion",
      category: "REX Intelligence Engine",
      light: [
        "REX detects reply with NLP and summarizes",
        "Appends reply + summary to candidate profile",
        "Keeps Notion CRM timeline synced",
      ],
      zap: [
        "Trigger: HirePilot → lead_replied",
        "Action: Notion → Search for candidate page",
        "Action: Notion → Append reply + timestamp to timeline",
        "Action: HirePilot → /api/leads/:id/update (status = “Replied”)",
      ],
    },
    {
      id: 18,
      title: "Reply Detected → Notify Recruiter in Slack",
      category: "REX Intelligence Engine",
      light: [
        "Real-time reply alerts for recruiters and founders",
        "Shows sender, snippet, campaign, next step",
      ],
      zap: [
        "Trigger: HirePilot → lead_replied",
        "Action: Slack → Send Block Kit message (Name, Company, Reply text, Deep link)",
        "Action: HirePilot → /api/messages/markRead",
      ],
    },
  ];

  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text || "");
      alert("Copied to clipboard");
    } catch {
      try {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text || "";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert("Copied to clipboard");
      } catch {}
    }
  };
  const [showLoginModal, setShowLoginModal] = useState(false);

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

  // Consistent icon renderer for integrations grid
  const IconCell = ({ icon, reactIcon, alt }) => (
    <div className="w-10 h-10 mx-auto mb-4 flex items-center justify-center">
      {reactIcon ? (
        reactIcon
      ) : (
        <img src={icon} alt={alt || ''} className="w-10 h-10 object-contain" />
      )}
    </div>
  );

  return (
    <div className="text-white bg-slate-950">
      <PublicNavbar />
      {/* HERO */}
      <section className="relative py-24 bg-gradient-to-br from-indigo-700 via-slate-900 to-purple-700 text-center overflow-hidden">
        <BackgroundBeams />
        <div className="relative max-w-5xl mx-auto px-6">
          <h1 className="text-5xl font-bold mb-4">Connect. Automate. Hire Faster.</h1>
          <p className="text-lg text-slate-200 mb-8">
            Integrate HirePilot with your favorite tools to run recruiting on autopilot.
          </p>
          <div className="flex justify-center gap-4">
            <a href="#workflows" onClick={(e)=>{ e.preventDefault(); const el=document.getElementById('workflows'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }} className="px-6 py-3 rounded-xl bg-white text-indigo-700 font-semibold shadow-lg hover:scale-105 transition">
              Explore Workflows
            </a>
            <a href="/apidoc" className="px-6 py-3 rounded-xl bg-slate-800 font-semibold hover:bg-slate-700 transition">
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
              <IconCell icon={tool.icon} reactIcon={tool.reactIcon} alt={tool.name} />
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
                <span className="inline-flex items-center gap-2">
                  {cat !== "All" && (
                    <span className="inline-flex items-center justify-center w-4 h-4">
                      {categoryIcon(cat)}
                    </span>
                  )}
                  <span>{cat}</span>
                </span>
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
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded-full bg-slate-700 text-slate-200">
                        {categoryIcon(w.category)}
                        <span>{w.category}</span>
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{w.title}</h3>
                    <ul className="list-disc list-inside space-y-1 text-slate-300 text-sm">
                      {(w.light || []).map((li, idx) => (
                        <li key={idx}>{li}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <button
                      onClick={() => setSelected(w)}
                      className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-white text-sm font-semibold"
                    >
                      View Zap Recipe
                    </button>
                    <button
                      onClick={() => setShowLoginModal(true)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-semibold"
                    >
                      Add to Library
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

              <h2 className="text-2xl font-bold mb-4">{selected.title}</h2>
              <div className="grid gap-4">
                <div className="bg-slate-800 rounded-xl p-4">
                  <h3 className="font-semibold mb-2">What it does</h3>
                  <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                    {(selected.light || []).map((li, idx) => <li key={idx}>{li}</li>)}
                  </ul>
                </div>
                <div className="bg-slate-800 rounded-xl p-4">
                  <h3 className="font-semibold mb-2">Zap Recipe</h3>
                  <ol className="list-decimal list-inside text-slate-300 text-sm space-y-1">
                    {(selected.zap || []).map((step, idx) => <li key={idx}>{step}</li>)}
                  </ol>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => copyToClipboard(Array.isArray(selected?.zap) ? selected.zap.join('\n') : '')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-900 rounded-lg font-semibold hover:bg-white"
                >
                  <span className="inline-block">⚡</span> Copy Zap
                </button>
                <button
                  onClick={() => copyToClipboard('MAKE.COM BLUEPRINT — ' + (selected?.title || '') + '\n\nModules\n1) Webhooks → Custom webhook\n2) HTTP / Formatter steps\n3) Destination app (Slack/SendGrid/Notion)\n\nNotes: Map fields based on your account setup.')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-600"
                >
                  <span className="inline-block">🧩</span> Copy Make Blueprint
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL — Login Required */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-slate-900 rounded-3xl max-w-md w-full p-8 shadow-2xl relative"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <button
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
              <h2 className="text-2xl font-bold mb-2">Sign in to add workflows</h2>
              <p className="text-slate-300 mb-6">
                You need to be logged in to save workflows to your Library.
              </p>
              <div className="flex gap-3 flex-wrap">
                <a
                  href="/login"
                  className="px-4 py-2 bg-indigo-600 rounded-lg text-white font-semibold hover:bg-indigo-500"
                >
                  Log In
                </a>
                <a
                  href="/signup"
                  className="px-4 py-2 bg-slate-700 rounded-lg text-white font-semibold hover:bg-slate-600"
                >
                  Create Account
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
      <PublicFooter />
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


