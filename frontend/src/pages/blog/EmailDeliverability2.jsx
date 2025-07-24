import React from 'react';

export default function EmailDeliverability2() {
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
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png"
          alt="Domain authentication setup with SPF, DKIM, and DMARC records"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">Email Deliverability</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">How to Protect Your Domain Reputation Like a Pro</h1>
            <p className="text-xl text-gray-200 mb-6">Your outreach is only as strong as the foundation it's built on: your domain reputation. Learn how to set up SPF, DKIM, DMARC and warm up your domain properly.</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg"
                alt="Author"
                className="w-12 h-12 rounded-full"
              />
              <div>
                <p className="font-semibold text-white">Brandon Omoregie</p>
                <p className="text-gray-300 text-sm">Published on January 16, 2025 • Part 2 of 5</p>
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
              <a href="#domain-reputation-explained" className="block text-gray-400 hover:text-white transition-colors py-1">Domain Reputation Explained</a>
              <a href="#setting-up-domain" className="block text-gray-400 hover:text-white transition-colors py-1">Setting Up Your Domain</a>
              <a href="#authentication-records" className="block text-gray-400 hover:text-white transition-colors py-1">SPF, DKIM, DMARC Setup</a>
              <a href="#domain-warmup" className="block text-gray-400 hover:text-white transition-colors py-1">Domain Warm-up Process</a>
              <a href="#monitoring-health" className="block text-gray-400 hover:text-white transition-colors py-1">Monitoring Domain Health</a>
              <a href="#throwaway-domains" className="block text-gray-400 hover:text-white transition-colors py-1">Throwaway Domain Strategy</a>
              <a href="#action-plan" className="block text-gray-400 hover:text-white transition-colors py-1">Action Plan</a>
              <a href="#next-up" className="block text-gray-400 hover:text-white transition-colors py-1">Next Up</a>
            </nav>
          </div>
        </div>

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <p>
            If Part 1 scared you off from sending 200 messages at once — good. Now it's time to show you how to do it the right way.
          </p>

          <p>
            Because even with SendGrid, if your domain isn't properly configured, you're going to land in spam — or worse, get blacklisted across the board.
          </p>

          <p>Let's fix that now.</p>

          <div id="domain-reputation-explained">
            <h2>💡 What Is Domain Reputation, Really?</h2>
            <p>
              Your domain reputation is like a credit score for your email-sending behavior. It's calculated by mailbox providers (Gmail, Outlook, Yahoo, etc.) based on how your emails perform over time.
            </p>

            <p><strong>Positive signals include:</strong></p>
            <ul>
              <li>Authenticated messages (SPF/DKIM/DMARC)</li>
              <li>High open and reply rates</li>
              <li>Low bounce/spam complaint rates</li>
              <li>Consistent send volumes (no sudden spikes)</li>
            </ul>

            <p><strong>Negative signals include:</strong></p>
            <ul>
              <li>Sending to invalid addresses (bad data)</li>
              <li>Spammy content or broken links</li>
              <li>Recipients marking you as spam</li>
              <li>Skipping domain authentication entirely</li>
            </ul>

            <p><strong>A poor domain reputation = instant spam filter or total block.</strong></p>
          </div>

          <div id="setting-up-domain">
            <h2>🧰 Step-by-Step: Setting Up a Deliverability-Ready Domain</h2>
            
            <h3>1. Buy a Custom Domain or Subdomain</h3>
            <p>If your main domain is <code>offrgroup.com</code>, use a subdomain for outreach like:</p>
            <ul>
              <li><code>hi.offrgroup.com</code></li>
              <li><code>careers.offrgroup.com</code></li>
              <li><code>contact.offrgroup.com</code></li>
            </ul>

            <p><strong>Why?</strong></p>
            <ul>
              <li>Protects your primary domain from deliverability damage</li>
              <li>Keeps outreach traffic isolated</li>
              <li>Looks professional and on-brand</li>
            </ul>

            <blockquote>
              <strong>Tip:</strong> Always use a custom domain. Never send from @gmail.com or @outlook.com.
            </blockquote>
          </div>

          {/* Inline CTA 1 */}
          <div id="inline-cta-1" className="bg-blue-600 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Ready to Set Up Your Domain?</h3>
            <p className="mb-4">HirePilot + SendGrid will guide you through the entire DNS setup process.</p>
            <button className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">Start Domain Setup</button>
          </div>

          <div id="authentication-records">
            <h3>2. Configure SPF, DKIM, and DMARC Records</h3>
            <p>These are DNS settings that verify your messages are really from you.</p>

            <table>
              <thead>
                <tr>
                  <th>Record</th>
                  <th>What it Does</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>SPF</td>
                  <td>Authorizes SendGrid to send emails on your behalf</td>
                  <td><code>v=spf1 include:sendgrid.net ~all</code></td>
                </tr>
                <tr>
                  <td>DKIM</td>
                  <td>Digitally signs your emails to verify authenticity</td>
                  <td>Add CNAME records from SendGrid</td>
                </tr>
                <tr>
                  <td>DMARC</td>
                  <td>Instructs mailbox providers on how to handle failed SPF/DKIM checks</td>
                  <td><code>v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com</code></td>
                </tr>
              </tbody>
            </table>

            <p>✅ HirePilot + SendGrid will guide you through adding these to your domain DNS (usually via GoDaddy, Namecheap, or Cloudflare).</p>

            <p><strong>Pro tip:</strong> After setup, test everything using <a href="https://mxtoolbox.com" className="text-blue-400 underline" target="_blank" rel="noopener noreferrer">https://mxtoolbox.com</a> or <a href="https://mail-tester.com" className="text-blue-400 underline" target="_blank" rel="noopener noreferrer">https://mail-tester.com</a>.</p>
          </div>

          <div id="domain-warmup">
            <h3>3. Warm Up Your Domain</h3>
            <p>Never go from 0 to 100 emails a day.</p>

            <p><strong>Instead:</strong></p>
            <ul>
              <li><strong>Week 1:</strong> Send 10–20 messages/day</li>
              <li><strong>Week 2:</strong> Increase to 30–50/day</li>
              <li><strong>Week 3:</strong> Scale slowly to 100+/day</li>
            </ul>

            <p>This mimics organic usage and signals trust to email providers.</p>

            <p>You can warm up manually or use tools like:</p>
            <ul>
              <li>Mailflow</li>
              <li>Instantly.ai (warm-up only)</li>
              <li>Lemwarm (standalone service)</li>
            </ul>

            <p><em>HirePilot will add native warm-up guidance soon.</em></p>
          </div>

          {/* Inline CTA 2 */}
          <div id="inline-cta-2" className="bg-gray-800 border border-gray-700 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Need Help with Domain Authentication?</h3>
            <p className="mb-4">Chat with REX for personalized guidance on SPF, DKIM, and DMARC setup.</p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Chat with REX</button>
          </div>

          <div id="monitoring-health">
            <h3>4. Monitor Your Domain Health</h3>
            <p>Check these regularly:</p>
            <ul>
              <li>✅ Google Postmaster Tools (for Gmail reputation)</li>
              <li>✅ Microsoft SNDS (for Outlook)</li>
              <li>✅ SendGrid suppression lists (remove blocked addresses)</li>
              <li>✅ Bounce and spam rates inside HirePilot</li>
            </ul>

            <p><strong>If you're seeing:</strong></p>
            <ul>
              <li>Bounce rate &gt; 5%</li>
              <li>Spam complaints &gt; 0.1%</li>
            </ul>
            <p>…you're in the danger zone. Time to pause and clean your list.</p>
          </div>

          <div id="throwaway-domains">
            <h2>🧠 Bonus: Should You Buy a "Throwaway" Domain?</h2>
            <p>
              Some advanced users buy "sacrificial" domains (like <code>offr-recruiting.com</code>) to protect their main brand.
            </p>

            <p><strong>It's a legit strategy — but risky if done wrong:</strong></p>
            <ul>
              <li>Use real DNS/email authentication (don't skip SPF/DKIM!)</li>
              <li>Avoid burner domains that look fake or spammy</li>
              <li>Keep branding consistent so users still trust the sender</li>
            </ul>
          </div>

          <div id="action-plan">
            <h2>✅ Your Action Plan (Technical, but Worth It)</h2>
            <ol>
              <li>Buy a subdomain (e.g. <code>hi.yourcompany.com</code>)</li>
              <li>Set up SPF, DKIM, and DMARC records via your DNS</li>
              <li>Verify your domain in SendGrid and test with mail-tester</li>
              <li>Start sending slowly — use HirePilot's campaign throttling tools</li>
              <li>Monitor deliverability weekly using Postmaster + SendGrid stats</li>
            </ol>
          </div>

          <div id="next-up">
            <h2>🔧 Next Up →</h2>
            <p>
              <a href="/blog/email-deliverability-3" className="text-blue-400 underline hover:text-blue-300">
                Part 3: Gmail, Outlook, and the Harsh Truth About Free Email Providers →
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
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
                alt="Email deliverability dashboard showing spam warnings"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Email Deliverability</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Part 1: The #1 Mistake Recruiters Make</h3>
                <p className="text-gray-400 mb-4">
                  Why sending 200+ cold emails from Gmail destroys your domain reputation.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>January 15, 2025</span>
                  <span className="mx-2">•</span>
                  <span>Part 1 of 5</span>
                </div>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png"
                alt="Free email provider limitations dashboard"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Email Deliverability</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Part 3: Free Email Provider Limitations</h3>
                <p className="text-gray-400 mb-4">
                  The harsh truth about Gmail, Outlook and why professional senders avoid them.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Coming soon</span>
                  <span className="mx-2">•</span>
                  <span>Part 3 of 5</span>
                </div>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png"
                alt="Advanced email deliverability monitoring tools"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Email Deliverability</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Part 4: Advanced Deliverability Tactics</h3>
                <p className="text-gray-400 mb-4">
                  Pro strategies for monitoring, warming, and maintaining excellent sender reputation.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Coming soon</span>
                  <span className="mx-2">•</span>
                  <span>Part 4 of 5</span>
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