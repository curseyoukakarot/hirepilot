import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function StopApplyingStartConversations() {
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
          alt="Job seeker strategy from applications to conversations"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-sky-700 text-white px-3 py-1 rounded-full text-sm font-medium">Job Seeker Strategy</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Stop Applying. Start Conversations.</h1>
            <p className="text-xl text-gray-200 mb-6">How jobs.thehirepilot.com changes job search from passive applications to strategic, direct engagement.</p>
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
          <div id="core-thesis">
            <h2>How jobs.thehirepilot.com Changes the Way You Get Hired</h2>
            <p>For most job seekers, the flow is repetitive: scroll, apply, upload, fill forms, wait, hear nothing.</p>
            <p>You do not need more applications. You need more conversations.</p>
            <p>Hiring decisions happen in conversations, not in piles of forms.</p>
          </div>

          <div id="real-problem">
            <h2>The Real Problem With Modern Job Searching</h2>
            <p>Applicant systems are saturated with high volume and low signal. Even strong candidates get buried.</p>
            <p>Applying harder is not enough. Visibility is what changes outcomes.</p>
            <p>Visibility comes from direct conversations, intelligent outreach, strategic positioning, and confident interviews.</p>
          </div>

          <div id="three-layers">
            <h2>The Three Layers of Modern Job Search</h2>
            <p>jobs.thehirepilot.com is built around three layers:</p>
            <ul>
              <li>Prepare your professional presence</li>
              <li>Identify the right hiring managers</li>
              <li>Create direct conversations</li>
            </ul>
            <p>Old flow: Apply -&gt; Wait</p>
            <p>New flow: Prepare -&gt; Target -&gt; Engage</p>
          </div>

          <div id="built-for-action">
            <h2>This Platform Is Built For Action</h2>
            <p>Inside jobs.thehirepilot.com, candidates can:</p>
            <ul>
              <li>Build and optimize resumes</li>
              <li>Analyze and score resumes with AI</li>
              <li>Create personal landing pages</li>
              <li>Practice interviews live with REX Voice</li>
              <li>Identify hiring managers behind open roles</li>
              <li>Launch intelligent outreach campaigns</li>
              <li>Track conversations and responses</li>
            </ul>
            <p>You do not just apply. You build leverage.</p>
          </div>

          <div id="conversations-vs-applications">
            <h2>Why Conversations Matter More Than Applications</h2>
            <p>Recruiters hire people they speak with, understand, remember, and trust.</p>
            <p>Applications create data points. Conversations create decisions.</p>
            <p>The platform is designed to move you from invisible applicant to visible candidate.</p>
          </div>
        </article>
      </div>
    </>
  );
}
