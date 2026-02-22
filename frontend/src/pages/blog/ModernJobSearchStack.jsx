import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function ModernJobSearchStack() {
  return (
    <>
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

      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
          alt="Modern job search workflow stack for serious candidates"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-emerald-700 text-white px-3 py-1 rounded-full text-sm font-medium">Job Search Strategy</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">The Modern Job Search Stack (For Serious Candidates)</h1>
            <p className="text-xl text-gray-200 mb-6">The tools, strategy, and leverage layers that turn reactive job search into a controlled system.</p>
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

      <div id="main-content" className="flex max-w-6xl mx-auto px-6 py-12 gap-8">
        <BlogTOC />
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <div id="intro">
            <p>Most candidates rely on one move: apply.</p>
            <p>That is not a stack. It is a hope strategy.</p>
            <p>Serious candidates build a five-layer system: positioning, visibility, targeting, outreach, and performance.</p>
          </div>

          <div id="layer-1-positioning">
            <h2>Layer 1: Positioning</h2>
            <p>Before applying or outreach, define what you want to be hired for.</p>
            <p>Positioning includes:</p>
            <ul>
              <li>Clear role targeting</li>
              <li>Strong resume structure</li>
              <li>Keyword alignment</li>
              <li>Impact-driven storytelling</li>
              <li>Consistent LinkedIn branding</li>
            </ul>
            <p>Inside jobs.thehirepilot.com, this happens in Prep Mode with Resume Builder, Resume Parser and Score, and Landing Page Builder.</p>
            <p>Clear positioning creates traction. Weak positioning creates confusion.</p>
          </div>

          <div id="layer-2-visibility">
            <h2>Layer 2: Visibility</h2>
            <p>If recruiters cannot find you, you effectively do not exist.</p>
            <p>Visibility includes optimized LinkedIn presence, recruiter-search keywords, a personal landing page, and shareable portfolio links.</p>
            <p>Applications alone rarely create visibility. Direct contact does.</p>
          </div>

          <div id="layer-3-targeting">
            <h2>Layer 3: Targeting</h2>
            <p>Instead of random applications, modern candidates identify hiring managers, directors, founders, and team leads.</p>
            <p>The Job Seeker Agent helps candidates paste a LinkedIn job-search URL, extract signals, identify decision-makers, and prioritize outreach.</p>
            <p>You stop chasing job posts and start targeting people.</p>
          </div>

          <div id="layer-4-outreach">
            <h2>Layer 4: Outreach</h2>
            <p>This is where conversations begin.</p>
            <p>Effective outreach is personalized, contextual, concise, value-aware, and includes a clear ask.</p>
            <p>The Job Seeker Agent helps scale this through structured targeting and AI cloud processing.</p>
            <p>Not spam. Strategic engagement.</p>
          </div>

          <div id="layer-5-performance">
            <h2>Layer 5: Performance</h2>
            <p>Once conversation starts, conversion depends on interview performance.</p>
            <p>This layer includes structured storytelling, confidence training, delivery refinement, and live rehearsal.</p>
            <p>REX Voice and Interview Helper complete the stack by turning preparation into execution readiness.</p>
          </div>

          <div id="why-most-fail">
            <h2>Why Most Candidates Fail</h2>
            <p>Common patterns include over-reliance on applications, little direct outreach, weak interview prep, and reactive behavior.</p>
            <p>The modern stack is proactive and leverage-driven.</p>
          </div>

          <div id="applications-vs-conversations">
            <h2>Applications vs Conversations</h2>
            <p>Applications rely on algorithms. Conversations rely on relationships.</p>
            <p>Algorithms filter. Relationships decide.</p>
            <p>To gain more control, visibility, and interviews, candidates must shift from volume to leverage.</p>
          </div>

          <div id="complete-modern-stack">
            <h2>The Complete Modern Stack</h2>
            <p>Inside jobs.thehirepilot.com:</p>
            <ul>
              <li>Prep Mode strengthens positioning</li>
              <li>Job Seeker Agent enables targeting + outreach</li>
              <li>Interview Helper elevates performance</li>
            </ul>
            <p>That is a system, not a guess.</p>
          </div>

          <div id="final-thought">
            <h2>Final Thought</h2>
            <p>The market rewards clarity, confidence, and visibility.</p>
            <p>Winning candidates are not always the most experienced. They are often the most strategic.</p>
            <p>Build your stack. Prepare properly. Target intelligently. Create conversations. Then convert them.</p>
          </div>
        </article>
      </div>
    </>
  );
}
