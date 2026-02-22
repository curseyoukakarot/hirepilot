import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function FounderMissionManualBarriers() {
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
          alt="Founder vision for recruiting automation and operational clarity"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-violet-600 text-white px-3 py-1 rounded-full text-sm font-medium">From the Founder</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">From the Founder - My Mission With HirePilot: Removing Manual Barriers From Recruiting</h1>
            <p className="text-xl text-gray-200 mb-6">Why HirePilot is focused on reducing operational friction so recruiters can focus on strategy, relationships, and outcomes.</p>
            <div className="flex items-center space-x-4">
              <img src="/logo.png" alt="Author" className="w-12 h-12 rounded-full" />
              <div>
                <p className="font-semibold text-white">Founder, HirePilot</p>
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
          <div id="opening">
            <p>I did not start building HirePilot because recruiting was broken.</p>
            <p>I started building it because recruiting was inefficient.</p>
            <p>There is a difference.</p>
            <p>
              Recruiting works. People get hired. Agencies make money. Internal teams fill roles. But behind the scenes, workflows are heavier than they need to be.
            </p>
            <p>Too many manual steps. Too many disconnected tools. Too much friction between actions.</p>
            <p>That friction compounds.</p>
            <p>My mission with HirePilot is simple:</p>
            <ul>
              <li>Remove manual barriers from recruiting</li>
              <li>Replace them with careful, structured AI automation</li>
              <li>Help recruiters do more with less</li>
            </ul>
            <p>Not less effort. Less friction.</p>
          </div>

          <div id="where-this-started">
            <h2>Where This Started</h2>
            <p>As a recruiter and operator, I lived inside the modern stack:</p>
            <ul>
              <li>LinkedIn</li>
              <li>Apollo</li>
              <li>An ATS</li>
              <li>An outreach tool</li>
              <li>Zapier</li>
              <li>Spreadsheets</li>
              <li>Stripe</li>
              <li>Slack</li>
            </ul>
            <p>Each tool was useful. None of them spoke the same language.</p>
            <p>Every placement required manual bridges:</p>
            <ul>
              <li>Copying profiles</li>
              <li>Exporting CSVs</li>
              <li>Updating multiple systems</li>
              <li>Checking inboxes</li>
              <li>Reconciling spreadsheets</li>
              <li>Manually tracking revenue</li>
              <li>Following up across disconnected tools</li>
            </ul>
            <p>The work was not intellectually difficult. It was operationally heavy.</p>
          </div>

          <div id="real-bottleneck">
            <h2>The Real Bottleneck in Recruiting</h2>
            <p>Recruiters are not limited by skill. They are limited by friction.</p>
            <p>The average recruiter can think faster than their tools let them operate.</p>
            <p>You know the feeling:</p>
            <ul>
              <li>You found a great candidate but did not log them yet</li>
              <li>You sent a message but forgot to update pipeline</li>
              <li>A reply came in but the stage never moved</li>
              <li>An invoice went out but revenue tracking stayed stale</li>
              <li>You built another spreadsheet because reporting was rigid</li>
            </ul>
            <p>Every manual bridge between steps is a barrier. And barriers reduce scale.</p>
          </div>

          <div id="automation-philosophy">
            <h2>Automation Without Recklessness</h2>
            <p>There are two ways to approach automation:</p>
            <ul>
              <li>Reckless automation - remove humans entirely</li>
              <li>Careful automation - remove repetitive barriers only</li>
            </ul>
            <p>HirePilot is built on careful automation.</p>
            <p>Recruiters are not replaceable. Judgment, instinct, relationship building, negotiation, and cultural fit evaluation are human strengths.</p>
            <p>Mechanical work should be automated: data copying, manual enrichment, status syncing, reminders, and reconciliation.</p>
          </div>

          <div id="replace-friction-not-recruiter">
            <h2>Replace the Friction, Not the Recruiter</h2>
            <p>AI should not try to be the recruiter. It should amplify the recruiter.</p>
            <p>In HirePilot, AI helps by:</p>
            <ul>
              <li>Drafting outreach</li>
              <li>Structuring searches</li>
              <li>Enriching data</li>
              <li>Scoring resumes</li>
              <li>Detecting replies</li>
              <li>Updating workflows</li>
              <li>Triggering automation</li>
              <li>Assisting in interviews</li>
            </ul>
            <p>It does not decide hires, override human judgment, or remove strategic thinking.</p>
            <p>The recruiter stays in control. The system removes friction.</p>
          </div>

          <div id="vision-command-center">
            <h2>The Vision: One Recruiting Command Center</h2>
            <p>The goal was never another tool. It was a recruiting operating system.</p>
            <p>An environment where sourcing, outreach, pipeline, collaboration, revenue, reporting, and automation live in one architecture.</p>
            <p>Not glued together by connectors. Not held together by spreadsheets. Intentionally designed.</p>
            <p>When workflow is unified, the question changes from "Did I update that?" to "What is the next strategic move?"</p>
          </div>

          <div id="do-more-with-less">
            <h2>Why "Do More With Less" Matters</h2>
            <p>Recruiting is leverage. One placement can generate meaningful revenue.</p>
            <p>Most teams scale by hiring more people, adding more tools, and increasing manual effort.</p>
            <p>There is another way: remove friction.</p>
            <ul>
              <li>One recruiter can manage more roles</li>
              <li>One agency can run leaner</li>
              <li>One team can scale intelligently</li>
            </ul>
            <p>Doing more with less is not about cutting corners. It is about removing waste.</p>
          </div>

          <div id="reducing-tool-sprawl">
            <h2>Reducing Tool Sprawl</h2>
            <p>Modern recruiting stacks are often bloated and expensive:</p>
            <ul>
              <li>LinkedIn Recruiter</li>
              <li>Apollo</li>
              <li>Outreach software</li>
              <li>ATS</li>
              <li>CRM</li>
              <li>Zapier</li>
              <li>Stripe</li>
              <li>Reporting tools</li>
              <li>Collaboration tools</li>
            </ul>
            <p>Every subscription adds cost. Every tool adds complexity. Every integration adds risk.</p>
            <p>HirePilot's mission is consolidation through architecture, not force.</p>
          </div>

          <div id="clarity-over-complexity">
            <h2>Clarity Over Complexity</h2>
            <p>Recruiting software is often over-engineered: too many menus, hidden automations, and setup layers.</p>
            <p>HirePilot follows a simple rule:</p>
            <ul>
              <li>Automation should be visible</li>
              <li>Control should remain human</li>
              <li>Data should be centralized</li>
              <li>Execution should be structured</li>
            </ul>
            <p>Clarity reduces anxiety in an already high-pressure workflow.</p>
          </div>

          <div id="who-we-build-for">
            <h2>Building for Agencies, Operators, and Builders</h2>
            <p>HirePilot was built from lived workflow experience, not from theory.</p>
            <p>The platform had to support:</p>
            <ul>
              <li>Multiple workspaces</li>
              <li>Revenue tracking</li>
              <li>Candidate notes</li>
              <li>Custom dashboards</li>
              <li>Structured sourcing</li>
              <li>Billing integration</li>
              <li>Automation triggers</li>
            </ul>
            <p>Because recruiting is not one-dimensional. It is operational.</p>
          </div>

          <div id="long-term-commitment">
            <h2>The Long-Term Commitment</h2>
            <p>HirePilot is not a launch-and-pivot product. It is a system built deliberately.</p>
            <p>Each layer serves the same mission:</p>
            <ul>
              <li>Agent Mode for structured execution</li>
              <li>Sniper for multi-step sourcing</li>
              <li>Enhanced enrichment for smarter targeting</li>
              <li>Deals for revenue visibility</li>
              <li>Custom tables for flexibility</li>
              <li>Dashboards for control</li>
              <li>Workspace permissions for collaboration</li>
            </ul>
            <p>Remove manual barriers. Preserve human intelligence. Increase leverage.</p>
          </div>

          <div id="future-of-recruiting">
            <h2>The Future of Recruiting</h2>
            <p>The future is not fully automated recruiting. It is intelligently assisted recruiting.</p>
            <p>AI should:</p>
            <ul>
              <li>Reduce repetition</li>
              <li>Increase clarity</li>
              <li>Improve consistency</li>
              <li>Surface insights</li>
              <li>Strengthen execution</li>
            </ul>
            <p>Humans should:</p>
            <ul>
              <li>Make decisions</li>
              <li>Build relationships</li>
              <li>Close placements</li>
              <li>Lead negotiations</li>
              <li>Evaluate nuance</li>
            </ul>
            <p>HirePilot is built at that intersection.</p>
          </div>

          <div id="why-this-matters">
            <h2>Why This Matters</h2>
            <p>Recruiters change lives. They move careers, build teams, and shape companies.</p>
            <p>They should not be buried in spreadsheets and manual sync work.</p>
            <p>My mission with HirePilot is not to disrupt recruiters. It is to empower them.</p>
            <p>Reduce friction. Increase leverage. Simplify complexity. Focus on people, not process overhead.</p>
          </div>

          <div id="final-thought">
            <h2>Final Thought</h2>
            <p>You do not need more hustle. You need fewer barriers.</p>
            <p>If recruiting is your craft, HirePilot is your operating system.</p>
            <p>And we are building it with intention.</p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Keep Reading</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <a href="/blog/hirepilot-2-0-recruiting-os" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png" alt="HirePilot operating system overview" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Product Update</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">HirePilot 2.0: From Outreach Tool to Autonomous Recruiting Operating System</h3>
                <p className="text-gray-400 mb-4">The architectural shift from fragmented recruiting stacks to one unified system.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>9 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/hirepilot-workflow-replacement" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png" alt="Recruiting workflow consolidation playbook" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Playbook</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">How HirePilot Fits Into (And Replaces) Your Current Recruiting Workflow</h3>
                <p className="text-gray-400 mb-4">A practical path to consolidating sourcing, outreach, pipeline, billing, and reporting.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>8 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/agentmode" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png" alt="Agent mode recruiting automation center" />
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
