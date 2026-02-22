import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function HirePilotWorkflowReplacement() {
  return (
    <>
      {/* Scoped styles preserved from BlogArticle template format */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose h3 { color: #d1d5db; font-size: 1.15rem; font-weight: 600; margin: 1.25rem 0 0.75rem 0; }
        .prose p { color: #d1d5db; line-height: 1.7; margin-bottom: 1.1rem; }
        .prose ul { color: #d1d5db; margin: 1rem 0 1.25rem 1.25rem; list-style: disc; }
        .prose li { margin-bottom: 0.5rem; }
        .prose table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
        .prose th, .prose td { border: 1px solid #374151; padding: 0.75rem; text-align: left; color: #d1d5db; }
        .prose th { background: #111827; color: #ffffff; }
      `}</style>

      <BlogNavbar />

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
          alt="Recruiting workflow orchestration and command center dashboard"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">Playbook</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">How HirePilot Fits Into (And Replaces) Your Current Recruiting Workflow</h1>
            <p className="text-xl text-gray-200 mb-6">A practical guide to replacing fragmented recruiting stacks with one orchestrated command center.</p>
            <div className="flex items-center space-x-4">
              <img src="/logo.png" alt="Author" className="w-12 h-12 rounded-full" />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on Feb 21, 2026</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div id="main-content" className="flex max-w-6xl mx-auto px-6 py-12 gap-8">
        <BlogTOC />

        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <div id="intro">
            <p>Recruiters do not wake up thinking, "I need another tool."</p>
            <p>They wake up thinking:</p>
            <ul>
              <li>I need to fill this role.</li>
              <li>I need stronger candidates.</li>
              <li>I need faster replies.</li>
              <li>I need to close this placement.</li>
              <li>I need clarity on where everything stands.</li>
              <li>I need to invoice this client.</li>
              <li>I need fewer things breaking.</li>
            </ul>
            <p>The problem is not effort. It is fragmentation.</p>
            <p>
              Most recruiters are running 6-10 tools to manage one placement. This guide covers what that stack looks like, where the friction happens, how HirePilot fits in, and how consolidation happens step by step.
            </p>
          </div>

          <div id="typical-stack">
            <h2>The Typical Modern Recruiting Stack</h2>
            <p>If you are an agency recruiter, independent consultant, or internal talent leader, this usually looks familiar:</p>

            <h3>🔍 Sourcing</h3>
            <ul>
              <li>LinkedIn Recruiter or Sales Navigator</li>
              <li>Apollo for structured search and email data</li>
              <li>Manual LinkedIn browsing</li>
              <li>CSV exports</li>
            </ul>

            <h3>📧 Outreach</h3>
            <ul>
              <li>Gmail</li>
              <li>SendGrid</li>
              <li>Lemlist / Instantly / Mailshake</li>
              <li>Manual follow-ups</li>
            </ul>

            <h3>📊 Tracking</h3>
            <ul>
              <li>ATS</li>
              <li>CRM</li>
              <li>Google Sheets</li>
              <li>Pipeline boards</li>
            </ul>

            <h3>🔁 Automation</h3>
            <ul>
              <li>Zapier</li>
              <li>Make</li>
              <li>Webhooks</li>
            </ul>

            <h3>💰 Revenue</h3>
            <ul>
              <li>Stripe</li>
              <li>QuickBooks</li>
              <li>Manual invoice tracking</li>
            </ul>

            <h3>📈 Reporting</h3>
            <ul>
              <li>Spreadsheets</li>
              <li>Notion dashboards</li>
              <li>Manually built reports</li>
            </ul>

            <p>Each tool solves one piece. None of them orchestrate the full system.</p>
          </div>

          <div id="friction">
            <h2>Where Friction Actually Happens</h2>
            <p>It is not in sourcing. It is not even in outreach. It is in transitions between steps.</p>
            <p>These are the invisible taxes recruiters pay every day:</p>
            <ul>
              <li>Copying LinkedIn profiles into spreadsheets</li>
              <li>Exporting Apollo lists into CSV</li>
              <li>Importing into outreach tools</li>
              <li>Manually creating candidates in the ATS</li>
              <li>Updating pipeline stages manually</li>
              <li>Checking inboxes for replies</li>
              <li>Logging notes across systems</li>
              <li>Creating invoices outside the recruiting tool</li>
              <li>Reconciling revenue numbers in spreadsheets</li>
              <li>Sending Slack updates manually</li>
            </ul>
            <p>None of these tasks are hard in isolation, but they compound and quietly consume hours every week.</p>
          </div>

          <div id="command-center-model">
            <h2>The Command Center Model</h2>
            <p>HirePilot does not replace everything overnight.</p>
            <p>It replaces the orchestration layer first, then absorbs fragmented pieces over time.</p>
            <p>Instead of connecting tools loosely through automation glue, workflows are connected by architecture.</p>
          </div>

          <div id="scenario-vp-eng">
            <h2>Scenario: Filling a VP of Engineering Role</h2>

            <h3>Step 1 - Intake the Job</h3>
            <p><strong>Traditional workflow:</strong> Notion notes, spreadsheet tracking, ATS entry, CRM update, Slack updates.</p>
            <p><strong>With HirePilot:</strong> Create Job REQ, attach pipeline, assign collaborators, add structured intake details, and start tracking candidates in one place.</p>
            <p>No duplicate entry. No scattered notes.</p>

            <h3>Step 2 - Source Candidates</h3>
            <p><strong>Traditional workflow:</strong> Search LinkedIn, open many tabs, copy names into sheets/ATS, find contacts in Apollo, export CSVs, import to outreach tools, dedupe, then update ATS manually.</p>
            <p>LinkedIn remains the primary discovery layer. Apollo often supports structured search and verified emails. The bottleneck is transfer and execution.</p>
            <p><strong>With HirePilot:</strong></p>
            <ul>
              <li>Use Agent Mode to define target profiles</li>
              <li>Trigger Sniper sourcing with LinkedIn/Apollo logic</li>
              <li>Pull structured leads directly into the system</li>
              <li>Enrich profiles inside HirePilot</li>
              <li>Auto-convert responding leads into candidates</li>
            </ul>
            <p>Old flow: Search -> Copy -> Paste -> Export -> Import -> Sequence -> Update</p>
            <p>New flow: Search -> Pull -> Enrich -> Launch</p>
            <p>LinkedIn stays discovery. HirePilot becomes execution.</p>

            <h3>Step 3 - Enrich and Qualify</h3>
            <p><strong>Traditional workflow:</strong> separate enrichment tools, manual company research, and notes spread across systems.</p>
            <p><strong>With HirePilot Enhanced Enrichment:</strong></p>
            <ul>
              <li>Company revenue</li>
              <li>Funding stage</li>
              <li>Funding amount</li>
              <li>Tech stack</li>
              <li>Industry</li>
              <li>Keywords</li>
            </ul>
            <p>Data attaches to lead/candidate records directly.</p>

            <h3>Step 4 - Outreach</h3>
            <p><strong>Traditional workflow:</strong> build in a separate sequencing tool, track replies in inboxes, then manually sync ATS and reminders.</p>
            <p><strong>With HirePilot:</strong> AI-generated outreach, enrichment-aware personalization, event-driven reply detection, automatic pipeline movement, Slack alerts, and candidate creation when needed.</p>
            <p>Replies live in your system, not scattered inbox threads.</p>

            <h3>Step 5 - Move Through Pipeline</h3>
            <p><strong>Traditional workflow:</strong> ATS drag/drop, manual notes, external trackers, manual client updates, separate revenue updates.</p>
            <p><strong>With HirePilot:</strong> pipeline stages tied to automation, shared collaborator notes, real-time dashboards, and automatic deal updates.</p>

            <h3>Step 6 - Interview and Evaluate</h3>
            <p><strong>Traditional workflow:</strong> isolated resume review, disconnected notes, inconsistent scoring.</p>
            <p><strong>With HirePilot:</strong> resume parsing, AI scoring, REX Voice and Interview Helper, structured evaluation, and centralized team notes.</p>
            <p>Everything stays attached to the candidate record.</p>

            <h3>Step 7 - Close and Invoice</h3>
            <p><strong>Traditional workflow:</strong> update ATS, create Stripe invoice separately, update spreadsheet, notify accounting manually.</p>
            <p><strong>With HirePilot:</strong> convert to placement, update opportunity stage, generate Stripe-powered invoice, track revenue in dashboards, and update client records automatically.</p>
            <p>Placement -> Invoice -> Revenue visibility, all in one system.</p>
          </div>

          <div id="what-gets-replaced-first">
            <h2>What Gets Replaced First?</h2>
            <p>Most teams consolidate gradually, not all at once.</p>

            <h3>Phase 1 - Replace</h3>
            <ul>
              <li>Outreach tool</li>
              <li>Spreadsheet tracking</li>
              <li>Manual pipeline updates</li>
            </ul>
            <p><strong>Keep:</strong> LinkedIn and Stripe initially.</p>

            <h3>Phase 2 - Replace</h3>
            <ul>
              <li>Separate CRM</li>
              <li>Manual billing tracking</li>
              <li>External dashboards</li>
            </ul>
            <p><strong>Add:</strong> Deals module, custom dashboards, and workspace collaboration.</p>

            <h3>Phase 3 - Fully Consolidated Workflow</h3>
            <p>Sourcing -> Enrichment -> Outreach -> Pipeline -> Collaboration -> Billing -> Reporting</p>
            <p>All inside one architecture.</p>
          </div>

          <div id="workflow-shift">
            <h2>The Workflow Shift</h2>
            <p>The biggest change is not features. It is mindset.</p>
            <p><strong>Old mindset:</strong> "What tool do I use for this step?"</p>
            <p><strong>New mindset:</strong> "What does the system do next?"</p>
            <p>That is the OS difference: from isolated actions to orchestrated workflows.</p>
          </div>

          <div id="integration-not-isolation">
            <h2>Integration, Not Isolation</h2>
            <p>HirePilot integrates with:</p>
            <ul>
              <li>LinkedIn</li>
              <li>Apollo</li>
              <li>Zapier</li>
              <li>Make</li>
              <li>Stripe</li>
              <li>Slack</li>
              <li>SendGrid</li>
            </ul>
            <p>If you love part of your stack, keep it. HirePilot becomes the command center, then replaces more over time as needed.</p>
          </div>

          <div id="true-value">
            <h2>The True Value: Removing Manual Barriers</h2>
            <p>Recruiting is high leverage. One placement can generate $20K-$50K.</p>
            <p>Manual friction limits scale. HirePilot reduces:</p>
            <ul>
              <li>Copy/paste tasks</li>
              <li>Export/import cycles</li>
              <li>Status checking</li>
              <li>Revenue confusion</li>
              <li>Multi-tool reporting</li>
              <li>Manual enrichment</li>
              <li>Workflow coordination errors</li>
            </ul>
            <p>You do not work harder. You work inside a system designed to remove friction.</p>
          </div>

          <div id="fully-consolidated-view">
            <h2>What a Fully Consolidated Workflow Looks Like</h2>
            <p>Inside HirePilot:</p>
            <ul>
              <li>Job REQ created</li>
              <li>Agent Mode sources</li>
              <li>Sniper enriches</li>
              <li>AI drafts outreach</li>
              <li>Reply detected</li>
              <li>Candidate created</li>
              <li>Pipeline updated</li>
              <li>Deal opportunity tracked</li>
              <li>Invoice sent</li>
              <li>Revenue dashboard updated</li>
            </ul>
            <p>No exports. No duplicate entry. No disconnected reporting. Just clarity.</p>
          </div>

          <div id="final-thought">
            <h2>Final Thought</h2>
            <p>HirePilot is not asking you to change how you recruit. It is asking you to stop juggling tools.</p>
            <p>You already know how to recruit. Now you can run the full workflow in one system, from first search to final invoice.</p>
            <ul>
              <li>One platform</li>
              <li>One data layer</li>
              <li>One automation engine</li>
              <li>One recruiting command center</li>
            </ul>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Keep Reading</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <a href="/blog/hirepilot-2-0-recruiting-os" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png" alt="Recruiting OS architecture overview" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Product Update</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">HirePilot 2.0: From Outreach Tool to Autonomous Recruiting Operating System</h3>
                <p className="text-gray-400 mb-4">How HirePilot evolved into a full recruiting operating system with centralized data and orchestration.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>9 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/agentmode" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png" alt="Agent mode recruiting automation controls" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">AI Automation</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Introducing Agent Mode: Let REX Run Your Outbound</h3>
                <p className="text-gray-400 mb-4">Turn on Agent Mode to have REX source, message, and manage weekly campaigns for you.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Aug 26, 2025</span>
                  <span className="mx-2">•</span>
                  <span>6 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/hirepilot-full-ats" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png" alt="HirePilot full ATS feature overview" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Product Update</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">HirePilot Just Became a Full ATS - And It's Free</h3>
                <p className="text-gray-400 mb-4">One AI-powered system for sourcing, outreach, pipelines, job apps, and hiring.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Sep 14, 2025</span>
                  <span className="mx-2">•</span>
                  <span>6 min read</span>
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <div id="newsletter-signup" className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Stay Ahead of the Curve</h2>
          <p className="text-xl mb-8 text-blue-100">Join other recruiters automating their workflow with HirePilot</p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <button className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Subscribe
            </button>
          </div>
          <p className="text-sm text-blue-200 mt-4">No spam. Unsubscribe anytime.</p>
        </div>
      </div>
    </>
  );
}
