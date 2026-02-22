import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function ResumeScoringDeepDive() {
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
          alt="AI resume scoring and optimization workflow"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-indigo-700 text-white px-3 py-1 rounded-full text-sm font-medium">Resume Optimization</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Resume Scoring Deep Dive</h1>
            <p className="text-xl text-gray-200 mb-6">What recruiters actually see first, and how to optimize your resume with tactical, measurable improvements.</p>
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
            <h2>What Recruiters Actually See - And How to Optimize for It</h2>
            <p>Most candidates think their resume is pretty good. Pretty good rarely wins interviews.</p>
            <p>Before a recruiter speaks to you, your resume must quickly answer: alignment, clarity, impact, and conversation-worthiness.</p>
            <p>The Resume Parser and Score in jobs.thehirepilot.com exists to remove guesswork.</p>
          </div>

          <div id="what-is-evaluated">
            <h2>What Resume Scoring Actually Evaluates</h2>
            <p>REX evaluates five core pillars:</p>
            <ul>
              <li>Structure</li>
              <li>Clarity</li>
              <li>Keyword alignment</li>
              <li>Impact strength</li>
              <li>Signal density</li>
            </ul>
            <p>Each pillar affects how quickly and confidently a recruiter can interpret your value.</p>
          </div>

          <div id="structure">
            <h2>1) Structure: Can This Be Scanned in 10 Seconds?</h2>
            <p>Recruiters scan first, then read.</p>
            <p>Strong structure includes clean headers, consistent formatting, bullets over paragraphs, clear dates/titles, and logical progression.</p>
            <p>Weak structure includes dense blocks, inconsistent formatting, chronology confusion, and overcrowded layout.</p>
            <p>If structure is weak, strong content can still be ignored.</p>
          </div>

          <div id="clarity">
            <h2>2) Clarity: Do You Sound Specific or Vague?</h2>
            <p>Specificity converts better than generic responsibility statements.</p>
            <p>REX flags passive phrasing, generic verbs, weak ownership language, and buzzword-heavy wording.</p>
            <p>Clear resumes reduce mental friction and make impact obvious without interpretation.</p>
          </div>

          <div id="keyword-alignment">
            <h2>3) Keyword Alignment: Are You Searchable?</h2>
            <p>Modern screening and search rely on role-relevant language.</p>
            <p>Resume Scoring checks missing keywords, title alignment, skills coverage, and terminology fit.</p>
            <p>This is not keyword stuffing. It is role alignment.</p>
          </div>

          <div id="impact-strength">
            <h2>4) Impact Strength: Are You Showing Results?</h2>
            <p>High-performing resumes are outcome-driven.</p>
            <p>REX looks for measurable results such as revenue influence, efficiency gains, growth metrics, cost savings, and performance indicators.</p>
            <p>If metrics are missing, that is useful feedback, not failure.</p>
          </div>

          <div id="signal-density">
            <h2>5) Signal Density: Are You Demonstrating Seniority?</h2>
            <p>Senior candidates often undersell by listing tasks instead of strategic ownership.</p>
            <p>Signal density reflects decision authority, strategic scope, team leadership, budget ownership, and cross-functional influence.</p>
            <p>Higher signal density strengthens seniority perception quickly.</p>
          </div>

          <div id="how-to-use">
            <h2>How to Use Resume Scoring Properly</h2>
            <p>Use scoring iteratively:</p>
            <ul>
              <li>Upload resume</li>
              <li>Review score breakdown</li>
              <li>Improve one pillar at a time</li>
              <li>Re-upload</li>
              <li>Compare progress</li>
            </ul>
            <p>The goal is not perfect score chasing. The goal is stronger positioning.</p>
          </div>

          <div id="common-mistakes">
            <h2>Common Resume Mistakes (And How Scoring Catches Them)</h2>
            <ul>
              <li>Overly long resumes for level</li>
              <li>Buzzword overload</li>
              <li>Weak verbs</li>
              <li>Missing metrics</li>
              <li>No clear specialization</li>
              <li>Generic summaries</li>
            </ul>
            <p>Scoring surfaces blind spots candidates often miss on self-review.</p>
          </div>

          <div id="judgment">
            <h2>Resume Scoring Is Not a Replacement for Judgment</h2>
            <p>AI can detect structural and language issues, but candidates must still maintain authenticity, accuracy, and integrity.</p>
            <p>The objective is clarity, not gaming.</p>
          </div>

          <div id="bigger-advantage">
            <h2>The Bigger Advantage</h2>
            <p>When Resume Builder, Resume Parser and Score, and Landing Page Builder are combined, candidates submit optimized positioning assets instead of raw documents.</p>
            <p>That can improve callback rates, interview volume, and recruiter interest quality.</p>
          </div>

          <div id="final-thought">
            <h2>Final Thought</h2>
            <p>Many resumes fail silently. Resume Scoring reduces silent failure by replacing guesswork with actionable refinement.</p>
            <p>That is leverage.</p>
          </div>
        </article>
      </div>
    </>
  );
}
