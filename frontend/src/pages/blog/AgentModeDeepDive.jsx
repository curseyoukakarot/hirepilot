import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function AgentModeDeepDive() {
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
      `}</style>

      <BlogNavbar />

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
          alt="Agent mode orchestration dashboard and recruiting control layer"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-purple-700 text-white px-3 py-1 rounded-full text-sm font-medium">Agent Mode</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Agent Mode Deep Dive - The Orchestration Layer Powering HirePilot&apos;s Autonomous Recruiting OS</h1>
            <p className="text-xl text-gray-200 mb-6">How Agent Mode turns recruiting actions into structured, controlled execution across sourcing, outreach, and pipeline.</p>
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
            <p>Most recruiting platforms give you tools. Agent Mode gives you control over execution.</p>
            <p>If HirePilot 2.0 is the recruiting operating system, Agent Mode is the control center.</p>
            <p>It defines what runs, when it runs, how it runs, and what happens next, with REX acting as an execution engine.</p>
          </div>

          <div id="what-agent-mode-is">
            <h2>What Agent Mode Actually Is</h2>
            <p>Agent Mode is a structured automation layer that sits above core product systems:</p>
            <ul>
              <li>Sourcing</li>
              <li>Outreach</li>
              <li>Campaigns</li>
              <li>Sniper</li>
              <li>Personas</li>
              <li>Schedules</li>
              <li>Deals</li>
              <li>Pipeline</li>
            </ul>
            <p>It lets teams configure AI agents, assign goals, define personas, set safety controls, schedule runs, manage pacing, route conversations, and monitor performance.</p>
            <p>It is not click-and-hope. It is configure-and-control.</p>
          </div>

          <div id="three-layers">
            <h2>The Three Layers of Agent Mode</h2>
            <p>Agent Mode operates through three connected layers:</p>
            <ul>
              <li>Sourcing Agent</li>
              <li>Sales Agent</li>
              <li>REX Console</li>
            </ul>
            <p>Each has a distinct role, but they operate as one system.</p>
          </div>

          <div id="sourcing-agent">
            <h2>Sourcing Agent: Controlled Lead Generation</h2>
            <p>The Sourcing Agent handles persona-based targeting, scheduling, Sniper execution, risk controls, quality vs quantity tuning, daily limits, and throttling.</p>
            <p>You do not just search. You define repeatable targeting structures.</p>

            <h3>Personas</h3>
            <ul>
              <li>Save targeting filters</li>
              <li>Define role, location, and seniority</li>
              <li>Reuse filters across runs</li>
              <li>Standardize sourcing logic</li>
            </ul>
            <p>Personas become sourcing blueprints.</p>

            <h3>Schedules</h3>
            <ul>
              <li>Recurring cadences</li>
              <li>One-time runs</li>
              <li>Specific run times</li>
              <li>Controlled daily limits</li>
            </ul>
            <p>This creates predictable pipeline fill, not random bursts.</p>

            <h3>Sniper Integration</h3>
            <p>Sniper runs inside the Sourcing Agent with dependency-aware execution, thresholds, throttling, and risk controls.</p>
            <p>It is structured automation, not chaotic automation.</p>

            <h3>Quality vs Quantity Control</h3>
            <p>Agent Mode allows teams to tune output between volume and precision based on current goals.</p>
          </div>

          <div id="sales-agent">
            <h2>Sales Agent: Inbox + Conversion Engine</h2>
            <p>The Sales Agent handles:</p>
            <ul>
              <li>Reply detection</li>
              <li>Automated responses</li>
              <li>Calendly routing</li>
              <li>Campaign monitoring</li>
              <li>Auto-send modes</li>
              <li>Quiet hours</li>
              <li>Sender rotation</li>
            </ul>
            <p>When replies come in, the agent reads context, chooses response strategy, routes qualified responses, and tracks conversion outcomes.</p>
            <p>That is conversion logic, not just auto-reply.</p>
          </div>

          <div id="rex-console">
            <h2>The REX Console: Intelligence + Planning</h2>
            <p>The REX Console is where execution planning happens. It includes playbooks, capabilities, guides, linked product areas, execution steps, plan views, execution tabs, and artifacts.</p>
            <p>This is orchestration, not chat.</p>
          </div>

          <div id="rex-vs-chat">
            <h2>What Makes REX Different From ChatGPT</h2>
            <p>REX does not only answer prompts. It:</p>
            <ul>
              <li>Understands active agents</li>
              <li>Understands product capabilities</li>
              <li>Generates execution plans</li>
              <li>Maps plans to real system endpoints</li>
              <li>Publishes artifacts into your workspace</li>
              <li>Triggers structured workflows</li>
            </ul>
            <p>It can generate criteria and then immediately move into persona creation, Sniper launches, scheduled runs, and shortlist publishing.</p>
          </div>

          <div id="plan-execute-artifacts">
            <h2>Plan -&gt; Execution -&gt; Artifacts</h2>
            <p>Agent Mode introduces a structured lifecycle:</p>
            <ul>
              <li>Plan</li>
              <li>Execute</li>
              <li>Publish artifacts</li>
            </ul>
            <p>Instead of chat ending in no action, plans become system-level execution with persistent outputs.</p>
          </div>

          <div id="playbooks-recipes">
            <h2>Agent Playbooks &amp; Recipes</h2>
            <p>Playbooks encode operational best practices such as role + geo + seniority setup, source mix strategy, minimum-result thresholds, persona sets, parallel discovery, score-based merges, selective enrichment, and shortlist delivery.</p>
            <p>You are not just automating steps. You are standardizing quality.</p>
          </div>

          <div id="why-this-changes-everything">
            <h2>Why This Changes Everything</h2>
            <p>Agent Mode introduces predictability, repeatability, strategy enforcement, risk control, and operational clarity.</p>
            <p>It helps agencies standardize sourcing quality, scale without chaos, protect sender/domain health, control credits, and align execution with business goals.</p>
          </div>

          <div id="safety-guardrails">
            <h2>Safety &amp; Guardrails</h2>
            <p>Agent Mode includes daily limits, safety pacing, throttling, quiet hours, and risk controls.</p>
            <p>It is careful AI execution aligned with recruiter control, not reckless automation.</p>
          </div>

          <div id="bigger-picture">
            <h2>The Bigger Picture</h2>
            <p>Agent Mode unifies Sourcing Agent, Sales Agent, REX intelligence, Sniper, personas, schedules, campaigns, deals, and dashboards under one control layer.</p>
            <p>This is what turns HirePilot from a toolset into an autonomous recruiting system.</p>
          </div>

          <div id="future-importance">
            <h2>Why This Matters for the Future</h2>
            <p>Most recruiting products stop at workflow management. Agent Mode moves into execution management, where AI should operate.</p>
            <p>The goal is not replacing recruiters. It is executing recruiter strategy at scale.</p>
          </div>

          <div id="final-thought">
            <h2>Final Thought</h2>
            <p>If HirePilot is the operating system, Agent Mode is the control tower.</p>
            <p>You do not just run campaigns. You configure agents.</p>
            <p>You do not just send messages. You define behavior.</p>
            <p>You do not just source leads. You orchestrate pipelines.</p>
            <p>That is a fundamental shift, and it is just getting started.</p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Keep Reading</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <a href="/blog/sniper-2-0-dependency-aware-sourcing" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png" alt="Sniper 2.0 dependency-aware sourcing controls" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">AI Sourcing</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Sniper 2.0: Intelligent, Dependency-Aware AI Sourcing for Recruiters</h3>
                <p className="text-gray-400 mb-4">How structured execution and guardrails improve sourcing reliability.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>8 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/hirepilot-2-0-recruiting-os" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png" alt="HirePilot 2.0 recruiting operating system architecture" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Product Update</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">HirePilot 2.0: From Outreach Tool to Autonomous Recruiting Operating System</h3>
                <p className="text-gray-400 mb-4">The shift to centralized data, orchestration, and autonomous execution.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>9 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/recruiters-to-revenue-operators" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png" alt="Pipeline to profit revenue operations workflow" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Revenue Operations</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Turning Recruiters Into Revenue Operators: How HirePilot Connects Pipeline to Profit</h3>
                <p className="text-gray-400 mb-4">Why connecting candidates to deals and billing changes recruiting outcomes.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>8 min read</span>
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
