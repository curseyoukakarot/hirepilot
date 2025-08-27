import React, { useEffect, useState } from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function RexAgentMode() {
  const tocItems = [
    { id: 'introduction', label: 'Introduction' },
    { id: 'turn-on', label: 'Turn on Agent Mode' },
    { id: 'weekly-example', label: 'Weekly Campaign Example' },
    { id: 'sourcer', label: 'REX – Sourcer' },
    { id: 'sniper', label: 'REX – Sniper' },
    { id: 'sales', label: 'REX – Sales Agent (NEW)' },
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

      <BlogNavbar />

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
        <BlogTOC items={tocItems} />

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

          <div id="sales">
            <h2>REX Agent 3: Sales Agent (NEW)</h2>
            <p>The newest member of Agent Mode turns every reply into momentum. Sales Agent reads inbound messages, classifies intent, and either proposes polished drafts for your approval or replies automatically with your demo, pricing, and calendar — then tracks the thread through to the meeting and beyond.</p>

            <h3>What Sales Agent does</h3>
            <ul>
              <li>Monitors inbound replies from sourcing/sequences (email today; LinkedIn/web optional).</li>
              <li>Understands intent: positive, neutral, objection, OOO, unsubscribe.</li>
              <li>Acts by policy (your rules):</li>
              <ul>
                <li><strong>Share &amp; ask</strong>: proposes 2–3 concise drafts for you to approve in the Action Inbox.</li>
                <li><strong>Handle (auto-send)</strong>: replies instantly in your voice and offers your Calendly link.</li>
              </ul>
              <li>Sends the right assets (if you’ve added them): demo video, pricing page, one-pager, deck.</li>
              <li>Books meetings (Calendly event type), captures basic qualifiers, and updates the thread status.</li>
              <li>Respects guardrails: quiet hours, per-thread daily send limit, escalation on uncertainty.</li>
              <li>Gives you control: review drafts, edit &amp; send, quick Offer Meeting, escalate, or view the full Timeline of a thread.</li>
            </ul>

            <h3>Quick start (two minutes)</h3>
            <ol>
              <li>Open: Settings → Sales Agent.</li>
              <li>Pick a mode: <em>Handle (auto-send)</em> for speed, or <em>Share &amp; ask</em> to approve each reply.</li>
              <li>Set a sender (required for sending): your verified SendGrid from-address.</li>
              <li>Add assets (optional, recommended): demo URL, pricing page, one-pager.</li>
              <li>Calendly event type: e.g., <code>hirepilot/15min-intro</code>.</li>
              <li>Limits: keep 1 send per thread per day and quiet hours (e.g., 20:00–07:00) unless you know you need more.</li>
              <li>Test tools (right on the page): Send test email; Simulate inbound reply to see the flow.</li>
              <li>Done. New replies will route into Action Inbox (and Slack, if connected).</li>
            </ol>
            <p><em>Tip:</em> If sender or links are missing, you’ll see a banner with exactly what to complete. The agent never fabricates links.</p>

            <h3>Two operating modes</h3>
            <h4>1) Share &amp; ask (approval mode)</h4>
            <ul>
              <li>The agent proposes 2–3 drafts (short, clear CTA, your tone).</li>
              <li>You approve in one click (or Edit &amp; Send) from the Action Inbox.</li>
              <li>Great for teams adopting Agent Mode or for sensitive deals.</li>
            </ul>
            <h4>2) Handle (auto-send)</h4>
            <ul>
              <li>The agent replies automatically within your limits and quiet hours.</li>
              <li>Positive replies get demo/pricing + Calendly. Objections get concise answers + proof (and still offer time).</li>
              <li>If something’s unclear, it escalates for your review.</li>
            </ul>

            <h3>The experience: Action Inbox + Timeline</h3>
            <p><strong>Action Inbox</strong> shows threads awaiting you with:</p>
            <ul>
              <li>Latest inbound message</li>
              <li>Up to 3 proposed drafts</li>
              <li>Buttons: Send this, Edit &amp; Send, Offer Meeting, Escalate</li>
              <li>Quick Insert chips (Demo, Pricing, Calendly, One-pager)</li>
            </ul>
            <p><strong>Timeline Drawer</strong> (View timeline) shows the full history: inbound/outbound/drafts + actions.</p>

            <h3>How it pairs with the other agents</h3>
            <ul>
              <li><strong>Sourcing Agent</strong> fills the top of the funnel from Apollo with sequenced outreach.</li>
              <li><strong>Sniper Agent</strong> adds daily micro-lists from live social intent (commenters/likers/keywords).</li>
              <li><strong>Sales Agent</strong> turns replies into calls and signups — hands-off or with your approval.</li>
            </ul>
            <p><em>Think: volume + intent → conversion.</em></p>

            <h3>Recommended setup</h3>
            <ul>
              <li><strong>Sender</strong>: start with Single sender per workspace (simpler reputation).</li>
              <li><strong>Tone</strong>: “friendly &amp; direct”, short replies (≤120 words), one CTA.</li>
              <li><strong>Assets</strong>: add at least a demo and pricing link so the agent can answer fast.</li>
              <li><strong>Calendly</strong>: set your default event type; the agent uses it on positive intent.</li>
              <li><strong>Limits</strong>: keep 1 send/day/thread and quiet hours on; increase later if needed.</li>
            </ul>

            <h3>What can Sales Agent handle?</h3>
            <ul>
              <li>Answer “What’s the price? / Can I see a demo?” with your links + book a time.</li>
              <li>Confirm interest and ask two qualifiers (team size, timeline) when helpful.</li>
              <li>Recognize OOO and pause until they’re back.</li>
              <li>Process unsubscribe cleanly.</li>
              <li>Generate and send proposal PDFs for DFY/enterprise (optional add-on).</li>
              <li>Keep a clean audit trail (per-thread actions &amp; messages).</li>
            </ul>

            <h3>Talk to REX: commands you can use today</h3>
            <h4>Configure policy (once)</h4>
            <ul>
              <li>“REX, set my Sales Agent sender to jane@agency.com.”</li>
              <li>“REX, add my demo https://youtu.be/abc and pricing https://myagency.com/pricing.”</li>
              <li>“REX, use Calendly event myagency/15min-intro.”</li>
              <li>“REX, switch Sales Agent to Share &amp; ask.”</li>
              <li>“REX, set tone to professional and keep replies under 120 words.”</li>
            </ul>

            <h4>Per-thread actions</h4>
            <ul>
              <li>“REX, handle replies for thread {{threadId}} end-to-end.”</li>
              <li>“REX, propose 3 drafts for thread {{threadId}}.”</li>
              <li>“REX, offer a meeting on thread {{threadId}} with the 15-min link.”</li>
              <li>“REX, send the DFY starter one-pager on thread {{threadId}} and propose a 30-min call.”</li>
            </ul>

            <h4>Sweeps &amp; reporting</h4>
            <ul>
              <li>“REX, sweep stuck threads from the last 24 hours and draft nudges.”</li>
              <li>“REX, summarize this week’s inbound and what we booked.”</li>
            </ul>

            <h3>Real-world plays (copy/paste)</h3>
            <h4>Get new recruiting clients</h4>
            <p>“REX, when someone replies ‘interested’, send demo + pricing and offer my 15-min link. If no response in 48 hours, nudge with a short case study.”</p>
            <h4>Fill a job req</h4>
            <p>“REX, for candidates who ask about comp or timeline, answer briefly and book a 15-min screen with the hiring manager’s link.”</p>
            <h4>Partnership outreach with VCs</h4>
            <p>“REX, for partners who reply ‘tell me more’, send the 1-pager + 15-min link and ask for 2–3 portfolio intros.”</p>
            <h4>International expansion</h4>
            <p>“REX, when a non-US lead replies, use my international pricing link and suggest morning CST slots.”</p>

            <h3>Guardrails &amp; good citizenship</h3>
            <ul>
              <li>No fabricated links: if you haven’t configured demo/pricing, the agent will omit them and escalate if needed.</li>
              <li>Deliverability: we default to single sender, quiet hours, and a per-thread daily limit. You can raise limits as your program matures.</li>
              <li>Transparency: every action is logged and visible in the Timeline.</li>
            </ul>

            <h3>Enable it now</h3>
            <ol>
              <li>Go to Settings → Sales Agent.</li>
              <li>Add sender, demo, pricing, Calendly.</li>
              <li>Choose Handle or Share &amp; ask.</li>
              <li>Click Send test email to confirm everything is wired.</li>
              <li>Watch the Action Inbox light up as replies arrive. 🎉</li>
            </ol>
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


