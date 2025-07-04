import React from 'react';

export default function MeetRexGuide() {
  return (
    <>
      {/* Scoped styles */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose p { color: #d1d5db; line-height: 1.7; margin-bottom: 1.5rem; }
        .prose ul { color: #d1d5db; margin: 1.5rem 0; }
        .prose li { margin-bottom: 0.5rem; }
        .prose blockquote { border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 2rem 0; font-style: italic; color: #9ca3af; }
      `}</style>

      {/* Breadcrumb */}
      <div className="bg-gray-800 py-4" id="breadcrumb">
        <div className="max-w-6xl mx-auto px-6">
          <a href="/blog" className="flex items-center transition-colors">
            <i className="fa-solid fa-arrow-left mr-2" />
            Back to Blog
          </a>
        </div>
      </div>

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/copilot-hero.gif"
          alt="REX AI recruiting copilot illustration"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium">AI Copilot</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Meet REX – Your AI Recruiting Copilot and Support Assistant</h1>
            <p className="text-xl text-gray-200 mb-6">Source faster, write smarter, and automate recruiting with REX inside HirePilot.</p>
            <div className="flex items-center space-x-4">
              <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-7.jpg" alt="Author" className="w-12 h-12 rounded-full" />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on July 4, 2025</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div id="main-content" className="flex max-w-6xl mx-auto px-6 py-12 gap-8">
        {/* TOC */}
        <div id="toc-sidebar" className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-8">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Table of Contents</h3>
            <nav className="space-y-2">
              <a href="#what" className="block text-gray-400 hover:text-white py-1">What Can REX Do?</a>
              <a href="#knowledge" className="block text-gray-400 hover:text-white py-1">Where REX Gets Knowledge</a>
              <a href="#ask" className="block text-gray-400 hover:text-white py-1">What to Ask REX</a>
              <a href="#tools" className="block text-gray-400 hover:text-white py-1">Built-In Tools</a>
              <a href="#access" className="block text-gray-400 hover:text-white py-1">Who Has Access</a>
              <a href="#future" className="block text-gray-400 hover:text-white py-1">Future of Recruiting</a>
            </nav>
          </div>
        </div>

        {/* Article */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          {/* What can REX do */}
          <div id="what">
            <h2>🚀 What Can REX Do?</h2>
            <p>REX is deeply integrated with your HirePilot workspace. It can:</p>
            <ul>
              <li>Recommend leads from your existing campaigns</li>
              <li>Enrich lead profiles using external tools like Apollo or Proxycurl</li>
              <li>Generate outreach messages tailored to your job req and candidate</li>
              <li>Trigger automations (like follow-ups or webhook calls)</li>
              <li>Answer support questions such as:
                <ul>
                  <li>"How do I import a CSV?"</li>
                  <li>"Where do I connect Apollo?"</li>
                  <li>"What does this error mean?"</li>
                </ul>
              </li>
            </ul>
          </div>

          {/* Knowledge source */}
          <div id="knowledge">
            <h2>🧠 Where Does REX Get Its Knowledge?</h2>
            <p>REX uses:</p>
            <ul>
              <li>Your campaigns, leads, and candidates</li>
              <li>HirePilot's help center articles (like this one!)</li>
              <li>Tools and actions wired into your account</li>
              <li>Enrichment data from Apollo, LinkedIn, Proxycurl, and more</li>
            </ul>
            <p>As we expand our content library, REX gets smarter every week.</p>
          </div>

          {/* Ask examples */}
          <div id="ask">
            <h2>💬 What Can I Ask REX?</h2>
            <h3>🔎 Sourcing</h3>
            <ul>
              <li>"REX, who are the top 5 leads in my SDR campaign?"</li>
              <li>"REX, enrich this lead with a personal email." (charges credits)</li>
              <li>"REX, filter my leads for product managers in healthcare."</li>
            </ul>
            <h3>✉️ Messaging</h3>
            <ul>
              <li>"Write a 3-step cold email sequence for this candidate."</li>
              <li>"Create a follow-up message for someone who opened but didn't reply."</li>
            </ul>
            <h3>⚙️ Support</h3>
            <ul>
              <li>"How do I connect my Gmail account?"</li>
              <li>"Where do I paste my Apollo API key?"</li>
              <li>"What does 'message failed to send' mean?"</li>
            </ul>
          </div>

          {/* Tools */}
          <div id="tools">
            <h2>🔧 Built-In Tools REX Can Trigger</h2>
            <p>REX has access to powerful tools — and it's always learning more. Here's what it can do automatically (based on your prompts):</p>
            <ul>
              <li>Export a list of leads to Clay</li>
              <li>Trigger a Zapier webhook</li>
              <li>Run a Make.com workflow</li>
              <li>Look up personal emails or phone numbers (credit-based)</li>
              <li>Fetch your active campaigns or pipeline stats</li>
              <li>Open Help Center articles or videos</li>
            </ul>
            <blockquote>🧠 REX will <strong>always confirm</strong> actions before using credits or changing data.</blockquote>
          </div>

          {/* Access */}
          <div id="access">
            <h2>🔒 Who Has Access to REX?</h2>
            <p>REX is available to:</p>
            <ul>
              <li>Super Admins</li>
              <li>RecruitPro accounts</li>
              <li>Team Admins</li>
            </ul>
            <p>If you're eligible, you'll see a REX button in the top nav bar or side drawer.</p>
            <p>Want access? Reach out to <a className="text-blue-400 underline" href="mailto:support@thehirepilot.com">support@thehirepilot.com</a>.</p>
          </div>

          {/* Future */}
          <div id="future">
            <h2>🪄 The Future of Recruiting is Here</h2>
            <p>REX isn't just a chatbot. It's a recruiting command center that understands your workflows, helps you scale, and cuts your time-to-hire in half.</p>
            <p>Ask it anything. Automate everything. Let REX run point.</p>
          </div>
        </article>
      </div>
    </>
  );
} 