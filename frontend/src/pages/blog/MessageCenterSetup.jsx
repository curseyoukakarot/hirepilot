import React from 'react';

export default function MessageCenterSetup() {
  return (
    <>
      {/* Scoped styles (reuse from BlogArticle) */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose p { color: #d1d5db; line-height: 1.7; margin-bottom: 1.5rem; }
        .prose ul { color: #d1d5db; margin: 1.5rem 0; }
        .prose li { margin-bottom: 0.5rem; }
        .prose blockquote { border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 2rem 0; font-style: italic; color: #9ca3af; }
        .toc-active { color: #3b82f6; }
      `}</style>

      {/* Breadcrumb */}
      <div className="bg-gray-800 py-4" id="breadcrumb">
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
          alt="Email integration illustration"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">Product Guide</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Message Center Setup – Connecting Gmail, Outlook, and SendGrid</h1>
            <p className="text-xl text-gray-200 mb-6">Learn how to power your HirePilot outreach by linking your own email providers.</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg"
                alt="Author"
                className="w-12 h-12 rounded-full"
              />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on July 4, 2025</p>
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
              <a href="#why" className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Why Connect</a>
              <a href="#choose-provider" className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Step 1 – Choose Provider</a>
              <a href="#gmail-issue" className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Gmail Permissions</a>
              <a href="#sendgrid" className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Step 2 – SendGrid</a>
              <a href="#test" className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Step 3 – Test Connection</a>
              <a href="#pro-tips" className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Pro Tips</a>
            </nav>
          </div>
        </div>

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          {/* Why Connect */}
          <div id="why">
            <h2>✉️ Message Center Setup: Connect Gmail, Outlook, and SendGrid to HirePilot</h2>
            <p>HirePilot's <strong>Message Center</strong> gives you the power to send personalized outreach messages to leads and candidates — at scale — using your own email address.</p>
            <p>This guide walks you through how to:</p>
            <ul>
              <li>Connect Gmail or Outlook</li>
              <li>Set up SendGrid for transactional messaging</li>
              <li>Troubleshoot common issues (especially with Gmail permissions)</li>
            </ul>
          </div>

          {/* Step 1 provider */}
          <div id="choose-provider">
            <h2>🔐 Step 1: Choose Your Email Provider</h2>
            <p>When you open the Message Center for the first time, you'll be asked to choose:</p>
            <ul>
              <li><strong>Gmail</strong> (Google Workspace or personal)</li>
              <li><strong>Outlook</strong> (Microsoft 365 or Outlook.com)</li>
            </ul>
            <p>Click <em>Connect Account</em>, and follow the OAuth prompt to authorize access.</p>
            <blockquote>✅ HirePilot never stores your email credentials — we use secure OAuth scopes to send on your behalf.</blockquote>
          </div>

          {/* Gmail issue */}
          <div id="gmail-issue">
            <h2>💡 Gmail Permissions Issue? Read This.</h2>
            <p>Sometimes Google flags HirePilot's Gmail connection as "unverified." This is temporary and only affects apps in testing or early deployment phases.</p>
            <p>If you see:</p>
            <blockquote>"Google hasn't verified this app"</blockquote>
            <p>
              Click <em>Advanced</em> → "<em>Go to thehirepilot.com (unsafe)</em>" → proceed anyway.
            </p>
            <p>🛠 We're working with Google to get fully verified. In the meantime, this is safe and common for new apps using Gmail APIs.</p>
            <p className="italic">🔗 (Video walkthrough coming soon – you'll be able to view it here)</p>
          </div>

          {/* Step 2 SendGrid */}
          <div id="sendgrid">
            <h2>📨 Step 2: (Optional) Connect SendGrid</h2>
            <p>HirePilot can also send messages through your <strong>SendGrid</strong> account for better deliverability and faster sending — especially useful for:</p>
            <ul>
              <li>High-volume outreach</li>
              <li>Transactional emails (like confirmations or reminders)</li>
              <li>Done-for-you outreach services</li>
            </ul>
            <p>To connect:</p>
            <ol>
              <li>Go to the <strong>Integrations</strong> tab in <em>Settings</em></li>
              <li>Paste your <strong>SendGrid API Key</strong></li>
              <li>Set your default sending domain</li>
            </ol>
            <p>
              Need help generating a SendGrid API key?
              <br />→ <a href="https://docs.sendgrid.com/for-developers/sending-email/api-getting-started" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Official SendGrid Docs</a>
            </p>
          </div>

          {/* Step 3 test */}
          <div id="test">
            <h2>⚙️ Step 3: Test Your Connection</h2>
            <p>Once connected, go to the <strong>Message Center</strong>:</p>
            <ul>
              <li>Compose a test message to yourself</li>
              <li>Try sending from your connected Gmail/Outlook account</li>
              <li>Check for delivery, open tracking, and reply handling</li>
            </ul>
            <p>You're now ready to use personalized templates and automated sequences tied to your Campaigns!</p>
          </div>

          {/* Pro tips */}
          <div id="pro-tips">
            <h2>💬 Pro Tips</h2>
            <ul>
              <li>✅ You can switch between Gmail, Outlook, or SendGrid anytime in your Settings</li>
              <li>✉️ Always warm up your email account before high-volume outreach (use tools like Mailflow or Instantly)</li>
              <li>🤖 <strong>REX</strong> can help you craft messages or troubleshoot connection issues</li>
            </ul>
            <p>Ask REX:</p>
            <ul>
              <li>"How do I fix the Gmail permissions error?"</li>
              <li>"What's the best time to send cold outreach emails?"</li>
              <li>"Generate a 3-step outreach sequence for my campaign."</li>
            </ul>
          </div>
        </article>
      </div>
    </>
  );
} 