import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function WhyWeMadeAtsFree() {
  return (
    <>
      {/* Scoped styles preserved from BlogArticle template format */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose h3 { color: #d1d5db; font-size: 1.15rem; font-weight: 600; margin: 1.25rem 0 0.75rem 0; }
        .prose p { color: #d1d5db; line-height: 1.7; margin-bottom: 1.1rem; }
        .prose ul { color: #d1d5db; margin: 1rem 0 1.25rem 1.25rem; list-style: disc; }
        .prose li { margin-bottom: 0.5rem; }
      `}</style>

      <BlogNavbar />

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
          alt="ATS workflow and recruiting infrastructure dashboard"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-sm font-medium">Product Philosophy</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Why We Made a Full ATS Free</h1>
            <p className="text-xl text-gray-200 mb-6">Why candidate tracking infrastructure should be accessible, and why HirePilot monetizes execution instead.</p>
            <div className="flex items-center space-x-4">
              <img src="/logo.png" alt="Author" className="w-12 h-12 rounded-full" />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on Feb 21, 2026</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div id="main-content" className="flex max-w-6xl mx-auto px-6 py-12 gap-8">
        <BlogTOC />

        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <div id="intro">
            <p>Most recruiting software companies optimize for one thing: lock-in.</p>
            <p>Gate core features. Restrict pipeline access. Limit collaboration. Force upgrades early. Charge just to track candidates.</p>
            <p>We chose a different path.</p>
            <p>HirePilot includes a full Applicant Tracking System for free. That was deliberate.</p>
          </div>

          <div id="problem-pricing">
            <h2>The Problem With Traditional ATS Pricing</h2>
            <p>The common ATS model looks like this:</p>
            <ul>
              <li>Free trial (14 days)</li>
              <li>Then pay per seat</li>
              <li>Pay per workspace</li>
              <li>Pay to unlock reporting</li>
              <li>Pay to add collaborators</li>
              <li>Pay to customize pipelines</li>
              <li>Pay to export data</li>
            </ul>
            <p>Even small agencies quickly run into high recurring costs, plus separate tools for outreach, billing, and integrations.</p>
            <p>Tracking candidates should not be a luxury. It should be foundational.</p>
          </div>

          <div id="ats-is-infrastructure">
            <h2>An ATS Is Infrastructure - Not a Premium Feature</h2>
            <p>At its core, an ATS does three things:</p>
            <ul>
              <li>Tracks candidates</li>
              <li>Tracks job requisitions</li>
              <li>Tracks pipeline stages</li>
            </ul>
            <p>That is table stakes, not premium functionality.</p>
            <p>We believe infrastructure should be accessible. Candidate tracking and pipeline management should never require a credit card.</p>
          </div>

          <div id="free-not-limited">
            <h2>Free Does Not Mean Limited</h2>
            <p>When we say "Full ATS Free," we mean:</p>
            <ul>
              <li>Job REQ creation</li>
              <li>Custom pipeline stages</li>
              <li>Candidate tracking</li>
              <li>Pipeline movement</li>
              <li>Notes</li>
              <li>Collaboration (within plan limits)</li>
              <li>Core reporting</li>
              <li>Integration with sourcing</li>
              <li>Integration with outreach</li>
            </ul>
            <p>You are not getting a lite version. You are getting real operational capability.</p>
          </div>

          <div id="where-value-lives">
            <h2>Where Value Actually Lives</h2>
            <p>The highest leverage in recruiting is not in basic stage movement or job entry.</p>
            <p>It lives in:</p>
            <ul>
              <li>Sourcing at scale</li>
              <li>Intelligent enrichment</li>
              <li>AI-assisted outreach</li>
              <li>Automation</li>
              <li>Revenue tracking</li>
              <li>Advanced execution tools</li>
            </ul>
            <p>That is where HirePilot monetizes, not at the foundational layer.</p>
          </div>

          <div id="remove-paywall">
            <h2>Removing the Paywall to Professionalism</h2>
            <p>Many new recruiters are forced into spreadsheets or expensive monthly fees too early.</p>
            <p>We want recruiters to start clean, build pipeline discipline, and operate professionally from day one.</p>
            <p>If you need advanced AI and automation later, it is there. If you only need a clean ATS, it is still there.</p>
          </div>

          <div id="confidence-in-system">
            <h2>Confidence in the System</h2>
            <p>Making a full ATS free is a signal: we are confident in the product.</p>
            <p>Once users experience sourcing, enrichment, automation, deals, dashboards, and AI in one architecture, they stay because the system delivers value, not because they are trapped.</p>
          </div>

          <div id="bigger-strategy">
            <h2>The Bigger Strategy</h2>
            <p>This aligns with our mission: remove manual barriers.</p>
            <p>If candidate tracking sits behind a paywall, teams revert to spreadsheets. Spreadsheets reintroduce friction. Friction slows execution and revenue.</p>
            <p>Making the ATS free helps keep data centralized, workflows structured, and AI layers connected cleanly.</p>
          </div>

          <div id="accessibility-innovation">
            <h2>Accessibility Drives Innovation</h2>
            <p>When infrastructure is accessible:</p>
            <ul>
              <li>More recruiters experiment</li>
              <li>More agencies professionalize</li>
              <li>More teams collaborate</li>
              <li>More operators build systems</li>
              <li>More innovation happens</li>
            </ul>
            <p>We want HirePilot to be the recruiting command center, not an elite gated tool.</p>
          </div>

          <div id="lets-be-honest">
            <h2>But Let&apos;s Be Honest</h2>
            <p>Free ATS does not mean free business. HirePilot invests heavily in infrastructure, AI, integrations, security, development, and support.</p>
            <p>Our revenue model is clear:</p>
            <ul>
              <li>Advanced automation</li>
              <li>AI sourcing</li>
              <li>Enhanced enrichment</li>
              <li>Credit-based execution</li>
              <li>Revenue modules</li>
              <li>Workspace expansion</li>
            </ul>
            <p>We monetize leverage, not fundamentals.</p>
          </div>

          <div id="different-relationship">
            <h2>A Different Kind of Relationship</h2>
            <p>Traditional software says: pay to access.</p>
            <p>HirePilot says: access first, scale when ready.</p>
            <p>That creates trust, and trust creates long-term partnerships.</p>
          </div>

          <div id="what-this-means">
            <h2>What This Means for You</h2>
            <p>If you are a recruiter, you can build job REQs, pipelines, candidate tracking, collaboration, and workflow organization without paying.</p>
            <p>As you grow, you can add Agent Mode, Sniper sourcing, AI outreach, enhanced enrichment, deals and billing, and custom dashboards when it actually makes sense.</p>
            <p>You scale with capability, not obligation.</p>
          </div>

          <div id="philosophy">
            <h2>The Philosophy Behind It</h2>
            <p>Recruiting is performance-driven, relationship-driven, and outcome-driven. Your tools should not make it harder.</p>
            <p>By making the ATS free, we remove one more barrier.</p>
            <p>You should not have to earn the right to track candidates. You should earn revenue from the system.</p>
          </div>

          <div id="final-thought">
            <h2>Final Thought</h2>
            <p>We did not make the ATS free to compete. We made it free because it is foundational.</p>
            <p>Tracking candidates is infrastructure, and infrastructure should be accessible.</p>
            <p>The real value of HirePilot lives in the execution layer. Once you operate inside the system, you will not want to go back.</p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Keep Reading</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <a href="/blog/hirepilot-full-ats" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png" alt="HirePilot full ATS product overview" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Product Update</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">HirePilot Just Became a Full ATS - And It&apos;s Free</h3>
                <p className="text-gray-400 mb-4">One AI-powered system for sourcing, outreach, pipelines, job apps, and hiring.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Sep 14, 2025</span>
                  <span className="mx-2">•</span>
                  <span>6 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/hirepilot-workflow-replacement" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png" alt="Workflow consolidation and recruiting command center" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Playbook</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">How HirePilot Fits Into (And Replaces) Your Current Recruiting Workflow</h3>
                <p className="text-gray-400 mb-4">How to consolidate fragmented tools into one recruiting command center.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>8 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/founder-mission-manual-barriers" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png" alt="Founder mission and recruiting philosophy" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">From the Founder</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">My Mission With HirePilot: Removing Manual Barriers From Recruiting</h3>
                <p className="text-gray-400 mb-4">Why reducing operational friction is central to HirePilot&apos;s product philosophy.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>7 min read</span>
                </div>
              </div>
            </a>
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
