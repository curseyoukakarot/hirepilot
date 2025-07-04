import React from 'react';

export default function CampaignWizardGuide() {
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
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
          alt="Campaign wizard illustration"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">Sourcing Wizard</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Using the Campaign Wizard – Apollo, LinkedIn, and Manual Sourcing</h1>
            <p className="text-xl text-gray-200 mb-6">Source high-quality leads faster with HirePilot's guided Campaign Wizard.</p>
            <div className="flex items-center space-x-4">
              <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg" alt="Author" className="w-12 h-12 rounded-full" />
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
              <a href="#launch" className="block text-gray-400 hover:text-white py-1">Step 1 – Launch Wizard</a>
              <a href="#apollo" className="block text-gray-400 hover:text-white py-1">Option 1 – Apollo</a>
              <a href="#linkedIn" className="block text-gray-400 hover:text-white py-1">Option 2 – LinkedIn</a>
              <a href="#manual" className="block text-gray-400 hover:text-white py-1">Option 3 – Manual</a>
              <a href="#tips" className="block text-gray-400 hover:text-white py-1">Pro Tips</a>
              <a href="#rex" className="block text-gray-400 hover:text-white py-1">Ask REX</a>
            </nav>
          </div>
        </div>

        {/* Article */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          {/* Launch */}
          <div id="launch">
            <h2>🧭 Step 1: Launch the Campaign Wizard</h2>
            <p>From your dashboard:</p>
            <ul>
              <li>Go to the <strong>Campaigns</strong> tab</li>
              <li>Click into a campaign you've already created (or create a new one)</li>
              <li>Hit <em>"Launch Wizard"</em> in the top right</li>
            </ul>
            <p>You'll be prompted to choose your sourcing method.</p>
          </div>

          {/* Apollo */}
          <div id="apollo">
            <h2>🚀 Option 1: Apollo Search</h2>
            <p>Apollo is a great source for verified contact data and role-based targeting.</p>
            <p><strong>To use it:</strong></p>
            <ol>
              <li>Choose <strong>Apollo</strong> from the wizard</li>
              <li>Enter your search filters (job title, company size, industry, etc.)</li>
              <li>Click <em>"Search & Preview"</em></li>
              <li>Select the leads you want to import</li>
              <li>Click <em>"Add to Campaign"</em></li>
            </ol>
            <blockquote>🧠 Already connected your Apollo API key in Settings? If not, REX will walk you through it.</blockquote>
            <h3>🧠 Tips for Apollo</h3>
            <ul>
              <li>Use specific job titles (e.g., "Director of Growth")</li>
              <li>Add keywords related to tools or experience (e.g., "SaaS" or "Series A")</li>
              <li>Combine filters for location, seniority, and company size for laser targeting</li>
            </ul>
          </div>

          {/* LinkedIn */}
          <div id="linkedIn">
            <h2>💼 Option 2: LinkedIn Sales Navigator</h2>
            <p>Perfect for sourcing directly from live LinkedIn searches.</p>
            <p>You have two choices:</p>
            <ul>
              <li>Use the Chrome Extension</li>
              <li>Or manually paste your LinkedIn session cookie</li>
            </ul>
            <p><strong>Once connected:</strong></p>
            <ol>
              <li>Paste a search URL or keyword string</li>
              <li>Click <em>"Preview Leads"</em></li>
              <li>Select and import the ones you want</li>
            </ol>
            <p>🔁 You can rerun this step whenever you have a new batch of filtered leads.</p>
          </div>

          {/* Manual */}
          <div id="manual">
            <h2>✍️ Option 3: Add Leads Manually</h2>
            <p>Just have a few names to add? No problem.</p>
            <p>Click <strong>"Manual Entry"</strong> and type in lead info line by line:</p>
            <ul>
              <li>Name</li>
              <li>Email or LinkedIn URL</li>
              <li>Title & company</li>
              <li>Tags or notes</li>
            </ul>
            <p>This is perfect for VIP candidates or leads pulled from referrals.</p>
          </div>

          {/* Tips */}
          <div id="tips">
            <h2>💡 Pro Tips</h2>
            <ul>
              <li>You can mix and match sources inside a single campaign</li>
              <li>HirePilot automatically deduplicates leads across imports</li>
              <li>Use tags to track sourcing channels (e.g., "Apollo" vs "LinkedIn")</li>
            </ul>
          </div>

          {/* Ask REX */}
          <div id="rex">
            <h2>🤖 Ask REX for Help</h2>
            <ul>
              <li>"REX, walk me through the Apollo search wizard."</li>
              <li>"REX, show me my most recently imported leads."</li>
              <li>"REX, why didn't this LinkedIn lead import correctly?"</li>
            </ul>
            <p>The Campaign Wizard gives you a guided sourcing experience with less friction, better targeting, and smarter automation.</p>
          </div>
        </article>
      </div>
    </>
  );
} 