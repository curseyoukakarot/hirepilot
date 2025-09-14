import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function HirePilotFullATS() {
  return (
    <>
      {/* Scoped styles to mirror BlogArticle format */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose p { color: #d1d5db; line-height: 1.7; margin-bottom: 1.25rem; }
        .prose ul { color: #d1d5db; margin: 1.25rem 0 1.25rem 1.25rem; list-style: disc; }
        .prose li { margin-bottom: 0.5rem; }
        .prose table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
        .prose th, .prose td { border: 1px solid #374151; padding: 0.75rem; color: #d1d5db; text-align: left; }
        .prose th { background: #111827; color: #ffffff !important; }
      `}</style>

      <BlogNavbar />

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
          alt="HirePilot ATS announcement with modern dashboard visuals"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-violet-600 text-white px-3 py-1 rounded-full text-sm font-medium">Product Update</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">HirePilot Just Became a Full ATS — And It’s Free (Yes, Really)</h1>
            <p className="text-xl text-gray-200 mb-6">One AI-powered system for sourcing, outreach, pipelines, and hiring.</p>
            <div className="flex items-center space-x-4">
              <img src="/logo.png" alt="Author" className="w-12 h-12 rounded-full" />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on Sep 14, 2025</p>
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
              You shouldn’t need 6 tools, 3 tabs, and a $30K contract to run recruiting. You need one AI-powered system. That’s why we built HirePilot.
            </p>
          </div>

          <div id="what-is-hirepilot">
            <h2>🧠 What is HirePilot?</h2>
            <p>
              HirePilot is your all-in-one Sourcing, Outreach, CRM, and ATS — powered by modern AI agents and a ridiculously powerful free plan.
            </p>
            <p>It replaces tools like:</p>
            <ul>
              <li>Lever</li>
              <li>Greenhouse</li>
              <li>Ashby</li>
              <li>Clay</li>
              <li>Salesloft / Outreach</li>
              <li>Calendly (for recruiting)</li>
              <li>PhantomBuster / TexAu / Zapier</li>
            </ul>
            <p>
              And connects it all under one AI-native operating system — complete with sourcing automations, email & LinkedIn outreach, job req collaboration, candidate pipelines, and recruiter workflows.
            </p>
          </div>

          <div id="full-recruiting-flow">
            <h2>🔄 The Full Recruiting Flow — Now in One System</h2>
            <p>Here’s what you can now do start to finish in HirePilot:</p>

            <h3>1) Source Candidates (No Extensions Needed)</h3>
            <ul>
              <li>🔍 Run searches using Apollo or LinkedIn Sales Navigator</li>
              <li>🧠 Use REX (our AI agent) to find & filter leads based on your job</li>
              <li>⚡ Capture lead info with our Chrome Extension or SalesNav scraper</li>
              <li>✨ Enrich profiles automatically (email, phone, title, etc.)</li>
            </ul>

            <h3>2) Outreach That Actually Works</h3>
            <ul>
              <li>📩 Choose Email or LinkedIn outreach (or both)</li>
              <li>🧠 Use AI to write high-converting messages based on job + candidate</li>
              <li>🕰 Schedule follow-ups with reply detection + auto-threading</li>
              <li>🔁 Send from your sender (Gmail, Outlook, or SendGrid)</li>
              <li>📈 Track replies, click rates, and real-time activity logs</li>
            </ul>

            <h3>3) Convert to Candidate Instantly</h3>
            <ul>
              <li>✅ One click → move a lead into your candidate pipeline</li>
              <li>📥 All past messages + profile data stay linked</li>
              <li>🔁 Candidate shows up in your job pipeline + CRM</li>
              <li>💬 Add internal notes, tags, and enriched data (title, industry, etc.)</li>
            </ul>

            <h3>4) Job Collaboration Made Simple</h3>
            <ul>
              <li>📄 Create job requisitions (reqs) with custom traits and details</li>
              <li>🧑‍🤝‍🧑 Invite team members or guests (unlimited) to collaborate</li>
              <li>🗂 Link candidates to the job automatically</li>
              <li>🗣 Share comments, notes, and pipeline status live</li>
            </ul>

            <h3>5) Public Jobs + Application Flow</h3>
            <ul>
              <li>🌐 Each job gets a public application page (hosted by HirePilot)</li>
              <li>📝 Collect resume, cover letter, LinkedIn, contact info</li>
              <li>📁 Auto-upload resumes + store in the candidate profile</li>
              <li>🔔 Recruiters get notified instantly (Slack/email/Zapier)</li>
            </ul>

            <h3>6) Pipeline Management + Stages</h3>
            <ul>
              <li>📊 Custom pipeline stages per job</li>
              <li>🧩 Drag-and-drop candidate stage movement</li>
              <li>👀 Filter, sort, and manage across jobs in a single view</li>
              <li>🪪 All activity logged and searchable in your CRM</li>
            </ul>
          </div>

          <div id="integrations">
            <h2>⚙️ Missing Feature? Use Integrations.</h2>
            <p>We’re honest about where we’re still building.</p>
            <p>Don’t see:</p>
            <ul>
              <li>🟡 Candidate scoring or interview feedback? → Use tags, notes, and Slack/Zapier triggers to collect feedback automatically.</li>
              <li>🟡 Offer letters or hireflow? → Trigger DocuSign, Stripe invoicing, or onboarding via Make.com/Zapier in a few clicks.</li>
            </ul>
            <p>Everything is API-ready and automation-friendly. You’re never locked in.</p>
          </div>

          <div id="free-plan">
            <h2>💸 All This… for Free?</h2>
            <p>
              YES. 90% of what’s listed above is included in the Free Forever Plan. No trial. No credit card. No usage limit traps.
            </p>
            <p>
              Because we believe modern recruiting software should be accessible, not gatekept by overpriced tools.
            </p>
          </div>

          <div id="comparison">
            <h2>🥊 How HirePilot Compares to Other ATSs</h2>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Feature / Platform</th>
                    <th>Lever</th>
                    <th>Greenhouse</th>
                    <th>Ashby</th>
                    <th>HirePilot</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Sourcing tools</td><td>❌ External tools needed</td><td>❌</td><td>❌</td><td>✅ Built-in</td></tr>
                  <tr><td>Chrome extension</td><td>❌</td><td>❌</td><td>❌</td><td>✅</td></tr>
                  <tr><td>LinkedIn + Apollo sourcing</td><td>❌</td><td>❌</td><td>❌</td><td>✅</td></tr>
                  <tr><td>AI agents (sourcing, outreach)</td><td>❌</td><td>❌</td><td>❌</td><td>✅</td></tr>
                  <tr><td>Email + LinkedIn outreach</td><td>❌</td><td>❌</td><td>❌</td><td>✅</td></tr>
                  <tr><td>Job req management</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
                  <tr><td>Guest collaboration</td><td>❌</td><td>❌</td><td>✅</td><td>✅ Unlimited</td></tr>
                  <tr><td>Public job board + app flow</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
                  <tr><td>Custom pipelines</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
                  <tr><td>Candidate CRM + logs</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
                  <tr><td>Interview feedback</td><td>✅</td><td>✅</td><td>✅</td><td>🟡 Zapier workaround</td></tr>
                  <tr><td>Scheduling</td><td>✅</td><td>✅</td><td>✅</td><td>✅ With integrations + REX</td></tr>
                  <tr><td>Offer/hire flow</td><td>✅</td><td>✅</td><td>✅</td><td>🟡 Zapier + DocuSign</td></tr>
                  <tr><td>Analytics</td><td>✅</td><td>✅</td><td>✅</td><td>🟡 Early-stage</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div id="bottom-line">
            <h2>🎯 The Bottom Line</h2>
            <p>HirePilot is the only platform that gives you:</p>
            <ul>
              <li>✅ Full ATS</li>
              <li>✅ CRM</li>
              <li>✅ Chrome Extension</li>
              <li>✅ AI agents</li>
              <li>✅ Outreach tools</li>
              <li>✅ Public job board</li>
              <li>✅ Candidate pipelines</li>
              <li>✅ Automations & integrations</li>
              <li>✅ All for free</li>
            </ul>
            <p>If you’re a freelance recruiter, talent agency, or startup, this is your unfair advantage.</p>

            {/* CTA */}
            <div className="bg-violet-600 rounded-lg p-6 my-8 text-center">
              <h3 className="text-xl font-semibold mb-2 text-white">✨ Ready to Try It?</h3>
              <p className="mb-4 text-violet-100">Start for Free Today. No credit card. Just results.</p>
              <a href="/signup" className="inline-block bg-white text-violet-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">Start for Free</a>
            </div>
          </div>
        </article>
      </div>
    </>
  );
}


