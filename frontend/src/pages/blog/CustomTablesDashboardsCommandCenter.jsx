import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function CustomTablesDashboardsCommandCenter() {
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
          alt="Custom recruiting tables and dashboards command center interface"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-blue-700 text-white px-3 py-1 rounded-full text-sm font-medium">Operations</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Custom Tables &amp; Dashboards: Build Your Own Recruiting Command Center</h1>
            <p className="text-xl text-gray-200 mb-6">How to replace spreadsheet drift with connected, real-time recruiting infrastructure.</p>
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
            <p>Most recruiting software gives you fixed pipelines, fixed records, fixed reporting, and fixed dashboards.</p>
            <p>You operate inside someone else&apos;s structure. When you need flexibility, you open a spreadsheet.</p>
            <p>And once you open a spreadsheet, you leave the system. Data fragments. Reporting breaks. Automation disconnects.</p>
            <p>Custom Tables and Dashboards were built to solve that as infrastructure, not as a cosmetic feature.</p>
          </div>

          <div id="static-reporting-problem">
            <h2>The Problem With Static ATS Reporting</h2>
            <p>Traditional ATS platforms assume a narrow workflow:</p>
            <ul>
              <li>Track candidates</li>
              <li>Move stages</li>
              <li>Export reports</li>
              <li>You are done</li>
            </ul>
            <p>Modern recruiters need much more flexibility. You may need to track:</p>
            <ul>
              <li>Client retainers</li>
              <li>Referral sources</li>
              <li>Recruiter performance</li>
              <li>Revenue per role</li>
              <li>Submission-to-interview ratios</li>
              <li>Interview-to-offer ratios</li>
              <li>Offer-to-close ratios</li>
              <li>Placement velocity</li>
              <li>Average time-to-fill</li>
              <li>Outreach response rates</li>
              <li>Per-client win rates</li>
              <li>Advisory hours + recruiting hours</li>
            </ul>
            <p>When software cannot model that, teams add extra spreadsheets, boards, and reporting layers, which reintroduce fragmentation.</p>
          </div>

          <div id="why-custom-tables">
            <h2>Why We Built Custom Tables</h2>
            <p>Custom Tables let you create structured data models inside HirePilot, not outside it.</p>
            <p>You are not locked into predefined schemas. You can create:</p>
            <ul>
              <li>Custom fields</li>
              <li>Custom data relationships</li>
              <li>Custom tracking systems</li>
              <li>Custom operational views</li>
            </ul>
            <p>All inside the same architecture.</p>
          </div>

          <div id="what-you-can-build">
            <h2>What You Can Build With Custom Tables</h2>

            <h3>1) Recruiter Performance Tracker</h3>
            <ul>
              <li>Recruiter name</li>
              <li>Roles assigned</li>
              <li>Submissions</li>
              <li>Interviews</li>
              <li>Placements</li>
              <li>Revenue generated</li>
              <li>Close rate</li>
              <li>Average time-to-fill</li>
            </ul>

            <h3>2) Client Health Table</h3>
            <ul>
              <li>Client name</li>
              <li>Active roles</li>
              <li>Placements this quarter</li>
              <li>Revenue YTD</li>
              <li>Retainer status</li>
              <li>Payment status</li>
              <li>Last engagement date</li>
            </ul>

            <h3>3) Referral Source Tracking</h3>
            <ul>
              <li>Source name</li>
              <li>Candidates referred</li>
              <li>Placements generated</li>
              <li>Revenue tied to source</li>
              <li>Payout owed</li>
            </ul>

            <h3>4) Advisory + Recruiting Hybrid Tracking</h3>
            <ul>
              <li>Advisory retainer revenue</li>
              <li>Recruiting placement revenue</li>
              <li>Blended client value</li>
              <li>Active opportunities</li>
              <li>Revenue pipeline</li>
            </ul>

            <p>You are no longer forced to track this outside your ATS. It lives inside your operating system.</p>
          </div>

          <div id="replace-spreadsheet-drift">
            <h2>Tables Replace Spreadsheet Drift</h2>
            <p>Spreadsheets drift. They duplicate, age, lose control, break formulas, and disconnect from live execution.</p>
            <p>Custom Tables stay connected to:</p>
            <ul>
              <li>Candidates</li>
              <li>Deals</li>
              <li>Pipelines</li>
              <li>Clients</li>
              <li>Revenue</li>
              <li>Automation events</li>
            </ul>
            <p>When system data updates, your tables reflect it automatically.</p>
          </div>

          <div id="dashboards-visibility">
            <h2>Dashboards: Turn Data Into Visibility</h2>
            <p>Tables organize data. Dashboards interpret it.</p>
            <p>Custom Dashboards give real-time views of:</p>
            <ul>
              <li>Revenue</li>
              <li>Pipeline health</li>
              <li>Recruiter performance</li>
              <li>Client performance</li>
              <li>Role status</li>
              <li>Outreach metrics</li>
              <li>Conversion ratios</li>
            </ul>
            <p>Instead of exporting reports, you operate on live visibility.</p>
          </div>

          <div id="what-makes-dashboards-different">
            <h2>What Makes HirePilot Dashboards Different?</h2>
            <p>Most ATS dashboards are fixed, usually with only basic counts and a simple funnel.</p>
            <p>HirePilot Dashboards are customizable. You choose:</p>
            <ul>
              <li>What metrics matter</li>
              <li>What charts display</li>
              <li>What tables surface</li>
              <li>What KPIs stay visible</li>
              <li>What revenue gets tracked</li>
            </ul>
            <p>You do not adapt to the tool. The tool adapts to your operation.</p>
          </div>

          <div id="build-command-center">
            <h2>Building a Recruiting Command Center</h2>
            <p>A fully built HirePilot command center can include:</p>

            <h3>Revenue Panel</h3>
            <ul>
              <li>Monthly recurring revenue</li>
              <li>Placement revenue</li>
              <li>Pending invoice amount</li>
              <li>Revenue by client</li>
            </ul>

            <h3>Pipeline Panel</h3>
            <ul>
              <li>Candidates per stage</li>
              <li>Bottleneck detection</li>
              <li>Role velocity</li>
            </ul>

            <h3>Outreach Panel</h3>
            <ul>
              <li>Messages sent</li>
              <li>Reply rate</li>
              <li>Positive response rate</li>
            </ul>

            <h3>Recruiter Panel</h3>
            <ul>
              <li>Submissions per recruiter</li>
              <li>Close rate</li>
              <li>Revenue per recruiter</li>
            </ul>

            <h3>Deal Panel</h3>
            <ul>
              <li>Opportunities by stage</li>
              <li>Forecasted revenue</li>
              <li>Conversion probability</li>
            </ul>

            <p>All inside one system, not spread across multiple reporting tools.</p>
          </div>

          <div id="agency-impact">
            <h2>Why This Changes How Agencies Operate</h2>
            <p>When data is structured, centralized, live, automated, and connected, teams can:</p>
            <ul>
              <li>Make faster decisions</li>
              <li>Identify bottlenecks</li>
              <li>Adjust strategy quickly</li>
              <li>Coach recruiters with evidence</li>
              <li>Forecast revenue accurately</li>
              <li>Allocate resources intelligently</li>
            </ul>
            <p>You stop reacting and start operating.</p>
          </div>

          <div id="operator-shift">
            <h2>The Bigger Shift: From Tool User to Operator</h2>
            <p>Custom Tables and Dashboards are a philosophical shift.</p>
            <p>Most recruiters use software. Operators design systems.</p>
            <p>With this layer, you are not just tracking candidates. You are designing how your recruiting business runs.</p>
          </div>

          <div id="who-this-is-for">
            <h2>Who This Is For</h2>
            <p>Custom Tables &amp; Dashboards matter most for:</p>
            <ul>
              <li>Agency owners</li>
              <li>Team leads</li>
              <li>Fractional executives</li>
              <li>Operators managing hybrid revenue streams</li>
              <li>Recruiters scaling beyond solo placements</li>
            </ul>
            <p>If you are thinking in systems, this layer is for you.</p>
          </div>

          <div id="connected-to-everything">
            <h2>And It&apos;s Still Connected to Everything Else</h2>
            <p>Tables and Dashboards are not floating features. They connect to:</p>
            <ul>
              <li>Agent Mode</li>
              <li>Sniper</li>
              <li>Enrichment</li>
              <li>Pipeline</li>
              <li>Deals</li>
              <li>Stripe billing</li>
              <li>Automation events</li>
            </ul>
            <p>Your sourcing affects dashboards. Your pipeline affects revenue tables. Your placements affect forecasts.</p>
            <p>Nothing is isolated.</p>
          </div>

          <div id="final-thought">
            <h2>Final Thought</h2>
            <p>Spreadsheets were a workaround. Custom Tables are architecture.</p>
            <p>Static reports were a limitation. Dashboards are visibility.</p>
            <p>HirePilot is not just a recruiting tool anymore. It is a recruiting command center.</p>
            <p>Tables and Dashboards are where you start designing your own operating system.</p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Keep Reading</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <a href="/blog/hirepilot-2-0-recruiting-os" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png" alt="HirePilot recruiting operating system architecture" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Product Update</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">HirePilot 2.0: From Outreach Tool to Autonomous Recruiting Operating System</h3>
                <p className="text-gray-400 mb-4">How HirePilot evolved into a centralized recruiting operating system.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>9 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/hirepilot-workflow-replacement" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png" alt="Workflow replacement and recruiting command center playbook" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Playbook</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">How HirePilot Fits Into (And Replaces) Your Current Recruiting Workflow</h3>
                <p className="text-gray-400 mb-4">Step-by-step consolidation from fragmented tools to one execution system.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>8 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/why-we-made-a-full-ats-free" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png" alt="ATS infrastructure accessibility and product philosophy" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Product Philosophy</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Why We Made a Full ATS Free</h3>
                <p className="text-gray-400 mb-4">Why foundational candidate tracking should be accessible for every recruiter.</p>
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
