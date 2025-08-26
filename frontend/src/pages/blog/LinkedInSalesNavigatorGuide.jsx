import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

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
        .dark-table th, .dark-table td { color:#ffffff !important; }
      `}</style>

      <BlogNavbar />

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
                <p className="text-gray-300 text-sm">Published on August 2, 2025</p>
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
          <div id="option1">
            <h2>🔌 Option 1: Use the Chrome Extension (Recommended)</h2>
            <p>The HirePilot Chrome Extension v2.0 is the easiest way to source and engage LinkedIn leads, giving you full control without needing manual cookie setups.</p>
            <ul>
              <li>Capture Sales Navigator search results (bulk select profiles)</li>
              <li>Pull leads into HirePilot campaigns instantly</li>
              <li>Automatically sync Name, Title, Company, LinkedIn URL</li>
              <li>Capture your LinkedIn session cookie securely (enables connection requests via HirePilot)</li>
              <li>Navigate and scrape Sales Navigator pages directly from HirePilot</li>
            </ul>
            <p><strong>👉 To get started:</strong></p>
            <ol>
              <li>Install the <strong><a href="/chromeextension" className="text-blue-400 hover:text-blue-300 underline">HirePilot Chrome Extension</a></strong> (found under Integrations → LinkedIn inside the app)</li>
              <li>Go to LinkedIn Sales Navigator</li>
              <li>Perform a targeted search (e.g., "VP of Revenue SaaS San Francisco")</li>
              <li>Open the HirePilot Extension (click the icon in your toolbar)</li>
              <li>Select the leads you want → Add to Campaign</li>
            </ol>
            <blockquote>⚡ Fastest and safest way to source + engage LinkedIn leads in real-time</blockquote>
          </div>

          <div id="option2">
            <h2>🧪 Option 2: Manually Add Your LinkedIn Cookie</h2>
            <p>If you prefer a manual setup (or are using a non-Chrome browser), you can still connect LinkedIn via session cookie.</p>
            <ol>
              <li>Open LinkedIn in Chrome</li>
              <li>Right-click anywhere → Inspect → Console tab</li>
              <li>Paste this snippet:</li>
            </ol>
            <pre><code>{`document.cookie
  .split('; ')
  .find(row => row.startsWith('li_at='))
  .split('=')[1]`}</code></pre>
            <ol start={4}>
              <li>Copy the string that appears (this is your session cookie)</li>
              <li>Paste it inside HirePilot: Settings → Integrations → LinkedIn Sales Navigator</li>
            </ol>
            <p>This allows HirePilot to act on your behalf (securely), pulling public profile data and enabling automation features like connection requests and scraping.</p>
          </div>

          <div id="comparison">
            <h2>🤔 When to Use Which Method?</h2>
            <div className="overflow-x-auto rounded-lg shadow border border-gray-700 my-6">
              <table className="dark-table text-sm">
                <thead className="bg-gray-800 text-white uppercase text-xs">
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
                    <td className="px-4 py-3">Daily sourcing, speed, automation</td>
                    <td className="px-4 py-3">Easy UI, real-time lead selection, captures cookie automatically</td>
                    <td className="px-4 py-3">Chrome only</td>
                  </tr>
                  <tr className="bg-gray-800">
                    <td className="px-4 py-3">Manual Cookie</td>
                    <td className="px-4 py-3">Advanced users, API workflows</td>
                    <td className="px-4 py-3">Cross-browser support, no extension needed</td>
                    <td className="px-4 py-3">Manual process, expires every few weeks</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div id="privacy">
            <h2>🔐 Privacy & Security</h2>
            <p>Your LinkedIn cookie is encrypted and stored securely in our backend. HirePilot uses it only for your account and only for sourcing tasks you initiate (like pulling profiles or sending invites).</p>
            <p>We never access messages, inbox, or private data — only public profile information needed for recruiting workflows.</p>
            <p>🔁 If LinkedIn logs you out or your session expires, you'll need to reconnect by re-adding the cookie (manually or via the extension).</p>
          </div>

          <div id="rex">
            <h2>💬 Ask REX for Help</h2>
            <ul>
              <li>"REX, show me how to pull leads from LinkedIn with the Chrome extension."</li>
              <li>"REX, how do I capture my LinkedIn cookie for connection requests?"</li>
              <li>"REX, give me a Boolean search string for finding SaaS sales leaders in New York."</li>
            </ul>
          </div>
        </article>
      </div>
    </>
  );
}
