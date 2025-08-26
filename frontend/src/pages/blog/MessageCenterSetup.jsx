import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';

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
              <img src="/blog-icon.png" alt="Author" className="w-12 h-12 rounded-full" />
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
        <BlogTOC />

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          {/* Why Connect */}
          <div id="why">
            <h2>✉️ Message Center Setup: Connect Gmail, Outlook, and SendGrid to HirePilot</h2>
            <p>HirePilot’s Message Center lets you send personalized outreach to leads and candidates — at scale — using your own email address, all while keeping deliverability high and your brand front-and-center.</p>
            <p>This guide will walk you through:</p>
            <ul>
              <li>Connecting Gmail or Outlook</li>
              <li>Setting up SendGrid for transactional or high-volume sending</li>
              <li>Testing and optimizing your connection for best results</li>
            </ul>
            <hr className="my-6 border-gray-700" />
          </div>

          {/* Step 1 provider */}
          <div id="choose-provider">
            <h2>🔐 Step 1: Choose Your Email Provider</h2>
            <p>When you first open the Message Center, you’ll be prompted to choose your sending method:</p>
            <ul>
              <li>Gmail (Google Workspace or personal Gmail)</li>
              <li>Outlook (Microsoft 365 or Outlook.com)</li>
            </ul>
            <p>Click <em>Connect Account</em> and follow the OAuth prompt to authorize HirePilot.</p>
            <blockquote>✅ Security note: HirePilot never stores your email credentials. We use secure, fully verified OAuth scopes to send on your behalf.</blockquote>
            <hr className="my-6 border-gray-700" />
          </div>

          {/* Gmail verified */}
          <div id="gmail-verified">
            <h2>💡 No More Gmail Warnings</h2>
            <p>HirePilot’s Gmail connection is now Google-verified, meaning you’ll see the standard Google permissions screen — no “unverified app” warnings, no advanced click-throughs. Just connect and start sending.</p>
            <hr className="my-6 border-gray-700" />
          </div>

          {/* Step 2 SendGrid */}
          <div id="sendgrid">
            <h2>📨 Step 2: (Optional) Connect SendGrid</h2>
            <p>For high-volume outreach or transactional emails (e.g., confirmations, reminders), you can send via your own SendGrid account. This is especially helpful for:</p>
            <ul>
              <li>Large-scale cold outreach</li>
              <li>Automated transactional notifications</li>
              <li>HirePilot’s done-for-you outreach service</li>
            </ul>
            <p>To connect:</p>
            <ol>
              <li>Go to <strong>Settings</strong> → <strong>Integrations</strong> → <strong>SendGrid</strong></li>
              <li>Paste your <strong>SendGrid API Key</strong></li>
              <li>Set your default sending domain</li>
            </ol>
            <p>
              Need help creating a SendGrid API key? → <a href="https://docs.sendgrid.com/for-developers/sending-email/api-getting-started" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Official SendGrid Docs</a>
            </p>
            <hr className="my-6 border-gray-700" />
          </div>

          {/* Step 3 test */}
          <div id="test">
            <h2>⚙️ Step 3: Test Your Connection</h2>
            <p>Once connected:</p>
            <ol>
              <li>Open the Message Center</li>
              <li>Compose a quick test email to yourself</li>
              <li>Send from your connected Gmail, Outlook, or SendGrid account</li>
              <li>Check for delivery, open tracking, and reply handling</li>
            </ol>
            <p>You’re now ready to use personalized templates and automated sequences inside your campaigns.</p>
            <hr className="my-6 border-gray-700" />
          </div>

          {/* Security + Pro tips */}
          <div id="security">
            <h2>🛡 What Happens Under the Hood</h2>
            <p>We know connecting your email is a big trust decision — here’s how we protect it:</p>
            <ul>
              <li><strong>OAuth-Only Authentication</strong> — Your credentials never touch our servers. Instead, Gmail/Outlook give us a secure access token.</li>
              <li><strong>Scoped Access</strong> — We only request the minimum permissions needed to send messages, read replies, and track opens.</li>
              <li><strong>Automatic Token Refresh</strong> — Tokens are securely renewed before they expire, so your connection stays live without re-entering passwords.</li>
              <li><strong>No Password Storage</strong> — We physically cannot see, log, or store your email password.</li>
              <li><strong>Revocable Anytime</strong> — You can revoke access instantly from HirePilot or directly inside your Google/Microsoft account security settings.</li>
            </ul>
            <p>This means you stay in control of your account at all times.</p>
            <hr className="my-6 border-gray-700" />
          </div>

          <div id="pro-tips">
            <h2>💬 Pro Tips for Best Results</h2>
            <ul>
              <li>✅ Switch between Gmail, Outlook, or SendGrid anytime in Settings</li>
              <li>✉️ Warm up any new sending domain before high-volume outreach (tools like Mailflow or Instantly work great)</li>
              <li>🤖 Ask REX for help crafting outreach or troubleshooting issues</li>
            </ul>
            <p>Ask REX:</p>
            <ul>
              <li>“How do I improve deliverability for cold outreach?”</li>
              <li>“What’s the best time of day to send?”</li>
              <li>“Write me a 3-step outreach sequence for a SaaS founder.”</li>
            </ul>
          </div>
        </article>
      </div>
    </>
  );
} 