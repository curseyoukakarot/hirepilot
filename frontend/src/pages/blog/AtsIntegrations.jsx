import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function AtsIntegrations() {
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
          alt="HirePilot integrations with Greenhouse, Lever, and Ashby via Zapier and webhooks"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-10 w-full">
            <div className="mb-3">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">Integrations</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Integrating HirePilot with Greenhouse, Lever, and Ashby via Zapier & Webhooks</h1>
            <p className="text-lg text-gray-200 mb-5">Step-by-step guide to connect your ATS to HirePilot using Zapier, webhooks, and native triggers.</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg"
                alt="Author"
                className="w-10 h-10 rounded-full"
              />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on Aug 29, 2025</p>
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
          { id: 'greenhouse', label: 'Greenhouse → HirePilot' },
          { id: 'lever', label: 'Lever → HirePilot' },
          { id: 'ashby', label: 'Ashby → HirePilot' },
          { id: 'bonus-automations', label: 'Bonus Automations' },
          { id: 'final-notes', label: 'Final Notes' },
        ]} />

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <div id="introduction">
            <p>
              HirePilot's flexible REST API enables you to integrate directly with the world’s top applicant tracking systems (ATS), including <strong>Greenhouse</strong>, <strong>Lever</strong>, and <strong>Ashby</strong>. In this guide, we’ll walk you step-by-step through how to connect each ATS to HirePilot using Zapier, webhooks, and HirePilot’s native event triggers.
            </p>
          </div>

          <div id="greenhouse">
            <h2>🟢 INTEGRATION: Greenhouse → HirePilot</h2>

            <h3>✨ Use Case</h3>
            <p>When a new candidate applies via Greenhouse, create a new lead in HirePilot, enrich it via Apollo, and optionally trigger a Slack notification or campaign.</p>

            <h3>✅ Prerequisites</h3>
            <ul>
              <li>Greenhouse account (admin access)</li>
              <li>Zapier account</li>
              <li>HirePilot Pro or Team plan (for API access)</li>
              <li>Your HirePilot API key (from Settings → Integrations)</li>
            </ul>

            <h3>🔧 Step-by-Step Setup</h3>
            <h4>Step 1: Configure Greenhouse Webhooks</h4>
            <ol className="list-decimal pl-6">
              <li>Log into Greenhouse → Admin → Dev Center → Web Hooks</li>
              <li>Click "+ Web Hook" and configure:</li>
            </ol>
            <ul>
              <li><strong>When</strong>: <code>Candidate has been created</code></li>
              <li><strong>Endpoint URL</strong>: Create a new Zapier Zap with a webhook trigger (see next step), then copy the Zapier Webhook URL here.</li>
              <li><strong>Secret Key</strong>: Leave blank or use a shared secret if desired.</li>
            </ul>
            <p>Save Webhook.</p>

            <h4>Step 2: Create a New Zap in Zapier</h4>
            <ol className="list-decimal pl-6">
              <li><strong>Trigger App</strong>: Webhooks by Zapier → Trigger: <strong>Catch Hook</strong></li>
              <li>Copy the generated webhook URL and paste it into Greenhouse (from Step 1).</li>
              <li>Test the webhook by creating a dummy candidate in Greenhouse.</li>
            </ol>

            <h4>Step 3: Parse Greenhouse Candidate Data</h4>
            <ol className="list-decimal pl-6">
              <li>Add a <strong>Code by Zapier</strong> step (JavaScript)</li>
              <li>Use the code block to parse <code>first_name</code>, <code>last_name</code>, <code>email</code>, <code>company</code>, and LinkedIn URL (if available)</li>
            </ol>
            <pre className="force-white">
              <code>{`return {
  email: inputData.candidate.email,
  first_name: inputData.candidate.first_name,
  last_name: inputData.candidate.last_name,
  company: inputData.candidate.current_company,
  linkedin_url: inputData.candidate.linkedin_profile
};`}</code>
            </pre>

            <h4>Step 4: Send to HirePilot</h4>
            <ol className="list-decimal pl-6">
              <li><strong>App</strong>: Webhooks by Zapier</li>
              <li>Action: <strong>Custom Request</strong></li>
              <li>Method: <strong>POST</strong></li>
              <li>URL: <code>https://thehirepilot.com/api/zapier/leads</code></li>
              <li>Headers:</li>
            </ol>
            <pre className="force-white">
              <code>{`{\n  "X-API-Key": "YOUR_HIREPILOT_API_KEY",\n  "Content-Type": "application/json"\n}`}</code>
            </pre>
            <p>Body (raw JSON):</p>
            <pre className="force-white">
              <code>{`{\n  "email": "{{email}}",\n  "first_name": "{{first_name}}",\n  "last_name": "{{last_name}}",\n  "company": "{{company}}",\n  "linkedin_url": "{{linkedin_url}}"\n}`}</code>
            </pre>

            <h4>Step 5 (Optional): Enrich the Lead Automatically</h4>
            <ol className="list-decimal pl-6">
              <li>Add another <strong>Custom Request</strong> step to POST to <code>/api/zapier/enrich</code></li>
              <li>Body:</li>
            </ol>
            <pre className="force-white">
              <code>{`{\n  "email": "{{email}}"\n}`}</code>
            </pre>

            <h4>Step 6 (Optional): Send Slack Notification</h4>
            <p>Add Slack step → Send message to a channel with parsed lead details and enrichment status.</p>
          </div>

          <div id="lever">
            <h2>🟠 INTEGRATION: Lever → HirePilot</h2>

            <h3>✨ Use Case</h3>
            <p>When a new opportunity or candidate is added to Lever, create or update a lead in HirePilot.</p>

            <h3>✅ Prerequisites</h3>
            <ul>
              <li>Lever account (admin)</li>
              <li>Zapier account</li>
              <li>HirePilot API key</li>
            </ul>

            <h3>🔧 Step-by-Step Setup</h3>
            <h4>Step 1: Set Up Zapier Trigger</h4>
            <ol className="list-decimal pl-6">
              <li>Create a new Zap</li>
              <li>Trigger: <strong>Lever</strong> → Event: <code>Candidate Stage Change</code> or <code>New Candidate</code></li>
              <li>Authenticate your Lever account</li>
              <li>Test to fetch sample data</li>
            </ol>

            <h4>Step 2: Filter for Active Stages (Optional)</h4>
            <p>Use the Zapier Filter step to ensure only specific pipeline stages (e.g., “Applied”) are sent to HirePilot.</p>

            <h4>Step 3: Transform Data (if needed)</h4>
            <p>Use a <strong>Formatter</strong> or <strong>Code</strong> step to extract fields like:</p>
            <ul>
              <li><code>email</code> → from <code>emails[0].value</code></li>
              <li><code>name</code> → split into <code>first_name</code> / <code>last_name</code></li>
              <li><code>LinkedIn URL</code> → from tags or fields</li>
            </ul>

            <h4>Step 4: POST to HirePilot</h4>
            <p>Same steps as above: POST to <code>/api/zapier/leads</code>. Follow with optional enrich + Slack notification if desired.</p>
          </div>

          <div id="ashby">
            <h2>🔵 INTEGRATION: Ashby → HirePilot</h2>

            <h3>✨ Use Case</h3>
            <p>Trigger HirePilot actions when a new application is submitted or a candidate is moved to a new stage in Ashby.</p>

            <h3>✅ Prerequisites</h3>
            <ul>
              <li>Ashby account</li>
              <li>Zapier account or custom webhook relay (e.g., Make.com)</li>
              <li>HirePilot API key</li>
            </ul>

            <h3>🔧 Step-by-Step Setup</h3>
            <h4>Step 1: Enable Ashby Webhook</h4>
            <p>Ashby allows creating webhooks via their admin panel or API. Contact support if webhooks are not visible.</p>
            <ul>
              <li>Event Type: <code>application.created</code> or <code>candidate.stage_updated</code></li>
              <li>Endpoint: Zapier Catch Hook URL</li>
            </ul>

            <h4>Step 2: Create Zapier Zap (Same as Greenhouse Flow)</h4>
            <ul>
              <li>Trigger: <strong>Webhook → Catch Hook</strong></li>
              <li>Parse the payload via Code by Zapier or Formatter</li>
              <li>Map fields to: <code>email</code>, <code>first_name</code>, <code>last_name</code>, <code>linkedin_url</code>, <code>job_title</code> / <code>company</code></li>
            </ul>

            <h4>Step 3: POST to HirePilot → Create Lead</h4>
            <p>Same as previous integrations.</p>

            <h4>Step 4 (Optional): Enrich & Slack</h4>
            <p>Same as above.</p>
          </div>

          <div id="bonus-automations">
            <h2>🔁 BONUS AUTOMATIONS</h2>

            <h3>🧠 Automatically Enrich Leads + Trigger Campaign</h3>
            <ol className="list-decimal pl-6">
              <li>Enrich the lead</li>
              <li>Assign to a HirePilot campaign</li>
              <li>Trigger outbound messaging</li>
            </ol>

            <h3>📅 Sync Interview Scheduling</h3>
            <p>Trigger HirePilot → Notion, Google Calendar, or CRM when candidate stage changes (e.g., “Interview Scheduled”).</p>

            <h3>📊 Auto-reporting to Slack</h3>
            <p>Set up a daily or weekly Zap to poll <code>/api/zapier/triggers/events?event_type=lead_created</code> and summarize into a Slack message.</p>
          </div>

          <div id="final-notes">
            <h2>✅ Final Notes</h2>
            <ul>
              <li>Always test webhooks using sample candidate data</li>
              <li>Use Zapier’s “Replay” feature to resend past test events</li>
              <li>Use HirePilot’s <code>/api/zapier/triggers/events</code> to fetch past or missed updates</li>
              <li>Consider creating a fallback in Make.com if Zapier rate limits or lacks a connector</li>
            </ul>
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
                <h3 className="text-xl font-semibold mt-2 mb-3"><a href="/blog/zapierguide" className="hover:underline">HirePilot + Zapier/Make: No-Code Recruiting Superpowers</a></h3>
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
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png"
                alt="Recruiting analytics dashboard"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Analytics</span>
                <h3 className="text-xl font-semibold mt-2 mb-3"><a href="/blog/AutomateRecruiting5" className="hover:underline">Build an Engagement Dashboard in Sheets</a></h3>
                <p className="text-gray-400 mb-4">Pipe your events into Sheets or BI tools for pipeline analytics.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Mar 28, 2025</span>
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
                <h3 className="text-xl font-semibold mt-2 mb-3"><a href="/blog/AutomateRecruiting4" className="hover:underline">Automating Interview Prep with Checklists</a></h3>
                <p className="text-gray-400 mb-4">Turn pipeline stage changes into organized interview prep.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Mar 22, 2025</span>
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


