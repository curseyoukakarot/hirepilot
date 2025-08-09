import React from 'react';

export default function AutomateRecruiting5() {
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
        /* Force white text for specific elements */
        #inline-cta-2 h3, #inline-cta-2 p { color: #ffffff !important; }
        #comparison table th, #comparison table td { color: #ffffff !important; }
        #related-articles h2, #related-articles h3 { color: #ffffff !important; }
        /* Force black for specific comparison rows */
        .force-black, .force-black td, .force-black th, .force-black * { color: #000000 !important; }
      `}</style>

      {/* Breadcrumb */}
      <div id="breadcrumb" className="bg-gray-800 py-4">
        <div className="max-w-6xl mx-auto px-6">
          <a href="/blog" className="text-gray-300 hover:text-white transition-colors flex items-center">
            <i className="fa-solid fa-arrow-left mr-2" />
            Back to Blog
          </a>
        </div>
      </div>

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
          alt="Complete recruiting operating system dashboard with analytics, reporting, and agency management tools"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">Recruiting OS</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Automate Your Recruiting with HirePilot + REX</h1>
            <p className="text-xl text-gray-200 mb-6">Part 5: Your Recruiting OS — Reporting, Collaboration & Scaling your agency with HirePilot</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg"
                alt="Author"
                className="w-12 h-12 rounded-full"
              />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on January 19, 2025</p>
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
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Credits & ROI Tracking</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Weekly Reporting</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Stack Integration</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Agency Automation</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Before vs After</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Your Recruiting Machine</span>
            </nav>
          </div>
        </div>

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <div id="introduction">
            <p>
              At this point, your recruiting process is no longer a series of tasks.
            </p>

            <p>
              It's a <strong>system</strong> — an intelligent, automated OS.
            </p>

            <p>
              HirePilot with REX at the center gives you everything you need to run:
            </p>

            <ul>
              <li>A solo recruiting practice</li>
              <li>A lean internal talent team</li>
              <li>Or a full-service recruiting agency</li>
            </ul>

            <p>Here's how to <strong>scale it</strong>, measure it, and stay in control.</p>
          </div>

          <div id="credits-tracking">
            <h2>📈 Track Credits, Usage, and ROI</h2>

            <p>Every sourced lead, enriched contact, and message sent consumes credits.</p>

            <p>But you don't have to guess.</p>

            <blockquote>
              "REX, how many credits do I have left?"<br/><br/>
              "REX, show me what I've used credits on this week."
            </blockquote>

            <p>You'll see:</p>

            <ul>
              <li>📊 Total Credits</li>
              <li>📤 Used for sourcing, enrichment, messaging</li>
              <li>📉 Breakdown by campaign</li>
            </ul>

            <blockquote>
              ⚠️ Out of credits? REX prompts you to top up or pause actions.
            </blockquote>
          </div>

          {/* Inline CTA 1 */}
          <div id="inline-cta-1" className="bg-red-600 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Ready to Build Your Recruiting OS?</h3>
            <p className="mb-4">Start your free trial and transform your recruiting practice into an automated system.</p>
            <button className="bg-white text-red-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">Start Free Trial</button>
          </div>

          <div id="weekly-reporting">
            <h2>🧾 Weekly Reporting On-Demand</h2>

            <p>Whether you're reporting to clients or your team, you can ask:</p>

            <blockquote>
              "REX, summarize this week's outreach."<br/><br/>
              "REX, how many candidates are in Interview stage?"<br/><br/>
              "REX, who's responded but hasn't been moved yet?"
            </blockquote>

            <p>REX compiles:</p>

            <ul>
              <li>Lead → candidate conversions</li>
              <li>Response rates</li>
              <li>Candidates in each stage</li>
              <li>Outreach performance per campaign</li>
            </ul>
          </div>

          <div id="stack-integration">
            <h2>🛠 Integration with Your Stack (Zapier + Make)</h2>

            <p>Need data outside of HirePilot?</p>

            <p>REX can trigger automations like:</p>

            <ul>
              <li><strong>Send new candidates to Clay or Airtable</strong></li>
              <li><strong>Update Notion dashboards</strong></li>
              <li><strong>Ping Slack when someone books an interview</strong></li>
              <li><strong>Create tasks in Asana, ClickUp, or Monday.com</strong></li>
            </ul>

            <p>You focus on conversations. REX keeps your systems updated.</p>
          </div>

          <div id="agency-automation">
            <h2>🤖 Hands-Free Recruiting: How Agencies Win with HirePilot</h2>

            <p>Here's how a Done-For-You recruiting service might work:</p>

            <h3>🧭 Client submits a new role</h3>
            <ul>
              <li>Via Typeform or embedded form</li>
              <li>Triggers a new campaign in HirePilot</li>
            </ul>

            <h3>🛰️ REX sources + enriches leads</h3>
            <ul>
              <li>Campaign Wizard + Apollo + LinkedIn</li>
              <li>Emails and phones filled automatically</li>
            </ul>

            <h3>✉️ REX launches outreach</h3>
            <ul>
              <li>Personalized 3-step sequence</li>
              <li>Replies routed into pipeline</li>
            </ul>

            <h3>🧱 REX manages pipeline</h3>
            <ul>
              <li>Moves candidates</li>
              <li>Triggers Slack updates or client-facing alerts</li>
              <li>Hands-off scheduling flow</li>
            </ul>

            <h3>📤 Client only sees:</h3>
            <ul>
              <li>A shortlist of qualified candidates</li>
              <li>Or calendar invites filled with interviews</li>
            </ul>

            <p>That's how you deliver recruiting like a <strong>SaaS product.</strong></p>
          </div>

          {/* Inline CTA 2 */}
          <div id="inline-cta-2" className="bg-gray-800 border border-gray-700 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">See the Complete System in Action</h3>
            <p className="mb-4">Chat with REX now and experience the full recruiting automation platform.</p>
            <a href="/login" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block">Chat with REX</a>
          </div>

          <div id="comparison">
            <h2>✅ What's Automated at the Agency/OS Level?</h2>

            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Manual Before</th>
                  <th>With HirePilot + REX</th>
                </tr>
              </thead>
              <tbody>
                <tr className="force-black">
                  <td>Client updates</td>
                  <td>❌ Emails & screenshots</td>
                  <td>✅ Weekly summaries</td>
                </tr>
                <tr>
                  <td>Workflow tracking</td>
                  <td>❌ Multiple tools</td>
                  <td>✅ All in one command</td>
                </tr>
                <tr className="force-black">
                  <td>Team coordination</td>
                  <td>❌ Shared docs + Slack</td>
                  <td>✅ Automations via REX</td>
                </tr>
                <tr>
                  <td>Credit management</td>
                  <td>❌ Hard to monitor</td>
                  <td>✅ Real-time via chat</td>
                </tr>
                <tr className="force-black">
                  <td>Client reporting</td>
                  <td>❌ Manual exports</td>
                  <td>✅ Live dashboards or Slack alerts</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div id="recruiting-machine">
            <h2>🎯 Final Word: You've Built the Machine</h2>

            <p>By now, your recruiting engine has:</p>

            <ul>
              <li>Campaign logic</li>
              <li>Candidate pipelines</li>
              <li>Messaging automation</li>
              <li>Data enrichment</li>
              <li>Credit-based control</li>
              <li>External integrations</li>
              <li>A brain (REX) to run it all</li>
            </ul>

            <blockquote>
              You're no longer managing a workflow.<br/><br/>
              You're operating a platform.
            </blockquote>
          </div>

          <div id="go-further">
            <h2>✅ Want to Go Even Further?</h2>

            <p>You can:</p>

            <ul>
              <li>Add AI scheduling + calendar integration</li>
              <li>Plug in client-facing portals</li>
              <li>Connect to Stripe for billing</li>
              <li>Train REX to handle client-facing questions, too</li>
            </ul>

            <p>This isn't the end of the series — it's the <strong>beginning of your recruiting system at scale</strong>.</p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Complete Automation Series</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-40 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
                alt="The Vision - HirePilot + REX automation overview"
              />
              <div className="p-5">
                <span className="text-blue-400 text-sm font-medium">Part 1</span>
                <h3 className="text-lg font-semibold mt-2 mb-2"><a href="/blog/AutomateRecruiting1" className="hover:underline">The Vision</a></h3>
                <p className="text-gray-400 text-sm mb-3">
                  How REX turns recruiting into a scalable, automated growth engine.
                </p>
                <div className="flex items-center text-xs text-gray-500">
                  <span>6 min read</span>
                </div>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-40 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png"
                alt="Lead sourcing automation with Apollo integration"
              />
              <div className="p-5">
                <span className="text-blue-400 text-sm font-medium">Part 2</span>
                <h3 className="text-lg font-semibold mt-2 mb-2"><a href="/blog/AutomateRecruiting2" className="hover:underline">Lead Sourcing</a></h3>
                <p className="text-gray-400 text-sm mb-3">
                  Automate job intake to candidate discovery with Apollo and LinkedIn.
                </p>
                <div className="flex items-center text-xs text-gray-500">
                  <span>8 min read</span>
                </div>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-40 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png"
                alt="AI-powered messaging and follow-up automation"
              />
              <div className="p-5">
                <span className="text-blue-400 text-sm font-medium">Part 3</span>
                <h3 className="text-lg font-semibold mt-2 mb-2"><a href="/blog/AutomateRecruiting3" className="hover:underline">AI Messaging</a></h3>
                <p className="text-gray-400 text-sm mb-3">
                  Smart, personalized outreach sequences delivered at scale.
                </p>
                <div className="flex items-center text-xs text-gray-500">
                  <span>7 min read</span>
                </div>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-40 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png"
                alt="Pipeline automation and workflow integrations"
              />
              <div className="p-5">
                <span className="text-blue-400 text-sm font-medium">Part 4</span>
                <h3 className="text-lg font-semibold mt-2 mb-2"><a href="/blog/AutomateRecruiting4" className="hover:underline">Pipeline Automation</a></h3>
                <p className="text-gray-400 text-sm mb-3">
                  Workflow automation and integrations across your entire stack.
                </p>
                <div className="flex items-center text-xs text-gray-500">
                  <span>9 min read</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <div id="newsletter-signup" className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">🎉 You've Completed the Series!</h2>
          <p className="text-xl mb-8 text-blue-100">Stay updated with the latest HirePilot features and automation strategies</p>
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
          <p className="text-sm text-blue-200 mt-4">Get updates on new features, tips, and automation guides</p>
        </div>
      </div>
    </>
  );
} 