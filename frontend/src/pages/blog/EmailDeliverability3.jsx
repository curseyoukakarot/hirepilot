import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';

export default function EmailDeliverability3() {
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
        .prose code { background: #374151; color: #ffffff !important; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.875rem; }
        .prose pre { background: #1f2937; padding: 1.5rem; border-radius: 0.5rem; overflow-x: auto; margin: 2rem 0; }
        .prose table { width: 100%; border-collapse: collapse; margin: 2rem 0; }
        .prose th, .prose td { border: 1px solid #374151; padding: 0.75rem; text-align: left; }
        .prose th { background: #374151; color: #f9fafb; font-weight: 600; }
        .prose td { color: #d1d5db; }
        .toc-active { color: #3b82f6; }
        /* Force-white for specific sections */
        #hidden-send-limits table th { color: #ffffff !important; }
        #inline-cta-2 h3, #inline-cta-2 p { color: #ffffff !important; }
        #related-articles h2, #related-articles h3 { color: #ffffff !important; }
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
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png"
          alt="Gmail and Outlook interface showing sending limitations and warnings"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-sm font-medium">Email Deliverability</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Gmail, Outlook, and the Harsh Truth About Free Email Providers</h1>
            <p className="text-xl text-gray-200 mb-6">Just because you can send from Gmail or Outlook doesn't mean you should. Learn why free email platforms are the #1 reason recruiters get blocked and what to use instead.</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg"
                alt="Author"
                className="w-12 h-12 rounded-full"
              />
                              <div>
                  <p className="font-semibold text-white">HirePilot Team</p>
                  <p className="text-gray-300 text-sm">Published on July 24, 2025 • Part 3 of 5</p>
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
          <p>
            If you've ever thought:
          </p>

          <blockquote>
            "I'll just send all my outreach through my Gmail — it's faster…"
          </blockquote>

          <p>
            You're not alone. But here's the hard truth:
          </p>

          <p>
            <strong>Free email platforms are the #1 reason recruiters get blocked, throttled, or blacklisted.</strong>
          </p>

          <p>
            In this article, we'll show you exactly why that happens — and what to use instead.
          </p>

          <div id="what-theyre-designed-for">
            <h2>📉 What Gmail and Outlook Were Actually Designed For</h2>
            
            <p><strong>These platforms were built for:</strong></p>
            <ul>
              <li>Personal communication</li>
              <li>Internal team messaging</li>
              <li>Responding to warm contacts</li>
            </ul>

            <p><strong>They were not built for:</strong></p>
            <ul>
              <li>Cold outreach</li>
              <li>Bulk sequences</li>
              <li>Automated follow-ups</li>
              <li>Email tracking or analytics</li>
            </ul>

            <p>
              So when you try to send 50+ emails/day to people who don't know you — Gmail and Outlook raise red flags fast.
            </p>
          </div>

          <div id="hidden-send-limits">
            <h2>⚠️ Hidden Send Limits You Might Not Know About</h2>

            <table>
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Official Limit</th>
                  <th>Real-World Limit</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Gmail</td>
                  <td>500/day (personal), 2,000/day (Google Workspace)</td>
                  <td>Often throttled after 100–150 cold sends</td>
                  <td>Account suspension, CAPTCHA lockout</td>
                </tr>
                <tr>
                  <td>Outlook</td>
                  <td>300/day (varies by plan)</td>
                  <td>Often throttled at 50–100 messages</td>
                  <td>"Unusual activity" warnings, delayed sends</td>
                </tr>
              </tbody>
            </table>

            <p><strong>Even if you stay within these limits, you can get flagged if:</strong></p>
            <ul>
              <li>You send too many similar messages in a short time</li>
              <li>You include cold links or attachments</li>
              <li>You get even a few spam complaints</li>
            </ul>

            <p><strong>Worst part:</strong> your domain can get flagged too — not just your inbox.</p>
          </div>

          {/* Inline CTA 1 */}
          <div id="inline-cta-1" className="bg-blue-600 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Avoid Email Platform Penalties</h3>
            <p className="mb-4">Switch to professional email infrastructure designed for recruiting outreach.</p>
            <button className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">Setup Professional Email</button>
          </div>

          <div id="signs-of-throttling">
            <h2>🧪 Common Signs You're Already Being Throttled or Blocked</h2>
            <ul>
              <li>Emails show "sent" but never arrive (silent spam folder delivery)</li>
              <li>You get bouncebacks with vague errors like <code>550-5.7.1</code></li>
              <li>Responses drop to 0% suddenly</li>
              <li>Outlook/Gmail shows "account usage alert"</li>
            </ul>

            <p>
              These aren't bugs — they're signs your email provider is slowing you down on purpose.
            </p>
          </div>

          <div id="manual-outreach">
            <h2>🔄 But What About Manual 1:1 Outreach?</h2>
            <p><strong>Manual sends from Gmail/Outlook can work when:</strong></p>
            <ul>
              <li>You're replying to inbound interest</li>
              <li>You're using an existing thread</li>
              <li>You've already warmed up the contact</li>
            </ul>

            <p><strong>Even then:</strong></p>
            <ul>
              <li>Send in small batches (under 20/day)</li>
              <li>Don't copy/paste the same message over and over</li>
              <li>Avoid link-heavy or salesy content</li>
            </ul>
          </div>

          <div id="what-to-use-instead">
            <h2>✅ So What Should You Use Instead?</h2>
            <p>
              Use a dedicated sending provider like <strong>SendGrid</strong>, integrated with HirePilot.
            </p>

            <p><strong>SendGrid gives you:</strong></p>
            <ul>
              <li>High-volume capacity without getting blocked</li>
              <li>Email authentication to prove you're legitimate</li>
              <li>Dedicated IP or subdomain reputation</li>
              <li>Detailed bounce/spam reports</li>
              <li>Built-in throttling to protect your sender score</li>
            </ul>

            <p>
              It's the same infrastructure used by Stripe, Uber, and Spotify.
            </p>
          </div>

          {/* Inline CTA 2 */}
          <div id="inline-cta-2" className="bg-gray-800 border border-gray-700 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Ready to Switch to SendGrid?</h3>
            <p className="mb-4">Chat with REX for step-by-step guidance on migrating from Gmail/Outlook to professional email.</p>
            <a href="/login" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block">Chat with REX</a>
          </div>

          <div id="gmail-smtp-vs-ui">
            <h2>📦 Bonus: Gmail SMTP vs Gmail UI — Is It Safer?</h2>
            <p>
              Using Gmail's SMTP server (through HirePilot or another tool) is slightly safer than using the Gmail interface. But it's still not designed for cold outreach, and the limits are the same.
            </p>

            <p><strong>You're better off:</strong></p>
            <ul>
              <li>Using SendGrid or Mailgun</li>
              <li>Creating a new custom domain or subdomain</li>
              <li>Setting up full authentication (SPF/DKIM/DMARC)</li>
            </ul>
          </div>

          <div id="action-plan">
            <h2>✅ Your Action Plan (Smart Sending)</h2>
            <ol>
              <li>Stop bulk-sending from Gmail or Outlook immediately</li>
              <li>Use Gmail/Outlook only for replies or warm contacts</li>
              <li>Set up a SendGrid account and connect it to HirePilot</li>
              <li>Send from a properly authenticated domain</li>
              <li>Scale slowly, monitor stats, and follow best practices</li>
            </ol>
          </div>

          <div id="next-up">
            <h2>🔧 Next Up →</h2>
            <p>
              <a href="/blog/email-deliverability-4" className="text-blue-400 underline hover:text-blue-300">
                Part 4: SendGrid Best Practices for HirePilot Users →
              </a>
            </p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Email Deliverability Series</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <a href="/blog/email-deliverability-2" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block" style={{color: '#ffffff', textDecoration: 'none'}}>
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png"
                alt="Domain reputation setup guide"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Email Deliverability</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Part 2: Protect Your Domain Reputation</h3>
                <p className="text-gray-400 mb-4">
                  Learn how to set up SPF, DKIM, DMARC and warm up your domain properly.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>January 16, 2025</span>
                  <span className="mx-2">•</span>
                  <span>Part 2 of 5</span>
                </div>
              </div>
            </a>

            <a href="/blog/email-deliverability-4" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block" style={{color: '#ffffff', textDecoration: 'none'}}>
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png"
                alt="SendGrid best practices for recruiters"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Email Deliverability</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Part 4: SendGrid Best Practices</h3>
                <p className="text-gray-400 mb-4">
                  Advanced configuration, monitoring, and optimization strategies for HirePilot users.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>July 24, 2025</span>
                  <span className="mx-2">•</span>
                  <span>Part 4 of 5</span>
                </div>
              </div>
            </a>

            <a href="/blog/email-deliverability-5" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block" style={{color: '#ffffff', textDecoration: 'none'}}>
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
                alt="Email deliverability troubleshooting guide"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Email Deliverability</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Part 5: Troubleshooting & Recovery</h3>
                <p className="text-gray-400 mb-4">
                  How to diagnose deliverability issues and recover from blacklists and penalties.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>July 24, 2025</span>
                  <span className="mx-2">•</span>
                  <span>Part 5 of 5</span>
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