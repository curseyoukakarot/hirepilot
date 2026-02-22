import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function RecruitersToRevenueOperators() {
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
          alt="Recruiting pipeline and revenue operations dashboard"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-green-700 text-white px-3 py-1 rounded-full text-sm font-medium">Revenue Operations</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Turning Recruiters Into Revenue Operators: How HirePilot Connects Pipeline to Profit</h1>
            <p className="text-xl text-gray-200 mb-6">How connecting deals, placements, billing, and dashboards transforms recruiting execution into revenue operations.</p>
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
            <p>Recruiting has always been revenue-driven, but most recruiters are forced to operate like candidate managers.</p>
            <p>They track candidates, interviews, submissions, and offers. Revenue often lives elsewhere in spreadsheets, billing tools, accounting systems, and manual forecasts.</p>
            <p>That separation creates a blind spot. You cannot scale what you cannot see.</p>
            <p>HirePilot&apos;s Deals and Revenue layer was built to solve this as an operational shift, not an add-on.</p>
          </div>

          <div id="traditional-revenue-gap">
            <h2>The Traditional Revenue Gap in Recruiting</h2>
            <p>Most agencies run two disconnected systems.</p>
            <p><strong>Candidate system:</strong> ATS, pipeline, submissions, interviews.</p>
            <p><strong>Revenue system:</strong> Stripe invoices, manual sheets, accounting software, ad hoc forecasts.</p>
            <p>When these do not connect, teams lose visibility into forecasted revenue, recruiter performance, conversion health, and deal stage progression.</p>
            <p>Revenue becomes reactive instead of strategic.</p>
          </div>

          <div id="recruiting-is-sales-process">
            <h2>Recruiting Is a Sales Process</h2>
            <p>At a core level, recruiting follows a deal lifecycle:</p>
            <ul>
              <li>Win the client</li>
              <li>Fill the role</li>
              <li>Close the placement</li>
              <li>Invoice</li>
              <li>Collect</li>
            </ul>
            <p>Most recruiting tools stop at candidate tracking. HirePilot extends into close, billing, and revenue collection.</p>
          </div>

          <div id="deals-layer">
            <h2>Introducing the Deals Layer</h2>
            <p>The Deals module connects:</p>
            <ul>
              <li>Clients</li>
              <li>Opportunities</li>
              <li>Job REQs</li>
              <li>Pipeline stages</li>
              <li>Placements</li>
              <li>Invoices</li>
              <li>Revenue</li>
            </ul>
            <p>Inside one architecture, the question shifts from "Did we place someone?" to "Where is this opportunity in the revenue lifecycle?"</p>
          </div>

          <div id="candidate-to-revenue-flow">
            <h2>From Candidate to Revenue in One Flow</h2>
            <p>A connected flow inside HirePilot can look like this:</p>
            <ul>
              <li>Client created</li>
              <li>Opportunity created</li>
              <li>Job REQ attached</li>
              <li>Candidates sourced</li>
              <li>Interviews conducted</li>
              <li>Offer accepted</li>
              <li>Candidate marked as hired</li>
              <li>Opportunity stage updated</li>
              <li>Stripe invoice generated</li>
              <li>Revenue reflected in dashboards</li>
            </ul>
            <p>No spreadsheet reconciliation. No double entry. No uncertainty.</p>
          </div>

          <div id="revenue-visibility-impact">
            <h2>Why Revenue Visibility Changes Everything</h2>
            <p>When pipeline and revenue connect, teams can answer:</p>
            <ul>
              <li>What is forecasted revenue this quarter?</li>
              <li>What is average placement value?</li>
              <li>Which clients generate the most profit?</li>
              <li>Which recruiters drive the most revenue?</li>
              <li>What is close rate?</li>
              <li>What is revenue per role?</li>
              <li>How many active opportunities are likely to convert?</li>
            </ul>
            <p>That is operational intelligence, not just reporting.</p>
          </div>

          <div id="operator-shift">
            <h2>From Recruiter to Revenue Operator</h2>
            <p>Traditional activity focus:</p>
            <ul>
              <li>Filling roles</li>
              <li>Sending candidates</li>
              <li>Scheduling interviews</li>
            </ul>
            <p>Revenue operator focus:</p>
            <ul>
              <li>Conversion rates</li>
              <li>Client lifetime value</li>
              <li>Opportunity velocity</li>
              <li>Forecast accuracy</li>
              <li>Revenue distribution</li>
              <li>Strategic prioritization</li>
            </ul>
            <p>When pipeline and revenue connect, teams move from managing tasks to managing outcomes.</p>
          </div>

          <div id="modern-agency-models">
            <h2>Built for Modern Agency Models</h2>
            <p>Many agencies run mixed business models across contingency, retained search, contract staffing, advisory retainers, fractional placements, and blended recruiting + consulting.</p>
            <p>HirePilot supports this with:</p>
            <ul>
              <li>Custom opportunity stages</li>
              <li>Revenue tracking by model</li>
              <li>Placement attribution</li>
              <li>Invoice management</li>
              <li>Client-level reporting</li>
              <li>Revenue dashboards</li>
            </ul>
          </div>

          <div id="forecasting">
            <h2>Revenue Forecasting Becomes Real</h2>
            <p>Without structured deal tracking, forecasting is guesswork.</p>
            <p>With Deals:</p>
            <ul>
              <li>Each opportunity has a stage</li>
              <li>Each stage can imply probability</li>
              <li>Each opportunity ties to potential revenue</li>
              <li>Each placement ties to confirmed revenue</li>
            </ul>
            <p>Dashboards can show committed, forecasted, pipeline, and collected revenue in real time.</p>
          </div>

          <div id="stripe-integration">
            <h2>Stripe Integration: Placement to Payment</h2>
            <p>Revenue tracking is incomplete without billing. HirePilot connects directly to Stripe so teams can generate invoices from opportunities, monitor invoice status, track payment collection, and tie revenue to placements automatically.</p>
            <p>Placement -&gt; Invoice -&gt; Revenue, all visible in one system.</p>
          </div>

          <div id="why-rare">
            <h2>Why This Is Rare in Recruiting Software</h2>
            <p>Most ATS platforms avoid billing. Most CRMs avoid candidate tracking. Most billing tools avoid pipeline management.</p>
            <p>HirePilot combines these layers intentionally because recruiting is both a talent operation and a revenue operation.</p>
          </div>

          <div id="agency-owners">
            <h2>Agency Owners: This Is Where It Gets Powerful</h2>
            <p>Deals + Dashboards unlock:</p>
            <ul>
              <li>Revenue per recruiter</li>
              <li>Revenue per client</li>
              <li>Revenue per vertical</li>
              <li>Average deal size</li>
              <li>Close rates by recruiter</li>
              <li>Placement velocity</li>
              <li>Revenue growth trends</li>
            </ul>
            <p>The question changes from "Are we busy?" to "Are we profitable?"</p>
          </div>

          <div id="psychological-shift">
            <h2>The Psychological Shift</h2>
            <p>When revenue is visible in workflow, behavior improves. Recruiters prioritize high-value roles, follow up more strategically, manage client relationships proactively, and forecast more realistically.</p>
            <p>The system shapes execution quality.</p>
          </div>

          <div id="do-more-revenue">
            <h2>Do More With Less - At a Revenue Level</h2>
            <p>This is the revenue version of barrier removal.</p>
            <p>Instead of juggling sheets, manual Stripe reconciliation, and fragmented forecasts, teams operate in one architecture.</p>
            <p>That reduces cognitive load, and cognitive load directly affects performance.</p>
          </div>

          <div id="bigger-vision">
            <h2>The Bigger Vision</h2>
            <p>HirePilot&apos;s long-term vision is full recruiting operations where sourcing, outreach, pipeline, clients, dashboards, and forecasting all connect to revenue in a structured system.</p>
            <p>That is a revenue OS.</p>
          </div>

          <div id="final-thought">
            <h2>Final Thought</h2>
            <p>If you only track candidates, you are running half a business.</p>
            <p>If you track pipeline and revenue together, you operate strategically.</p>
            <p>HirePilot is designed to turn recruiters into revenue operators by connecting dots that already exist.</p>
            <p>Pipeline -&gt; Placement -&gt; Profit, all in one system.</p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Keep Reading</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <a href="/blog/custom-tables-dashboards-command-center" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png" alt="Custom tables and dashboards recruiting operations" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Operations</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Custom Tables &amp; Dashboards: Build Your Own Recruiting Command Center</h3>
                <p className="text-gray-400 mb-4">Replace spreadsheet drift with connected data models and live operational visibility.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>8 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/hirepilot-workflow-replacement" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png" alt="Recruiting workflow to execution system transition" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Playbook</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">How HirePilot Fits Into (And Replaces) Your Current Recruiting Workflow</h3>
                <p className="text-gray-400 mb-4">How to consolidate fragmented recruiting tools into one command center.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>8 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/why-we-made-a-full-ats-free" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png" alt="ATS and revenue operations product philosophy" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Product Philosophy</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Why We Made a Full ATS Free</h3>
                <p className="text-gray-400 mb-4">Why foundational ATS infrastructure is free and value monetizes in execution layers.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
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
