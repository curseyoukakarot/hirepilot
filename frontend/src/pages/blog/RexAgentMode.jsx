import React, { useEffect, useState } from 'react';

export default function RexAgentMode() {
  const tocItems = [
    { id: 'introduction', label: 'Introduction' },
    { id: 'turn-on', label: 'Turn on Agent Mode' },
    { id: 'weekly-example', label: 'Weekly Campaign Example' },
    { id: 'sourcer', label: 'REX – Sourcer' },
    { id: 'sniper', label: 'REX – Sniper' },
    { id: 'use-cases', label: 'Use Cases' },
    { id: 'sample-commands', label: 'Sample Commands' },
    { id: 'command-center', label: 'Command Center' },
    { id: 'pro-tip', label: 'Pro Tip' },
    { id: 'get-started', label: 'Get Started' },
  ];

  const [activeId, setActiveId] = useState('introduction');

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { root: null, rootMargin: '0px 0px -60% 0px', threshold: 0.1 }
    );

    const elements = tocItems
      .map(t => document.getElementById(t.id))
      .filter(Boolean);
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <>
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose h3 { color: #f3f4f6; font-size: 1.125rem; font-weight: 600; margin: 1.5rem 0 0.75rem 0; }
        .prose p { color: #d1d5db; line-height: 1.7; margin-bottom: 1.25rem; }
        .prose ul { color: #d1d5db; margin: 1.25rem 0 1.5rem; padding-left: 1.25rem; }
        .prose li { margin-bottom: 0.5rem; }
        .prose blockquote { border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 2rem 0; font-style: italic; color: #9ca3af; }
        .prose code { background: #374151; color: #f9fafb; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.875rem; }
        .prose pre { background: #1f2937; padding: 1.25rem; border-radius: 0.5rem; overflow-x: auto; margin: 1.5rem 0; }
        .prose figure { margin: 1.25rem 0 1.5rem; }
        .prose figcaption { color: #9ca3af; font-size: 0.875rem; margin-top: 0.5rem; text-align: center; }
        .toc-active { color: #3b82f6; }
        .force-white, .force-white * { color: #ffffff !important; }
        #related-articles h3 { color: #ffffff !important; }
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
          className="w-full h-[360px] object-cover"
          src="/agent-mode-header-pic.png"
          alt="Agent Mode launch header"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-10 w-full">
            <div className="mb-3">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">Product Update</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Introducing Agent Mode in HirePilot: Let REX Run Your Outbound for You</h1>
            <p className="text-lg text-gray-200 mb-5">Let REX source, message, and manage campaigns while you sleep.</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg"
                alt="Author"
                className="w-10 h-10 rounded-full"
              />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on Aug 26, 2025</p>
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
              {tocItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={`block text-left w-full py-1 cursor-pointer transition-colors ${activeId===item.id? 'toc-active' : 'text-gray-400 hover:text-white'}`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <div id="introduction">
            <p>
              What if you could start, manage, and optimize sourcing campaigns — without lifting a finger?
            </p>
            <p>
              Today, we’re launching Agent Mode for all HirePilot users. This is not just automation. This is your very own AI teammate, powered by REX, that helps you reach the right people, message them with context, and grow your pipeline every single week.
            </p>
          </div>

          <div id="turn-on">
            <h2>Turn on Agent Mode, and Let REX Handle the Work</h2>
            <p>With one toggle, you can now enable REX to:</p>
            <ul>
              <li>Run sourcing actions like pulling leads and assigning sequences</li>
              <li>Manage follow-ups and reactivation messages</li>
              <li>Send prebuilt or AI-generated messaging sequences</li>
              <li>Check in with you once a week to plan the next move</li>
            </ul>
            <p>✳️ No more manual pulling, filtering, uploading, or emailing. Just give REX a goal — and it executes.</p>
          </div>

          <div id="weekly-example">
            <h2>Example: Weekly Campaigns with REX</h2>
            <p>Let’s say every Monday morning, you want to run a campaign targeting RevOps leaders.</p>
            <p>With Agent Mode on, REX will:</p>
            <ul>
              <li>Pull 200 fresh leads matching your titles</li>
              <li>Apply a 3-step nurture sequence</li>
              <li>Send them out using your preferred sender (SendGrid or Gmail)</li>
              <li>Track replies, classify intent, and help you follow up</li>
            </ul>
            <blockquote>
              “You reached 200 leads. 13 replied. 4 are warm. Want to re-engage or pause this segment?”
            </blockquote>
            <p>You approve or adjust next week's targeting — all from the REX chat interface.</p>
          </div>

          <div id="sourcer">
            <h2>REX Agent 1: The Sourcing Agent (REX – Sourcer)</h2>
            <p>REX Sourcer is your weekly workhorse. Use it to:</p>
            <ul>
              <li>Pull targeted leads from Apollo (based on title, region, industry, etc.)</li>
              <li>Automatically enrich with verified data</li>
              <li>Assign a sequence — either from templates or generated on the spot</li>
              <li>Choose whether to send from one sender or rotate between team accounts</li>
              <li>Track replies, manage follow-up, and re-engage leads later</li>
            </ul>
            <figure>
              <img src="/agent-mode-blog.png" alt="Agent Mode Center screenshot" className="rounded-lg border border-gray-800 w-full" />
              <figcaption>Manage all Agent Mode campaigns in one place.</figcaption>
            </figure>
          </div>

          <div id="sniper">
            <h2>REX Agent 2: The Sniper Agent (REX – Sniper)</h2>
            <p>This is your surgical intent hunter. REX Sniper captures hyper-relevant leads based on real activity across LinkedIn.</p>
            <h3>What it can track</h3>
            <ul>
              <li>Engagers on your posts (likes/comments)</li>
              <li>Competitor posts and active participants</li>
              <li>Keywords/hashtags for fresh intent data</li>
            </ul>
            <h3>Then it</h3>
            <ul>
              <li>Collects name + LinkedIn URL (safely + rate-limited)</li>
              <li>Enriches via Apollo</li>
              <li>Tags into a micro-campaign (e.g., "Sniper – RevOps W34")</li>
              <li>Crafts a short, specific opener based on the topic</li>
            </ul>
            <p>Perfect for daily drips: watches 3–4 topics, grabs 10–15 high-intent leads/day, and creates warm conversations with minimal noise.</p>
          </div>

          <div id="use-cases">
            <h2>What Can You Use REX For?</h2>
            <h3>For Recruiters & Talent Agencies</h3>
            <ul>
              <li>Get new recruiting clients</li>
              <li>Run campaigns targeting VCs or startup HR leads</li>
              <li>Book more intro calls without hours of list pulling</li>
            </ul>
            <h3>For Founders</h3>
            <ul>
              <li>Reach ideal customers at scale</li>
              <li>Run investor or partnership outreach</li>
              <li>Activate inbound and outbound together</li>
            </ul>
            <h3>For International Outreach</h3>
            <ul>
              <li>Target non-US regions with local domains</li>
              <li>Run translated sequences</li>
              <li>Layer sourcing & sniper agents per region</li>
            </ul>
          </div>

          <div id="sample-commands">
            <h2>What You Can Say to REX (Sample Commands)</h2>
            <h3>Sourcing Agent</h3>
            <ul>
              <li>source 400 Heads of Talent in SaaS and start a 3-step sequence on Monday</li>
              <li>use my “Demo CTA” template on RevOps Week 34 tomorrow 10am</li>
              <li>resend the follow-up to the “PMs Q2” campaign — fire and forget</li>
              <li>track replies and draft responses for me</li>
            </ul>
            <h3>Sniper Agent</h3>
            <ul>
              <li>watch this post for 7 days and capture up to 15/day (paste a LinkedIn URL)</li>
              <li>track posts that mention “ATS migration”, 10/day, and start a short opener</li>
              <li>push sniper captures into a Sniper – ATS W34 campaign and send</li>
            </ul>
          </div>

          <div id="command-center">
            <h2>Your Command Center: Campaign Dashboard</h2>
            <ul>
              <li>View all active campaigns by status</li>
              <li>Drill into each one to see leads, messages, and stats</li>
              <li>Pause, relaunch, or chat with REX directly to modify your approach</li>
            </ul>
          </div>

          <div id="pro-tip">
            <h2>Tip: Let REX Run Your Agency While You Sleep</h2>
            <ul>
              <li>Run 3–5 campaigns per week</li>
              <li>Activate a sniper trigger</li>
              <li>Review once a week</li>
              <li>Refine as you grow</li>
            </ul>
            <p>This is how small teams win like big ones.</p>
          </div>

          {/* CTA */}
          <div className="bg-blue-600 rounded-lg p-6 my-8 text-center">
            <h3 className="text-xl font-semibold mb-2 text-white">Turn on Agent Mode Today</h3>
            <p className="mb-4 text-blue-100">Head to Connected Applications → Agent Mode and flip the switch.</p>
            <a href="/pricing" className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block">Start Free</a>
          </div>

          <div id="get-started">
            <h2>Get Started</h2>
            <p>Let REX work while you sleep. Let your business scale while you build. Your agent is ready.</p>
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
                alt="REX automation overview"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Automation</span>
                <h3 className="text-xl font-semibold mt-2 mb-3 force-white"><a href="/blog/AutomateRecruiting1" className="hover:underline">Automate Your Recruiting with HirePilot + REX</a></h3>
                <p className="text-gray-400 mb-4">How REX turns recruiting into a scalable engine.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Jan 15, 2025</span>
                  <span className="mx-2">•</span>
                  <span>6 min read</span>
                </div>
              </div>
            </article>
            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png"
                alt="Zapier integration guide"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Integrations</span>
                <h3 className="text-xl font-semibold mt-2 mb-3 force-white"><a href="/blog/zapierguide" className="hover:underline">HirePilot + Zapier/Make</a></h3>
                <p className="text-gray-400 mb-4">Connect your stack and automate workflows in minutes.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Aug 9, 2025</span>
                  <span className="mx-2">•</span>
                  <span>7 min read</span>
                </div>
              </div>
            </article>
            <article className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
              <img
                className="w-full h-48 object-cover"
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png"
                alt="Email deliverability best practices"
              />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Deliverability</span>
                <h3 className="text-xl font-semibold mt-2 mb-3 force-white"><a href="/blog/email-deliverability-1" className="hover:underline">Avoid Spam Filters & Get More Replies</a></h3>
                <p className="text-gray-400 mb-4">Setup and practices to maximize inbox placement.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Jul 24, 2025</span>
                  <span className="mx-2">•</span>
                  <span>5 min read</span>
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


