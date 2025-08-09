import React from 'react';

export default function EmailDeliverability5() {
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
        /* Force white text for specific elements */
        #inline-cta-2 h3, #inline-cta-2 p { color: #ffffff !important; }
        #spam-triggers table th { color: #ffffff !important; }
        .token-sample, .token-sample code { color: #ffffff !important; }
        #complete-series h3, #complete-series p { color: #ffffff !important; }
      `}</style>

      {/* Breadcrumb */}
      <div id="breadcrumb" className="bg-gray-800 py-4">
        <div className="max-w-6xl mx-auto px-6">
          <a href="/blog" className="text-gray-300 hover:text-white transition-colors flex items-center">
            <i className="fa-solid fa-arrow-left mr-2" />
            Back to Blog
          </a>
        </div>
      </div>

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/8b7f2a1c95-d4e892ab56c7f8e90123.png"
          alt="Email inbox showing high deliverability and response rates with clean formatting"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-teal-600 text-white px-3 py-1 rounded-full text-sm font-medium">Email Deliverability</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">How to Avoid Spam Filters and Get More Replies</h1>
            <p className="text-xl text-gray-200 mb-6">Great tech won't save you from bad copy. Learn how to write messages that reach the inbox and actually get responses from top candidates.</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg"
                alt="Author"
                className="w-12 h-12 rounded-full"
              />
                              <div>
                  <p className="font-semibold text-white">HirePilot Team</p>
                  <p className="text-gray-300 text-sm">Published on July 24, 2025 • Part 5 of 5</p>
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
              <a href="#spam-triggers" className="block text-gray-400 hover:text-white transition-colors py-1">What Triggers Spam Filters</a>
              <a href="#high-deliverability" className="block text-gray-400 hover:text-white transition-colors py-1">High-Deliverability Messages</a>
              <a href="#subject-lines" className="block text-gray-400 hover:text-white transition-colors py-1">Subject Line Rules</a>
              <a href="#opening-lines" className="block text-gray-400 hover:text-white transition-colors py-1">Opening Lines</a>
              <a href="#body-copy" className="block text-gray-400 hover:text-white transition-colors py-1">Body Copy</a>
              <a href="#signatures" className="block text-gray-400 hover:text-white transition-colors py-1">Professional Signatures</a>
              <a href="#technical-dos" className="block text-gray-400 hover:text-white transition-colors py-1">Technical Do's & Don'ts</a>
              <a href="#testing" className="block text-gray-400 hover:text-white transition-colors py-1">Test Before Sending</a>
              <a href="#final-thoughts" className="block text-gray-400 hover:text-white transition-colors py-1">Final Thoughts</a>
              <a href="#action-plan" className="block text-gray-400 hover:text-white transition-colors py-1">Final Action Plan</a>
            </nav>
          </div>
        </div>

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <p>
            You've authenticated your domain. You've set up SendGrid. You're sending at a safe pace.
          </p>

          <p>
            But there's one more layer to email deliverability that can't be ignored: <strong>your message content</strong>.
          </p>

          <p>
            Even if your domain is perfect, poor copywriting, spammy formatting, or careless links can tank your response rate — and trigger spam filters.
          </p>

          <p>
            This guide will show you how to write messages that actually reach the inbox and get replies.
          </p>

          <div id="spam-triggers">
            <h2>📥 What Triggers Spam Filters?</h2>
            
            <p>
              Modern spam filters use machine learning and historical data to score every message. If your message looks like spam — it gets blocked.
            </p>

            <p><strong>Here's what filters look at:</strong></p>

            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Red Flags</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Subject Line</td>
                  <td>ALL CAPS, "Free!!!", Emojis overload 😱, clickbait</td>
                </tr>
                <tr>
                  <td>Body Copy</td>
                  <td>Generic text, too many links, no personalization</td>
                </tr>
                <tr>
                  <td>Formatting</td>
                  <td>Large images, heavy bolding, bright colors</td>
                </tr>
                <tr>
                  <td>Links</td>
                  <td>Broken URLs, shady domains, raw URL strings</td>
                </tr>
                <tr>
                  <td>Missing Info</td>
                  <td>No reply-to, no unsubscribe, no footer info</td>
                </tr>
              </tbody>
            </table>

            <blockquote>
              Even with a great sender reputation, bad content will drag you down.
            </blockquote>
          </div>

          <div id="high-deliverability">
            <h2>🧠 Anatomy of a High-Deliverability Message</h2>
            <p>Let's break it down.</p>
          </div>

          <div id="subject-lines">
            <h3>✅ Subject Line</h3>
            
            <p><strong>Avoid:</strong> "Get hired FAST!! 🚀"</p>
            <p><strong>Try:</strong> "Quick question about your sales team"</p>

            <p><strong>Rules:</strong></p>
            <ul>
              <li>No caps or exclamation points</li>
              <li>Keep it under 50 characters</li>
              <li>Sound natural, like a 1:1 email</li>
            </ul>
          </div>

          {/* Inline CTA 1 */}
          <div id="inline-cta-1" className="bg-teal-600 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Need Help Writing Better Subject Lines?</h3>
            <p className="mb-4">HirePilot's message templates include proven subject lines that bypass spam filters.</p>
            <a href="https://thehirepilot.com/messages" className="bg-white text-teal-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block">Browse Templates</a>
          </div>

          <div id="opening-lines">
            <h3>✅ Opening Line</h3>
            
            <p><strong>"Hope your week's off to a great start."</strong></p>
            <p>Nope. That screams automation.</p>

            <p><strong>Instead:</strong></p>
            <p>"Saw you just raised a Series A — congrats. I work with other revenue leaders scaling fast."</p>

            <p><strong>Rules:</strong></p>
            <ul>
              <li>Mention something relevant (job title, company event, funding round)</li>
              <li className="token-sample">
                Use personalization tokens (
                <code>{"{{firstName}}"}</code>
                ,
                <code>{"{{companyName}}"}</code>
                )
              </li>
              <li>Get to the point fast</li>
            </ul>
          </div>

          <div id="body-copy">
            <h3>✅ Body</h3>
            
            <p>
              Avoid long intros or self-centered language. Cut "We are a platform that helps…" entirely.
            </p>

            <p><strong>Instead:</strong></p>
            <ul>
              <li><strong>Highlight a result:</strong> "We helped [Company] book 14 interviews in 3 weeks."</li>
              <li><strong>Ask a soft CTA:</strong> "Would it make sense to explore?"</li>
            </ul>
          </div>

          <div id="signatures">
            <h3>✅ Signature</h3>
            
            <p><strong>Always include:</strong></p>
            <ul>
              <li>Full name</li>
              <li>Role/title</li>
              <li>Real reply-to email</li>
              <li>Optional: LinkedIn or company website</li>
            </ul>
          </div>

          <div id="technical-dos">
            <h2>⚙️ Technical Do's and Don'ts</h2>
            
            <div className="grid md:grid-cols-2 gap-6 my-8">
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-6">
                <h3 className="text-green-400 font-semibold mb-4">✅ Do:</h3>
                <ul className="space-y-2">
                  <li>Use plain text or lightly formatted HTML</li>
                  <li>Include an unsubscribe link (even if cold)</li>
                  <li>Add custom reply-to addresses for tracking</li>
                  <li>Keep links to 2 or fewer, and make sure they work</li>
                  <li>A/B test different templates inside HirePilot</li>
                </ul>
              </div>

              <div className="bg-red-900/20 border border-red-700 rounded-lg p-6">
                <h3 className="text-red-400 font-semibold mb-4">❌ Don't:</h3>
                <ul className="space-y-2">
                  <li>Use URL shorteners (bit.ly, etc.)</li>
                  <li>Add attachments</li>
                  <li>Use words like "guaranteed," "winner," "free," or "last chance"</li>
                  <li>Send identical copy to 100 people — mix it up with variables</li>
                </ul>
              </div>
            </div>
          </div>

          <div id="testing">
            <h2>🔍 Test Before You Send</h2>
            
            <p><strong>Use tools like:</strong></p>
            <ul>
              <li><a href="https://mail-tester.com" className="text-blue-400 underline" target="_blank" rel="noopener noreferrer">mail-tester.com</a></li>
              <li><a href="https://mxtoolbox.com" className="text-blue-400 underline" target="_blank" rel="noopener noreferrer">MXToolbox</a></li>
              <li>Gmail's "Show Original" to inspect SPF/DKIM status</li>
            </ul>

            <blockquote>
              HirePilot will soon include a built-in deliverability grader to preview your message risk score.
            </blockquote>
          </div>

          {/* Inline CTA 2 */}
          <div id="inline-cta-2" className="bg-gray-800 border border-gray-700 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Ready to Put It All Together?</h3>
            <p className="mb-4">Use HirePilot's campaign builder with built-in deliverability best practices and personalization tokens.</p>
            <a href="https://thehirepilot.com/campaigns" className="bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-colors inline-block">Start Campaign</a>
          </div>

          <div id="final-thoughts">
            <h2>🧠 Final Thoughts</h2>
            
            <p>
              Deliverability isn't just about tech — it's about <strong>trust</strong>. When your message feels human, relevant, and respectful of the inbox… it gets read.
            </p>

            <p>
              Keep the volume safe. Keep the copy clean. Keep the personalization sharp.
            </p>

            <p>
              <strong>That's how you win the inbox.</strong>
            </p>
          </div>

          <div id="action-plan">
            <h2>✅ Your Final Action Plan</h2>
            
            <ol>
              <li>Check every message with mail-tester.com before launching</li>
              <li>Keep campaigns under 100/day until warmed up</li>
              <li>Write like a human, not a bot</li>
              <li>Review replies, bounce rates, and spam flags weekly in SendGrid</li>
              <li>Iterate, test, and never copy-paste blindly</li>
            </ol>
          </div>

          <div className="bg-gradient-to-r from-teal-600 to-blue-600 rounded-xl p-8 my-8 text-center">
            <h2 className="text-2xl font-bold mb-4">🎉 You've Completed the Series!</h2>
            <p className="text-lg mb-6">
              Want a downloadable checklist or template pack? Let us know → 
              <a href="mailto:support@thehirepilot.com" className="text-blue-200 underline ml-2">support@thehirepilot.com</a>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/blog/email-deliverability-1" className="bg-white text-teal-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                Start from Part 1
              </a>
              <a href="/pricing" className="bg-teal-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-900 transition-colors">
                Try HirePilot
              </a>
            </div>
          </div>
        </article>
      </div>

      {/* Complete Series Overview */}
      <div id="complete-series" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Complete Email Deliverability Series</h2>
          <div className="grid md:grid-cols-5 gap-6">
            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <div className="p-6">
                <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-medium">Part 1</span>
                <h3 className="text-lg font-semibold mt-2 mb-2"><a href="/blog/email-deliverability-1" className="hover:underline">The #1 Mistake</a></h3>
                <p className="text-sm">
                  Why Gmail/Outlook fail at scale
                </p>
                <a href="/blog/email-deliverability-1" className="text-blue-400 text-sm hover:underline block mt-3">Read Part 1 →</a>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <div className="p-6">
                <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-medium">Part 2</span>
                <h3 className="text-lg font-semibold mt-2 mb-2"><a href="/blog/email-deliverability-2" className="hover:underline">Domain Reputation</a></h3>
                <p className="text-sm">
                  SPF, DKIM, DMARC setup
                </p>
                <a href="/blog/email-deliverability-2" className="text-blue-400 text-sm hover:underline block mt-3">Read Part 2 →</a>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <div className="p-6">
                <span className="bg-orange-600 text-white px-2 py-1 rounded text-xs font-medium">Part 3</span>
                <h3 className="text-lg font-semibold mt-2 mb-2"><a href="/blog/email-deliverability-3" className="hover:underline">Free Providers</a></h3>
                <p className="text-sm">
                  Hidden limits & throttling
                </p>
                <a href="/blog/email-deliverability-3" className="text-blue-400 text-sm hover:underline block mt-3">Read Part 3 →</a>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <div className="p-6">
                <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-medium">Part 4</span>
                <h3 className="text-lg font-semibold mt-2 mb-2"><a href="/blog/email-deliverability-4" className="hover:underline">SendGrid Setup</a></h3>
                <p className="text-sm">
                  Best practices & monitoring
                </p>
                <a href="/blog/email-deliverability-4" className="text-blue-400 text-sm hover:underline block mt-3">Read Part 4 →</a>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 ring-2 ring-teal-600">
              <div className="p-6">
                <span className="bg-teal-600 text-white px-2 py-1 rounded text-xs font-medium">Part 5</span>
                <h3 className="text-lg font-semibold mt-2 mb-2">Avoid Spam Filters</h3>
                <p className="text-sm">
                  Copy & formatting tips
                </p>
                <span className="text-teal-400 text-sm block mt-3">You're here! ✓</span>
              </div>
            </article>
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <div id="newsletter-signup" className="bg-gradient-to-r from-teal-600 to-purple-600 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Master Email Deliverability</h2>
          <p className="text-xl mb-8 text-blue-100">Get all 5 parts of our Email Deliverability series plus weekly recruiting tips</p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <button className="bg-white text-teal-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Subscribe
            </button>
          </div>
          <p className="text-sm text-blue-200 mt-4">No spam. Unsubscribe anytime.</p>
        </div>
      </div>
    </>
  );
} 