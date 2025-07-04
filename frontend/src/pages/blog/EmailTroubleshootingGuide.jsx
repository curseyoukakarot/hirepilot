import React from 'react';

export default function EmailTroubleshootingGuide() {
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
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png"
          alt="Email troubleshooting illustration"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">Email</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Troubleshooting Email Sending — Gmail, Outlook & SendGrid Fixes</h1>
            <p className="text-xl text-gray-200 mb-6">Quickly diagnose and fix the most common email issues in HirePilot.</p>
            <div className="flex items-center space-x-4">
              <img src="/blog-icon.png" alt="Author" className="w-12 h-12 rounded-full" />
              <div>
                <p className="font-semibold text-white">HirePilot Support</p>
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
              <a href="#how" className="block text-gray-400 hover:text-white py-1">How Email Sending Works</a>
              <a href="#gmail" className="block text-gray-400 hover:text-white py-1">Gmail Fixes</a>
              <a href="#outlook" className="block text-gray-400 hover:text-white py-1">Outlook Fixes</a>
              <a href="#sendgrid" className="block text-gray-400 hover:text-white py-1">SendGrid Fixes</a>
              <a href="#tips" className="block text-gray-400 hover:text-white py-1">General Tips</a>
              <a href="#rex" className="block text-gray-400 hover:text-white py-1">Ask REX</a>
            </nav>
          </div>
        </div>

        {/* Article */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          {/* How email works */}
          <div id="how">
            <h2>🧩 First: Understand How Email Sending Works in HirePilot</h2>
            <p>When you send messages via the Message Center, HirePilot uses one of three connected methods:</p>
            <div className="overflow-x-auto rounded-lg shadow border border-gray-700 my-6">
              <table className="text-gray-200 text-sm">
                <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
                  <tr><th className="px-4 py-3">Method</th><th className="px-4 py-3">Used For</th></tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-900"><td className="px-4 py-3">Gmail</td><td className="px-4 py-3">Personal or Workspace Gmail accounts</td></tr>
                  <tr className="bg-gray-800"><td className="px-4 py-3">Outlook</td><td className="px-4 py-3">Microsoft 365 and Outlook.com</td></tr>
                  <tr className="bg-gray-900"><td className="px-4 py-3">SendGrid</td><td className="px-4 py-3">High-volume or transactional emails</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Gmail */}
          <div id="gmail">
            <h2>🔐 Gmail Troubleshooting</h2>
            <h3>❌ "Google hasn't verified this app"</h3>
            <p>This is common if you're using a Gmail account with an unverified app.</p>
            <p><strong>✅ Solution:</strong></p>
            <ol>
              <li>When you see the warning screen, click <em>"Advanced"</em></li>
              <li>Then click <em>"Go to thehirepilot.com (unsafe)"</em></li>
              <li>Complete the OAuth steps normally</li>
            </ol>
            <p>🔁 This only needs to be done once, unless you revoke permissions.</p>
            <h3>❌ Messages Not Sending</h3>
            <p>Often caused by expired tokens or permission issues.</p>
            <p><strong>✅ Solution:</strong></p>
            <ul>
              <li>Go to <em>Settings → Integrations</em></li>
              <li>Click <strong>"Disconnect Gmail"</strong> and then reconnect</li>
              <li>Ensure the correct email is selected during re-auth</li>
            </ul>
            <p className="italic">📽 Video Coming Soon: walkthrough on bypassing Gmail verification and reconnecting.</p>
          </div>

          {/* Outlook */}
          <div id="outlook">
            <h2>📧 Outlook Troubleshooting</h2>
            <h3>❌ Outlook Not Authenticating</h3>
            <p>This usually means Microsoft 365 permissions need to be refreshed.</p>
            <p><strong>✅ Solution:</strong></p>
            <ul>
              <li>Disconnect and reconnect your Outlook account</li>
              <li>Make sure you're logged into the right Microsoft account in your browser</li>
              <li>Approve all requested permissions during login</li>
            </ul>
          </div>

          {/* SendGrid */}
          <div id="sendgrid">
            <h2>✉️ SendGrid Troubleshooting</h2>
            <h3>❌ "Failed to Send" or 400/401 errors</h3>
            <p>Usually caused by:</p>
            <ul>
              <li>Invalid or expired API key</li>
              <li>Missing verified domain in SendGrid</li>
            </ul>
            <p><strong>✅ Solution:</strong></p>
            <ol>
              <li>Log into your SendGrid dashboard</li>
              <li>Generate a new API key with full permissions</li>
              <li>In HirePilot, go to <em>Settings → Integrations → SendGrid</em></li>
              <li>Paste the new API key</li>
            </ol>
            <p>🧪 Also make sure your sending domain is verified inside <em>SendGrid → Settings → Sender Authentication</em></p>
          </div>

          {/* General tips */}
          <div id="tips">
            <h2>💡 General Tips</h2>
            <ul>
              <li>✅ Always test with a single email first before launching a campaign</li>
              <li>✅ Keep Gmail and Outlook integrations refreshed (especially if you've changed passwords)</li>
              <li>✅ For bulk sending, consider using SendGrid to reduce risk of blocks</li>
            </ul>
          </div>

          {/* REX */}
          <div id="rex">
            <h2>🤖 Ask REX</h2>
            <ul>
              <li>"REX, help me fix Gmail message errors."</li>
              <li>"REX, did my message to Jordan get delivered?"</li>
              <li>"REX, reconnect my Outlook account."</li>
              <li>"REX, test my SendGrid API key."</li>
            </ul>
            <p>Stuck or need help fast? Email us at <a className="text-blue-400 underline" href="mailto:support@thehirepilot.com">support@thehirepilot.com</a> — or just ask REX. He's on call 24/7.</p>
          </div>
        </article>
      </div>
    </>
  );
} 