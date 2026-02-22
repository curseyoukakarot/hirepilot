import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function RexVoiceInterviewHelper() {
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
          alt="AI voice interview coaching experience for job seekers"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-sky-700 text-white px-3 py-1 rounded-full text-sm font-medium">Job Seeker AI</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">REX Voice &amp; Interview Helper - AI-Powered Interview Coaching for Job Seekers (jobs.thehirepilot.com)</h1>
            <p className="text-xl text-gray-200 mb-6">How real-time voice coaching helps candidates practice, refine delivery, and interview with confidence.</p>
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
          <div id="what-is-rex-voice">
            <h2>What Is REX Voice?</h2>
            <p>REX Voice is an AI-powered, real-time interview assistant designed for job seekers.</p>
            <p>It helps candidates:</p>
            <ul>
              <li>Practice interview questions aloud</li>
              <li>Receive structured feedback</li>
              <li>Improve clarity and confidence</li>
              <li>Refine positioning</li>
              <li>Strengthen storytelling</li>
              <li>Build stronger responses</li>
            </ul>
            <p>It is not a chatbot. It is an interactive voice experience.</p>
            <p>Core experience modes include Supportive Coach behavior, hands-free and push-to-talk options, and a live listening interaction flow.</p>
            <p>Interviews are spoken environments, so preparation should be spoken too.</p>
          </div>

          <div id="why-voice-matters">
            <h2>Why Voice Matters</h2>
            <p>Typing an answer is not the same as saying it out loud.</p>
            <p>When candidates speak, tone, clarity, filler words, pacing issues, and structure gaps become visible.</p>
            <p>Voice practice reveals what typing can hide.</p>
            <p>REX Voice helps candidates practice naturally, hear themselves think, improve delivery, and refine responses through repetition.</p>
          </div>

          <div id="supportive-coach-mode">
            <h2>Supportive Coach Mode</h2>
            <p>Supportive Coach mode is intentional.</p>
            <p>REX Voice is not a harsh evaluator. It acts as a structured feedback engine, clarity improver, confidence builder, and answer refiner.</p>
            <p>It can help candidates:</p>
            <ul>
              <li>Tighten responses</li>
              <li>Strengthen storytelling</li>
              <li>Clarify impact</li>
              <li>Align answers with role expectations</li>
              <li>Reduce filler language</li>
              <li>Improve executive presence</li>
            </ul>
            <p>The experience is designed to elevate, not intimidate.</p>
          </div>

          <div id="interview-helper-layer">
            <h2>The Interview Helper Layer</h2>
            <p>Beyond live voice interaction, Interview Helper supports:</p>
            <ul>
              <li>Structured response guidance</li>
              <li>Resume-aware suggestions</li>
              <li>STAR method alignment</li>
              <li>Industry-specific context</li>
              <li>Positioning refinement</li>
              <li>Skill articulation support</li>
            </ul>
            <p>Instead of generic advice, candidates get contextual suggestions they can act on immediately.</p>
          </div>

          <div id="who-its-built-for">
            <h2>Who It&apos;s Built For</h2>
            <p>REX Voice and Interview Helper are built for:</p>
            <ul>
              <li>Early career professionals</li>
              <li>Mid-level operators</li>
              <li>Senior leaders</li>
              <li>Executive candidates</li>
              <li>Career switchers</li>
              <li>RecruitPro students</li>
              <li>Job seekers using jobs.thehirepilot.com</li>
            </ul>
            <p>This is not part of the recruiter-facing HirePilot app. It is part of the job seeker experience at `jobs.thehirepilot.com`.</p>
          </div>

          <div id="bigger-philosophy">
            <h2>The Bigger Philosophy</h2>
            <p>The same principle applies across the platform: AI should strengthen people, not replace them.</p>
            <p>REX Voice does not replace real interviews, guarantee offers, or remove preparation effort.</p>
            <p>It removes isolation, guesswork, lack of feedback, and inefficient rehearsal loops.</p>
            <p>Structure builds confidence.</p>
          </div>

          <div id="market-impact">
            <h2>Why This Matters in Today&apos;s Market</h2>
            <p>Interviews are competitive. Candidates with clear articulation, structured storytelling, measured tone, and confident delivery tend to perform better.</p>
            <p>REX Voice helps level the playing field by improving delivery quality, not by scripting people.</p>
          </div>

          <div id="ecosystem-connection">
            <h2>Connecting the Ecosystem</h2>
            <p>HirePilot supports both sides of hiring:</p>
            <ul>
              <li>Recruiters use HirePilot for sourcing, enrichment, automation, pipeline, and revenue tracking</li>
              <li>Job seekers use jobs.thehirepilot.com for resume building, interview practice, positioning, and confidence</li>
            </ul>
            <p>One platform powers recruiters. The other empowers candidates. That symmetry is intentional.</p>
          </div>

          <div id="long-term-vision">
            <h2>The Long-Term Vision</h2>
            <p>The long-term mission is to raise quality on both sides of hiring: better recruiters, better candidates, better interviews, and better matches.</p>
            <p>REX Voice helps candidates show up prepared with structure and confidence.</p>
          </div>

          <div id="final-thought">
            <h2>Final Thought</h2>
            <p>Recruiters need infrastructure. Candidates need confidence. HirePilot builds for both.</p>
            <p>REX Voice and Interview Helper are built exclusively for job seekers at `jobs.thehirepilot.com`.</p>
            <p>They represent a new layer of AI that strengthens people, not replaces them.</p>
          </div>
        </article>
      </div>

      {/* Related articles */}
      <div id="related-articles" className="bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Keep Reading</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <a href="/blog/agent-mode-deep-dive" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png" alt="Agent Mode orchestration layer in HirePilot" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Agent Mode</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Agent Mode Deep Dive - The Orchestration Layer Powering HirePilot&apos;s Autonomous Recruiting OS</h3>
                <p className="text-gray-400 mb-4">How execution control works across sourcing, sales automation, and planning.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>9 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/enhanced-enrichment-deep-dive" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/ae9ba539d4-75ea5d607595907901a7.png" alt="Enhanced enrichment intelligence for targeting" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">Enrichment</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Enhanced Enrichment Deep Dive</h3>
                <p className="text-gray-400 mb-4">How funding, revenue, PR, and keywords improve recruiting strategy.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>8 min read</span>
                </div>
              </div>
            </a>

            <a href="/blog/sniper-2-0-dependency-aware-sourcing" className="bg-gray-900 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 block">
              <img className="w-full h-48 object-cover" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png" alt="Sniper 2.0 intelligent sourcing execution" />
              <div className="p-6">
                <span className="text-blue-400 text-sm font-medium">AI Sourcing</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">Sniper 2.0: Intelligent, Dependency-Aware AI Sourcing for Recruiters</h3>
                <p className="text-gray-400 mb-4">Dependency-aware sourcing logic with quality guardrails and execution control.</p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Feb 21, 2026</span>
                  <span className="mx-2">•</span>
                  <span>8 min read</span>
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
