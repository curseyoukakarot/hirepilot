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
    { id: 2, title: 'LinkedIn Connect → Slack Introduction', category: 'Sourcing', trigger: 'New LinkedIn connection (Chrome Extension)', action: 'Tag lead + post Slack message', tools: ['Chrome Extension', 'HirePilot', 'Slack'], description: 'When a connection is made, tag the lead and announce in Slack.', setupTime: '5 min', difficulty: 'Beginner', setupSteps: [
      'Install/enable the HirePilot Chrome Extension and sign in.',
      'On LinkedIn, click the “LinkedIn Request” button in the extension to send the request.',
      'HirePilot will tag the lead "LinkedIn Request Made" automatically.',
      'In Workflows, create a trigger for leads tagged "LinkedIn Request Made".',
      'Add an action to post a Slack message to your desired channel.'
    ] },
    { id: 3, title: 'Hunter Verified → Send Intro Email via SendGrid', category: 'Sourcing', trigger: 'Email verified by Hunter', action: 'Send personalized intro using SendGrid template', tools: ['Hunter', 'HirePilot', 'SendGrid'], description: 'Auto-send a personalized intro once a verified email is found.', setupTime: '5–10 min', difficulty: 'Beginner', setupSteps: [
      'Connect Hunter: Settings → Integrations → Hunter → paste API key → Connect.',
      'Connect SendGrid: Settings → Integrations → SendGrid → add API key (Mail Send).',
      'Choose or create a Messaging → Template with personalization tokens (e.g., {{lead.first_name}}, {{lead.company}}).',
      'Open the workflow card → confirm trigger (source = Hunter, status = Verified) → select your SendGrid template → Deploy Recipe.',
      'Test: add a new lead via Hunter or Chrome Extension; when verified, an intro email is sent. Check Activity Log → Messaging Events.'
    ] },
    { id: 5, title: 'Lead Tagged “Hiring Manager” → Create Client in CRM', category: 'Sourcing', trigger: "Lead tagged 'Hiring Manager'", action: 'Create client record in Monday.com', tools: ['HirePilot', 'Monday.com'], description: 'Tag leads as “Hiring Manager” to auto-create a client in your CRM.', setupTime: '5 min', difficulty: 'Beginner', setupSteps: [
      'When you tag a lead as “Hiring Manager” in HirePilot, this workflow creates a new Client in your Monday.com CRM.',
      'It maps key fields: Name → Lead Name + Company; Email → Lead Email; Status → Prospect; Source → HirePilot.',
      'Open the card → select your Monday board and group (e.g., “Active Clients”).',
      'Confirm trigger filter: tag equals “Hiring Manager”.',
      'Deploy, then tag a test lead to verify the new client appears in Monday.'
    ], copyZap: `⚡ Zap Summary\n\nTrigger: Lead Tagged "Hiring Manager" (from HirePilot)\nAction: Create Client in Monday.com CRM\n\nGoal: When a recruiter tags a lead as “Hiring Manager,” HirePilot automatically creates a Client record in the team’s CRM workspace — using Monday.com’s Boards + Items system.\n\n⸻\n\n🧩 Zap Steps Breakdown\n\nStep 1: Trigger — Lead Tagged “Hiring Manager”\n\nApp: HirePilot\nEvent: lead_tag_added\nFilter: payload.tag == "hiring manager"\n\nThis fires every time a recruiter manually or automatically applies the tag “Hiring Manager” to a lead.\nHirePilot emits this event via its Universal Events API:\n\nGET /api/zapier/triggers/events?event_type=lead_tag_added&since={{now}}\n\nSample payload:\n\n{\n  "event_type": "lead_tag_added",\n  "payload": {\n    "entity": "leads",\n    "entity_id": "lead_123",\n    "tag": "hiring manager",\n    "lead": {\n      "name": "Alex Rivera",\n      "company": "CloudSync Labs",\n      "email": "alex@cloudsync.io"\n    }\n  }\n}\n\n⸻\n\nStep 2: Filter (Optional)\n\nOnly continue if:\n\nTag = "Hiring Manager"\n\nThis ensures that only hiring decision-makers get converted into clients, not general leads.\n\n⸻\n\nStep 3: Action — Create Client Record in Monday.com\n\nApp: Monday.com\nEvent: Create Item\nBoard: “Clients” (or your CRM board)\nGroup: “Active Clients” (default group or configurable)\n\nHirePilot sends the payload to Monday’s GraphQL API through your connected integration.\nExample request:\n\nmutation {\n  create_item(\n    board_id: 1234567890,\n    group_id: "active_clients",\n    item_name: "Alex Rivera - CloudSync Labs",\n    column_values: "{\\\"email\\\":\\\"alex@cloudsync.io\\\",\\\"company\\\":\\\"CloudSync Labs\\\",\\\"status\\\":\\\"Prospect\\\"}"\n  ) {\n    id\n  }\n}\n\n✅ Result:\nA new Client item is created in your CRM board under Active Clients, pre-filled with:\n  • Client Name: Lead name + company\n  • Email: Lead email\n  • Source: HirePilot\n  • Status: Prospect (or configurable)\n  • Owner: Recruiter who tagged the lead\n\n⸻\n\nStep 4 (Optional): Notify in Slack\n\nAdd an optional step to alert your team:\nApp: Slack\nEvent: Post message\nChannel: #client-updates\nMessage:\n\n🧑‍💼 New client added: Alex Rivera (CloudSync Labs) from HirePilot.\n\n⸻\n\n🧱 What the User Actually Configures\n\nWhen setting up the card in guided mode, the user selects:\n  1. Trigger Source: HirePilot → Lead Tagged\n  2. Tag Filter: Hiring Manager\n  3. Action App: Monday.com\n  4. Board: Select their CRM board\n  5. Group: Choose where new clients should go (e.g., “Prospects”)\n  6. Field Mapping:\n    • Name → Lead Name + Company\n    • Email → Lead Email\n    • Notes → Auto-filled with “Imported from HirePilot”\n\nThen they hit Deploy Recipe.\n\n⸻\n\n🕒 Example Timeline\n  • 12:05 PM → Recruiter tags a lead as “Hiring Manager.”\n  • 12:06 PM → HirePilot emits event → Zap triggers.\n  • 12:07 PM → Monday.com client item created + Slack alert sent.\n` },

    // Messaging & Campaigns
    { id: 6, title: 'Lead Replied → Notify Recruiter in Slack', category: 'Messaging', trigger: 'Reply detected', action: 'Post Slack alert with message text', tools: ['HirePilot', 'Slack'], description: 'Real-time Slack alerts when prospects or candidates reply.', setupTime: '3 min', difficulty: 'Beginner', setupSteps: [
      'Enable Slack Notifications: Go to Settings → Integrations → Slack in HirePilot. Click Connect Slack, choose your workspace, and approve access.',
      'Select a Notification Channel: After connecting, choose the Slack channel for reply alerts (e.g., #recruiting-alerts) and save as your default.',
      'Turn On Reply Alerts: Navigate to Settings → Notifications and toggle on “Lead or Candidate Replies”.',
      'What Happens: Whenever a lead or candidate replies, HirePilot instantly sends a Slack notification (e.g., “Alex from CloudSync Labs just replied to your message about ‘Senior Product Manager.’”). No Zapier/Make needed.'
    ] },
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
                      <button onClick={() => openRecipe({ title: wf.title, summary: wf.description, tools: wf.tools || [wf.category], setupTime: wf.setupTime || '', difficulty: wf.difficulty || '', formula: toFormulaString(wf), setupSteps: wf.setupSteps || [], copyZap: wf.copyZap || '' })} className="px-3 py-2 bg-indigo-500 rounded-lg text-xs font-semibold text-white hover:bg-indigo-400 transition">View Recipe</button>
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
        copyZap={selected?.copyZap || ''}
      />
    </div>
  );
}


