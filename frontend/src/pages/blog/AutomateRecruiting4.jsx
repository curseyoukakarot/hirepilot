import React from 'react';

export default function AutomateRecruiting4() {
  return (
    <>
      {/* Scoped styles preserved from original article page */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose h3 { color: #f3f4f6; font-size: 1.25rem; font-weight: 600; margin: 1.5rem 0 0.75rem 0; }
        .prose p { color: #d1d5db; line-height: 1.7; margin-bottom: 1.5rem; }
        .prose ul { color: #d1d5db; margin: 1.5rem 0; }
        .prose ol { color: #d1d5db; margin: 1.5rem 0; }
        .prose li { margin-bottom: 0.5rem; }
        .prose blockquote { border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 2rem 0; font-style: italic; color: #9ca3af; }
        .prose code { background: #374151; color: #f9fafb; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.875rem; }
        .prose pre { background: #1f2937; padding: 1.5rem; border-radius: 0.5rem; overflow-x: auto; margin: 2rem 0; }
        .toc-active { color: #3b82f6; }
        .prose table { width: 100%; border-collapse: collapse; margin: 2rem 0; }
        .prose th, .prose td { border: 1px solid #374151; padding: 0.75rem; text-align: left; }
        .prose th { background: #1f2937; font-weight: 600; }
        .prose tr:nth-child(even) { background: #1f2937; }
      `}</style>

      {/* Breadcrumb */}
      <div id="breadcrumb" className="bg-gray-800 py-4">
        <div className="max-w-6xl mx-auto px-6">
          <span className="text-gray-300 hover:text-white transition-colors flex items-center cursor-pointer">
            <i className="fa-solid fa-arrow-left mr-2" />
            Back to Blog
          </span>
        </div>
      </div>

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png"
          alt="Pipeline management dashboard with workflow automation and integration tools"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-sm font-medium">Pipeline Automation</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Automate Your Recruiting with HirePilot + REX</h1>
            <p className="text-xl text-gray-200 mb-6">Part 4: Managing Your Pipeline + Automating Your Workflows</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg"
                alt="Author"
                className="w-12 h-12 rounded-full"
              />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on January 18, 2025</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div id="main-content" className="flex max-w-6xl mx-auto px-6 py-12 gap-8">
        {/* TOC */}
        <div id="toc-sidebar" className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-8">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Table of Contents</h3>
            <nav className="space-y-2">
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Pipeline Visualization</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">REX Pipeline Commands</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Candidate Conversion</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Workflow Integrations</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Smart Notifications</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Before vs After</span>
            </nav>
          </div>
        </div>

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <div id="introduction">
            <p>
              Once your outreach starts working, candidates begin replying.
            </p>

            <p>
              Now it's time to track, qualify, and move them — without letting anything fall through the cracks.
            </p>

            <p>
              With <strong>HirePilot + REX</strong>, managing your pipeline isn't a spreadsheet chore — it's a seamless, automated flow.
            </p>
          </div>

          <div id="pipeline-visualization">
            <h2>📊 Visualize Your Pipeline</h2>

            <p>Every campaign in HirePilot includes a built-in <strong>Pipeline View</strong>.</p>

            <p>You'll see:</p>

            <ul>
              <li>Candidate cards sorted by stage</li>
              <li>Customizable columns (e.g., Sourced, Phone Screen, Interview, Offer)</li>
              <li>Drag-and-drop movement between stages</li>
            </ul>

            <p>No more stale Airtables or forgotten leads.</p>
          </div>

          {/* Inline CTA 1 */}
          <div id="inline-cta-1" className="bg-orange-600 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Ready to Streamline Your Pipeline?</h3>
            <p className="mb-4">Start your free trial and experience visual pipeline management with REX automation.</p>
            <button className="bg-white text-orange-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">Start Free Trial</button>
          </div>

          <div id="rex-pipeline-commands">
            <h2>🤖 Move Candidates with REX</h2>

            <p>Don't want to drag manually?</p>

            <p>Let REX handle pipeline transitions with simple commands like:</p>

            <blockquote>
              "REX, move Jordan Lee to Interview stage."<br/><br/>
              "REX, who's stuck in Phone Screen?"<br/><br/>
              "REX, summarize interview notes for this candidate."
            </blockquote>

            <p>REX will:</p>

            <ul>
              <li>Update the database</li>
              <li>Timestamp the move</li>
              <li>Trigger Slack alerts (if enabled)</li>
              <li>Log the full history for your team</li>
            </ul>
          </div>

          <div id="candidate-conversion">
            <h2>🧠 Candidate Conversion from Leads</h2>

            <p>Got a reply from a great lead?</p>

            <p>REX can instantly:</p>

            <ul>
              <li>Promote the lead to candidate</li>
              <li>Attach them to the job req</li>
              <li>Pre-fill their profile using enriched data</li>
            </ul>

            <blockquote>
              "REX, convert this lead to a candidate and assign to Marketing Manager role."
            </blockquote>

            <p>One prompt, done.</p>
          </div>

          <div id="workflow-integrations">
            <h2>🔁 Trigger Automations with Zapier + Make</h2>

            <p>HirePilot is now wired to fire external automations.</p>

            <p>Examples:</p>

            <ul>
              <li><strong>Zapier → Clay</strong> → Send leads/candidates to a synced CRM view</li>
              <li><strong>Make.com → Notion</strong> → Auto-update a hiring dashboard</li>
              <li><strong>Zapier → Slack</strong> → Post when a candidate reaches "Offer" stage</li>
            </ul>

            <p>All of this happens <strong>when REX triggers tool calls</strong>, based on your action or theirs.</p>

            <blockquote>
              "REX, send this candidate to Clay."<br/><br/>
              "REX, trigger my onboarding workflow."
            </blockquote>
          </div>

          {/* Inline CTA 2 */}
          <div id="inline-cta-2" className="bg-gray-800 border border-gray-700 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Want to See Pipeline Automation?</h3>
            <p className="mb-4">Chat with REX and watch it manage candidates and trigger workflows automatically.</p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Chat with REX</button>
          </div>

          <div id="smart-notifications">
            <h2>🛎 Notifications Where You Need Them</h2>

            <p>You'll never miss a beat:</p>

            <ul>
              <li>Get a Slack alert when a candidate replies</li>
              <li>Set up SMS or Notion alerts via Make</li>
              <li>Log a row in Google Sheets automatically</li>
            </ul>

            <p>REX connects the dots. You stay in the loop.</p>
          </div>

          <div id="comparison">
            <h2>✅ What's Automated in the Pipeline + Workflow Stage?</h2>

            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Manual Before</th>
                  <th>With HirePilot + REX</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Moving candidates</td>
                  <td>❌ Drag or update manually</td>
                  <td>✅ "REX, move to Interview"</td>
                </tr>
                <tr>
                  <td>Converting replies</td>
                  <td>❌ Manual data entry</td>
                  <td>✅ One-click convert</td>
                </tr>
                <tr>
                  <td>Notifications</td>
                  <td>❌ Set up in Zapier separately</td>
                  <td>✅ REX triggers pre-wired hooks</td>
                </tr>
                <tr>
                  <td>Automations</td>
                  <td>❌ Custom per client</td>
                  <td>✅ Triggered by stage or reply</td>
                </tr>
                <tr>
                  <td>Pipeline tracking</td>
                  <td>❌ Spreadsheet</td>
                  <td>✅ Real-time campaign dashboard</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div id="feature-spotlight">
            <h2>🛠 Feature Spotlight</h2>

            <ul>
              <li>✅ Pipeline drag/drop</li>
              <li>✅ REX pipeline tools</li>
              <li>✅ Slack, Clay, Notion integrations</li>
              <li>✅ TriggerZapier & triggerMakeWorkflow tools</li>
              <li>✅ Support for credit-based actions & limits</li>
            </ul>
          </div>

          <div id="next-up">
            <h2>👉 Next Up</h2>

            <p><strong>Part 5 – Your Recruiting OS: Reporting, Collaboration, and Scaling your agency with HirePilot</strong></p>

            <p>You'll learn how to run your entire recruiting agency (or team) from one command center.</p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Continue the Series</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png"
                alt="Lead sourcing automation with Apollo integration"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Part 2</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Job Intake to Lead Sourcing</h3>
                <p className="text-gray-400 mb-4">
                  Turn job descriptions into ready-to-run campaigns with automated lead sourcing from Apollo and LinkedIn.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Published</span>
                  <span className="mx-2">•</span>
                  <span>8 min read</span>
                </div>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png"
                alt="AI-powered messaging and follow-up automation"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Part 3</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">AI Messaging & Follow-Ups</h3>
                <p className="text-gray-400 mb-4">
                  Generate personalized cold emails and automated follow-up sequences delivered at scale.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Published</span>
                  <span className="mx-2">•</span>
                  <span>7 min read</span>
                </div>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
                alt="Recruiting agency operations and scaling dashboard"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Part 5</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Your Recruiting OS</h3>
                <p className="text-gray-400 mb-4">
                  Run your entire recruiting agency from one command center with reporting, collaboration, and scaling.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Coming Soon</span>
                  <span className="mx-2">•</span>
                  <span>10 min read</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <div id="newsletter-signup" className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Don't Miss the Final Part</h2>
          <p className="text-xl mb-8 text-blue-100">Get notified when we publish the complete recruiting agency operations guide</p>
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