import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function HirePilot20RecruitingOS() {
  return (
    <>
      {/* Scoped styles preserved from BlogArticle template format */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose h3 { color: #d1d5db; font-size: 1.2rem; font-weight: 600; margin: 1.4rem 0 0.75rem 0; }
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
          alt="Recruiting operations dashboard and autonomous workflow controls"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-sm font-medium">Product Update</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">🏛 HirePilot 2.0: From Outreach Tool to Autonomous Recruiting Operating System</h1>
            <p className="text-xl text-gray-200 mb-6">The architectural shift from fragmented recruiting stacks to one unified, automation-first command center.</p>
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
          <div id="the-problem">
            <h2>The Problem With Modern Recruiting Tools</h2>
            <p>
              If you have recruited for more than six months, you have probably built a Frankenstein stack:
            </p>
            <ul>
              <li>An ATS to track candidates</li>
              <li>A CRM to manage clients</li>
              <li>Apollo or LinkedIn to source leads</li>
              <li>A sequencing tool for email outreach</li>
              <li>Zapier or Make to glue everything together</li>
              <li>Google Sheets to fix what breaks</li>
              <li>Stripe to invoice</li>
              <li>Slack for notifications</li>
              <li>A separate dashboard to track revenue</li>
            </ul>
            <p>Then you spend half your time managing the system instead of managing talent.</p>
            <p>Recruiting is not hard because of sourcing. It is hard because of fragmentation.</p>
            <p>Every handoff between tools creates friction:</p>
            <ul>
              <li>CSV exports</li>
              <li>Field mapping</li>
              <li>Sync errors</li>
              <li>Missed updates</li>
              <li>Duplicate data</li>
              <li>Manual follow-ups</li>
              <li>"Did this send?" moments</li>
              <li>"Where is that candidate now?" confusion</li>
            </ul>
            <p>The industry did not need another tool. It needed an operating system.</p>
          </div>

          <div id="what-hirepilot-used-to-be">
            <h2>What HirePilot Used to Be</h2>
            <p>
              When we started, HirePilot focused on outreach: campaigns, Apollo integration, email sequencing, and lead import.
            </p>
            <p>It worked well. Recruiters loved the speed.</p>
            <p>But we quickly saw that teams needed much more than better messaging:</p>
            <ul>
              <li>Pipeline automation</li>
              <li>Collaboration</li>
              <li>Revenue tracking</li>
              <li>AI sourcing</li>
              <li>Intelligent enrichment</li>
              <li>Automation triggers</li>
              <li>Billing workflows</li>
              <li>Real reporting</li>
            </ul>
            <p>Outreach was only one layer. Recruiting is a system. So HirePilot evolved.</p>
          </div>

          <div id="welcome-hirepilot-2">
            <h2>Welcome to HirePilot 2.0</h2>
            <p>HirePilot is no longer just a sourcing or outreach tool. It is now a full Recruiting Operating System.</p>
            <p>An OS does three things:</p>
            <ul>
              <li>Centralizes data</li>
              <li>Orchestrates workflows</li>
              <li>Automates execution</li>
            </ul>
          </div>

          <div id="centralized-data">
            <h2>1️⃣ Centralized Data - One Source of Truth</h2>
            <p>In HirePilot 2.0, all core objects live in one unified system:</p>
            <ul>
              <li>Leads</li>
              <li>Candidates</li>
              <li>Job REQs</li>
              <li>Pipelines</li>
              <li>Deals</li>
              <li>Clients</li>
              <li>Billing</li>
              <li>Messaging history</li>
              <li>Enrichment data</li>
              <li>Notes</li>
              <li>Custom tables</li>
              <li>Dashboards</li>
            </ul>
            <p>No more export/import loops, spreadsheet confusion, or fragile manual syncs.</p>
            <p>Your outreach informs your pipeline. Your pipeline informs your reporting. Your reporting informs your revenue.</p>
          </div>

          <div id="orchestrated-workflows">
            <h2>2️⃣ Orchestrated Workflows - From Step-Based to System-Based</h2>
            <p>Most recruiting tools are step-based: click, send, move, repeat.</p>
            <p>HirePilot 2.0 is system-based. It understands dependencies across actions.</p>
            <p>Example flow:</p>
            <ul>
              <li>Lead sourced</li>
              <li>Enrichment triggered</li>
              <li>Message generated</li>
              <li>Outreach sent</li>
              <li>Reply detected</li>
              <li>Candidate created</li>
              <li>Pipeline updated</li>
              <li>Slack alert sent</li>
              <li>Deal opportunity updated</li>
            </ul>
            <p>This is powered by event-based triggers, dependency-aware execution, intelligent credit controls, and automation rules.</p>
            <p>You are not just clicking buttons. You are running a machine.</p>
          </div>

          <div id="automated-execution">
            <h2>3️⃣ Automated Execution - Enter REX</h2>
            <p>REX is not just an AI chat tool. In 2.0, REX can:</p>
            <ul>
              <li>Source leads from Apollo</li>
              <li>Generate outreach</li>
              <li>Manage campaigns</li>
              <li>Enrich records</li>
              <li>Analyze resumes</li>
              <li>Score candidates</li>
              <li>Trigger automations</li>
              <li>Run Agent Mode campaigns</li>
              <li>Assist in interviews</li>
              <li>Execute multi-step Sniper sourcing</li>
              <li>Power dashboards</li>
            </ul>
            <p>With Agent Mode, you can turn on autonomous execution.</p>
            <p>
              Instead of saying "I need to build a campaign," you can say "Find VP Engineering candidates in Austin for Series B SaaS companies," and REX handles search, filtering, enrichment, messaging, and campaign setup.
            </p>
            <p>That is not a feature. That is infrastructure.</p>
          </div>

          <div id="old-vs-new">
            <h2>From Outreach Tool to Command Center</h2>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Old Model</th>
                    <th>New Model</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Campaign builder</td><td>Agent Mode Center</td></tr>
                  <tr><td>Manual pipeline movement</td><td>Event-driven automation</td></tr>
                  <tr><td>Basic lead enrichment</td><td>Enhanced enrichment (revenue, funding, tech stack)</td></tr>
                  <tr><td>Static dashboards</td><td>Custom tables + dashboards</td></tr>
                  <tr><td>External billing</td><td>Integrated Stripe billing</td></tr>
                  <tr><td>Single-user workflows</td><td>Workspace collaboration</td></tr>
                  <tr><td>Outreach tool</td><td>Recruiting OS</td></tr>
                </tbody>
              </table>
            </div>
            <p>The shift is architectural. HirePilot now acts as ATS, CRM, outreach engine, automation platform, AI sourcing layer, revenue tracking system, collaboration workspace, and custom data builder - in one place.</p>
          </div>

          <div id="agent-mode-center">
            <h2>The Agent Mode Center</h2>
            <p>2.0 introduces a unified control layer instead of scattered navigation.</p>
            <p>Agent Mode Center is where campaigns launch, Sniper runs, AI execution happens, multi-step sourcing is managed, and automation logic lives.</p>
            <p>It replaces complexity with clarity and feels like a recruiting cockpit.</p>
          </div>

          <div id="sniper-2">
            <h2>Sniper 2.0 - Intelligent Multi-Step Sourcing</h2>
            <p>Sniper is no longer a one-off sourcing action. It is dependency-aware and execution-safe.</p>
            <p>It understands:</p>
            <ul>
              <li>Step order</li>
              <li>Required outcomes</li>
              <li>Retry logic</li>
              <li>Failure handling</li>
              <li>Minimum result requirements</li>
            </ul>
            <p>This enables structured AI execution, controlled automation, and safe scaling with guardrails.</p>
          </div>

          <div id="enhanced-enrichment">
            <h2>Enhanced Enrichment - Deeper Intelligence</h2>
            <p>HirePilot now enriches beyond basic contact data. You can unlock:</p>
            <ul>
              <li>Company revenue</li>
              <li>Funding stage</li>
              <li>Funding amount</li>
              <li>Tech stack</li>
              <li>Industry classification</li>
              <li>Keywords</li>
            </ul>
            <p>This helps teams segment smarter, target precisely, personalize better, and prioritize higher-value leads.</p>
            <p>Enrichment is not cosmetic. It drives strategy.</p>
          </div>

          <div id="tables-dashboards">
            <h2>Tables &amp; Custom Dashboards - Your System, Your Way</h2>
            <p>One of the biggest upgrades in 2.0 is customization. You can now:</p>
            <ul>
              <li>Create custom tables</li>
              <li>Track custom data</li>
              <li>Build revenue dashboards</li>
              <li>Monitor pipeline health</li>
              <li>Create recruiter scorecards</li>
              <li>Build placement tracking systems</li>
              <li>Track team performance</li>
            </ul>
            <p>Most ATS platforms give fixed reporting. HirePilot gives you data infrastructure.</p>
          </div>

          <div id="deals-billing">
            <h2>Deals &amp; Billing - Revenue Inside the System</h2>
            <p>Most recruiting tools stop at candidate tracking. HirePilot 2.0 carries the workflow through revenue:</p>
            <ul>
              <li>Clients</li>
              <li>Opportunities</li>
              <li>Custom stages</li>
              <li>Stripe-powered invoicing</li>
              <li>Revenue tracking</li>
              <li>Placement attribution</li>
            </ul>
            <p>From candidate sourced to placement to invoice to payment - all tracked inside one system.</p>
          </div>

          <div id="collaboration-workspaces">
            <h2>Collaboration &amp; Workspaces</h2>
            <p>HirePilot 2.0 introduced collaboration as a native layer:</p>
            <ul>
              <li>Multi-user workspaces</li>
              <li>Role-based access</li>
              <li>Shared candidate notes</li>
              <li>Team dashboards</li>
              <li>Structured permissions</li>
            </ul>
            <p>Recruiting is coordinated effort, not solo work. The platform now reflects that reality.</p>
          </div>

          <div id="bigger-philosophy">
            <h2>The Bigger Philosophy</h2>
            <p>HirePilot 2.0 is not about piling on features. It is about removing friction.</p>
            <p>Every manual barrier in recruiting is a tax:</p>
            <ul>
              <li>Copy/paste</li>
              <li>Field mapping</li>
              <li>Switching tabs</li>
              <li>Checking status</li>
              <li>Following up manually</li>
              <li>Tracking deals in spreadsheets</li>
            </ul>
            <p>The goal is simple: remove manual barriers and replace them with careful AI automation.</p>
            <p>Not reckless automation. Careful automation. Structured, guard-railed, transparent, and controllable.</p>
            <p>AI should amplify recruiters, not replace them.</p>
          </div>

          <div id="where-this-is-headed">
            <h2>Where This Is Headed</h2>
            <p>HirePilot is evolving toward:</p>
            <ul>
              <li>Autonomous sourcing</li>
              <li>Intelligent matching</li>
              <li>Revenue-aware automation</li>
              <li>AI-assisted interviewing</li>
              <li>Unified recruiting infrastructure</li>
            </ul>
            <p>Not as hype. As architecture.</p>
          </div>

          <div id="final-thought">
            <h2>Final Thought</h2>
            <p>
              If you are running an ATS, a CRM, an outreach tool, Zapier, spreadsheets, a billing tool, and a dashboard tool, you do not have a recruiting system. You have a stack.
            </p>
            <p>HirePilot 2.0 is designed to be the system:</p>
            <ul>
              <li>One command center</li>
              <li>One data layer</li>
              <li>One automation engine</li>
              <li>One recruiting OS</li>
            </ul>
            <p>And we are just getting started.</p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Keep Reading</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <a href="/blog/agentmode" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png" alt="Agent mode recruiting automation controls" />
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
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png" alt="HirePilot ATS platform feature overview" />
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

            <a href="/blog/AutomateRecruiting5" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png" alt="Recruiting operating system dashboard and analytics" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Recruiting OS</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Your Recruiting OS: Reporting, Collaboration &amp; Scaling</h3>
                <p className="text-gray-400 mb-4">Run your entire recruiting agency from one command center with reporting, collaboration, and scaling.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Jan 19, 2025</span>
                  <span className="mx-2">•</span>
                  <span>7 min read</span>
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
