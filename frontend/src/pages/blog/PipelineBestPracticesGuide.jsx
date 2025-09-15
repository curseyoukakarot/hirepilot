import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function PipelineBestPracticesGuide() {
  return (
    <>
      {/* Scoped styles */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose p { color: #d1d5db; line-height: 1.7; margin-bottom: 1.5rem; }
        .prose ul { color: #d1d5db; margin: 1.5rem 0; }
        .prose li { margin-bottom: 0.5rem; }
        .prose blockquote { border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 2rem 0; font-style: italic; color: #9ca3af; }
      `}</style>

      <BlogNavbar />

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/75caae2492-c87687c0aa429fc7491c.png"
          alt="Pipeline board illustration"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-yellow-600 text-white px-3 py-1 rounded-full text-sm font-medium">Pipeline</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Managing Candidates in the Pipeline – Workflow Best Practices</h1>
            <p className="text-xl text-gray-200 mb-6">Keep your hiring funnel organized and collaborative with HirePilot's Pipeline.</p>
            <div className="flex items-center space-x-4">
              <img src="/blog-icon.png" alt="Author" className="w-12 h-12 rounded-full" />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on July 4, 2025</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div id="main-content" className="flex max-w-6xl mx-auto px-6 py-12 gap-8">
        {/* TOC */}
        <BlogTOC />

        {/* Article */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          {/* Table of Contents */}
          <div id="toc">
            <h2>📋 Table of Contents</h2>
            <ul>
              <li>📊 Step 1: Open the Pipeline View</li>
              <li>🔄 Step 2: Move Candidates Through Stages</li>
              <li>🧩 Step 3: Customize Your Pipeline (Now Inline!)</li>
              <li>🧠 Step 4: Convert Qualified Leads to Candidates</li>
              <li>👥 Collaborate With Your Team</li>
              <li>🤖 Ask REX to Help</li>
            </ul>
          </div>

          {/* Step 1 */}
          <div id="open">
            <h2>📊 Step 1: Open the Pipeline View</h2>
            <p>From the dashboard:</p>
            <ul>
              <li>Click into any active Job REQ or Campaign</li>
              <li>Select the "Candidates" tab</li>
              <li>You'll land on a drag-and-drop board view organized by hiring stages (e.g. Sourced, Screened, Interview, Offer, Hired)</li>
            </ul>
            <p>This pipeline gives you real-time visibility into where every candidate stands — all in one place.</p>
          </div>

          {/* Step 2 */}
          <div id="move">
            <h2>🔄 Step 2: Move Candidates Through Stages</h2>
            <p>Progressing a candidate is as easy as dragging their card to the next stage. The board is fully interactive.</p>
            <p>You can also:</p>
            <ul>
              <li>Add internal notes (e.g., "Great communicator – strong on async tools")</li>
              <li>Tag team members or collaborators</li>
              <li>View full candidate history and activity</li>
              <li>Set follow-up reminders (if enabled)</li>
            </ul>
            <blockquote>✅ Keeping your pipeline updated ensures clarity for your team and faster hires for your clients or stakeholders.</blockquote>
          </div>

          {/* Step 3 */}
          <div id="customize">
            <h2>🧩 Step 3: Customize Your Pipeline (Inline Editing)</h2>
            <p>Every job is different — and now, you can edit your pipeline stages directly on the page.</p>
            <p>To customize:</p>
            <ul>
              <li>Click the edit icon next to any stage title</li>
              <li>Add, rename, delete, or reorder stages on the fly</li>
              <li>Changes are auto-saved per job and visible to all collaborators</li>
            </ul>
            <p>Some example pipelines:</p>
            <ul>
              <li>Startup GTM Hiring Funnel</li>
              <li>Executive Search Process</li>
              <li>Tech Recruiting Flow (ICs & Leads)</li>
            </ul>
            <p>No need to go into Settings — the board is the control center now.</p>
          </div>

          {/* Step 4 */}
          <div id="convert">
            <h2>🧠 Step 4: Convert Leads Into Candidates</h2>
            <p>Still sourcing from the Leads tab? You can promote qualified prospects to the pipeline anytime:</p>
            <ul>
              <li>Click "Convert to Candidate" on the lead card</li>
              <li>Assign them to the right job and initial pipeline stage</li>
            </ul>
            <p>This keeps your pipeline clean — only serious candidates move forward.</p>
          </div>

          {/* Collaboration */}
          <div id="collab">
            <h2>👥 Collaborate With Your Team (or Guests)</h2>
            <p>HirePilot is built for collaboration.</p>
            <p>Inside the pipeline:</p>
            <ul>
              <li>Team members and guest collaborators can leave internal notes</li>
              <li>You can assign candidates to owners or interviewers</li>
              <li>Everyone sees real-time updates and shared activity</li>
              <li>Ideal for async workflows and distributed teams</li>
            </ul>
            <p>💬 Candidate-specific discussions can happen directly on the card view — no switching tabs.</p>
          </div>

          {/* REX */}
          <div id="rex">
            <h2>🤖 Let REX Handle the Heavy Lifting</h2>
            <p>You can ask REX (your AI assistant) to:</p>
            <ul>
              <li>"Show all candidates in the Phone Screen stage"</li>
              <li>"Move Jane Smith to Final Interview"</li>
              <li>"Summarize notes for John Doe"</li>
              <li>"Who's been stuck in the same stage for 7+ days?"</li>
            </ul>
            <p>REX keeps your pipeline in motion — even when you're not.</p>
          </div>

          {/* Why It Matters */}
          <div id="why-matters">
            <h2>🧭 Why It Matters</h2>
            <p>A well-managed pipeline = fewer drop-offs, faster decisions, and better hires.</p>
            <p>With real-time collaboration, inline editing, and REX handling tasks, you stay in flow — and in control.</p>
          </div>
        </article>
      </div>
    </>
  );
} 