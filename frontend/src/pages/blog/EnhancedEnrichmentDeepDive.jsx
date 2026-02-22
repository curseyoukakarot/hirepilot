import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function EnhancedEnrichmentDeepDive() {
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
          alt="Enhanced lead enrichment intelligence in recruiting workflow"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-cyan-700 text-white px-3 py-1 rounded-full text-sm font-medium">Enrichment</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Enhanced Enrichment Deep Dive</h1>
            <p className="text-xl text-gray-200 mb-6">Turning lead profiles into strategic intelligence for better targeting, messaging, and execution.</p>
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
            <h2>Turning Lead Profiles Into Strategic Intelligence</h2>
            <p>Most recruiting tools store contact data: name, title, company, email, LinkedIn URL.</p>
            <p>That is identification, not intelligence.</p>
            <p>Enhanced Enrichment was built to move from contact details into context, because context drives strategy and strategy drives revenue.</p>
          </div>

          <div id="problem-basic-enrichment">
            <h2>The Problem With Basic Enrichment</h2>
            <p>Traditional enrichment usually stops at:</p>
            <ul>
              <li>Email lookup</li>
              <li>Phone number</li>
              <li>Title confirmation</li>
              <li>Company name</li>
            </ul>
            <p>Useful for sending messages, but not enough for strategic decisions like company quality, growth stage fit, role alignment, or response likelihood.</p>
            <p>Recruiting is not only about finding people. It is about targeting intelligently.</p>
          </div>

          <div id="what-it-adds">
            <h2>What Enhanced Enrichment Adds</h2>
            <p>Inside the Lead Profile Drawer, Enhanced Enrichment adds structured business intelligence directly to each profile.</p>
          </div>

          <div id="funding-rounds">
            <h2>1) Funding Rounds</h2>
            <p>You can see:</p>
            <ul>
              <li>Funding stage (Seed, Series A, B, C, etc.)</li>
              <li>Total funding amount</li>
              <li>Most recent round</li>
              <li>Funding timing</li>
            </ul>
            <p>Funding context helps with hiring urgency, budget expectations, growth velocity, and organizational maturity.</p>
            <p>Series A often needs hands-on builders; later stages often need scalable systems leaders and department builders.</p>
            <p>With funding context, targeting becomes intentional instead of guesswork.</p>
          </div>

          <div id="revenue-numbers">
            <h2>2) Revenue Numbers</h2>
            <p>Revenue data can instantly change qualification decisions. You can work with:</p>
            <ul>
              <li>Estimated revenue range</li>
              <li>Growth indicators</li>
              <li>Revenue tier</li>
            </ul>
            <p>This supports segmentation by company size, tighter targeting, better message positioning, and stronger expectation alignment.</p>
            <p>For executive and enterprise placements, revenue context is critical.</p>
          </div>

          <div id="pr-public-signals">
            <h2>3) PR Articles &amp; Public Signals</h2>
            <p>Enhanced Enrichment surfaces recent PR and public activity signals such as product launches, partnerships, funding updates, leadership changes, market expansion, and strategic pivots.</p>
            <p>Instead of leaving the platform for manual research, context is available directly in profile view.</p>
            <p>This improves personalization, qualification quality, positioning strength, and response relevance.</p>
          </div>

          <div id="keywords-intelligence">
            <h2>4) Keywords &amp; Searchable Intelligence</h2>
            <p>Keyword intelligence ties to:</p>
            <ul>
              <li>Industry classification</li>
              <li>Technology stack</li>
              <li>Company focus areas</li>
              <li>Hiring themes</li>
            </ul>
            <p>This enables keyword-based searching in HirePilot, better persona targeting, higher Sniper precision, and stronger Agent Mode filters.</p>
            <p>Targeting can go beyond title + location into environment and strategic fit.</p>
          </div>

          <div id="decision-hub">
            <h2>The Lead Profile Drawer Becomes a Decision Hub</h2>
            <p>Before Enhanced Enrichment, the drawer was mainly a contact card.</p>
            <p>Now it can include contact details, enrichment, funding stage, revenue estimate, PR signals, keywords, notes, pipeline status, and campaign association in one view.</p>
            <p>You do not leave the system to evaluate. The system supports the decision directly.</p>
          </div>

          <div id="connects-agent-mode">
            <h2>How This Connects to Agent Mode</h2>
            <p>Enhanced Enrichment connects to:</p>
            <ul>
              <li>Sourcing Agent personas</li>
              <li>Sniper filters</li>
              <li>Quality vs Quantity tuning</li>
              <li>Campaign personalization</li>
              <li>REX planning logic</li>
              <li>Dashboards</li>
              <li>Deals</li>
            </ul>
            <p>This enables precision automation based on structured intelligence, not assumptions.</p>
          </div>

          <div id="outreach-impact">
            <h2>How This Improves Outreach</h2>
            <p>Better context leads to better messaging.</p>
            <p>Instead of generic outreach, messages can reference funding events, growth stage, expansion moves, partnerships, and positioning, which improves relevance and reply performance.</p>
          </div>

          <div id="competitive-advantage">
            <h2>Why This Is a Competitive Advantage</h2>
            <p>Many platforms separate enrichment, require manual research, or fail to connect business intelligence to workflows.</p>
            <p>HirePilot embeds intelligence directly in recruiting execution, shortening the loop from discovery to evaluation to action.</p>
          </div>

          <div id="credit-economics">
            <h2>Credit Economics &amp; Transparency</h2>
            <p>Enhanced Enrichment is a premium intelligence layer with structured data costs.</p>
            <p>It is credit-gated, optional, user-controlled, and transparent so teams only unlock deeper context when it matters.</p>
          </div>

          <div id="bigger-shift">
            <h2>The Bigger Shift</h2>
            <p>Basic enrichment helps send messages. Enhanced Enrichment helps build strategy.</p>
            <p>Recruiting becomes: find the right environment, match the right talent, and position intelligently.</p>
            <p>Context moves execution from reactive to strategic.</p>
          </div>

          <div id="final-thought">
            <h2>Final Thought</h2>
            <p>Name and email are contact details. Funding stage, revenue, PR signals, and keywords are intelligence.</p>
            <p>Enhanced Enrichment turns each lead profile into a strategic asset.</p>
            <p>When that intelligence connects to Agent Mode, Sniper, and Campaigns, sourcing becomes intent-driven targeting.</p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Keep Reading</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <a href="/blog/sniper-2-0-dependency-aware-sourcing" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png" alt="Sniper 2.0 sourcing execution controls" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">AI Sourcing</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Sniper 2.0: Intelligent, Dependency-Aware AI Sourcing for Recruiters</h3>
                <p className="text-gray-400 mb-4">How structured execution and guardrails improve sourcing reliability at scale.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>8 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/agent-mode-deep-dive" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png" alt="Agent Mode control layer and orchestration console" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Agent Mode</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Agent Mode Deep Dive - The Orchestration Layer Powering HirePilot&apos;s Autonomous Recruiting OS</h3>
                <p className="text-gray-400 mb-4">How Agent Mode connects planning, execution, and control across recruiting workflows.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>9 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/custom-tables-dashboards-command-center" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png" alt="Custom tables and dashboards recruiting command center" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Operations</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Custom Tables &amp; Dashboards: Build Your Own Recruiting Command Center</h3>
                <p className="text-gray-400 mb-4">Build structured visibility with connected recruiting, revenue, and performance data.</p>
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
