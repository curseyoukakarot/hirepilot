import React from 'react';

export default function LinkedInSalesNavigatorGuide() {
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
        table { width:100%; }
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
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png"
          alt="LinkedIn Sales Navigator illustration"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-teal-600 text-white px-3 py-1 rounded-full text-sm font-medium">Product Guide</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Using LinkedIn Sales Navigator – Chrome Extension vs Manual Cookie</h1>
            <p className="text-xl text-gray-200 mb-6">Pull leads from LinkedIn into HirePilot using the method that fits your workflow.</p>
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
        <div id="toc-sidebar" className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-8">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Table of Contents</h3>
            <nav className="space-y-2">
              <a href="#option1" className="block text-gray-400 hover:text-white py-1">Option 1 – Chrome Extension</a>
              <a href="#option2" className="block text-gray-400 hover:text-white py-1">Option 2 – Manual Cookie</a>
              <a href="#comparison" className="block text-gray-400 hover:text-white py-1">When to Use Each</a>
              <a href="#privacy" className="block text-gray-400 hover:text-white py-1">Privacy & Security</a>
              <a href="#rex" className="block text-gray-400 hover:text-white py-1">Ask REX</a>
            </nav>
          </div>
        </div>

        {/* Article */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          {/* Intro provided in hero */}

          {/* Option 1 */}
          <div id="option1">
            <h2>🔌 Option 1: Use the Chrome Extension (Recommended)</h2>
            <p>HirePilot has a lightweight Chrome extension that lets you:</p>
            <ul>
              <li>Pull leads directly from Sales Navigator search results</li>
              <li>Select specific profiles to add to a campaign</li>
              <li>Sync data (name, title, company, profile link) with one click</li>
            </ul>
            <p><strong>👉 To get started:</strong></p>
            <ol>
              <li>Install the <strong>HirePilot Chrome Extension</strong><br />(You'll find the link inside the app under <em>Integrations → LinkedIn</em>)</li>
              <li>Open LinkedIn Sales Navigator</li>
              <li>Perform your search (e.g., "VP of Marketing, SaaS, Austin")</li>
              <li>Click the HirePilot extension</li>
              <li>Select leads → Add to campaign</li>
            </ol>
            <blockquote>⚡ <strong>Fastest</strong> way to add leads from LinkedIn in real-time</blockquote>
          </div>

          {/* Option 2 */}
          <div id="option2">
            <h2>🧪 Option 2: Manually Add Your Session Cookie</h2>
            <p>If you prefer not to use the Chrome extension (or are using a different browser or OS), you can still connect LinkedIn manually.</p>
            <p>Here's how:</p>
            <ol>
              <li>Open LinkedIn in Chrome</li>
              <li>Right-click the page → <em>Inspect</em> → open the <strong>Console</strong></li>
              <li>Paste this snippet and hit Enter:</li>
            </ol>
            <pre><code>{`document.cookie
  .split('; ')
  .find(row => row.startsWith('li_at='))
  .split('=')[1]`}</code></pre>
            <ol start={4}>
              <li>Copy the string that appears — this is your session cookie</li>
              <li>Paste it inside HirePilot:<br /> <em>Settings → Integrations → LinkedIn Sales Navigator</em></li>
            </ol>
            <p>🧠 This lets HirePilot make requests on your behalf and pull profile data</p>
          </div>

          {/* Comparison */}
          <div id="comparison">
            <h2>🤔 When to Use Which Method?</h2>
            <div className="overflow-x-auto rounded-lg shadow border border-gray-700 my-6">
              <table className="text-gray-200 text-sm">
                <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Best For</th>
                    <th className="px-4 py-3">Pros</th>
                    <th className="px-4 py-3">Cons</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-900">
                    <td className="px-4 py-3">Chrome Extension</td>
                    <td className="px-4 py-3">Daily use, speed</td>
                    <td className="px-4 py-3">Easy UI, real-time selection</td>
                    <td className="px-4 py-3">Chrome only</td>
                  </tr>
                  <tr className="bg-gray-800">
                    <td className="px-4 py-3">Manual Cookie</td>
                    <td className="px-4 py-3">Advanced users, API tools</td>
                    <td className="px-4 py-3">Works across platforms</td>
                    <td className="px-4 py-3">Must refresh every few weeks</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Privacy */}
          <div id="privacy">
            <h2>🔐 Privacy &amp; Security</h2>
            <p>Your cookie is stored securely and encrypted in our backend. HirePilot never uses it outside your account and cannot access your messages or private data — only public profile info needed for sourcing.</p>
            <p>🔁 If LinkedIn logs you out or your cookie expires, you'll need to re-add it.</p>
          </div>

          {/* Ask REX */}
          <div id="rex">
            <h2>💬 Ask REX for Help</h2>
            <ul>
              <li>"REX, how do I find my LinkedIn cookie?"</li>
              <li>"REX, show me the best leads from my LinkedIn campaign."</li>
              <li>"REX, which method is better for fast sourcing?"</li>
            </ul>
          </div>
        </article>
      </div>
    </>
  );
} 