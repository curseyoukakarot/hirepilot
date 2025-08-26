import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';

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

      {/* Breadcrumb */}
      <div className="bg-gray-800 py-4" id="breadcrumb">
        <div className="max-w-6xl mx-auto px-6">
          <a href="/blog" className="flex items-center transition-colors">
            <i className="fa-solid fa-arrow-left mr-2" />
            Back to Blog
          </a>
        </div>
      </div>

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
          {/* Open */}
          <div id="open">
            <h2>📊 Step 1: Open the Pipeline</h2>
            <p>From the dashboard:</p>
            <ul>
              <li>Click into any active <strong>Campaign</strong></li>
              <li>Navigate to the <strong>Pipeline</strong> tab</li>
            </ul>
            <p>You'll see a drag-and-drop board view with columns like:</p>
            <ul>
              <li>Sourced</li>
              <li>Phone Screen</li>
              <li>Interview</li>
              <li>Offer</li>
              <li>Hired / Rejected</li>
            </ul>
            <p>These stages can be customized to match your process.</p>
          </div>

          {/* Move */}
          <div id="move">
            <h2>🔄 Step 2: Move Candidates Through Stages</h2>
            <p>Each time a candidate progresses (or stalls), update their stage by dragging their card to the appropriate column.</p>
            <p>You can also:</p>
            <ul>
              <li>Add notes (e.g., "Interviewed by Sam – strong communicator")</li>
              <li>Attach internal comments or feedback</li>
              <li>Set follow-up reminders</li>
            </ul>
            <blockquote>✅ Keeping stages updated ensures accurate metrics and avoids drop-offs.</blockquote>
          </div>

          {/* Customize */}
          <div id="customize">
            <h2>🧩 Step 3: Customize Your Pipeline Stages</h2>
            <p>Every hiring process is different. HirePilot lets you edit the default stage names and order.</p>
            <p><strong>To update:</strong></p>
            <ol>
              <li>Go to <strong>Settings → Pipeline Templates</strong></li>
              <li>Add, rename, or delete stages</li>
              <li>Apply custom templates to specific campaigns or jobs</li>
            </ol>
            <p>Example templates:</p>
            <ul>
              <li>"Full-Cycle Recruiter Process"</li>
              <li>"Executive Search"</li>
              <li>"Tech Hiring Funnel"</li>
            </ul>
          </div>

          {/* Convert */}
          <div id="convert">
            <h2>🧠 Step 4: Convert Qualified Leads to Candidates</h2>
            <p>Still working from the Leads tab? You can promote a lead to the pipeline anytime by clicking <strong>"Convert to Candidate."</strong></p>
            <p>This ensures only the most qualified people make it into your hiring funnel.</p>
          </div>

          {/* Collaboration */}
          <div id="collab">
            <h2>👥 Collaborate With Your Team</h2>
            <p>Team members can:</p>
            <ul>
              <li>Add internal notes</li>
              <li>Rate candidates</li>
              <li>Assign themselves as "owners" of a stage</li>
              <li>See full history of every touchpoint</li>
            </ul>
            <p>Perfect for distributed or async recruiting teams.</p>
          </div>

          {/* REX */}
          <div id="rex">
            <h2>🤖 Ask REX</h2>
            <ul>
              <li>"REX, show me all candidates in the Phone Screen stage."</li>
              <li>"REX, summarize interview notes for John Doe."</li>
              <li>"REX, move Jane Smith to Final Interview."</li>
              <li>"REX, who hasn't moved stages in 7 days?"</li>
            </ul>
            <p>The Pipeline gives you structure, clarity, and insight — so nothing falls through the cracks, and every great candidate gets the attention they deserve.</p>
          </div>
        </article>
      </div>
    </>
  );
} 