import React, { useState } from 'react';

export default function BlogLandingPage() {
  // ----- NEW STATE FOR SEARCH / PAGINATION -----
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(6);
  const [activeTag, setActiveTag] = useState('All');

  const articles = [
    {
      id: 1,
      href: '/blog/flow-of-hirepilot',
      title: 'The Flow of HirePilot – From Campaigns to Candidates',
      summary: 'Understand how data moves through HirePilot and set up your workflow for success.',
      tag: 'Automation',
      gradient: 'from-blue-500 to-violet-600',
      icon: 'fa-robot',
      date: 'Jul 4, 2025',
    },
    {
      id: 2,
      href: '/blog/message-center-setup',
      title: 'Message Center Setup – Connecting Gmail, Outlook, and SendGrid',
      summary: 'Learn how to power your outreach by linking your own email providers.',
      tag: 'Email',
      gradient: 'from-emerald-500 to-blue-600',
      icon: 'fa-envelope',
      date: 'Jul 4, 2025',
    },
    {
      id: 3,
      href: '/blog/apollo-integration',
      title: 'How to Use Apollo with HirePilot – Setup & Keyword Tips',
      summary: 'Connect Apollo and source qualified leads in seconds.',
      tag: 'Integrations',
      gradient: 'from-purple-500 to-pink-600',
      icon: 'fa-chart-line',
      date: 'Jul 4, 2025',
    },
    {
      id: 4,
      href: '/blog/linkedin-sales-navigator',
      title: 'Using LinkedIn Sales Navigator – Chrome Extension vs Manual Cookie',
      summary: 'Import leads from Sales Navigator into HirePilot easily.',
      tag: 'Leads',
      gradient: 'from-orange-500 to-red-600',
      icon: 'fa-users',
      date: 'Jul 4, 2025',
    },
    {
      id: 5,
      href: '/blog/meet-rex',
      title: 'Meet REX – Your AI Recruiting Copilot & Support Assistant',
      summary: 'Automate outreach, enrichment, and support with REX.',
      tag: 'AI Copilot',
      gradient: 'from-teal-500 to-cyan-600',
      icon: 'fa-puzzle-piece',
      date: 'Jul 4, 2025',
    },
    {
      id: 6,
      href: '/blog/import-csv',
      title: 'Importing Leads via CSV — Field Mapping, Enrichment Tips, and Fixes',
      summary: 'Upload spreadsheets and enrich lead data in minutes.',
      tag: 'Lead Import',
      gradient: 'from-indigo-500 to-purple-600',
      icon: 'fa-file-csv',
      date: 'Jul 4, 2025',
    },
    {
      id: 7,
      href: '/blog/campaign-wizard',
      title: 'Using the Campaign Wizard – Apollo, LinkedIn, and Manual Sourcing',
      summary: 'Source high-quality leads with HirePilot\'s wizard.',
      tag: 'Sourcing',
      gradient: 'from-green-500 to-emerald-600',
      icon: 'fa-magic',
      date: 'Jul 4, 2025',
    },
    {
      id: 8,
      href: '/blog/PipelineBestPractices',
      title: 'Managing Candidates in the Pipeline – Workflow Best Practices',
      summary: 'Keep your hiring funnel organized and collaborative.',
      tag: 'Pipeline',
      gradient: 'from-blue-800 to-gray-700',
      icon: 'fa-layer-group',
      date: 'Jul 4, 2025',
    },
    {
      id: 9,
      href: '/blog/email-troubleshooting',
      title: 'Troubleshooting Email Sending — Gmail, Outlook & SendGrid',
      summary: 'Diagnose and fix common email issues quickly.',
      tag: 'Email',
      gradient: 'from-red-500 to-pink-600',
      icon: 'fa-triangle-exclamation',
      date: 'Jul 4, 2025',
    },
    {
      id: 10,
      href: '/blog/CreditsGuide',
      title: 'How Credits Work in HirePilot: Enrichment, Messaging & REX Tasks',
      summary: 'Understand credit costs and track usage effectively.',
      tag: 'Billing',
      gradient: 'from-indigo-600 to-blue-600',
      icon: 'fa-credit-card',
      date: 'Jul 4, 2025',
    },
  ];

  const tagFiltered = activeTag === 'All' ? articles : articles.filter(a=>a.tag===activeTag);
  const filtered = tagFiltered.filter(a => a.title.toLowerCase().includes(search.toLowerCase()));

  const tags = ['All', ...Array.from(new Set(articles.map(a=>a.tag)))];

  return (
    <>
      {/* Component-scoped helper styles to preserve original effects */}
      <style>{`
        /* Hide default scrollbar */
        ::-webkit-scrollbar { display: none; }
        /* Custom fonts are loaded globally – just keep font-family reference here */
        body { font-family: 'Inter', sans-serif; }
        /* Effects ported from original stylesheet */
        .search-glow { box-shadow: 0 0 20px rgba(139, 92, 246, 0.2); }
        .card-hover { transition: all 0.3s ease; }
        .card-hover:hover { transform: translateY(-8px); box-shadow: 0 25px 50px -12px rgba(139, 92, 246, 0.3); }
      `}</style>

      {/* Marketing Header (same as HomePage) */}
      <header id="header" className="fixed w-full top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="HirePilot Logo" className="h-8 w-8" />
            <span className="text-xl font-bold">HirePilot</span>
          </a>
          <nav className="hidden md:flex items-center gap-8">
            <a href="/copilot" className="text-gray-600 hover:text-gray-900">Your Recruiting Co-Pilot</a>
            <a href="/handsfree" className="text-gray-600 hover:text-gray-900">Done For You Hiring</a>
            <a href="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
          </nav>
          <div className="flex items-center gap-4">
            <a href="/login" className="hidden md:block text-gray-600 hover:text-gray-900">Sign in</a>
            <a href="#" className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-2.5 rounded-lg hover:shadow-lg transition-all duration-200">
              Start for Free
            </a>
          </div>
          <button className="md:hidden text-gray-600">
            <i className="fa-solid fa-bars text-2xl"></i>
          </button>
        </div>
      </header>

      {/* Main */}
      <main id="blog-main" className="min-h-screen">
        {/* Hero */}
        <section id="blog-hero" className="bg-gradient-to-br from-gray-50 via-white to-gray-50 py-20">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              The HirePilot Blog
            </h1>
            <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
              Tips, tools, and automation insights for modern recruiters
            </p>

            {/* Search */}
            <div id="search-container" className="max-w-2xl mx-auto mb-8">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={search}
                  onChange={e=>{setSearch(e.target.value);setVisible(6);}}
                  className="w-full px-6 py-4 bg-white border-2 border-violet-200 rounded-2xl text-gray-900 placeholder-gray-500 focus:outline-none focus:border-violet-500 search-glow text-lg shadow-sm"
                />
                <i className="fa-solid fa-search absolute right-6 top-1/2 -translate-y-1/2 text-violet-500 text-xl" />
              </div>
            </div>

            {/* Dynamic Filter pills */}
            <div id="filter-pills" className="flex flex-wrap justify-center gap-3">
              {tags.map(t=> (
                <button
                  key={t}
                  onClick={()=>{setActiveTag(t);setVisible(6);}}
                  className={`px-6 py-2 rounded-xl font-medium transition ${activeTag===t? 'bg-violet-600 text-white':'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >{t}</button>
              ))}
            </div>
          </div>
        </section>

        {/* Articles grid */}
        <section id="articles-grid" className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filtered.slice(0,visible).map(a=> (
                <a key={a.id} href={a.href} className="bg-white rounded-2xl overflow-hidden card-hover shadow-lg block">
                  <div className={`h-48 bg-gradient-to-br ${a.gradient} flex items-center justify-center`}>
                    <i className={`fa-solid ${a.icon} text-white text-4xl`} />
                  </div>
                  <div className="p-6">
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">{a.tag}</span>
                    <h3 className="text-xl font-bold mt-4 mb-3 line-clamp-2 text-gray-900">{a.title}</h3>
                    <p className="text-gray-600 mb-4 line-clamp-2">{a.summary}</p>
                    <div className="flex items-center space-x-3">
                      <img src="/blog-icon.png" alt="Blog icon" className="w-8 h-8 rounded-full" />
                      <div className="text-sm">
                        <p className="text-gray-900 font-medium">HirePilot Team</p>
                        <p className="text-gray-500">{a.date}</p>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Pagination */}
        <section id="pagination" className="py-12 bg-gray-50">
          <div className="max-w-6xl mx-auto px-6 text-center">
            {visible < filtered.length && (
              <button onClick={()=>setVisible(v=>v+3)} className="bg-gradient-to-r from-blue-500 to-violet-600 px-8 py-3 rounded-xl font-medium hover:from-blue-600 hover:to-violet-700 transition text-lg text-white">
                Load More Articles
              </button>
            )}
          </div>
        </section>
      </main>

      {/* Marketing Footer (same as HomePage) */}
      <footer id="footer" className="bg-gray-900 text-white py-16 mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <img src="/logo.png" alt="HirePilot Logo" className="h-8 w-8" />
                <span className="text-xl font-bold">HirePilot</span>
              </div>
              <p className="text-gray-400">AI-powered recruiting platform that helps you hire better, faster.</p>
              <div className="mt-6 flex gap-4">
                <span className="text-gray-400 hover:text-white cursor-pointer"><i className="fa-brands fa-linkedin text-xl" /></span>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-4">Product</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="/copilot" className="hover:text-white">Your Recruiting Co-Pilot</a></li>
                <li><a href="/handsfree" className="hover:text-white">Done For You Hiring</a></li>
                <li><a href="/pricing" className="hover:text-white">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-4">Company</h4>
              <ul className="space-y-3 text-gray-400">
                <li><span className="hover:text-white cursor-pointer">Blog</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-4">Support</h4>
              <ul className="space-y-3 text-gray-400">
                <li><span className="hover:text-white cursor-pointer">Terms of Use</span></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
            © 2025 HirePilot. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
} 