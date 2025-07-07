import React, { useState } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

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
    {
      id: 11,
      href: '/blog/AutomateRecruiting1',
      title: 'Automate Your Recruiting with HirePilot + REX: The Vision',
      summary: 'How REX and HirePilot turn recruiting into a scalable, automated growth engine.',
      tag: 'AI Automation',
      gradient: 'from-blue-600 to-purple-600',
      icon: 'fa-robot',
      date: 'Jan 15, 2025',
    },
    {
      id: 12,
      href: '/blog/AutomateRecruiting2',
      title: 'From Job Intake to Lead Sourcing: Automate the Top of Funnel',
      summary: 'Turn job descriptions into ready-to-run campaigns with automated lead sourcing from Apollo and LinkedIn.',
      tag: 'Lead Sourcing',
      gradient: 'from-purple-600 to-pink-600',
      icon: 'fa-magnifying-glass',
      date: 'Jan 16, 2025',
    },
    {
      id: 13,
      href: '/blog/AutomateRecruiting3',
      title: 'AI Messaging and Outreach at Scale with REX',
      summary: 'Generate personalized cold emails and automated follow-up sequences delivered at scale.',
      tag: 'AI Messaging',
      gradient: 'from-green-600 to-teal-600',
      icon: 'fa-envelope-open-text',
      date: 'Jan 17, 2025',
    },
    {
      id: 14,
      href: '/blog/AutomateRecruiting4',
      title: 'Managing Your Pipeline + Automating Your Workflows',
      summary: 'Automate candidate pipeline management and trigger workflows across Slack, Clay, Notion, and more.',
      tag: 'Pipeline Automation',
      gradient: 'from-orange-600 to-red-600',
      icon: 'fa-sitemap',
      date: 'Jan 18, 2025',
    },
    {
      id: 15,
      href: '/blog/AutomateRecruiting5',
      title: 'Your Recruiting OS: Reporting, Collaboration & Scaling',
      summary: 'Run your entire recruiting agency from one command center with reporting, collaboration, and scaling.',
      tag: 'Recruiting OS',
      gradient: 'from-red-600 to-pink-600',
      icon: 'fa-desktop',
      date: 'Jan 19, 2025',
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

      {/* Header */}
      <PublicNavbar />

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
      <PublicFooter />
    </>
  );
} 