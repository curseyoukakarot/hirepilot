import React from 'react';

export default function AutomateRecruiting3() {
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
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png"
          alt="AI-powered messaging dashboard with personalized email sequences and automation"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">AI Messaging</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Automate Your Recruiting with HirePilot + REX</h1>
            <p className="text-xl text-gray-200 mb-6">Part 3: AI Messaging and Outreach at Scale — Send Smart, Personalized Emails with REX</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg"
                alt="Author"
                className="w-12 h-12 rounded-full"
              />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on January 17, 2025</p>
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
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">AI Outreach Assistant</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Message Sequences</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Deliverability</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Personalization</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Reply Automation</span>
              <span className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Before vs After</span>
            </nav>
          </div>
        </div>

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <div id="introduction">
            <p>
              You've sourced great leads. Now it's time to connect.
            </p>

            <p>
              But writing and sending outreach is where most recruiters get stuck in the weeds:
            </p>

            <ul>
              <li>Personalizing each message manually</li>
              <li>Managing clunky mail merge tools</li>
              <li>Forgetting to follow up</li>
              <li>Losing track of what was sent, when, and to whom</li>
            </ul>

            <blockquote>
              With HirePilot + REX, all of that is automated — in your tone, your voice, and your flow.
            </blockquote>
          </div>

          <div id="ai-outreach">
            <h2>🧠 Your AI Outreach Assistant</h2>

            <p>With REX, you can:</p>

            <ul>
              <li>Generate multi-step cold outreach sequences</li>
              <li>Choose between tones like "casual" or "professional"</li>
              <li>Reference the role and candidate's profile</li>
              <li>Automatically send through Gmail, Outlook, or SendGrid</li>
            </ul>

            <h3>💬 Example Prompts:</h3>

            <blockquote>
              "REX, write a 3-step cold email for this SDR campaign."<br/><br/>
              "REX, send a follow-up to anyone who opened but didn't reply."<br/><br/>
              "REX, write a casual intro message for this lead."
            </blockquote>
          </div>

          {/* Inline CTA 1 */}
          <div id="inline-cta-1" className="bg-green-600 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Ready to Automate Your Outreach?</h3>
            <p className="mb-4">Start your free trial and let REX write personalized messages for your campaigns.</p>
            <button className="bg-white text-green-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">Start Free Trial</button>
          </div>

          <div id="message-sequences">
            <h2>🔁 Message Sequences That Follow Through</h2>

            <p>REX will generate:</p>

            <ol>
              <li><strong>Intro Email</strong> (personalized with name, title, company)</li>
              <li><strong>Follow-Up #1</strong> (e.g., 2–3 days later if no reply)</li>
              <li><strong>Final Nudge</strong> (friendly bump after 1 week)</li>
            </ol>

            <p>You can:</p>

            <ul>
              <li>Edit the copy before sending</li>
              <li>Track opens and replies</li>
              <li>Reuse sequences across campaigns</li>
            </ul>

            <blockquote>
              And all of this respects your credit balance + message limits.
            </blockquote>
          </div>

          <div id="deliverability">
            <h2>✨ Deliverability, Solved</h2>

            <p>You can send from:</p>

            <ul>
              <li><strong>Gmail or Outlook</strong> (via OAuth connection)</li>
              <li><strong>SendGrid</strong> (for higher volume)</li>
            </ul>

            <p>REX will:</p>

            <ul>
              <li>Handle token refresh + errors</li>
              <li>Choose the right sender (per campaign or per user)</li>
              <li>Pause if the lead lacks an email or you're out of credits</li>
            </ul>
          </div>

          <div id="personalization">
            <h2>🎯 Personalization Without the Pain</h2>

            <p>Every message includes:</p>

            <ul>
              <li>Smart tokens like <code>{first_name}</code>, <code>{company}</code>, <code>{title}</code></li>
              <li>Role-specific phrasing</li>
              <li>Optional value prop inserts</li>
            </ul>

            <p>🧠 And you can prompt REX to tweak the tone:</p>

            <blockquote>
              "Make this sound more executive."<br/><br/>
              "Make it shorter and friendlier."<br/><br/>
              "Rewrite this with a stronger CTA."
            </blockquote>
          </div>

          {/* Inline CTA 2 */}
          <div id="inline-cta-2" className="bg-gray-800 border border-gray-700 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Want to See REX Write Messages?</h3>
            <p className="mb-4">Chat with REX now and watch it generate personalized outreach sequences.</p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Chat with REX</button>
          </div>

          <div id="reply-automation">
            <h2>💬 Replies That Trigger Action</h2>

            <p>REX monitors replies — and can automatically:</p>

            <ul>
              <li>Convert a lead to a candidate</li>
              <li>Move them to the next pipeline stage</li>
              <li>Notify you via Slack</li>
            </ul>

            <p>You stay focused on real conversations. REX handles the grunt work.</p>
          </div>

          <div id="comparison">
            <h2>✅ What's Automated at the Messaging Stage?</h2>

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
                  <td>Writing intros</td>
                  <td>❌ 1-by-1 in Gmail</td>
                  <td>✅ Prompt-based generation</td>
                </tr>
                <tr>
                  <td>Following up</td>
                  <td>❌ Calendar or CRM</td>
                  <td>✅ Smart sequences</td>
                </tr>
                <tr>
                  <td>Sending</td>
                  <td>❌ External tools</td>
                  <td>✅ In-app Message Center</td>
                </tr>
                <tr>
                  <td>Personalization</td>
                  <td>❌ Merge tags + templates</td>
                  <td>✅ Context-aware AI</td>
                </tr>
                <tr>
                  <td>Tracking</td>
                  <td>❌ Spreadsheets</td>
                  <td>✅ Open/reply tracking</td>
                </tr>
                <tr>
                  <td>Managing replies</td>
                  <td>❌ Manual</td>
                  <td>✅ REX auto-converts or alerts you</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div id="feature-spotlight">
            <h2>🛠 Feature Spotlight</h2>

            <ul>
              <li>✅ Message Center with scheduling</li>
              <li>✅ REX tone + sequence generator</li>
              <li>✅ SendGrid + Gmail integration</li>
              <li>✅ Credit-aware sending logic</li>
              <li>✅ Slack notifications (via Zapier)</li>
            </ul>
          </div>

          <div id="next-up">
            <h2>👉 Next Up</h2>

            <p><strong>Part 4 – Managing Your Pipeline + Automating Your Workflows</strong></p>

            <p>You'll see how REX moves candidates, triggers actions, and keeps your hiring flow alive.</p>
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
            </article>

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
                  <span>Coming Soon</span>
                  <span className="mx-2">•</span>
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
          <h2 className="text-3xl font-bold mb-4">Don't Miss Part 4</h2>
          <p className="text-xl mb-8 text-blue-100">Get notified when we publish the pipeline automation and workflow integration guide</p>
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