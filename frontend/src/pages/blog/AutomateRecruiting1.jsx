import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function AutomateRecruiting1() {
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
        
        /* Force white text overrides */
        #related-articles h2 { color: #ffffff !important; }
        #inline-cta-2 h3 { color: #ffffff !important; }
        #inline-cta-2 p { color: #ffffff !important; }
        .text-white { color: #ffffff !important; }
        .bg-gray-800 h3 { color: #ffffff !important; }
        .bg-gray-800 p { color: #ffffff !important; }
        
        /* Force article card titles to white */
        #related-articles .bg-white h3 { color: #ffffff !important; }
        #related-articles .bg-white .text-xl { color: #ffffff !important; }
        #related-articles .bg-white .font-semibold { color: #ffffff !important; }
        #related-articles article h3 { color: #ffffff !important; }
        #related-articles article .text-xl { color: #ffffff !important; }
      `}</style>

      <BlogNavbar />

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
          alt="AI-powered recruiting automation dashboard with REX assistant interface"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">AI Automation</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Automate Your Recruiting with HirePilot + REX</h1>
            <p className="text-xl text-gray-200 mb-6">Part 1 of 5: The Vision — How REX and HirePilot Turn Recruiting into a Growth Engine</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg"
                alt="Author"
                className="w-12 h-12 rounded-full"
              />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on January 15, 2025</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div id="main-content" className="flex max-w-6xl mx-auto px-6 py-12 gap-8">
        {/* TOC */}
        <BlogTOC />

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <div id="introduction">
            <p>
              What if your recruiting workflow worked like your marketing funnel?
            </p>

            <p>
              What if you could <strong>source, qualify, message, and manage candidates</strong> — the same way you'd manage leads in a sales campaign?
            </p>

            <blockquote>
              That's the core idea behind HirePilot + REX.
            </blockquote>

            <p>
              You're not just filling roles anymore. You're building a <strong>scalable, automated recruiting engine</strong>.
            </p>
          </div>

          <div id="meet-rex">
            <h2>🤖 Meet Your Recruiting Copilot: REX</h2>

            <p>
              REX isn't just a chatbot. It's an <strong>AI agent</strong> connected directly to your data, campaigns, and hiring workflows.
            </p>

            <p>With REX, you can say things like:</p>

            <ul>
              <li>"REX, source 20 SDRs for my campaign."</li>
              <li>"REX, enrich these leads with verified emails."</li>
              <li>"REX, send a 3-step cold email sequence to these candidates."</li>
              <li>"REX, move John Smith to Final Interview."</li>
              <li>"REX, send this lead to Clay."</li>
            </ul>

            <p>And it <em>just happens.</em></p>

            <p>REX handles:</p>

            <ul>
              <li>Lead sourcing</li>
              <li>Outreach generation</li>
              <li>Candidate enrichment</li>
              <li>Pipeline management</li>
              <li>Automation triggers (via Zapier, Make)</li>
              <li>Credit usage tracking</li>
              <li>Help content and onboarding</li>
            </ul>

            <p>All from one interface. All connected to your data.</p>
          </div>

          {/* Inline CTA 1 */}
          <div id="inline-cta-1" className="bg-blue-600 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Ready to Meet REX?</h3>
            <p className="mb-4">Start your free trial of HirePilot today and experience AI-powered recruiting automation.</p>
            <button className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">Start Free Trial</button>
          </div>

          <div id="why-automate">
            <h2>💡 Why Automate Recruiting?</h2>

            <p>Let's face it: most recruiting work is <strong>high effort + repetitive.</strong></p>

            <ul>
              <li>You're searching for the same types of candidates over and over</li>
              <li>Writing similar messages across roles</li>
              <li>Moving people through the same funnel manually</li>
              <li>Juggling spreadsheets, Slack pings, calendars, and CRMs</li>
            </ul>

            <p>What if your system just… did it for you?</p>

            <p>HirePilot makes that possible.</p>

            <blockquote>
              It turns your recruiting operation into a growth machine — powered by campaigns, tracked by data, and run with AI.
            </blockquote>
          </div>

          <div id="series-overview">
            <h2>⚙️ What This Series Will Cover</h2>

            <p>In this 5-part guide, we'll show you how to fully automate your recruiting workflow using tools already built into HirePilot:</p>

            <h3>1. Job Intake & Lead Sourcing</h3>
            <p>→ Turn a job description into a ready-to-run campaign with leads sourced from Apollo or LinkedIn.</p>

            <h3>2. Messaging & Follow-Ups</h3>
            <p>→ Generate personalized cold emails, follow-ups, and deliver through Gmail or SendGrid.</p>

            <h3>3. Pipeline + Automations</h3>
            <p>→ Move candidates, manage interview stages, and auto-trigger workflows (Slack, Clay, Notion, etc.)</p>

            <h3>4. Credits, Analytics & Reporting</h3>
            <p>→ Track your usage, review what's working, and streamline your week.</p>

            <h3>5. Hands-Free Recruiting Agency Playbook</h3>
            <p>→ How to use HirePilot to deliver Done-For-You recruiting for clients at scale.</p>
          </div>

          {/* Inline CTA 2 */}
          <div id="inline-cta-2" className="bg-gray-800 border border-gray-700 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2 text-white">Want to Chat with REX Now?</h3>
            <p className="mb-4 text-white">Try REX inside the HirePilot app and see automation in action.</p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Chat with REX</button>
          </div>

          <div id="getting-started">
            <h2>🚀 Ready to Get Started?</h2>

            <p>You don't need to install 5 tools. You don't need to hire 3 coordinators.</p>

            <p>You just need:</p>

            <ul>
              <li>1 campaign</li>
              <li>1 REX prompt</li>
              <li>1 candidate to convert</li>
            </ul>

            <p>And you're off.</p>

            <p><strong>👉 Next Up:</strong> <em>Part 2 – From Job Intake to Lead Sourcing: Automate the Top of Funnel with REX + Apollo</em></p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">Continue the Series</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <a href="/blog/AutomateRecruiting2" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
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
            </a>

            <a href="/blog/AutomateRecruiting3" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png"
                alt="AI-powered messaging and follow-up automation"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Part 3</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Messaging & Follow-Ups</h3>
                <p className="text-gray-400 mb-4">
                  Generate personalized cold emails and automated follow-up sequences delivered through your preferred platform.
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
                  <span>9 min read</span>
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <div id="newsletter-signup" className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Don't Miss the Next Part</h2>
          <p className="text-xl mb-8 text-blue-100">Get notified when we publish the next article in this 5-part automation series</p>
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