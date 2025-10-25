// src/pages/IntegrationsAndWorkflows.jsx
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { FaStripeS, FaLinkedin } from "react-icons/fa6";
import PublicNavbar from "../components/PublicNavbar";
import PublicFooter from "../components/PublicFooter";

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
    "Team",
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

  // ---------- Replaced Workflow Library ----------
  const workflows = [
    // Lead & Prospecting (Sourcing)
    { id: 1, title: "Apollo → Smart Enrichment & Warm Tagging", category: "Sourcing", trigger: "Lead arrives from Apollo", action: "Auto-enrich, score, and tag 'Warm'", tools: ["Apollo", "Hunter", "Skrapp", "HirePilot"], desc: "When a lead arrives from Apollo, HirePilot enriches, scores interest, and tags them 'Warm'." },
    { id: 2, title: "LinkedIn Connect → Slack Introduction", category: "Sourcing", trigger: "New LinkedIn connection (Chrome Extension)", action: "Post Slack summary to #new-prospects", tools: ["Chrome Extension", "Slack", "HirePilot"], desc: "Instantly post a prospect intro in Slack when a LI connection is made." },
    { id: 3, title: "Hunter Verified → Send Intro Email via SendGrid", category: "Sourcing", trigger: "Email verified by Hunter", action: "Send personalized intro using SendGrid template", tools: ["Hunter", "SendGrid", "HirePilot"], desc: "Auto-send a personalized intro once a verified email is found." },
    { id: 4, title: "Sales Navigator Saved Lead → Create Job Target", category: "Sourcing", trigger: "Saved lead on Sales Navigator", action: "Add to Sniper Target list", tools: ["LinkedIn Sales Navigator", "HirePilot"], desc: "Saving a lead on Sales Navigator automatically creates a Sniper target." },
    { id: 5, title: "Lead Tagged “Hiring Manager” → Create Client in CRM", category: "Sourcing", trigger: "Lead tagged 'Hiring Manager'", action: "Create client record in Monday.com", tools: ["HirePilot", "Monday.com"], desc: "Tag leads as 'Hiring Manager' to auto-create a client in your CRM." },

    // Messaging & Campaigns
    { id: 6, title: "Lead Replied → Notify Recruiter in Slack", category: "Messaging", trigger: "Reply detected", action: "Post Slack alert with message text", tools: ["HirePilot", "Slack"], desc: "Real-time Slack alerts when prospects or candidates reply." },
    { id: 7, title: "Lead Source: Skrapp → Launch Warm-Up Sequence", category: "Messaging", trigger: "Lead from Skrapp", action: "Start 'Intro + Reminder' sequence with SendGrid tracking", tools: ["Skrapp", "SendGrid", "HirePilot"], desc: "Warm up Skrapp leads with a gentle sequence and tracking." },
    { id: 8, title: "Campaign Relaunched → Team Announcement + Stats", category: "Messaging", trigger: "Campaign relaunched", action: "Push stats summary to Slack", tools: ["HirePilot", "Slack"], desc: "Announce relaunch with fresh send/reply/open metrics." },
    { id: 9, title: "High-Performing Template → Clone to New Campaign", category: "Messaging", trigger: ">45% open rate detected", action: "Clone template to 'Top Performers' folder", tools: ["HirePilot"], desc: "Automatically surface winning templates for reuse." },
    { id: 10, title: "Reply Detected → Update Candidate Profile in Notion", category: "Messaging", trigger: "Reply received", action: "Append last message to candidate's Notion timeline", tools: ["Notion", "HirePilot"], desc: "Keep Notion profiles updated with latest replies." },

    // Client & CRM
    { id: 11, title: "Client Created → Auto-Enrich + Slack Welcome", category: "Client Experience", trigger: "client_created", action: "Enrich company + send Slack 'Client added'", tools: ["HirePilot", "Slack"], desc: "New clients are enriched and announced instantly." },
    { id: 12, title: "Client Updated → Send Snapshot to Notion CRM", category: "Client Experience", trigger: "client_updated", action: "Update Notion CRM card via Make.com", tools: ["Make.com", "Notion", "HirePilot"], desc: "Sync client updates to your Notion CRM automatically." },
    { id: 13, title: "Contact Added → Schedule Intro Email", category: "Client Experience", trigger: "Contact created", action: "Send intro email via SendGrid after 15 minutes", tools: ["SendGrid", "HirePilot"], desc: "New contacts get a timely intro email queued by HirePilot." },
    { id: 14, title: "New Client → Create Monday Board + Slack Channel", category: "Client Experience", trigger: "client_created", action: "Create Monday board + dedicated Slack channel", tools: ["Monday.com", "Slack", "HirePilot"], desc: "Kick off client projects with auto-created boards and channels." },
    { id: 15, title: "Client Synced → Generate Stripe Invoice Draft", category: "Billing", trigger: "Client enrichment completed", action: "Draft Stripe invoice (Pro)", tools: ["Stripe", "HirePilot"], desc: "Automate invoice drafts once enrichment finishes." },

    // Deals & Placements
    { id: 16, title: "Candidate Hired → Create Stripe Invoice + Slack Win Alert", category: "Billing", trigger: "candidate_hired", action: "Create invoice + confetti Slack alert", tools: ["Stripe", "Slack", "HirePilot"], desc: "Celebrate wins and bill instantly on hire." },
    { id: 17, title: "Candidate Submitted → Create DocuSign Offer Letter", category: "Pipeline", trigger: "candidate_submitted", action: "Generate & send DocuSign offer", tools: ["DocuSign", "HirePilot"], desc: "Streamline offer letter creation and delivery." },
    { id: 18, title: "Pipeline Stage Updated → Update Google Sheet Tracker", category: "Pipeline", trigger: "pipeline_stage_updated", action: "Append change to master Google Sheet", tools: ["Google Sheets", "HirePilot"], desc: "Keep your master pipeline spreadsheet in sync." },
    { id: 19, title: "Candidate Rejected → Send “Keep Warm” Message", category: "Messaging", trigger: "candidate_rejected", action: "Send follow-up to keep candidate engaged", tools: ["SendGrid", "HirePilot"], desc: "Maintain relationships even when candidates are not a fit." },
    { id: 20, title: "New Application → Create Task in Monday.com", category: "Pipeline", trigger: "application_created", action: "Add task card to client's Monday board", tools: ["Monday.com", "HirePilot"], desc: "Ensure new applications create actionable tasks." },

    // Team & Collaboration
    { id: 21, title: "Collaborator Added → Send Slack Welcome", category: "Team", trigger: "collaborator_added", action: "Send Slack intro with links & next steps", tools: ["Slack", "HirePilot"], desc: "Welcome new collaborators with helpful context." },
    { id: 22, title: "Role Changed → Sync Permissions + Notion Access", category: "Team", trigger: "role_updated", action: "Sync access across Notion and Slack", tools: ["Notion", "Slack", "HirePilot"], desc: "Keep team permissions consistent across tools." },
    { id: 23, title: "Invite Sent → Trigger Onboarding Sequence", category: "Team", trigger: "invite_sent", action: "Send onboarding email series via SendGrid", tools: ["SendGrid", "HirePilot"], desc: "Automate onboarding for new team invites." },

    // Sniper & REX Automation
    { id: 24, title: "Sniper Target Captured → Create Candidate + Enrich Profile", category: "REX Intelligence", trigger: "sniper_target_captured", action: "Create candidate + run enrichment", tools: ["Sniper", "HirePilot"], desc: "Convert captured targets into enriched candidates automatically." },
    { id: 25, title: "REX Chat → Generate Daily Summary in Notion", category: "REX Intelligence", trigger: "Daily at 6:00 PM", action: "Create a Notion 'Recruiting Summary' page", tools: ["REX", "Notion", "HirePilot"], desc: "REX writes a daily summary of hires, campaigns, and conversations." },

    // AI-Enhanced Automations (REX Intelligence)
    { id: 26, title: "REX Detects Unresponsive Campaign → Suggest A/B Test", category: "REX Intelligence", trigger: "Low reply rate detected", action: "Draft alternate subject line", tools: ["REX", "HirePilot"], desc: "REX proposes A/B test ideas when performance drops." },
    { id: 27, title: "REX Detects Hiring Gap → Build Outreach Sequence", category: "REX Intelligence", trigger: "Open role without candidates", action: "Draft and launch new outreach campaign", tools: ["REX", "HirePilot"], desc: "Fill role gaps by auto-building a fresh outreach sequence." },
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


