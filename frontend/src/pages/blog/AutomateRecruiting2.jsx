import React from 'react';

export default function AutomateRecruiting2() {
  return (
    <>
      {/* Scoped styles preserved from original article page */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose p { color: #d1d5db; line-height: 1.7; margin-bottom: 1.5rem; }
        .prose ul { color: #d1d5db; margin: 1.5rem 0; }
        .prose li { margin-bottom: 0.5rem; }
        .prose blockquote { border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 2rem 0; font-style: italic; color: #9ca3af; }
        .prose code { background: #374151; color: #f9fafb; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.875rem; }
        .prose pre { background: #1f2937; padding: 1.5rem; border-radius: 0.5rem; overflow-x: auto; margin: 2rem 0; }
        .toc-active { color: #3b82f6; }
        .prose table { width: 100%; border-collapse: collapse; margin: 2rem 0; }
        .prose th, .prose td { border: 1px solid #374151; padding: 0.75rem; text-align: left; }
        .prose th { background: #1f2937; font-weight: 600; }
        .prose tr:nth-child(even) { background: #1f2937; }
        
        /* Force white text overrides for dark rows only */
        .prose table th { color: #ffffff !important; }
        .prose table tr:nth-child(even) td { color: #ffffff !important; }
        .prose table tr:nth-child(odd) td { color: #000000 !important; }
        #related-articles h2 { color: #ffffff !important; }
        #related-articles .bg-gray-900 h3 { color: #ffffff !important; }
        #related-articles .bg-gray-900 .text-xl { color: #ffffff !important; }
        #related-articles .bg-gray-900 .font-semibold { color: #ffffff !important; }
        #related-articles article h3 { color: #ffffff !important; }
        #related-articles article .text-xl { color: #ffffff !important; }
        #inline-cta-2 h3 { color: #ffffff !important; }
        #inline-cta-2 p { color: #ffffff !important; }
        .text-white { color: #ffffff !important; }
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
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png"
          alt="Lead sourcing automation dashboard with Apollo integration and campaign management"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium">Lead Sourcing</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Automate Your Recruiting with HirePilot + REX</h1>
            <p className="text-xl text-gray-200 mb-6">Part 2: From Job Intake to Lead Sourcing — Automate the Top of Funnel with REX + Apollo</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg"
                alt="Author"
                className="w-12 h-12 rounded-full"
              />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on January 16, 2025</p>
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
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Job to Campaign</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Apollo Sourcing</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">LinkedIn Integration</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">CSV Uploads</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Built-in Enrichment</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Before vs After</span>
            </nav>
          </div>
        </div>

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <div id="introduction">
            <p>
              So you've got a job to fill. Traditionally, this is where the work <em>starts.</em>
            </p>

            <p>
              But with <strong>HirePilot + REX</strong>, the top of funnel becomes <strong>automated, precise, and lightning fast.</strong>
            </p>
          </div>

          <div id="job-to-campaign">
            <h2>🧠 From Job Description to Campaign</h2>

            <p>The moment you know what you're hiring for, you can drop it into a new <strong>HirePilot Campaign</strong>:</p>

            <ul>
              <li>Give it a title (e.g. "Product Marketing Manager – SF")</li>
              <li>Set your target industry, titles, location</li>
              <li>Choose your sourcing strategy: Apollo, LinkedIn, or CSV</li>
            </ul>

            <p>Then let REX take over.</p>

            <blockquote>
              "REX, create a campaign for this role."<br/><br/>
              "REX, suggest Boolean filters for LinkedIn."<br/><br/>
              "REX, what keywords should I use in Apollo?"
            </blockquote>
          </div>

          {/* Inline CTA 1 */}
          <div id="inline-cta-1" className="bg-purple-600 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Ready to Build Your First Campaign?</h3>
            <p className="mb-4">Start your free trial and let REX automate your job intake process today.</p>
            <button className="bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">Start Free Trial</button>
          </div>

          <div id="apollo-sourcing">
            <h2>🛰️ Source from Apollo in Seconds</h2>

            <p>If you've connected your Apollo account (or are using HirePilot's shared RecruitPro key), REX can:</p>

            <ul>
              <li>Pull leads based on title, seniority, industry, location</li>
              <li>Apply keyword filters ("Fintech," "AI," "Healthcare SaaS")</li>
              <li>Preview matched leads</li>
              <li>Deduct credits and auto-enrich with verified emails</li>
            </ul>

            <blockquote>
              "REX, source 25 Series A Growth Marketers for this campaign."<br/><br/>
              "REX, show me leads with verified personal emails only."
            </blockquote>

            <p>Apollo becomes a sourcing engine — not a place you have to live inside.</p>
          </div>

          <div id="linkedin-integration">
            <h2>🧑‍💼 LinkedIn Sales Navigator — Even Without the Extension</h2>

            <p>Prefer LinkedIn?</p>

            <ul>
              <li>Use the Chrome Extension to select leads from live searches</li>
              <li>Or paste your <strong>session cookie</strong> into your integrations settings and let REX do the pulling for you</li>
            </ul>

            <blockquote>
              "REX, source 20 technical recruiters from LinkedIn."<br/><br/>
              "REX, enrich this lead I just uploaded."
            </blockquote>
          </div>

          <div id="csv-uploads">
            <h2>📥 Already Have a List? Use CSV Uploads</h2>

            <p>Have a spreadsheet from a past campaign?</p>

            <p>Just:</p>

            <ol>
              <li>Go to your campaign</li>
              <li>Click "Add Leads" → "Upload CSV"</li>
              <li>Map your fields (name, title, email, LinkedIn URL)</li>
              <li>REX will clean, dedupe, and enrich the data</li>
            </ol>
          </div>

          {/* Inline CTA 2 */}
          <div id="inline-cta-2" className="bg-gray-800 border border-gray-700 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Need Help Setting Up Apollo or LinkedIn?</h3>
            <p className="mb-4">Chat with REX for step-by-step integration guidance.</p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Chat with REX</button>
          </div>

          <div id="enrichment">
            <h2>✨ Bonus: Enrichment Built In</h2>

            <p>If your leads are missing info, REX will:</p>

            <ul>
              <li>Use Apollo or Proxycurl to find missing emails or phone numbers</li>
              <li>Only charge credits when enrichment succeeds</li>
              <li>Return the source ("Enriched by: Apollo")</li>
            </ul>

            <blockquote>
              "REX, enrich this batch with phone numbers."<br/><br/>
              "REX, fill missing emails for these leads."
            </blockquote>
          </div>

          <div id="comparison">
            <h2>✅ Recap: What's Automated at the Top of Funnel?</h2>

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
                  <td>Building a search</td>
                  <td>❌ 15–30 minutes</td>
                  <td>✅ Ask REX once</td>
                </tr>
                <tr>
                  <td>Pulling leads</td>
                  <td>❌ Clicky + error-prone</td>
                  <td>✅ Instant from Apollo or LinkedIn</td>
                </tr>
                <tr>
                  <td>Enrichment</td>
                  <td>❌ Requires 3rd-party tools</td>
                  <td>✅ Built in with credit logic</td>
                </tr>
                <tr>
                  <td>CSV handling</td>
                  <td>❌ Manual cleaning</td>
                  <td>✅ Smart mapping + dedupe</td>
                </tr>
                <tr>
                  <td>Tracking progress</td>
                  <td>❌ Spreadsheets</td>
                  <td>✅ Campaign dashboard in real time</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div id="next-up">
            <h2>🎯 Next Up</h2>

            <p>In Part 3, we'll show you how to <strong>launch cold outreach</strong>, set up automated <strong>follow-ups</strong>, and let REX do the writing for you.</p>

            <p><strong>👉 Part 3: AI Messaging and Outreach at Scale — Send Smart, Personalized Emails with REX</strong></p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Continue the Series</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <a href="/blog/AutomateRecruiting1" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
                alt="The Vision - HirePilot + REX automation overview"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Part 1</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">The Vision</h3>
                <p className="text-gray-400 mb-4">
                  How REX and HirePilot turn recruiting into a scalable, automated growth engine.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Published</span>
                  <span className="mx-2">•</span>
                  <span>6 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/AutomateRecruiting3" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
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
            </a>

            <a href="/blog/AutomateRecruiting4" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png"
                alt="Pipeline automation and workflow integrations"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Part 4</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Pipeline + Automations</h3>
                <p className="text-gray-400 mb-4">
                  Automate candidate pipeline management and trigger workflows across Slack, Clay, Notion, and more.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Published</span>
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
          <h2 className="text-3xl font-bold mb-4">Don't Miss Part 3</h2>
          <p className="text-xl mb-8 text-blue-100">Get notified when we publish the AI messaging and outreach automation guide</p>
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