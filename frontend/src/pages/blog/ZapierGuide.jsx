import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function ZapierGuide() {
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
        .prose figure { margin: 1.25rem 0 1.5rem; }
        .prose figcaption { color: #9ca3af; font-size: 0.875rem; margin-top: 0.5rem; text-align: center; }
        .toc-active { color: #3b82f6; }
        /* Force-white utility for key code/text blocks */
        .force-white, .force-white * { color: #ffffff !important; }
        #related-articles h3 { color: #ffffff !important; }
      `}</style>

      <BlogNavbar />

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[360px] object-cover"
          src="/ai-outreach.png"
          alt="Zapier and Make integration with HirePilot"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-10 w-full">
            <div className="mb-3">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">Integrations</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">HirePilot + Zapier/Make: Your No-Code Recruiting Superpowers</h1>
            <p className="text-lg text-gray-200 mb-5">Connect HirePilot to Slack, Sheets, CRMs and more — automate recruiting workflows in minutes without code.</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg"
                alt="Author"
                className="w-10 h-10 rounded-full"
              />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on {new Date().toLocaleDateString()}</p>
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
          { id: 'step-1', label: 'Step 1 – Grab Your API Key' },
          { id: 'step-2', label: 'Step 2 – What You Can Automate' },
          { id: 'step-3', label: 'Step 3 – Trigger Endpoints' },
          { id: 'step-4', label: 'Step 4 – Action Endpoints' },
          { id: 'step-5', label: 'Step 5 – Example Workflows' },
          { id: 'step-6', label: 'Step 6 – Zapier Setup' },
          { id: 'step-7', label: 'Step 7 – Make.com Setup' },
          { id: 'step-8', label: 'Step 8 – Pro Tips' },
          { id: 'step-9', label: 'Step 9 – Real-World Automations' },
          { id: 'step-10', label: 'Step 10 – Let REX Help' },
          { id: 'conclusion', label: 'Conclusion' },
        ]} />

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <div id="introduction">
            <p>
              If you’ve ever wished HirePilot could magically talk to the rest of your tools — Slack, Google Sheets, HubSpot, Trello, you name it — Zapier and Make make it happen. With a few clicks, you can trigger automations when new leads arrive, candidates move through your pipeline, or messages get replies… all without writing a single line of code.
            </p>
            <p>
              This is your practical, step-by-step guide to connecting HirePilot to Zapier or Make, unlocking time-saving workflows in minutes.
            </p>
          </div>

          <div id="step-1">
            <h2>Step 1 – Grab Your API Key</h2>
            <p>
              Think of your API key like your VIP pass — it’s what lets Zapier/Make talk securely to your HirePilot account. In HirePilot, go to <strong>Settings → Integrations → Zapier/Make</strong>, click <strong>Generate API Key</strong>, and copy it somewhere safe — you’ll paste this into your automations later.
            </p>
            <p>You’ll use it in an HTTP header like this:</p>
            <pre className="force-white">
              <code>{`Header name: X-API-Key\nHeader value: YOUR_API_KEY`}</code>
            </pre>
            <figure>
              <img src="/api_key_watermarked.png" alt="HirePilot integration screen showing Generate API Key and events list" className="rounded-lg border border-gray-800 w-full" />
              <figcaption>This is where you generate your API key inside HirePilot.</figcaption>
            </figure>
            <p className="text-gray-400">Pro tip: You can revoke or regenerate this key anytime from the same screen.</p>
          </div>

          <div id="step-2">
            <h2>Step 2 – What You Can Automate</h2>
            <p>HirePilot sends events and accepts actions so you can build almost any recruiting workflow you can imagine.</p>
            <h3>Leads & Candidates</h3>
            <ul className="force-white">
              <li><code>lead_created</code>, <code>lead_updated</code>, <code>lead_converted</code>, <code>lead_enriched</code></li>
              <li><code>candidate_created</code>, <code>candidate_hired</code>, <code>candidate_rejected</code></li>
            </ul>
            <h3>Pipeline Stages</h3>
            <ul className="force-white">
              <li><code>candidate_pipeline_stage_changed</code></li>
              <li>Auto events like <code>candidate_moved_to_phone_screen</code>, <code>candidate_interviewed</code>, <code>candidate_offered</code></li>
            </ul>
            <h3>Messaging & Email Signals</h3>
            <ul className="force-white">
              <li><code>message_sent</code>, <code>message_reply</code></li>
              <li><code>email_opened</code>, <code>email_clicked</code>, <code>email_bounced</code></li>
            </ul>
          </div>

          <div id="step-3">
            <h2>Step 3 – Trigger Endpoints</h2>
            <p>Zapier and Make can “poll” HirePilot for new events.</p>
            <h3>Universal Events (recommended)</h3>
            <pre className="force-white">
              <code>{`GET https://api.thehirepilot.com/api/zapier/triggers/events`}</code>
            </pre>
            <p>Optional filters:</p>
            <pre className="force-white">
              <code>{`?event_type=lead_created\n?since=2025-01-01T00:00:00Z`}</code>
            </pre>
            <p>Always include your API key in the header.</p>
          </div>

          <div id="step-4">
            <h2>Step 4 – Action Endpoints</h2>
            <p>Want to make HirePilot do something from your automation?</p>
            <h3>Create/Update Lead</h3>
            <pre className="force-white">
              <code>{`POST https://api.thehirepilot.com/api/zapier/leads`}</code>
            </pre>
            <p>Headers:</p>
            <pre className="force-white">
              <code>{`Content-Type: application/json\nX-API-Key: YOUR_API_KEY`}</code>
            </pre>
            <p>Body:</p>
            <pre className="force-white">
              <code>{`{ "email": "alex@acme.com", "first_name": "Alex", "last_name": "Chen", "company": "Acme" }`}</code>
            </pre>
            <h3>Enrich Lead (Apollo)</h3>
            <pre className="force-white">
              <code>{`POST https://api.thehirepilot.com/api/zapier/enrich`}</code>
            </pre>
            <p>Body:</p>
            <pre className="force-white">
              <code>{`{ "lead_id": "LEAD_UUID" }`}</code>
            </pre>
            <p>Or:</p>
            <pre className="force-white">
              <code>{`{ "email": "alex@acme.com" }`}</code>
            </pre>
          </div>

          <div id="step-5">
            <h2>Step 5 – Example Workflows</h2>
            <ul>
              <li><strong>New Lead → Slack Alert + Google Sheet:</strong> Log and broadcast every new lead instantly.</li>
              <li><strong>Form Submission → Create Lead:</strong> Turn website signups into leads automatically.</li>
              <li><strong>Auto-Enrich Lead → Notify via Slack:</strong> Enrichment completes → notify the owner.</li>
              <li><strong>Pipeline Stage Change → Create Task:</strong> Keep interview tasks in sync.</li>
              <li><strong>Email Reply → Mark as High Interest:</strong> Bubble up hot replies to the top.</li>
            </ul>
          </div>

          <div id="step-6">
            <h2>Step 6 – Zapier Setup (Polling Trigger)</h2>
            <ol className="list-decimal pl-6">
              <li>Select <strong>Webhooks by Zapier</strong> as the trigger app.</li>
              <li>Choose <strong>Retrieve Poll</strong> for polling GET requests.</li>
              <li>Paste the universal events URL:</li>
            </ol>
            <pre className="force-white">
              <code>{`https://api.thehirepilot.com/api/zapier/triggers/events?event_type=lead_created&since={{zap_meta_human_now}}`}</code>
            </pre>
            <p>Add your API key to the Headers section (<code>X-API-Key</code>).</p>
            <figure>
              <img src="/zapier_trigger_watermarked.png" alt="Zapier Webhooks trigger setup with Retrieve Poll" className="rounded-lg border border-gray-800 w-full" />
              <figcaption>This is where you choose “Retrieve Poll” in Zapier’s Webhooks.</figcaption>
            </figure>
          </div>

          <div id="step-7">
            <h2>Step 7 – Make.com Setup (Trigger)</h2>
            <ol className="list-decimal pl-6">
              <li>Create a new scenario.</li>
              <li>Select the <strong>Webhooks</strong> module.</li>
              <li>Choose <strong>Custom webhook</strong> for GET events.</li>
              <li>Add the events URL and API key in the header.</li>
            </ol>
            <figure>
              <img src="/make_trigger_watermarked.png" alt="Make.com Webhooks module selection for Custom webhook" className="rounded-lg border border-gray-800 w-full" />
              <figcaption>This is the Webhooks module in Make.com where you select your trigger.</figcaption>
            </figure>
          </div>

          <div id="step-8">
            <h2>Step 8 – Pro Tips</h2>
            <ul>
              <li>Keep your API key private — rotate if it’s exposed.</li>
              <li>Use filters while testing to avoid mass triggers.</li>
              <li>Poll every 10–15 minutes for fresh data without overload.</li>
              <li>Read error messages — HirePilot’s API tells you what went wrong.</li>
            </ul>
          </div>

          <div id="step-9">
            <h2>Step 9 – Real-World Recruiting Automations</h2>
            <ul>
              <li><strong>New Lead → Enrich → Slack + CRM:</strong> Instantly enrich leads and DM your team top fields (role, location, email confidence).</li>
              <li><strong>Candidate Moved to Interview → Prep Docs:</strong> Auto-create interview checklists and events.</li>
              <li><strong>Candidate Hired → Onboard in HR Tools:</strong> Provision accounts, send welcome emails, open IT tickets.</li>
              <li><strong>Email Reply → Priority Escalation:</strong> Route high-intent replies to a Slack channel with a quick-assignment button.</li>
              <li><strong>Engagement Dashboard:</strong> Log all events into Sheets or BI tools for pipeline analytics.</li>
            </ul>
          </div>

          <div id="step-10">
            <h2>Step 10 – Let REX Do the Heavy Lifting</h2>
            <p>Don’t want to build it all yourself? Ask REX in your HirePilot chat:</p>
            <pre className="force-white">
              <code>{`"Test my lead_created Zap"\n"Send an event to my Zapier webhook"`}</code>
            </pre>
            <p>REX can fire events to your Zaps or Make scenarios, enrich leads, post summaries to Slack, and chain multi-step actions automatically.</p>
          </div>

          {/* CTA */}
          <div className="bg-blue-600 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2 text-white">Build your recruiting engine — no code required</h3>
            <p className="mb-4 text-blue-100">Connect HirePilot to Zapier or Make and automate your hiring pipeline today.</p>
            <a href="/pricing" className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block">Start Free</a>
          </div>

          <div id="conclusion">
            <h2>Conclusion</h2>
            <p>
              With HirePilot + Zapier/Make, you’re not just connecting apps — you’re building a recruiting engine that runs while you sleep. The only limit is your imagination.
            </p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Keep Reading</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png"
                alt="Zapier automation examples"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Automation</span>
                <h3 className="text-xl font-semibold mt-2 mb-3 force-white"><a href="/blog/AutomateRecruiting1" className="hover:underline">5 Automation Recipes for Talent Teams</a></h3>
                <p className="text-gray-400 mb-4">Steal these plug-and-play workflows to accelerate your recruiting ops.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>April 2, 2025</span>
                  <span className="mx-2">•</span>
                  <span>6 min read</span>
                </div>
              </div>
            </article>
            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png"
                alt="Recruiting analytics dashboard"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Analytics</span>
                <h3 className="text-xl font-semibold mt-2 mb-3 force-white"><a href="/blog/AutomateRecruiting5" className="hover:underline">Build an Engagement Dashboard in Sheets</a></h3>
                <p className="text-gray-400 mb-4">Pipe your events into Sheets or BI tools for instant visibility.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>March 28, 2025</span>
                  <span className="mx-2">•</span>
                  <span>5 min read</span>
                </div>
              </div>
            </article>
            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png"
                alt="Interview process automation"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Best Practices</span>
                <h3 className="text-xl font-semibold mt-2 mb-3 force-white"><a href="/blog/AutomateRecruiting4" className="hover:underline">Automating Interview Prep with Checklists</a></h3>
                <p className="text-gray-400 mb-4">Turn pipeline stage changes into organized interview prep.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>March 22, 2025</span>
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
