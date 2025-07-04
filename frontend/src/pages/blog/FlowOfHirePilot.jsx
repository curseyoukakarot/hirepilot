import React from 'react';

export default function FlowOfHirePilot() {
  return (
    <>
      {/* Local styles (reuse from BlogArticle) */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { font-family: 'Inter', sans-serif; }
        .prose h1 { color: #ffffff; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose h2 { color: #e5e7eb; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem 0; }
        .prose p { color: #d1d5db; line-height: 1.7; margin-bottom: 1.5rem; }
        .prose ul { color: #d1d5db; margin: 1.5rem 0; }
        .prose li { margin-bottom: 0.5rem; }
        .prose blockquote { border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 2rem 0; font-style: italic; color: #9ca3af; }
        .toc-active { color: #3b82f6; }
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
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/22f7736434-ea460dbdda56f2c78643.png"
          alt="Illustration representing HirePilot workflow from campaigns to candidates"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-violet-600 text-white px-3 py-1 rounded-full text-sm font-medium">Product Guide</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">The Flow of HirePilot – From Campaigns to Candidates</h1>
            <p className="text-xl text-gray-200 mb-6">See how data moves through HirePilot so you can source, qualify, and hire with confidence.</p>
            <div className="flex items-center space-x-4">
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg"
                alt="Author"
                className="w-12 h-12 rounded-full"
              />
              <div>
                <p className="font-semibold text-white">HirePilot Team</p>
                <p className="text-gray-300 text-sm">Published on July 4, 2025</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="main-content" className="flex max-w-6xl mx-auto px-6 py-12 gap-8">
        {/* Table of contents */}
        <div id="toc-sidebar" className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-8">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Table of Contents</h3>
            <nav className="space-y-2">
              <a href="#overview" className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Overview</a>
              <a href="#campaigns" className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Step 1 – Campaigns</a>
              <a href="#leads" className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Step 2 – Leads</a>
              <a href="#candidates" className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Step 3 – Candidates</a>
              <a href="#pipeline" className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Step 4 – Pipeline</a>
              <a href="#summary" className="block text-gray-400 hover:text-white transition-colors py-1 cursor-pointer">Summary</a>
            </nav>
          </div>
        </div>

        {/* Article body */}
        <article id="article-body" className="flex-1 max-w-3xl prose prose-lg">
          <div id="overview">
            <p>Welcome to <strong>HirePilot</strong>! Whether you're a solo recruiter or scaling a hiring team, understanding how information flows through the platform will help you unlock its full power.</p>
            <p className="mb-6">At a high level, every record travels through four key stages:</p>
            <ul>
              <li><strong>Campaigns</strong></li>
              <li><strong>Leads</strong></li>
              <li><strong>Candidates</strong></li>
              <li><strong>Pipeline</strong></li>
            </ul>
          </div>

          {/* Step 1 */}
          <div id="campaigns">
            <h2>📌 Step 1: Start With a Campaign</h2>
            <p>A <strong>Campaign</strong> is your starting point. It defines:</p>
            <ul>
              <li>The job or project you're sourcing for</li>
              <li>The target criteria (industry, job titles, etc.)</li>
              <li>The lead source (<span className="italic">CSV, Apollo, LinkedIn, or manual</span>)</li>
            </ul>
            <p>When you create a campaign, you'll be able to:</p>
            <ul>
              <li>Assign it a name and target role</li>
              <li>Choose how you want to find leads</li>
              <li>Track results like messages sent, replies, and conversions</li>
            </ul>
            <blockquote>🎯 Think of a campaign like a folder — everything related to sourcing for that role lives inside it.</blockquote>
          </div>

          {/* Step 2 */}
          <div id="leads">
            <h2>👥 Step 2: Import or Source Leads</h2>
            <p>Once a campaign is created, it's time to add <strong>leads</strong> (people you want to reach out to). You have two main options:</p>

            <h3>🧪 Option A: Use the Lead Wizard</h3>
            <ul>
              <li>Choose Apollo, LinkedIn, or Manual entry</li>
              <li>Connect your source (like your Apollo API key or session cookie)</li>
              <li>Let HirePilot pull leads based on your criteria</li>
            </ul>

            <h3>📥 Option B: Upload a CSV</h3>
            <ul>
              <li>Prepare a CSV with basic fields (name, title, company, email, etc.)</li>
              <li>Map your columns inside HirePilot's upload tool</li>
              <li>Attach the leads to the correct campaign</li>
            </ul>
            <p>💡 <strong>Pro Tip:</strong> <em>REX</em> can even help enrich or vet leads before importing them!</p>
          </div>

          {/* Step 3 */}
          <div id="candidates">
            <h2>🔁 Step 3: Convert Leads to Candidates</h2>
            <p>Once you've imported leads, it's time to qualify the good ones. You can:</p>
            <ul>
              <li>Review each lead profile</li>
              <li>Mark promising ones as <strong>Candidates</strong></li>
              <li>Add notes, ratings, or even rejection reasons</li>
            </ul>
            <p>🧠 <strong>Candidates</strong> are leads that you want to move forward in the hiring process.</p>
          </div>

          {/* Step 4 */}
          <div id="pipeline">
            <h2>📊 Step 4: Manage Candidates in the Pipeline</h2>
            <p>Your <strong>Pipeline</strong> shows all candidates actively being considered for a role. From here, you can:</p>
            <ul>
              <li>Drag-and-drop candidates into stages like "Phone Screen," "Interview," or "Offer"</li>
              <li>Add interview notes and feedback</li>
              <li>See who's moving forward — and who needs a follow-up</li>
            </ul>
            <blockquote>🔁 This is where recruiting shifts from <em>outreach</em> → <em>hiring process</em>.</blockquote>
          </div>

          {/* Summary table */}
          <div id="summary">
            <h2>✅ Summary</h2>
            <div className="overflow-x-auto rounded-lg shadow border border-gray-700 my-6">
              <table className="min-w-full text-left text-sm text-gray-200">
                <thead className="bg-gray-800 uppercase text-xs text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Step</th>
                    <th className="px-4 py-3">What Happens</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-900">
                    <td className="px-4 py-3 font-medium">Campaign</td>
                    <td className="px-4 py-3">Define the role and sourcing strategy</td>
                  </tr>
                  <tr className="bg-gray-800">
                    <td className="px-4 py-3 font-medium">Leads</td>
                    <td className="px-4 py-3">Import via wizard or CSV</td>
                  </tr>
                  <tr className="bg-gray-900">
                    <td className="px-4 py-3 font-medium">Candidates</td>
                    <td className="px-4 py-3">Qualify and promote leads</td>
                  </tr>
                  <tr className="bg-gray-800">
                    <td className="px-4 py-3 font-medium">Pipeline</td>
                    <td className="px-4 py-3">Move candidates through interview stages</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mb-4">Need Help? You can always ask <strong>REX</strong>, your Recruiting AI Copilot, for assistance:</p>
            <ul>
              <li>🗣 "REX, show me how to import leads via CSV."</li>
              <li>🗣 "REX, what's the best way to qualify leads?"</li>
              <li>🗣 "REX, open my active campaigns."</li>
            </ul>
          </div>
        </article>
      </div>
    </>
  );
} 