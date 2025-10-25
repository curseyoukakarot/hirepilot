import React, { useMemo, useState } from 'react';
import WorkflowRecipeModal from '../components/WorkflowRecipeModal';

export default function WorkflowsPage() {
  const [selected, setSelected] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Curated in-app workflow recipes (mirrors public /workflows)
  const workflows = [
    // Lead & Prospecting (Sourcing)
    { id: 1, title: 'Apollo → Smart Enrichment & Warm Tagging', category: 'Sourcing', trigger: 'Lead arrives from Apollo', action: "Auto-enrich, score, and tag 'Warm'", tools: ['Apollo', 'HirePilot'], description: "When a lead arrives from Apollo, HirePilot enriches, scores interest, and tags them 'Warm'.", setupTime: '5 min', difficulty: 'Beginner', setupSteps: [
      'Connect your Apollo API key in Settings → Integrations.',
      'Enable “Auto-enrich new Apollo leads” in Workflows.',
      'Optionally set scoring rules under Messaging → Scoring.',
      'Save and test with a sample lead.'
    ] },
    { id: 2, title: 'LinkedIn Connect → Slack Introduction', category: 'Sourcing', trigger: 'New LinkedIn connection (Chrome Extension)', action: 'Post Slack summary to #new-prospects', tools: ['Chrome Extension', 'Slack', 'HirePilot'], description: 'Instantly post a prospect intro in Slack when a LI connection is made.' },
    { id: 3, title: 'Hunter Verified → Send Intro Email via SendGrid', category: 'Sourcing', trigger: 'Email verified by Hunter', action: 'Send personalized intro using SendGrid template', tools: ['Hunter', 'SendGrid', 'HirePilot'], description: 'Auto-send a personalized intro once a verified email is found.' },
    { id: 4, title: 'Sales Navigator Saved Lead → Create Job Target', category: 'Sourcing', trigger: 'Saved lead on Sales Navigator', action: 'Add to Sniper Target list', tools: ['LinkedIn Sales Navigator', 'HirePilot'], description: 'Saving a lead on Sales Navigator automatically creates a Sniper target.' },
    { id: 5, title: 'Lead Tagged “Hiring Manager” → Create Client in CRM', category: 'Sourcing', trigger: "Lead tagged 'Hiring Manager'", action: 'Create client record in Monday.com', tools: ['HirePilot', 'Monday.com'], description: 'Tag leads as “Hiring Manager” to auto-create a client in your CRM.' },

    // Messaging & Campaigns
    { id: 6, title: 'Lead Replied → Notify Recruiter in Slack', category: 'Messaging', trigger: 'Reply detected', action: 'Post Slack alert with message text', tools: ['HirePilot', 'Slack'], description: 'Real-time Slack alerts when prospects or candidates reply.' },
    { id: 7, title: 'Lead Source: Skrapp → Launch Warm-Up Sequence', category: 'Messaging', trigger: 'Lead from Skrapp', action: "Start 'Intro + Reminder' sequence with SendGrid tracking", tools: ['Skrapp', 'SendGrid', 'HirePilot'], description: 'Warm up Skrapp leads with a gentle sequence and tracking.' },
    { id: 8, title: 'Campaign Relaunched → Team Announcement + Stats', category: 'Messaging', trigger: 'Campaign relaunched', action: 'Push stats summary to Slack', tools: ['HirePilot', 'Slack'], description: 'Announce relaunch with fresh send/reply/open metrics.' },
    { id: 9, title: 'High-Performing Template → Clone to New Campaign', category: 'Messaging', trigger: '>45% open rate detected', action: "Clone template to 'Top Performers' folder", tools: ['HirePilot'], description: 'Automatically surface winning templates for reuse.' },
    { id: 10, title: 'Reply Detected → Update Candidate Profile in Notion', category: 'Messaging', trigger: 'Reply received', action: "Append last message to candidate's Notion timeline", tools: ['Notion', 'HirePilot'], description: 'Keep Notion profiles updated with latest replies.' },

    // Client & CRM
    { id: 11, title: 'Client Created → Auto-Enrich + Slack Welcome', category: 'Client Experience', trigger: 'client_created', action: "Enrich company + send Slack 'Client added'", tools: ['HirePilot', 'Slack'], description: 'New clients are enriched and announced instantly.' },
    { id: 12, title: 'Client Updated → Send Snapshot to Notion CRM', category: 'Client Experience', trigger: 'client_updated', action: 'Update Notion CRM card via Make.com', tools: ['Make.com', 'Notion', 'HirePilot'], description: 'Sync client updates to your Notion CRM automatically.' },
    { id: 13, title: 'Contact Added → Schedule Intro Email', category: 'Client Experience', trigger: 'Contact created', action: 'Send intro email via SendGrid after 15 minutes', tools: ['SendGrid', 'HirePilot'], description: 'New contacts get a timely intro email queued by HirePilot.' },
    { id: 14, title: 'New Client → Create Monday Board + Slack Channel', category: 'Client Experience', trigger: 'client_created', action: 'Create Monday board + dedicated Slack channel', tools: ['Monday.com', 'Slack', 'HirePilot'], description: 'Kick off client projects with auto-created boards and channels.' },
    { id: 15, title: 'Client Synced → Generate Stripe Invoice Draft', category: 'Billing', trigger: 'Client enrichment completed', action: 'Draft Stripe invoice (Pro)', tools: ['Stripe', 'HirePilot'], description: 'Automate invoice drafts once enrichment finishes.' },

    // Deals & Placements
    { id: 16, title: 'Candidate Hired → Create Stripe Invoice + Slack Win Alert', category: 'Billing', trigger: 'candidate_hired', action: 'Create invoice + confetti Slack alert', tools: ['Stripe', 'Slack', 'HirePilot'], description: 'Celebrate wins and bill instantly on hire.' },
    { id: 17, title: 'Candidate Submitted → Create DocuSign Offer Letter', category: 'Pipeline', trigger: 'candidate_submitted', action: 'Generate & send DocuSign offer', tools: ['DocuSign', 'HirePilot'], description: 'Streamline offer letter creation and delivery.' },
    { id: 18, title: 'Pipeline Stage Updated → Update Google Sheet Tracker', category: 'Pipeline', trigger: 'pipeline_stage_updated', action: 'Append change to master Google Sheet', tools: ['Google Sheets', 'HirePilot'], description: 'Keep your master pipeline spreadsheet in sync.' },
    { id: 19, title: 'Candidate Rejected → Send “Keep Warm” Message', category: 'Messaging', trigger: 'candidate_rejected', action: 'Send follow-up to keep candidate engaged', tools: ['SendGrid', 'HirePilot'], description: 'Maintain relationships even when candidates are not a fit.' },
    { id: 20, title: 'New Application → Create Task in Monday.com', category: 'Pipeline', trigger: 'application_created', action: "Add task card to client's Monday board", tools: ['Monday.com', 'HirePilot'], description: 'Ensure new applications create actionable tasks.' },

    // Team & Collaboration
    { id: 21, title: 'Collaborator Added → Send Slack Welcome', category: 'Team', trigger: 'collaborator_added', action: 'Send Slack intro with links & next steps', tools: ['Slack', 'HirePilot'], description: 'Welcome new collaborators with helpful context.' },
    { id: 22, title: 'Role Changed → Sync Permissions + Notion Access', category: 'Team', trigger: 'role_updated', action: 'Sync access across Notion and Slack', tools: ['Notion', 'Slack', 'HirePilot'], description: 'Keep team permissions consistent across tools.' },
    { id: 23, title: 'Invite Sent → Trigger Onboarding Sequence', category: 'Team', trigger: 'invite_sent', action: 'Send onboarding email series via SendGrid', tools: ['SendGrid', 'HirePilot'], description: 'Automate onboarding for new team invites.' },

    // Sniper & REX Automation
    { id: 24, title: 'Sniper Target Captured → Create Candidate + Enrich Profile', category: 'REX Intelligence', trigger: 'sniper_target_captured', action: 'Create candidate + run enrichment', tools: ['Sniper', 'HirePilot'], description: 'Convert captured targets into enriched candidates automatically.' },
    { id: 25, title: 'REX Chat → Generate Daily Summary in Notion', category: 'REX Intelligence', trigger: 'Daily at 6:00 PM', action: "Create a Notion 'Recruiting Summary' page", tools: ['REX', 'Notion', 'HirePilot'], description: 'REX writes a daily summary of hires, campaigns, and conversations.' },

    // AI-Enhanced Automations (optional bonus)
    { id: 26, title: 'REX Detects Unresponsive Campaign → Suggest A/B Test', category: 'REX Intelligence', trigger: 'Low reply rate detected', action: 'Draft alternate subject line', tools: ['REX', 'HirePilot'], description: 'REX proposes A/B test ideas when performance drops.' },
    { id: 27, title: 'REX Detects Hiring Gap → Build Outreach Sequence', category: 'REX Intelligence', trigger: 'Open role without candidates', action: 'Draft and launch new outreach campaign', tools: ['REX', 'HirePilot'], description: 'Fill role gaps by auto-building a fresh outreach sequence.' },
  ];

  const filtered = useMemo(() => {
    if (!query) return workflows;
    const q = query.toLowerCase();
    return workflows.filter(
      (w) => w.title.toLowerCase().includes(q) || (w.description || '').toLowerCase().includes(q)
    );
  }, [query]);

  const openRecipe = (wf) => {
    setSelected(wf);
    setIsOpen(true);
  };

  const closeRecipe = () => {
    setIsOpen(false);
    setTimeout(() => setSelected(null), 200);
  };

  const byCategory = useMemo(() => {
    const groups = {};
    filtered.forEach((w) => {
      const key = w.category || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(w);
    });
    return groups;
  }, [filtered]);

  const colorClasses = {
    indigo: 'bg-indigo-900 text-indigo-300',
    purple: 'bg-purple-900 text-purple-300',
    green: 'bg-green-900 text-green-300',
    teal: 'bg-teal-900 text-teal-300',
    red: 'bg-red-900 text-red-300',
    amber: 'bg-amber-900 text-amber-300',
  };

  const toFormulaString = (wf) => {
    if (wf?.recipeJSON) {
      try { return JSON.stringify(wf.recipeJSON, null, 2); } catch (_) {}
    }
    const obj = { name: wf.title, trigger: wf.trigger, actions: (wf.actions || (wf.action ? [{ name: wf.action }] : [])) };
    try { return JSON.stringify(obj, null, 2); } catch (_) { return String(obj); }
  };

  return (
    <div id="main-content" className="bg-slate-950 min-h-screen text-white">
      {/* Top Bar */}
      <header id="header" className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Workflows</h1>
          <div className="relative">
            <input
              type="text"
              placeholder="Search workflows..."
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pl-10 w-80 focus:outline-none focus:border-indigo-500"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"></i>
          </div>
        </div>
        <button className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 rounded-lg font-semibold hover:scale-105 transition">
          <i className="fa-solid fa-plus mr-2"></i>
          Add Workflow
        </button>
      </header>

      {/* Page Content */}
      <main id="workflows-main" className="p-8 space-y-8">
        {/* Header Hero */}
        <section id="header-hero" className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 rounded-2xl">
          <h1 className="text-3xl font-bold mb-2">Automate Everything.</h1>
          <p className="text-slate-100 mb-4 text-lg">Install or customize ready-made recruiting workflows — powered by REX.</p>
          <button className="px-6 py-3 bg-white text-indigo-700 font-semibold rounded-lg shadow hover:scale-105 transition">
            Explore Workflow Library
          </button>
        </section>

        {/* Connected Integrations */}
        <section id="integrations-status" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Your Connected Integrations</h2>
            <button className="text-indigo-400 hover:text-indigo-300 font-medium">
              Manage All <i className="fa-solid fa-arrow-right ml-1"></i>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-3">
                <i className="fa-brands fa-slack text-white text-xl"></i>
              </div>
              <h4 className="font-semibold text-sm">Slack</h4>
              <span className="text-xs mt-2 text-green-400">✅ Connected</span>
              <button className="mt-3 text-xs px-3 py-1 bg-slate-700 rounded-lg hover:bg-slate-600 transition">Manage</button>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mb-3">
                <i className="fa-solid fa-bolt text-white text-xl"></i>
              </div>
              <h4 className="font-semibold text-sm">Zapier</h4>
              <span className="text-xs mt-2 text-green-400">✅ Connected</span>
              <button className="mt-3 text-xs px-3 py-1 bg-slate-700 rounded-lg hover:bg-slate-600 transition">Manage</button>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center mb-3">
                <i className="fa-solid fa-envelope text-white text-xl"></i>
              </div>
              <h4 className="font-semibold text-sm">SendGrid</h4>
              <span className="text-xs mt-2 text-red-400">⚠️ Not Connected</span>
              <button className="mt-3 text-xs px-3 py-1 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition">Connect</button>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-3">
                <i className="fa-brands fa-stripe text-white text-xl"></i>
              </div>
              <h4 className="font-semibold text-sm">Stripe</h4>
              <span className="text-xs mt-2 text-green-400">✅ Connected</span>
              <button className="mt-3 text-xs px-3 py-1 bg-slate-700 rounded-lg hover:bg-slate-600 transition">Manage</button>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-3">
                <i className="fa-brands fa-linkedin text-white text-xl"></i>
              </div>
              <h4 className="font-semibold text-sm">LinkedIn</h4>
              <span className="text-xs mt-2 text-red-400">⚠️ Not Connected</span>
              <button className="mt-3 text-xs px-3 py-1 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition">Connect</button>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-3">
                <i className="fa-solid fa-calendar text-white text-xl"></i>
              </div>
              <h4 className="font-semibold text-sm">Calendly</h4>
              <span className="text-xs mt-2 text-green-400">✅ Connected</span>
              <button className="mt-3 text-xs px-3 py-1 bg-slate-700 rounded-lg hover:bg-slate-600 transition">Manage</button>
            </div>
          </div>
        </section>

        {/* Workflow Library */}
        <section id="workflow-library" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Workflow Recipes Library</h2>
          </div>

          {/* Category Filters (static UI for now) */}
          <div id="category-filters" className="flex gap-2 flex-wrap">
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium">All</button>
            <button className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition">Messaging</button>
            <button className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition">Pipeline</button>
            <button className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition">Billing</button>
            <button className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition">REX</button>
          </div>

          {/* Grouped by category */}
          {Object.keys(byCategory).map((group) => (
            <div key={group} className="space-y-4">
              <h3 className="text-xl font-semibold">{group}</h3>
              <div id="workflow-grid" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {byCategory[group]?.map((wf) => (
                  <div key={wf.id} className="bg-slate-900 rounded-xl p-6 hover:bg-slate-800 transition group">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold pr-2">{wf.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs ${colorClasses[wf.color] || 'bg-slate-800 text-slate-300'}`}>
                        <span className="mr-1">{wf.icon}</span>{wf.category}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">{wf.description}</p>
                    <div className="flex gap-2">
                      <button onClick={() => openRecipe({ title: wf.title, summary: wf.description, tools: wf.tools || [wf.category], setupTime: wf.setupTime || '', difficulty: wf.difficulty || '', formula: toFormulaString(wf), setupSteps: wf.setupSteps || [] })} className="px-3 py-2 bg-indigo-500 rounded-lg text-xs font-semibold text-white hover:bg-indigo-400 transition">View Recipe</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>

      <WorkflowRecipeModal
        isOpen={isOpen}
        onClose={closeRecipe}
        title={selected?.title || ''}
        summary={selected?.summary || ''}
        tools={selected?.tools || []}
        setupTime={selected?.setupTime || ''}
        difficulty={selected?.difficulty || ''}
        formula={selected?.formula || ''}
        setupSteps={selected?.setupSteps || []}
      />
    </div>
  );
}


