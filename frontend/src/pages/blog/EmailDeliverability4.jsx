import React from 'react';

export default function EmailDeliverability4() {
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
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png"
          alt="SendGrid dashboard showing email analytics and deliverability metrics"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium">Email Deliverability</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">SendGrid Best Practices for HirePilot Users</h1>
            <p className="text-xl text-gray-200 mb-6">Your secret weapon for sending smarter, safer, and at scale. Learn how to optimize SendGrid for maximum deliverability and compliance with HirePilot.</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg"
                alt="Author"
                className="w-12 h-12 rounded-full"
              />
              <div>
                <p className="font-semibold text-white">Brandon Omoregie</p>
                <p className="text-gray-300 text-sm">Published on January 18, 2025 • Part 4 of 5</p>
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
              <a href="#why-sendgrid" className="block text-gray-400 hover:text-white transition-colors py-1">Why Use SendGrid</a>
              <a href="#setup-sendgrid" className="block text-gray-400 hover:text-white transition-colors py-1">Setting Up SendGrid</a>
              <a href="#domain-authentication" className="block text-gray-400 hover:text-white transition-colors py-1">Domain Authentication</a>
              <a href="#integration-methods" className="block text-gray-400 hover:text-white transition-colors py-1">API vs SMTP Integration</a>
              <a href="#warm-up-process" className="block text-gray-400 hover:text-white transition-colors py-1">Warm-up Process</a>
              <a href="#monitoring-metrics" className="block text-gray-400 hover:text-white transition-colors py-1">Monitoring Metrics</a>
              <a href="#pro-tips" className="block text-gray-400 hover:text-white transition-colors py-1">Pro Tips</a>
              <a href="#protect-sender-score" className="block text-gray-400 hover:text-white transition-colors py-1">Protect Sender Score</a>
              <a href="#action-plan" className="block text-gray-400 hover:text-white transition-colors py-1">Action Plan</a>
              <a href="#next-up" className="block text-gray-400 hover:text-white transition-colors py-1">Next Up</a>
            </nav>
          </div>
        </div>

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <p>
            By now, you've seen why Gmail and Outlook don't cut it — and why protecting your domain reputation is mission-critical.
          </p>

          <p>
            Now it's time to go deeper into SendGrid, the recommended provider for outbound messaging inside HirePilot.
          </p>

          <p>
            Whether you're new to email infrastructure or already have a SendGrid account, this guide will help you optimize your setup for deliverability, consistency, and compliance.
          </p>

          <div id="why-sendgrid">
            <h2>🚀 Why Use SendGrid in the First Place?</h2>
            
            <p><strong>SendGrid was built for:</strong></p>
            <ul>
              <li>High-volume email at scale</li>
              <li>Deliverability monitoring</li>
              <li>Compliance with spam and privacy laws</li>
              <li>Performance reporting (opens, clicks, bounces, unsubscribes)</li>
            </ul>

            <p><strong>HirePilot integrates seamlessly with SendGrid so that every message you send:</strong></p>
            <ul>
              <li>Uses your custom domain (not Gmail)</li>
              <li>Respects rate limits and smart throttling</li>
              <li>Tracks reply rates and bounce activity</li>
              <li>Keeps your domain out of spam folders</li>
            </ul>
          </div>

          <div id="setup-sendgrid">
            <h2>🛠️ Step-by-Step: Setting Up SendGrid Properly</h2>
            
            <h3>1. Create Your SendGrid Account</h3>
            <p>
              Start with the Essentials or Free tier. You can always upgrade later.
            </p>
            
            <p>
              👉 <a href="https://sendgrid.com/pricing/" className="text-blue-400 underline" target="_blank" rel="noopener noreferrer">SendGrid Signup</a>
            </p>

            <blockquote>
              <strong>Note:</strong> You may need to verify your business identity. Don't use fake domains or burner emails.
            </blockquote>
          </div>

          {/* Inline CTA 1 */}
          <div id="inline-cta-1" className="bg-blue-600 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Ready to Setup SendGrid?</h3>
            <p className="mb-4">HirePilot's SendGrid integration guide makes the setup process seamless.</p>
            <button className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">Start SendGrid Setup</button>
          </div>

          <div id="domain-authentication">
            <h3>2. Authenticate Your Domain</h3>
            <p>SendGrid will guide you through adding DNS records:</p>
            <ul>
              <li><strong>SPF</strong> (authorizes SendGrid to send on your behalf)</li>
              <li><strong>DKIM</strong> (digitally signs your messages)</li>
              <li><strong>CNAMEs</strong> (used to verify the domain)</li>
            </ul>

            <p>
              This is done through your domain registrar (e.g. GoDaddy, Namecheap, Cloudflare). You'll copy-paste 3–5 records into your DNS settings.
            </p>

            <blockquote>
              <strong>Don't skip this step.</strong><br/>
              Unauthenticated SendGrid messages = instant spam.
            </blockquote>
          </div>

          <div id="integration-methods">
            <h3>3. Choose Between API or SMTP Integration</h3>
            <p>HirePilot supports both — here's the difference:</p>

            <table>
              <thead>
                <tr>
                  <th>Option</th>
                  <th>Pros</th>
                  <th>Cons</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>API Key (recommended)</td>
                  <td>Fast, secure, direct SendGrid access</td>
                  <td>Requires API setup</td>
                </tr>
                <tr>
                  <td>SMTP Relay</td>
                  <td>Simple to configure</td>
                  <td>Slightly slower, less flexible</td>
                </tr>
              </tbody>
            </table>

            <p>
              <strong>Use the API key method for best results.</strong> You'll generate a private API token inside SendGrid and paste it into HirePilot's integration page.
            </p>
          </div>

          <div id="warm-up-process">
            <h3>4. Warm Up Your SendGrid Account</h3>
            <p>
              Even though SendGrid can technically send thousands of emails per day, you shouldn't jump straight to high volume.
            </p>

            <p><strong>Instead:</strong></p>
            <ul>
              <li>Start with 20–30 emails per day</li>
              <li>Gradually increase volume by 10–20% every few days</li>
              <li>Monitor bounce and complaint rates closely</li>
            </ul>

            <p>
              SendGrid may temporarily throttle you if you spike volume too fast — treat it like a long-term sender reputation.
            </p>
          </div>

          <div id="monitoring-metrics">
            <h3>5. Monitor the Right Metrics in SendGrid</h3>
            <p>Inside your SendGrid dashboard, pay close attention to:</p>

            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Bounce Rate</td>
                  <td>&lt; 5%</td>
                </tr>
                <tr>
                  <td>Spam Complaints</td>
                  <td>&lt; 0.1%</td>
                </tr>
                <tr>
                  <td>Open Rate</td>
                  <td>&gt; 30% (cold outreach varies)</td>
                </tr>
                <tr>
                  <td>Click Rate</td>
                  <td>&gt; 5%</td>
                </tr>
                <tr>
                  <td>Unsubscribes</td>
                  <td>&lt; 1%</td>
                </tr>
              </tbody>
            </table>

            <p><strong>If bounces or complaints spike:</strong></p>
            <ul>
              <li>Pause your campaign</li>
              <li>Review your email list quality</li>
              <li>Use a validation tool like NeverBounce</li>
            </ul>
          </div>

          {/* Inline CTA 2 */}
          <div id="inline-cta-2" className="bg-gray-800 border border-gray-700 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Need Help Monitoring Your SendGrid Metrics?</h3>
            <p className="mb-4">Chat with REX for personalized guidance on interpreting deliverability data and optimizing performance.</p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Chat with REX</button>
          </div>

          <div id="pro-tips">
            <h2>⚙️ Pro Tips for Power Senders</h2>
            <ul>
              <li>✅ Use a reply-to address that routes to a real inbox</li>
              <li>✅ Add unsubscribe links to cold outreach for compliance</li>
              <li>✅ Avoid image-heavy emails or tracking pixels</li>
              <li>✅ Use personalization (first name, company, etc.) — HirePilot makes this easy</li>
              <li>✅ Split large campaigns into smaller sends using smart delay intervals</li>
            </ul>
          </div>

          <div id="protect-sender-score">
            <h2>🔐 Protect Your SendGrid Sender Score</h2>
            <p>SendGrid monitors every customer's sender behavior. If you:</p>
            <ul>
              <li>Get flagged for spam too often</li>
              <li>Use unverified domains</li>
              <li>Send abusive or misleading content</li>
            </ul>

            <p>…they can reduce your sending throughput or suspend your account.</p>

            <p>
              <strong>That's why HirePilot enforces sane sending defaults — to keep you safe.</strong>
            </p>
          </div>

          <div id="action-plan">
            <h2>✅ Your Action Plan</h2>
            <ol>
              <li>Create and verify your SendGrid account</li>
              <li>Authenticate your domain (SPF, DKIM, CNAMEs)</li>
              <li>Integrate with HirePilot using API key</li>
              <li>Warm up your volume gradually</li>
              <li>Monitor your stats and keep your copy clean</li>
            </ol>
          </div>

          <div id="next-up">
            <h2>🔧 Next Up →</h2>
            <p>
              <a href="/blog/email-deliverability-5" className="text-blue-400 underline hover:text-blue-300">
                Part 5: How to Avoid Spam Filters and Get More Replies →
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
            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png"
                alt="Gmail and Outlook limitations guide"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Email Deliverability</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Part 3: Free Email Provider Limitations</h3>
                <p className="text-gray-400 mb-4">
                  Why Gmail and Outlook aren't built for recruiting outreach at scale.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>January 17, 2025</span>
                  <span className="mx-2">•</span>
                  <span>Part 3 of 5</span>
                </div>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
                alt="Spam filter avoidance strategies"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Email Deliverability</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Part 5: Avoid Spam Filters & Get More Replies</h3>
                <p className="text-gray-400 mb-4">
                  Advanced tactics for bypassing spam filters and increasing response rates.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Coming soon</span>
                  <span className="mx-2">•</span>
                  <span>Part 5 of 5</span>
                </div>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png"
                alt="Domain reputation protection guide"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Email Deliverability</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Part 2: Protect Your Domain Reputation</h3>
                <p className="text-gray-400 mb-4">
                  Complete guide to SPF, DKIM, DMARC setup and domain warm-up strategies.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>January 16, 2025</span>
                  <span className="mx-2">•</span>
                  <span>Part 2 of 5</span>
                </div>
              </div>
            </article>
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