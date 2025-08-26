import React from 'react';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';

export default function RexAgentMode() {
  return (
    <>
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #111827; font-size: 2rem; font-weight: 800; margin-bottom: 1rem; }
        .prose h2 { color: #111827; font-size: 1.5rem; font-weight: 700; margin: 2rem 0 1rem 0; }
        .prose p { color: #374151; line-height: 1.8; margin-bottom: 1rem; }
        .prose ul { color: #374151; margin: 1rem 0 1rem 1.25rem; list-style: disc; }
        .prose li { margin-bottom: 0.5rem; }
        .prose img { border-radius: 12px; }
      `}</style>

      <PublicNavbar />

      {/* Hero */}
      <section className="relative bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 pt-16 pb-6">
          <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">Product Update</span>
          <h1 className="text-4xl md:text-5xl font-extrabold mt-4 mb-4">🚀 Introducing Agent Mode in HirePilot: Let REX Run Your Outbound for You</h1>
          <p className="text-gray-600 text-lg">HirePilot Team • Aug 26, 2025</p>
          <img src="/agent-mode-header-pic.png" alt="Agent Mode Header" className="w-full object-cover mt-6" />
        </div>
      </section>

      {/* Body */}
      <main className="bg-white">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <article className="prose max-w-none">
            <p>
              What if you could start, manage, and optimize sourcing campaigns — without lifting a finger?
            </p>
            <p>
              Today, we’re launching Agent Mode for all HirePilot users. This is not just automation. This is your very own AI teammate, powered by REX, that helps you reach the right people, message them with context, and grow your pipeline every single week.
            </p>

            <h2>🔁 Turn on Agent Mode, and Let REX Handle the Work</h2>
            <p>With one toggle, you can now enable REX to:</p>
            <ul>
              <li>Run sourcing actions like pulling leads and assigning sequences</li>
              <li>Manage follow-ups and reactivation messages</li>
              <li>Send prebuilt or AI-generated messaging sequences</li>
              <li>Check in with you once a week to plan the next move</li>
            </ul>
            <p>✳️ No more manual pulling, filtering, uploading, or emailing. Just give REX a goal — and it executes.</p>

            <h2>💬 Example: Weekly Campaigns with REX</h2>
            <p>Let’s say every Monday morning, you want to run a campaign targeting RevOps leaders.</p>
            <p>With Agent Mode on, REX will:</p>
            <ul>
              <li>Pull 200 fresh leads matching your titles</li>
              <li>Apply a 3-step nurture sequence</li>
              <li>Send them out using your preferred sender (SendGrid or Gmail)</li>
              <li>Track replies, classify intent, and help you follow up</li>
            </ul>
            <p>
              At the end of the week, REX summarizes: “You reached 200 leads. 13 replied. 4 are warm. Want to re-engage or pause this segment?” You approve, give a thumbs up, or adjust next week's targeting — all from the REX chat interface.
            </p>

            <h2>🤖 REX Agent 1: The Sourcing Agent (💼 REX – Sourcer)</h2>
            <p>REX Sourcer is your weekly workhorse. Use it to:</p>
            <ul>
              <li>Pull targeted leads from Apollo (based on title, region, industry, etc.)</li>
              <li>Automatically enrich with verified data</li>
              <li>Assign a sequence — either from templates or generated on the spot</li>
              <li>Choose whether to send from one sender or rotate between team accounts</li>
              <li>Track replies, manage follow-up, and re-engage leads later</li>
            </ul>
            <p>You can now view and manage all campaigns in your Agent Mode Center:</p>
            <img src="/agent-mode-blog.png" alt="Agent Mode Center" style={{ marginTop: 16 }} />

            <h2>🎯 REX Agent 2: The Sniper Agent (🎯 REX – Sniper)</h2>
            <p>This is your surgical intent hunter. REX Sniper captures hyper-relevant leads based on real activity across LinkedIn. Here's what it can do:</p>
            <ul>
              <li>Watch your posts and capture engagers (likes/comments)</li>
              <li>Monitor competitor posts and extract active leads</li>
              <li>Search for keywords/hashtags and gather fresh intent data</li>
            </ul>
            <p>Then it:</p>
            <ul>
              <li>Collects their name + LinkedIn URL (safely + rate-limited)</li>
              <li>Enriches via Apollo</li>
              <li>Tags them into a micro-campaign (e.g., "Sniper – RevOps W34")</li>
              <li>Crafts a short, specific, and personal opener based on the topic</li>
            </ul>
            <p>Perfect for daily drips:</p>
            <ul>
              <li>REX watches 3–4 active topics</li>
              <li>Grabs 10–15 high-intent leads/day</li>
              <li>You get warm conversations with minimal noise</li>
            </ul>

            <h2>🧠 What Can You Use REX For?</h2>
            <p>Let’s talk outcomes. Here's how our users are already using REX to grow:</p>
            <h3>🚀 For Recruiters & Talent Agencies</h3>
            <ul>
              <li>Get new recruiting clients (agencies love using REX to pitch their services)</li>
              <li>Run campaigns targeting VCs or startup HR leads</li>
              <li>Book more intro calls without spending hours pulling lists</li>
            </ul>
            <h3>🧲 For Founders</h3>
            <ul>
              <li>Reach ideal customers at scale, without hiring a team</li>
              <li>Run investor campaigns or partnership outreach</li>
              <li>Activate both inbound & outbound at the same time</li>
            </ul>
            <h3>🌍 For International Outreach</h3>
            <ul>
              <li>Target non-US regions with local sender domains</li>
              <li>Run translated sequences to capture new markets</li>
              <li>Layer sourcing & sniper agents for region-specific growth</li>
            </ul>

            <h2>✨ What You Can Say to REX (Sample Commands)</h2>
            <h3>🔹 Sourcing Agent</h3>
            <ul>
              <li>source 400 Heads of Talent in SaaS and start a 3-step sequence on Monday</li>
              <li>use my “Demo CTA” template on RevOps Week 34 tomorrow 10am</li>
              <li>resend the follow-up to the “PMs Q2” campaign — fire and forget</li>
              <li>track replies and draft responses for me</li>
            </ul>
            <h3>🔹 Sniper Agent</h3>
            <ul>
              <li>watch this post for 7 days and capture up to 15/day (just paste a LinkedIn URL)</li>
              <li>track posts that mention “ATS migration”, 10/day, and start a short opener</li>
              <li>push sniper captures into a Sniper – ATS W34 campaign and send</li>
            </ul>

            <h2>📊 Your Command Center: Campaign Dashboard</h2>
            <p>Track everything REX is doing in your Agent Mode Center:</p>
            <ul>
              <li>View all active campaigns by status</li>
              <li>Drill into each one to see leads, messages, and stats</li>
              <li>Pause, relaunch, or chat with REX directly to modify your approach</li>
            </ul>

            <h2>💡 Tip: Let REX Run Your Agency While You Sleep</h2>
            <p>Even if you’re just getting started, Agent Mode gives you leverage.</p>
            <ul>
              <li>Run 3–5 campaigns per week.</li>
              <li>Activate a sniper trigger.</li>
              <li>Review once a week.</li>
              <li>Refine as you grow.</li>
            </ul>
            <p>This is how small teams win like big ones.</p>

            <h2>🔘 Turn It On Today</h2>
            <p>
              Head to Connected Applications → Agent Mode and flip the switch.
            </p>
            <p>
              Let REX work while you sleep. Let your business scale while you build.
            </p>
            <p>Your agent is ready.</p>
          </article>
        </div>
      </main>

      <PublicFooter />
    </>
  );
}


