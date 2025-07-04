import React from 'react';

export default function CreditsGuide() {
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
        table { width:100%; }
      `}</style>

      {/* Breadcrumb */}
      <div className="bg-gray-800 py-4" id="breadcrumb">
        <div className="max-w-6xl mx-auto px-6">
          <span className="text-gray-300 hover:text-white transition-colors flex items-center cursor-pointer">
            <i className="fa-solid fa-arrow-left mr-2" />
            Back to Blog
          </span>
        </div>
      </div>

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/copilot-hero.gif"
          alt="Credits system illustration"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-sm font-medium">Billing</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">💳 How Credits Work in HirePilot: Enrichment, Messaging & REX Tasks</h1>
            <p className="text-xl text-gray-200 mb-6">Understand what actions cost credits and how to track usage.</p>
            <div className="flex items-center space-x-4">
              <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg" alt="Author" className="w-12 h-12 rounded-full" />
              <div>
                <p className="font-semibold text-white">HirePilot Billing Team</p>
                <p className="text-gray-300 text-sm">Published on July 4, 2025</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div id="main-content" className="flex max-w-6xl mx-auto px-6 py-12 gap-8">
        {/* TOC */}
        <div id="toc-sidebar" className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-8">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Table of Contents</h3>
            <nav className="space-y-2">
              <a href="#usage" className="block text-gray-400 hover:text-white py-1">What Costs Credits</a>
              <a href="#enrich" className="block text-gray-400 hover:text-white py-1">What is Enrichment</a>
              <a href="#rex" className="block text-gray-400 hover:text-white py-1">How REX Handles</a>
              <a href="#monitor" className="block text-gray-400 hover:text-white py-1">Monitor Usage</a>
              <a href="#summary" className="block text-gray-400 hover:text-white py-1">Summary</a>
            </nav>
          </div>
        </div>

        {/* Article */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          {/* Usage */}
          <div id="usage">
            <h2>⚖️ What Are Credits Used For?</h2>
            <p>Here's a full breakdown of what actions consume credits in HirePilot:</p>
            <div className="overflow-x-auto rounded-lg shadow border border-gray-700 my-6">
              <table className="text-gray-200 text-sm">
                <thead className="bg-gray-800 text-gray-400 uppercase text-xs"><tr><th className="px-4 py-3">Action</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3">Notes</th></tr></thead>
                <tbody>
                  <tr className="bg-gray-900"><td className="px-4 py-3">Sourcing a lead from Apollo (HirePilot key)</td><td className="px-4 py-3">1 credit</td><td className="px-4 py-3">Free if using your own Apollo API key</td></tr>
                  <tr className="bg-gray-800"><td className="px-4 py-3">Sourcing a lead from LinkedIn Sales Navigator</td><td className="px-4 py-3">1 credit</td><td className="px-4 py-3">Via Chrome Extension or cookie</td></tr>
                  <tr className="bg-gray-900"><td className="px-4 py-3">Enriching a lead with missing email (Apollo)</td><td className="px-4 py-3">1 credit</td><td className="px-4 py-3">Only charged if lead didn't have an email previously</td></tr>
                  <tr className="bg-gray-800"><td className="px-4 py-3">Standard enrichment (LinkedIn info, title, company, etc.)</td><td className="px-4 py-3">FREE</td><td className="px-4 py-3">Basic enrichment is always free</td></tr>
                </tbody>
              </table>
            </div>
            <p>🔁 You are only charged once per lead per source — HirePilot deduplicates behind the scenes.</p>
          </div>

          {/* Enrichment */}
          <div id="enrich">
            <h2>🔍 What Counts as Enrichment?</h2>
            <p>Enrichment means we enhance your lead data by pulling:</p>
            <ul>
              <li>Current title & company</li>
              <li>LinkedIn profile link</li>
              <li>Personal or work email</li>
              <li>Optional: phone number, location, etc.</li>
            </ul>
            <p>📧 Only email lookups from scratch cost credits (via Apollo or Proxycurl)</p>
          </div>

          {/* REX */}
          <div id="rex">
            <h2>🧠 How REX Handles Credits</h2>
            <p>When REX runs a task that could trigger a credit cost, it will always:</p>
            <ul>
              <li>Notify you first (e.g., "This action will cost 1 credit. Proceed?")</li>
              <li>Wait for your confirmation</li>
              <li>Log the action under your account for transparency</li>
            </ul>
            <p>✅ REX will never spend credits without your explicit OK.</p>
          </div>

          {/* Monitor */}
          <div id="monitor">
            <h2>🧾 How to View Your Usage</h2>
            <p>From your dashboard:</p>
            <ul>
              <li>Go to <strong>Settings → Billing & Usage</strong></li>
            </ul>
            <p>You'll see:</p>
            <ul>
              <li>Current credit balance</li>
              <li>Monthly usage logs</li>
              <li>Breakdown by category (Sourcing, Enrichment, REX, etc.)</li>
            </ul>
            <p>Need more credits? Upgrade your plan or purchase a custom credit pack.</p>
          </div>

          {/* Summary */}
          <div id="summary">
            <h2>🎯 Summary</h2>
            <div className="overflow-x-auto rounded-lg shadow border border-gray-700 my-6">
              <table className="text-gray-200 text-sm">
                <thead className="bg-gray-800 text-gray-400 uppercase text-xs"><tr><th className="px-4 py-3">Task</th><th className="px-4 py-3">Cost</th></tr></thead>
                <tbody>
                  <tr className="bg-gray-900"><td className="px-4 py-3">Sourcing via Apollo (HirePilot key)</td><td className="px-4 py-3">1 credit</td></tr>
                  <tr className="bg-gray-800"><td className="px-4 py-3">Sourcing via LinkedIn</td><td className="px-4 py-3">1 credit</td></tr>
                  <tr className="bg-gray-900"><td className="px-4 py-3">Apollo email enrichment</td><td className="px-4 py-3">1 credit</td></tr>
                  <tr className="bg-gray-800"><td className="px-4 py-3">Using your own Apollo key</td><td className="px-4 py-3">Free</td></tr>
                  <tr className="bg-gray-900"><td className="px-4 py-3">Standard enrichment (LinkedIn/title/etc.)</td><td className="px-4 py-3">Free</td></tr>
                </tbody>
              </table>
            </div>
            <p>Your credits = your power. Use them wisely, track your usage, and let REX help you make every one count.</p>
          </div>
        </article>
      </div>
    </>
  );
} 