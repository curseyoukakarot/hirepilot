import React from 'react';
import BlogTOC from '../../components/blog/BlogTOC';
import BlogNavbar from '../../components/blog/BlogNavbar';

export default function ImportCsvGuide() {
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
        table { width: 100%; }
        .dark-table th, .dark-table td { color:#ffffff !important; }
      `}</style>

      <BlogNavbar />

      {/* Hero */}
      <div id="hero-section" className="relative">
        <img
          className="w-full h-[400px] object-cover"
          src="https://storage.googleapis.com/uxpilot-auth.appspot.com/a38d6691dc-92163dbe18bd3d5afa0e.png"
          alt="CSV import illustration"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-6 pb-12 w-full">
            <div className="mb-4">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">Lead Import</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Importing Leads via CSV — Field Mapping, Enrichment Tips, and Common Fixes</h1>
            <p className="text-xl text-gray-200 mb-6">Turn spreadsheets into leads inside HirePilot in just a few clicks.</p>
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
          {/* Prepare CSV */}
          <div id="prepare">
            <h2>🧩 Step 1: Prepare Your CSV</h2>
            <p>Before uploading, make sure your spreadsheet has clear column headers. At a minimum, include:</p>
            <div className="overflow-x-auto rounded-lg shadow border border-gray-700 my-6">
              <table className="dark-table text-sm">
                <thead className="bg-gray-800 text-white uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">Column</th>
                    <th className="px-4 py-3">Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-900"><td className="px-4 py-3">first_name</td><td className="px-4 py-3">Jordan</td></tr>
                  <tr className="bg-gray-800"><td className="px-4 py-3">last_name</td><td className="px-4 py-3">Lee</td></tr>
                  <tr className="bg-gray-900"><td className="px-4 py-3">email</td><td className="px-4 py-3">jordan.lee@email.com</td></tr>
                  <tr className="bg-gray-800"><td className="px-4 py-3">title</td><td className="px-4 py-3">Product Manager</td></tr>
                  <tr className="bg-gray-900"><td className="px-4 py-3">company</td><td className="px-4 py-3">Acme Corp</td></tr>
                  <tr className="bg-gray-800"><td className="px-4 py-3">linkedin_url</td><td className="px-4 py-3">https://linkedin.com/in/jordanlee</td></tr>
                </tbody>
              </table>
            </div>
            <p>🔑 Bonus fields (optional): <code>location</code>, <code>phone_number</code>, <code>industry</code>, <code>custom_notes</code></p>
          </div>

          {/* Upload */}
          <div id="upload">
            <h2>🚀 Step 2: Upload Your CSV to a Campaign</h2>
            <p>To import leads:</p>
            <ol>
              <li>Go to the <strong>Campaigns</strong> tab</li>
              <li>Open the campaign you want to import into</li>
              <li>Click <em>"Add Leads" → "Upload CSV"</em></li>
              <li>Drag your CSV file into the uploader</li>
              <li>Map each column to the correct field inside HirePilot</li>
            </ol>
            <blockquote>✅ You only need to do this once — we'll remember your mappings for future uploads.</blockquote>
          </div>

          {/* Enrich */}
          <div id="enrich">
            <h2>✨ Step 3: (Optional) Enrich Your Leads</h2>
            <p>After upload, you can choose to auto-enrich your leads using Apollo. This helps fill in missing data like:</p>
            <ul>
              <li>Personal or work email</li>
              <li>Phone number</li>
              <li>Current company and title</li>
              <li>LinkedIn profile URL</li>
            </ul>
            <p>💳 Some enrichments cost credits. REX will ask you to confirm before any charges are made.</p>
          </div>

          {/* Issues */}
          <div id="issues">
            <h2>⚠️ Common Issues &amp; Fixes</h2>
            <div className="overflow-x-auto rounded-lg shadow border border-gray-700 my-6">
              <table className="dark-table text-sm">
                <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">Problem</th>
                    <th className="px-4 py-3">Fix</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-900"><td className="px-4 py-3">❌ Missing required fields</td><td className="px-4 py-3">Ensure each row has first_name, last_name, and email or linkedin_url</td></tr>
                  <tr className="bg-gray-800"><td className="px-4 py-3">❌ Invalid LinkedIn URLs</td><td className="px-4 py-3">Double-check for typos; URLs must start with https://</td></tr>
                  <tr className="bg-gray-900"><td className="px-4 py-3">❌ Extra blank rows</td><td className="px-4 py-3">Delete empty rows or stray line breaks before uploading</td></tr>
                  <tr className="bg-gray-800"><td className="px-4 py-3">❌ File won't upload</td><td className="px-4 py-3">Make sure the file is saved as .csv (not Excel .xlsx)</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Tips */}
          <div id="tips">
            <h2>💡 Pro Tips</h2>
            <ul>
              <li>Use Google Sheets to clean and prep your CSV quickly</li>
              <li>Save templates for repeat roles (e.g., SDR campaigns, Engineers)</li>
              <li>Add a column like <code>source</code> to track where your leads came from</li>
            </ul>
          </div>

          {/* Ask REX */}
          <div id="rex">
            <h2>🤖 Let REX Help You</h2>
            <ul>
              <li>"REX, show me how to map my CSV fields."</li>
              <li>"REX, enrich this batch of leads with emails."</li>
              <li>"REX, why did this upload fail?"</li>
            </ul>
          </div>
        </article>
      </div>
    </>
  );
} 