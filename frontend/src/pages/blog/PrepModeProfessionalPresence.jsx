import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function PrepModeProfessionalPresence() {
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
          alt="Job seeker prep mode with resume and interview optimization"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-indigo-700 text-white px-3 py-1 rounded-full text-sm font-medium">Prep Mode</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Prep Mode: Build a Professional Presence That Converts</h1>
            <p className="text-xl text-gray-200 mb-6">The optimization layer that strengthens resume quality, positioning, and interview performance before outreach.</p>
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
          <div id="overview">
            <p>Before reaching out to hiring managers, professional presence needs to be prepared.</p>
            <p>Prep Mode is the foundation with modules for Resume Wizard, Resume Parser and Score, Landing Page Builder, REX Job Prep Chat, and Interview Helper.</p>
          </div>

          <div id="resume-builder">
            <h2>Resume Builder (AI-Powered)</h2>
            <p>Many resumes are too long, too vague, and responsibility-heavy instead of impact-driven.</p>
            <p>The Resume Builder helps candidates:</p>
            <ul>
              <li>Choose modern templates</li>
              <li>Improve phrasing</li>
              <li>Highlight measurable impact</li>
              <li>Refine positioning</li>
              <li>Structure content strategically</li>
            </ul>
            <p>This is not just formatting. It is competitive positioning.</p>
          </div>

          <div id="parser-score">
            <h2>Resume Parser &amp; Score</h2>
            <p>Upload a resume and REX evaluates formatting, keyword alignment, clarity, structure, and impact statements.</p>
            <p>Candidates receive:</p>
            <ul>
              <li>A score out of 100</li>
              <li>Specific improvement suggestions</li>
              <li>Optimization feedback</li>
            </ul>
            <p>Guesswork is replaced with actionable direction.</p>
          </div>

          <div id="landing-page-builder">
            <h2>Landing Page Builder</h2>
            <p>A resume shows history. A landing page shows brand.</p>
            <p>With Landing Page Builder, candidates can:</p>
            <ul>
              <li>Create a professional personal site</li>
              <li>Showcase projects</li>
              <li>Highlight achievements</li>
              <li>Add testimonials</li>
              <li>Add portfolio links</li>
              <li>Share a custom domain</li>
            </ul>
            <p>Outreach can include more than a PDF. It can include presence.</p>
          </div>

          <div id="interview-helper">
            <h2>Interview Helper (Live Voice Coaching)</h2>
            <p>Interviews are performance moments. Interview Helper supports:</p>
            <ul>
              <li>Live mock interview practice</li>
              <li>Spoken answer rehearsal</li>
              <li>Structured coaching</li>
              <li>Clarity and confidence improvements</li>
              <li>Progress tracking over time</li>
            </ul>
            <p>Preparation shifts from passive reading to active rehearsal, improving delivery quality.</p>
          </div>

          <div id="prep-not-optional">
            <h2>Prep Mode Is Not Optional</h2>
            <p>Reaching out before preparing reduces leverage.</p>
            <p>Prep Mode ensures that when conversations start, candidates are ready to convert interest into momentum.</p>
          </div>
        </article>
      </div>
    </>
  );
}
