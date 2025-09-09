import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function FreePlanPlaybook() {
  return (
    <>
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose h3 { color: #f3f4f6; font-size: 1.125rem; font-weight: 600; margin: 1.5rem 0 0.75rem 0; }
        .prose p { color: #d1d5db; line-height: 1.7; margin-bottom: 1.25rem; }
        .prose ul { color: #d1d5db; margin: 1.25rem 0 1.5rem; padding-left: 1.25rem; }
        .prose li { margin-bottom: 0.5rem; }
        .prose blockquote { border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 2rem 0; font-style: italic; color: #9ca3af; }
        .prose code { background: #374151; color: #ffffff !important; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.875rem; }
        .prose pre { background: #1f2937; padding: 1.25rem; border-radius: 0.5rem; overflow-x: auto; margin: 1.5rem 0; }
        .prose pre, .prose pre code { color: #ffffff !important; }
        .toc-active { color: #3b82f6; }
        .force-white, .force-white * { color: #ffffff !important; }
      `}</style>

      <BlogNavbar />

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[360px] object-cover"
          src="/ai-outreach.png"
          alt="How to win clients and close hires using HirePilot Free plan"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-10 w-full">
            <div className="mb-3">
              <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">Playbook</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">How to Win Clients and Close Hires Using the Free Plan on HirePilot</h1>
            <p className="text-lg text-gray-200 mb-5">No excuses. No budget. Just hustle, automation, and strategy.</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg"
                alt="Author"
                className="w-10 h-10 rounded-full"
              />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on Sep 9, 2025</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div id="main-content" className="flex max-w-6xl mx-auto px-6 py-12 gap-8">
        {/* TOC */}
        <BlogTOC items={[
          { id: 'introduction', label: 'Introduction' },
          { id: 'free-forever-plan', label: 'What You Get (Free)' },
          { id: 'winning-strategy', label: 'The Winning Strategy' },
          { id: 'tool-stack', label: 'Tool Stack (Free Edition)' },
          { id: 'outreach-best-practices', label: 'Outreach Best Practices' },
          { id: 'real-example', label: 'Real Example' },
          { id: 'final-words', label: 'Final Words' },
        ]} />

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <div id="introduction">
            <p>
              What if we told you that with just the free tools in HirePilot, you could book client calls, send outbound messages at scale, get verified emails, land candidate interviews, and actually make placements? You don’t need a budget to prove you’re a great recruiter or sourcer. You need a plan. This is that plan.
            </p>
          </div>

          <div id="free-forever-plan">
            <h2>🎒 What You Get on the Free Forever Plan</h2>
            <p>Here’s what you can do right now, totally free — no credit card required:</p>
            <ul>
              <li>✅ 50 credits/month (for email enrichment, sourcing, messaging)</li>
              <li>✅ Chrome Extension for profile & search scraping</li>
              <li>✅ Manual or Automated LinkedIn + Email Messages</li>
              <li>✅ Unlimited CSV Uploads</li>
              <li>✅ 3 Active Campaigns (unlimited archived)</li>
              <li>✅ REX AI Assistant for messaging, JD parsing, sourcing</li>
              <li>✅ Slack + Email alerts for replies</li>
              <li>✅ Gmail, Outlook, or Sendgrid integrations</li>
            </ul>
            <p>That’s everything you need to get started—and succeed—without paying a dime.</p>
          </div>

          <div id="winning-strategy">
            <h2>🧠 The Winning Strategy</h2>
            <h3>1️⃣ Pick a Focus</h3>
            <ul>
              <li>Recruiting? Target startup hiring managers.</li>
              <li>Sourcing service? Target busy recruiters or founders.</li>
              <li>Freelance placement agency? Target decision-makers and top candidates.</li>
            </ul>

            <h3>2️⃣ Build 3 Campaigns</h3>
            <table className="min-w-full border border-gray-700">
              <thead>
                <tr className="bg-gray-800 force-white">
                  <th className="p-3 text-left">Campaign</th>
                  <th className="p-3 text-left">Target</th>
                  <th className="p-3 text-left">Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-700">
                  <td className="p-3">Client Outreach</td>
                  <td className="p-3">Founders, CTOs, Heads of Talent</td>
                  <td className="p-3">Book calls & offer recruiting support</td>
                </tr>
                <tr className="border-t border-gray-700">
                  <td className="p-3">Candidate Search</td>
                  <td className="p-3">Engaged candidates</td>
                  <td className="p-3">Source for open roles</td>
                </tr>
                <tr className="border-t border-gray-700">
                  <td className="p-3">Community or Passive Leads</td>
                  <td className="p-3">Pipeline building</td>
                  <td className="p-3">Grow your CRM & nurture over time</td>
                </tr>
              </tbody>
            </table>
            <p>Each campaign can have its own message sequences, credits, and sourcing rules.</p>
          </div>

          <div id="tool-stack">
            <h2>🧰 Tool Stack (Free Edition)</h2>
            <p>Combine HirePilot’s free tools with this recommended stack:</p>
            <table className="min-w-full border border-gray-700">
              <thead>
                <tr className="bg-gray-800 force-white">
                  <th className="p-3 text-left">Tool</th>
                  <th className="p-3 text-left">Use</th>
                  <th className="p-3 text-left">Free?</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-700"><td className="p-3">Apollo / Clay</td><td className="p-3">Export prospects or candidates</td><td className="p-3">✅</td></tr>
                <tr className="border-t border-gray-700"><td className="p-3">Skrapp.io / SignalHire</td><td className="p-3">Free email credits</td><td className="p-3">✅</td></tr>
                <tr className="border-t border-gray-700"><td className="p-3">Notion / Trello</td><td className="p-3">Candidate/client tracking</td><td className="p-3">✅</td></tr>
                <tr className="border-t border-gray-700"><td className="p-3">Calendly</td><td className="p-3">Booking calls</td><td className="p-3">✅</td></tr>
                <tr className="border-t border-gray-700"><td className="p-3">ChatGPT / HirePilot REX</td><td className="p-3">Message writing & JD parsing</td><td className="p-3">✅</td></tr>
                <tr className="border-t border-gray-700"><td className="p-3">LinkedIn + Chrome Ext</td><td className="p-3">Manual search + scraping</td><td className="p-3">✅</td></tr>
              </tbody>
            </table>
          </div>

          <div id="outreach-best-practices">
            <h2>📈 Outreach Best Practices (That Actually Work)</h2>
            <blockquote>“Free tools don’t mean weak results — if you play it smart.”</blockquote>

            <h3 id="segment">🔍 1. Segment Your List First</h3>
            <p>Only enrich or message people who match your job specs (for candidates), are hiring (for clients), or have signs of activity (recent LinkedIn posts, company growth).</p>
            <p>→ Use LinkedIn Sales Navigator, Apollo, or Crunchbase for signs of activity.</p>

            <h3 id="first-messages">✍️ 2. Write Better First Messages</h3>
            <p>Use this cold outreach formula (works for both clients and candidates):</p>
            <pre className="force-white"><code>{`Subject: Quick question about [role or team]

Hey [First Name] — saw you're [hiring / leading X team] at [Company].

I help [teams like yours / candidates like you] [do X in Y way].

Just curious — open to a quick intro or candidate pass-through?

Best,
[Your Name]`}</code></pre>
            <p>→ Use REX AI to personalize each version and save it as a template.</p>

            <h3 id="use-credits">🧠 3. Use Credits Strategically</h3>
            <ul>
              <li>Use 15–20 credits on enrichment (to unlock verified emails)</li>
              <li>Use 15–20 credits for LinkedIn or email sequences</li>
              <li>Save 5–10 credits for high-quality follow-ups or targeting execs</li>
            </ul>
            <p><strong>Pro Tip:</strong> Use manual messaging when possible to stretch credits further.</p>

            <h3 id="follow-ups">⏱ 4. Follow Up at Least 2x</h3>
            <ul>
              <li>Wait 2–3 days after initial message</li>
              <li>Follow up with a short “just checking” style email</li>
              <li>Include social proof or a specific offer (“I helped [X company] hire 2 engineers last month.”)</li>
            </ul>

            <h3 id="test-iterate">🧪 5. Test & Iterate</h3>
            <p>Don’t expect instant gold. Try different job titles, message tones, times of day, and channels (LinkedIn vs. Email). Use HirePilot’s campaign metrics to double down on what’s working.</p>
          </div>

          <div id="real-example">
            <h2>💼 Real Example: The Free Plan That Booked 2 Interviews</h2>
            <blockquote>“I booked 2 interviews using just the free plan.” — Sarah M., Technical Recruiter</blockquote>
            <ul>
              <li>Scraped profiles with Chrome Extension</li>
              <li>Uploaded 50 leads from LinkedIn to CSV</li>
              <li>Used 12 credits for verified emails</li>
              <li>Sent 2-step email sequence via Gmail</li>
              <li>Booked 2 intro calls → 1 turned into an offer</li>
            </ul>
            <p>Zero dollars. Real placement. Repeatable.</p>
          </div>

          <div id="final-words">
            <h2>🧭 Final Words: The Free Plan Is a Real Business Tool</h2>
            <ul>
              <li>Chrome Extension → scrape leads</li>
              <li>CSV upload → build your database</li>
              <li>Enrich → contact with verified info</li>
              <li>Message → book calls, source candidates</li>
              <li>Slack alerts → never miss a reply</li>
              <li>REX → write like a pro</li>
            </ul>
            <p>💬 And when you outgrow it? Upgrade your credits. Your data, campaigns, templates — everything stays.</p>
            <p>No fluff. Just recruiting power.</p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12 force-white">Keep Reading</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png"
                alt="Credits guide"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Billing</span>
                <h3 className="text-xl font-semibold mt-2 mb-3 force-white"><a href="/blog/CreditsGuide" className="hover:underline">How Credits Work in HirePilot</a></h3>
                <p className="text-gray-400 mb-4">Understand enrichment and messaging credits to plan your outreach.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Jul 4, 2025</span>
                  <span className="mx-2">•</span>
                  <span>5 min read</span>
                </div>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png"
                alt="Zapier guide"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Automation</span>
                <h3 className="text-xl font-semibold mt-2 mb-3 force-white"><a href="/blog/zapierguide" className="hover:underline">HirePilot + Zapier/Make</a></h3>
                <p className="text-gray-400 mb-4">Connect HirePilot to your stack and automate end-to-end workflows.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Aug 9, 2025</span>
                  <span className="mx-2">•</span>
                  <span>6 min read</span>
                </div>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png"
                alt="Agent Mode"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">AI Automation</span>
                <h3 className="text-xl font-semibold mt-2 mb-3 force-white"><a href="/blog/agentmode" className="hover:underline">Introducing Agent Mode</a></h3>
                <p className="text-gray-400 mb-4">Let REX source, message, and manage weekly campaigns for you.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Aug 26, 2025</span>
                  <span className="mx-2">•</span>
                  <span>7 min read</span>
                </div>
              </div>
            </article>
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


