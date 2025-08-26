import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';

export default function ApolloIntegrationGuide() {
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
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png"
          alt="Apollo integration illustration"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-sm font-medium">Product Guide</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">How to Use Apollo with HirePilot – Setup, Keyword Tips, and Shared Access</h1>
            <p className="text-xl text-gray-200 mb-6">Connect Apollo to source high-quality candidates in seconds.</p>
            <div className="flex items-center space-x-4">
              <img src="/blog-icon.png" alt="Author" className="w-12 h-12 rounded-full" />
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
        <BlogTOC />

        {/* Article */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          {/* Intro already in hero title; begin with connect */}
          <div id="connect">
            <h2>🔌 Step 1: Connect Apollo to HirePilot</h2>
            <p>To use Apollo inside HirePilot:</p>
            <ol>
              <li>Go to <strong>Settings → Integrations</strong></li>
              <li>Click <em>"Connect Apollo"</em></li>
              <li>Paste your <strong>Apollo API Key</strong></li>
            </ol>
            <p>You can generate this key in your Apollo dashboard here:<br />→ <a href="https://app.apollo.io/settings/integrations/api" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Apollo API Access</a></p>
            <p>Once connected, you'll be able to:</p>
            <ul>
              <li>Use the Campaign Wizard to pull leads from Apollo</li>
              <li>Search by job title, industry, keywords, and more</li>
              <li>Import leads directly into any campaign</li>
            </ul>
          </div>

          {/* Keyword tips */}
          <div id="keywords">
            <h2>🧠 Step 2: Smart Apollo Keyword Searches</h2>
            <p>HirePilot pulls leads using Apollo's filters — but your keyword strategy matters. Here are some best practices:</p>
            <h3>✅ Job Titles</h3>
            <p>Use exact match and variation terms:</p>
            <ul>
              <li><code>"Product Manager"</code> → also try <code>"PM"</code> or <code>"Product Owner"</code></li>
            </ul>
            <h3>✅ Seniority + Function</h3>
            <p>Try combining:</p>
            <ul>
              <li>VP Marketing + Demand Gen</li>
              <li>Recruiter + Technical + Staffing</li>
            </ul>
            <h3>✅ Industry &amp; Tools</h3>
            <p>Target by niche:</p>
            <ul>
              <li><code>"Healthcare SaaS"</code> + <code>"Epic EMR"</code></li>
              <li><code>"Salesforce"</code> + <code>"RevOps"</code></li>
            </ul>
            <blockquote>Bonus Tip: Ask REX — "Write me an Apollo search string for a Head of Growth at a Series A startup in Fintech."</blockquote>
          </div>

          {/* Shared key */}
          <div id="shared">
            <h2>🧩 Step 3: Using Your Own vs. HirePilot's Apollo Key</h2>
            <p>Depending on your account type, you may have access to a shared Apollo account managed by HirePilot.</p>
            <h3>🔐 If You're a RecruitPro or Admin:</h3>
            <ul>
              <li>You can use the built-in HirePilot Apollo key</li>
              <li>This gives you limited free lead pulls as part of your plan</li>
              <li>Ideal for non-technical users or those without their own Apollo account</li>
            </ul>
            <h3>👤 If You Use Your Own Apollo Key:</h3>
            <ul>
              <li>You get full access to your Apollo plan's limits</li>
              <li>More flexibility and visibility into search filters and credits</li>
              <li>Great for power users</li>
            </ul>
            <h3>💡 How to Switch</h3>
            <p>You can switch your Apollo source anytime in:<br />→ <strong>Settings → Integrations → Apollo</strong></p>
            <p>HirePilot will default to your own key if present. If not, it'll fall back to the shared key (if you're eligible).</p>
          </div>

          {/* Field Tips */}
          <div id="field-tips">
            <h2>🚀 Tips from the Field</h2>
            <ul>
              <li>🔁 Use <em>"Update leads"</em> to refresh job titles and company info</li>
              <li>✨ Combine Apollo data with REX for automated lead enrichment</li>
              <li>🧪 Use Apollo with the Campaign Wizard to generate leads faster</li>
            </ul>
            <p>Ask REX:</p>
            <ul>
              <li>"Pull 20 Apollo leads for my SDR campaign."</li>
              <li>"Who are the top matches for my job in this campaign?"</li>
              <li>"How many Apollo credits do I have left?"</li>
            </ul>
          </div>
        </article>
      </div>
    </>
  );
} 