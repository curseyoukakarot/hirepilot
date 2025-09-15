import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function JobCollaboration() {
  return (
    <>
      {/* Scoped styles preserved from original article page */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose h3 { color: #d1d5db; font-size: 1.25rem; font-weight: 600; margin: 1.5rem 0 0.75rem 0; }
        .prose p { color: #d1d5db; line-height: 1.7; margin-bottom: 1.5rem; }
        .prose ul { color: #d1d5db; margin: 1.5rem 0; }
        .prose li { margin-bottom: 0.5rem; }
        .prose blockquote { border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 2rem 0; font-style: italic; color: #9ca3af; }
        .prose code { background: #374151; color: #f9fafb; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.875rem; }
        .prose pre { background: #1f2937; padding: 1.5rem; border-radius: 0.5rem; overflow-x: auto; margin: 2rem 0; }
        .prose table { width: 100%; border-collapse: collapse; margin: 2rem 0; }
        .prose th, .prose td { border: 1px solid #374151; padding: 0.75rem; text-align: left; }
        .prose th { background: #1f2937; color: #f9fafb; font-weight: 600; }
        .prose td { color: #d1d5db; }
        .toc-active { color: #3b82f6; }
        .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
        .feature-card { background: #1f2937; padding: 1.5rem; border-radius: 0.5rem; border: 1px solid #374151; }
        .step-number { background: #3b82f6; color: white; width: 2rem; height: 2rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 1rem; }
        .step-content { display: flex; align-items: flex-start; margin-bottom: 1.5rem; }
      `}</style>

      <BlogNavbar />

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
          alt="team collaboration interface with job requirements and candidate management"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">Collaboration</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">👥 Job REQ Collaboration – Work Together, Hire Faster</h1>
            <p className="text-xl text-gray-200 mb-6">Hiring is a team sport — and now, HirePilot makes it seamless. Bring hiring managers, clients, teammates, or guests into the recruiting process without friction.</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg"
                alt="Author"
                className="w-12 h-12 rounded-full"
              />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on September 14, 2025</p>
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
          <div id="overview">
            <h2>🧭 Overview</h2>
            <p>
              Hiring is a team sport — and now, HirePilot makes it seamless.
            </p>
            <p>
              With Job REQ Collaboration, you can bring hiring managers, clients, teammates, or guests into the recruiting process without friction. Share access, track progress, leave notes, and make faster decisions — all from one place.
            </p>
            <p>
              Best of all? It's built into every Job REQ.
              <br />
              No extra tools. No messy threads. No limits.
            </p>
          </div>

          <div id="key-benefits">
            <h2>📌 Key Benefits</h2>
            <div className="feature-grid">
              <div className="feature-card">
                <h3 className="text-lg font-semibold mb-2 text-white">✅ Unlimited Guest Collaborators</h3>
                <p className="text-sm text-gray-300">Invite as many people as you need to collaborate on each job.</p>
              </div>
              <div className="feature-card">
                <h3 className="text-lg font-semibold mb-2 text-white">✅ Real-Time Candidate Notes & Feedback</h3>
                <p className="text-sm text-gray-300">Leave comments and feedback directly on candidates in real-time.</p>
              </div>
              <div className="feature-card">
                <h3 className="text-lg font-semibold mb-2 text-white">✅ No Extra Logins or Complex Permissions</h3>
                <p className="text-sm text-gray-300">Simple invitation process with no complex account setup required.</p>
              </div>
              <div className="feature-card">
                <h3 className="text-lg font-semibold mb-2 text-white">✅ Async-Friendly for Distributed Teams</h3>
                <p className="text-sm text-gray-300">Perfect for teams working across different time zones.</p>
              </div>
              <div className="feature-card">
                <h3 className="text-lg font-semibold mb-2 text-white">✅ Perfect for Agencies, Hiring Managers, and Founders</h3>
                <p className="text-sm text-gray-300">Designed for all types of hiring scenarios and team structures.</p>
              </div>
            </div>
          </div>

          <div id="how-it-works">
            <h2>🔄 How It Works</h2>

            <div className="step-content">
              <div className="step-number">1</div>
              <div>
                <h3>🧩 Step 1: Open a Job REQ</h3>
                <p>From your dashboard, click into any job. You'll land in the Job Overview — where you can:</p>
                <ul>
                  <li>Invite collaborators</li>
                  <li>View candidate activity</li>
                  <li>Track sourcing progress</li>
                  <li>Share notes and feedback in one place</li>
                </ul>
              </div>
            </div>

            <div className="step-content">
              <div className="step-number">2</div>
              <div>
                <h3>👥 Step 2: Invite a Collaborator</h3>
                <p>Click "Invite Member" → then choose "Collaborator" (not team member).</p>
                <p>You can invite:</p>
                <ul>
                  <li>✅ Clients (view-only or comment access)</li>
                  <li>✅ Hiring managers</li>
                  <li>✅ Cross-functional teammates</li>
                  <li>✅ Interviewers or stakeholders</li>
                </ul>
                <p><strong>🔒 They'll only see the Job REQ you invite them to — not your whole workspace.</strong></p>
              </div>
            </div>
          </div>

          <div id="collaborator-permissions">
            <h2>💬 What Collaborators Can See & Do</h2>
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Guest Collaborators</th>
                  <th>Team Members</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>View Job Info</td>
                  <td>✅</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>View Candidates</td>
                  <td>✅</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>Leave Notes on Candidates</td>
                  <td>✅</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>Add Ratings or Comments</td>
                  <td>✅</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>Move Candidates</td>
                  <td>❌</td>
                  <td>✅ (if permissioned)</td>
                </tr>
                <tr>
                  <td>Edit Job Info</td>
                  <td>❌</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>Access Other Jobs</td>
                  <td>❌</td>
                  <td>✅</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div id="pipeline-collaboration">
            <h2>🧠 Collaborate Directly in the Pipeline</h2>
            <p>Inside the Candidates tab, collaborators can:</p>
            <ul>
              <li>Drop inline notes like "Need to loop in the CTO here"</li>
              <li>See interview history and candidate feedback</li>
              <li>Stay aligned without switching tools</li>
              <li>Use REX to summarize, search, or surface stalled candidates</li>
            </ul>
            <p><strong>✅ Zero onboarding required. Just click, contribute, and hire.</strong></p>
          </div>

          {/* Inline CTA 1 */}
          <div id="inline-cta-1" className="bg-blue-600 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Ready to Collaborate on Your Next Hire?</h3>
            <p className="mb-4">Start inviting collaborators to your Job REQs and experience seamless team hiring.</p>
            <button className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">Try Job REQ Collaboration</button>
          </div>

          <div id="rex-integration">
            <h2>🤖 Bonus: REX Works for Your Whole Team</h2>
            <p>Collaborators can use REX, your AI recruiting assistant, with built-in safeguards.</p>
            <p>They can say things like:</p>
            <ul>
              <li>"REX, summarize feedback on John Doe."</li>
              <li>"REX, who's still waiting on a decision?"</li>
              <li>"REX, draft a rejection note for this candidate."</li>
            </ul>
            <p><strong>REX helps your team move faster — not just the recruiter.</strong></p>
          </div>

          <div id="trust-and-focus">
            <h2>🔒 Built for Trust & Focus</h2>
            <ul>
              <li><strong>🧼 No extra dashboard clutter</strong> — collaborators only see what matters</li>
              <li><strong>🚪 Easy login flow</strong> — no full account setup required</li>
              <li><strong>🔐 Role-based visibility</strong> — you control who sees what</li>
              <li><strong>🧠 All feedback is shared transparently</strong> for better decision-making</li>
            </ul>
          </div>

          <div id="use-cases">
            <h2>🚀 Use Cases</h2>
            <ul>
              <li><strong>Recruiters & Hiring Managers:</strong> Share candidate progress without chasing Slack threads</li>
              <li><strong>Agencies & Clients:</strong> Let clients review candidates without giving full access</li>
              <li><strong>Founders:</strong> Loop in a cofounder or advisor to weigh in before interviews</li>
              <li><strong>Async Teams:</strong> Collaborate across time zones without losing context or momentum</li>
            </ul>
          </div>

          {/* Inline CTA 2 */}
          <div id="inline-cta-2" className="bg-gray-800 border border-gray-700 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Need Help Getting Started?</h3>
            <p className="mb-4">Chat with REX, our AI assistant, inside the HirePilot app for personalized guidance on collaboration features.</p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Chat with REX</button>
          </div>

          <div id="summary">
            <h2>🏁 Summary</h2>
            <p>
              Job REQ Collaboration turns HirePilot into a true collaborative hiring command center —
              no more spreadsheets, forwarded emails, or scattered notes.
            </p>
            <p>
              Just invite. Align. Hire.
            </p>
            <p>
              <strong>💡 Try it now → Open any Job REQ and click "Invite Collaborator"</strong>
            </p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Keep Reading</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png"
                alt="recruitment analytics dashboard with charts and metrics"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Pipeline</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Managing Candidates in the Pipeline – Workflow Best Practices</h3>
                <p className="text-gray-400 mb-4">
                  Keep your hiring funnel organized and collaborative with these proven strategies.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Jul 4, 2025</span>
                  <span className="mx-2">•</span>
                  <span>5 min read</span>
                </div>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png"
                alt="diverse team interview process with technology integration"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">AI Copilot</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Meet REX – Your AI Recruiting Copilot & Support Assistant</h3>
                <p className="text-gray-400 mb-4">
                  Automate outreach, enrichment, and support with REX's powerful AI capabilities.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Jul 4, 2025</span>
                  <span className="mx-2">•</span>
                  <span>7 min read</span>
                </div>
              </div>
            </article>

            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png"
                alt="remote work setup with video conferencing technology"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Product Update</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">HirePilot Just Became a Full ATS — And It's Free</h3>
                <p className="text-gray-400 mb-4">
                  One AI-powered system for sourcing, outreach, pipelines, job apps, and hiring.
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Sep 14, 2025</span>
                  <span className="mx-2">•</span>
                  <span>6 min read</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <div id="newsletter-signup" className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Stay Ahead of the Curve</h2>
          <p className="text-xl mb-8 text-blue-100">Join other recruiters automating their workflow with HirePilot</p>
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
