import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function JobSeekerAgentDirectOutreach() {
  return (
    <>
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose p { color: #d1d5db; line-height: 1.7; margin-bottom: 1.1rem; }
        .prose ul { color: #d1d5db; margin: 1rem 0 1.25rem 1.25rem; list-style: disc; }
        .prose li { margin-bottom: 0.5rem; }
      `}</style>

      <BlogNavbar />

      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
          alt="Job seeker agent identifying hiring managers for direct outreach"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-emerald-700 text-white px-3 py-1 rounded-full text-sm font-medium">Job Seeker Agent</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Job Seeker Agent: Find Hiring Managers. Reach Them Directly.</h1>
            <p className="text-xl text-gray-200 mb-6">How AI-powered manager targeting helps candidates move from applicant volume to strategic conversations.</p>
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
          <div id="premium-layer">
            <p>This is the premium job-seeker layer where search becomes strategic.</p>
            <p>The Job Seeker Agent is not about applying more. It is about targeting decision-makers directly.</p>
          </div>

          <div id="what-it-does">
            <h2>What the Job Seeker Agent Does</h2>
            <p>Candidates paste a LinkedIn Job Search URL and the system:</p>
            <ul>
              <li>Extracts job signals</li>
              <li>Identifies hiring managers</li>
              <li>Analyzes role relevance</li>
              <li>Prioritizes targets</li>
              <li>Generates outreach recommendations</li>
            </ul>
            <p>It runs on an AI cloud engine that processes large job datasets and surfaces high-value people to contact.</p>
            <p>Instead of applying to 100 listings, candidates can target the 20-50 real decision-makers.</p>
          </div>

          <div id="why-this-changes-game">
            <h2>Why This Changes the Game</h2>
            <p>Most candidates apply to job posts. Stronger strategy is contacting hiring managers directly.</p>
            <p>The Job Seeker Agent helps candidates:</p>
            <ul>
              <li>Discover who is actually hiring</li>
              <li>Avoid generic inboxes</li>
              <li>Reach department leaders</li>
              <li>Personalize outreach</li>
              <li>Launch structured campaigns</li>
            </ul>
            <p>You move from applicant to proactive candidate.</p>
          </div>

          <div id="smart-outreach-scale">
            <h2>Smart Outreach at Scale</h2>
            <p>Job seekers can set job limits, adjust processing priority, provide background context, and target specific roles and locations.</p>
            <p>The system then identifies relevant managers, drafts outreach, tracks results, and surfaces replies.</p>
            <p>Manual profile hunting is replaced by structured, high-signal execution.</p>
          </div>

          <div id="conversation-over-volume">
            <h2>Conversation Over Volume</h2>
            <p>This is not spam. It is structured targeting.</p>
            <p>The goal is not blasting messages; it is creating meaningful conversations with decision-makers.</p>
            <p>When Prep Mode combines with Job Seeker Agent, candidates gain confidence, visibility, and strategy.</p>
          </div>

          <div id="complete-ecosystem">
            <h2>The Complete Ecosystem</h2>
            <p>jobs.thehirepilot.com is designed to:</p>
            <ul>
              <li>Prepare candidates</li>
              <li>Position candidates</li>
              <li>Connect candidates</li>
              <li>Elevate interviews</li>
              <li>Increase visibility</li>
            </ul>
            <p>It is not about sending more resumes. It is about becoming impossible to ignore.</p>
          </div>
        </article>
      </div>
    </>
  );
}
