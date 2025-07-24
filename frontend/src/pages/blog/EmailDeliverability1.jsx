import React from 'react';

export default function EmailDeliverability1() {
  return (
    <>
      {/* Scoped styles preserved from original article page */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose p { color: #d1d5db; line-height: 1.7; margin-bottom: 1.5rem; }
        .prose ul { color: #d1d5db; margin: 1.5rem 0; }
        .prose li { margin-bottom: 0.5rem; }
        .prose blockquote { border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 2rem 0; font-style: italic; color: #9ca3af; }
        .prose code { background: #374151; color: #f9fafb; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.875rem; }
        .prose pre { background: #1f2937; padding: 1.5rem; border-radius: 0.5rem; overflow-x: auto; margin: 2rem 0; }
        .prose table { width: 100%; border-collapse: collapse; margin: 2rem 0; }
        .prose th, .prose td { border: 1px solid #374151; padding: 0.75rem; text-align: left; }
        .prose th { background: #374151; color: #f9fafb; font-weight: 600; }
        .prose td { color: #d1d5db; }
        .toc-active { color: #3b82f6; }
      `}</style>

      {/* Breadcrumb */}
      <div id="breadcrumb" className="bg-gray-800 py-4">
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
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
          alt="Email deliverability dashboard showing spam warnings and reputation metrics"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">Email Deliverability</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">The #1 Mistake Recruiters Make When Sending Emails at Scale</h1>
            <p className="text-xl text-gray-200 mb-6">Spoiler: It's sending 200+ cold emails from Gmail or Outlook without any safeguards. Learn why this destroys your domain reputation and what to do instead.</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg"
                alt="Author"
                className="w-12 h-12 rounded-full"
              />
                              <div>
                  <p className="font-semibold text-white">HirePilot Team</p>
                  <p className="text-gray-300 text-sm">Published on July 24, 2025 • Part 1 of 5</p>
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
              <a href="#why-this-matters" className="block text-gray-400 hover:text-white transition-colors py-1">Why This Matters</a>
              <a href="#domain-reputation" className="block text-gray-400 hover:text-white transition-colors py-1">What Is Domain Reputation?</a>
              <a href="#gmail-outlook-limits" className="block text-gray-400 hover:text-white transition-colors py-1">Gmail & Outlook Limits</a>
              <a href="#sendgrid-solution" className="block text-gray-400 hover:text-white transition-colors py-1">The Smarter Way: SendGrid</a>
              <a href="#action-plan" className="block text-gray-400 hover:text-white transition-colors py-1">Your Action Plan</a>
              <a href="#pro-tip" className="block text-gray-400 hover:text-white transition-colors py-1">Pro Tip</a>
              <a href="#next-up" className="block text-gray-400 hover:text-white transition-colors py-1">Next Up</a>
            </nav>
          </div>
        </div>

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <div id="why-this-matters">
            <h2>🚨 Why This Matters</h2>
            <p>
              If you're new to HirePilot and excited to launch your first campaign, you might be tempted to blast out 100–200+ messages in a single day using your personal Gmail or Outlook account.
            </p>

            <p><strong>Don't.</strong></p>

            <p>
              Doing this is like shouting through a megaphone in a library — you'll not only get ignored, you'll get kicked out.
            </p>

            <p>In email terms?</p>
            <ul>
              <li>You'll get flagged</li>
              <li>Your account may be suspended</li>
              <li>And worst of all — your domain reputation could be permanently damaged</li>
            </ul>
          </div>

          <div id="domain-reputation">
            <h2>🛡️ What Is Domain Reputation?</h2>
            <p>
              Think of your email domain (e.g. yourcompany.com) as your digital sender identity. Mail providers like Gmail, Outlook, and Yahoo track how people respond to your emails — and judge whether you're trustworthy.
            </p>

            <p>Negative signals include:</p>
            <ul>
              <li><strong>High bounce rate</strong> (bad or fake email addresses)</li>
              <li><strong>No engagement</strong> (opens, clicks, replies)</li>
              <li><strong>Spam complaints</strong> (recipients mark it as junk)</li>
              <li><strong>Sudden spike in volume</strong> (e.g. sending 200 emails in 5 minutes)</li>
            </ul>

            <p>
              If these pile up, your domain can land on blacklists, which block your emails entirely — even if you're sending legitimate follow-ups later.
            </p>
          </div>

          {/* Inline CTA 1 */}
          <div id="inline-cta-1" className="bg-blue-600 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Protect Your Email Reputation Today</h3>
            <p className="mb-4">Connect SendGrid to HirePilot and start sending emails the professional way.</p>
            <a href="/login" className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block">Setup SendGrid Integration</a>
          </div>

          <div id="gmail-outlook-limits">
            <h2>📉 Why Gmail & Outlook Are Not Built for Volume</h2>
            <p>
              Gmail and Outlook were designed for personal and business communication — not bulk outreach. Here's what happens when you push their limits:
            </p>

            <table>
              <thead>
                <tr>
                  <th style={{color: '#ffffff !important', backgroundColor: 'inherit', fontWeight: 'bold !important', textShadow: 'none !important'}}>Platform</th>
                  <th style={{color: '#ffffff !important', backgroundColor: 'inherit', fontWeight: 'bold !important', textShadow: 'none !important'}}>Max Daily Sends</th>
                  <th style={{color: '#ffffff !important', backgroundColor: 'inherit', fontWeight: 'bold !important', textShadow: 'none !important'}}>Common Spam Triggers</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Gmail</td>
                  <td>~500/day (soft cap)</td>
                  <td>Too many identical emails, sending too fast</td>
                </tr>
                <tr>
                  <td>Outlook</td>
                  <td>~300/day (varies by account)</td>
                  <td>Links to the same domain, large sends to new contacts</td>
                </tr>
              </tbody>
            </table>

            <p>
              You might still be able to send 500 messages from Gmail… once. But try doing that 3 days in a row? You'll likely be throttled, blocked, or banned.
            </p>
          </div>

          <div id="sendgrid-solution">
            <h2>📦 The Smarter Way: Use a Dedicated Email Sending Service</h2>
            <p>
              This is where SendGrid comes in — a professional-grade email infrastructure provider that's built to handle scale, deliverability, and reputation management.
            </p>

            <p>SendGrid helps you:</p>
            <ul>
              <li>Authenticate your domain (SPF, DKIM, DMARC)</li>
              <li>Send at scale without blacklisting</li>
              <li>Track bounces, spam complaints, and open rates</li>
              <li>Throttle email sends automatically to avoid spikes</li>
            </ul>

            <p>
              When integrated into HirePilot, SendGrid becomes your safe engine for outbound messaging. No more guessing if your Gmail account is about to get suspended.
            </p>
          </div>

          {/* Inline CTA 2 */}
          <div id="inline-cta-2" className="bg-gray-800 border border-gray-700 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2" style={{color: '#ffffff !important', filter: 'brightness(10) contrast(10)', WebkitTextFillColor: '#ffffff !important', textShadow: '0 0 0 #ffffff !important'}}>Need Help with SendGrid Setup?</h3>
            <p className="mb-4" style={{color: '#ffffff !important', filter: 'brightness(10) contrast(10)', WebkitTextFillColor: '#ffffff !important', textShadow: '0 0 0 #ffffff !important'}}>Chat with REX, our AI assistant, for step-by-step guidance on email deliverability.</p>
            <a href="/login" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block">Chat with REX</a>
          </div>

          <div id="action-plan">
            <h2>✅ Your Action Plan (Beginner Friendly)</h2>
            <ol>
              <li><strong>Stop using Gmail/Outlook for bulk outreach</strong> — reserve it for replies and manual emails.</li>
              <li><strong>Integrate SendGrid</strong> via the HirePilot Integrations Page (we'll walk you through it).</li>
              <li><strong>Start small</strong> — 20–50 emails per day is enough to warm up.</li>
              <li><strong>Avoid copy/pasting identical messages</strong> — use personalization tokens in HirePilot campaigns.</li>
              <li><strong>Add unsubscribe links</strong> and avoid sketchy-looking links/images.</li>
            </ol>
          </div>

          <div id="pro-tip">
            <h2>🧠 Pro Tip: Email Outreach Is a Marathon, Not a Sprint</h2>
            <p>
              Sending 200 emails today isn't impressive if you get flagged tomorrow.
            </p>

            <p><strong>What is impressive?</strong></p>
            <p>
              Building a sending reputation that lets you consistently deliver 50–100 messages a day, every day, without hitting the spam folder — and getting real replies.
            </p>
          </div>

          <div id="next-up">
            <h2>🔧 Next Up →</h2>
            <p>
              <a href="/blog/email-deliverability-2" className="text-blue-400 underline hover:text-blue-300">
                Part 2: How to Protect Your Domain Reputation Like a Pro →
              </a>
            </p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12" style={{color: '#ffffff !important', filter: 'brightness(10) contrast(10)', WebkitTextFillColor: '#ffffff !important', textShadow: '0 0 0 #ffffff !important'}}>Email Deliverability Series</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <a href="/blog/email-deliverability-2" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png"
                alt="Email domain authentication setup guide"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Email Deliverability</span>
                <h3 className="text-xl font-semibold mt-2 mb-3" style={{color: '#ffffff !important', filter: 'brightness(10) contrast(10)', WebkitTextFillColor: '#ffffff !important', textShadow: '0 0 0 #ffffff !important', MozTextFillColor: '#ffffff !important', forcedColorAdjust: 'none !important', colorScheme: 'dark !important', outline: '1px solid #ffffff !important', outlineOffset: '-1px !important'}}>Part 2: Protect Your Domain Reputation</h3>
                <p className="text-gray-400 mb-4">
                  Learn advanced strategies for maintaining a clean sender reputation and avoiding blacklists.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>July 24, 2025</span>
                  <span className="mx-2">•</span>
                  <span>Part 2 of 5</span>
                </div>
              </div>
            </a>

            <a href="/blog/email-deliverability-3" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png"
                alt="SendGrid integration dashboard for recruiters"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Email Deliverability</span>
                <h3 className="text-xl font-semibold mt-2 mb-3" style={{color: '#ffffff !important', filter: 'brightness(10) contrast(10)', WebkitTextFillColor: '#ffffff !important', textShadow: '0 0 0 #ffffff !important', MozTextFillColor: '#ffffff !important', forcedColorAdjust: 'none !important', colorScheme: 'dark !important', outline: '1px solid #ffffff !important', outlineOffset: '-1px !important'}}>Part 3: SendGrid Setup Guide</h3>
                <p className="text-gray-400 mb-4">
                  Step-by-step walkthrough for connecting SendGrid to HirePilot and optimizing settings.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>July 24, 2025</span>
                  <span className="mx-2">•</span>
                  <span>Part 3 of 5</span>
                </div>
              </div>
            </a>

            <a href="/blog/email-deliverability-4" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png"
                alt="Email campaign analytics showing high deliverability rates"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Email Deliverability</span>
                <h3 className="text-xl font-semibold mt-2 mb-3" style={{color: '#ffffff !important', filter: 'brightness(10) contrast(10)', WebkitTextFillColor: '#ffffff !important', textShadow: '0 0 0 #ffffff !important', MozTextFillColor: '#ffffff !important', forcedColorAdjust: 'none !important', colorScheme: 'dark !important', outline: '1px solid #ffffff !important', outlineOffset: '-1px !important'}}>Part 4: Advanced Deliverability Tactics</h3>
                <p className="text-gray-400 mb-4">
                  Pro strategies for warming up domains, managing IP reputation, and monitoring metrics.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>July 24, 2025</span>
                  <span className="mx-2">•</span>
                  <span>Part 4 of 5</span>
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <div id="newsletter-signup" className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Master Email Deliverability</h2>
          <p className="text-xl mb-8 text-blue-100">Get all 5 parts of our Email Deliverability series plus weekly recruiting tips</p>
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