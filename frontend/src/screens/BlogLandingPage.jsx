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
      id: 43,
      href: '/blog/resume-scoring-deep-dive',
      title: 'Resume Scoring Deep Dive',
      summary: 'A tactical breakdown of how structure, clarity, keywords, impact, and signal density influence recruiter decisions.',
      tag: 'Job Seeker Platform',
      gradient: 'from-indigo-700 to-blue-800',
      icon: 'fa-square-poll-vertical',
      date: 'Feb 21, 2026',
    },
    {
      id: 42,
      href: '/blog/ai-help-you-stand-out-without-sounding-like-a-robot',
      title: 'How AI Can Help You Stand Out (Without Sounding Like a Robot)',
      summary: 'How to use AI for clarity, structure, and performance while keeping your voice authentic and differentiated.',
      tag: 'Job Seeker Platform',
      gradient: 'from-violet-700 to-purple-800',
      icon: 'fa-wand-magic-sparkles',
      date: 'Feb 21, 2026',
    },
    {
      id: 41,
      href: '/blog/prepare-interviews-with-rex-voice',
      title: 'How to Prepare for Interviews Using REX Voice',
      summary: 'A tactical framework for using live voice coaching to tighten answers, reduce rambling, and build interview confidence.',
      tag: 'Job Seeker Platform',
      gradient: 'from-sky-700 to-indigo-800',
      icon: 'fa-headset',
      date: 'Feb 21, 2026',
    },
    {
      id: 40,
      href: '/blog/modern-job-search-stack',
      title: 'The Modern Job Search Stack (For Serious Candidates)',
      summary: 'The five-layer system serious candidates use to move from passive applications to strategic conversations and offers.',
      tag: 'Job Seeker Platform',
      gradient: 'from-emerald-700 to-teal-800',
      icon: 'fa-layer-group',
      date: 'Feb 21, 2026',
    },
    {
      id: 39,
      href: '/blog/stop-applying-start-conversations',
      title: 'Stop Applying. Start Conversations.',
      summary: 'Why jobs.thehirepilot.com helps candidates shift from passive applications to direct, strategic hiring conversations.',
      tag: 'Job Seeker Platform',
      gradient: 'from-blue-700 to-indigo-800',
      icon: 'fa-comments',
      date: 'Feb 21, 2026',
    },
    {
      id: 38,
      href: '/blog/prep-mode-professional-presence',
      title: 'Prep Mode: Build a Professional Presence That Converts',
      summary: 'How Prep Mode improves resumes, positioning, and interview delivery before job seekers start outreach.',
      tag: 'Job Seeker Platform',
      gradient: 'from-indigo-700 to-purple-800',
      icon: 'fa-file-lines',
      date: 'Feb 21, 2026',
    },
    {
      id: 37,
      href: '/blog/job-seeker-agent-direct-outreach',
      title: 'Job Seeker Agent: Find Hiring Managers. Reach Them Directly.',
      summary: 'Turn LinkedIn job searches into prioritized manager targets and structured outreach campaigns.',
      tag: 'Job Seeker Platform',
      gradient: 'from-emerald-700 to-teal-800',
      icon: 'fa-user-tie',
      date: 'Feb 21, 2026',
    },
    {
      id: 36,
      href: '/blog/rex-voice-interview-helper',
      title: 'REX Voice & Interview Helper - AI-Powered Interview Coaching for Job Seekers',
      summary: 'How jobs.thehirepilot.com helps candidates practice spoken interviews with real-time AI coaching and structured feedback.',
      tag: 'Job Seeker Platform',
      gradient: 'from-sky-700 to-blue-800',
      icon: 'fa-microphone-lines',
      date: 'Feb 21, 2026',
    },
    {
      id: 35,
      href: '/blog/enhanced-enrichment-deep-dive',
      title: 'Enhanced Enrichment Deep Dive',
      summary: 'How funding, revenue, PR signals, and keyword intelligence turn lead profiles into strategic targeting assets.',
      tag: 'Enrichment',
      gradient: 'from-cyan-700 to-blue-800',
      icon: 'fa-magnifying-glass-chart',
      date: 'Feb 21, 2026',
    },
    {
      id: 34,
      href: '/blog/agent-mode-deep-dive',
      title: 'Agent Mode Deep Dive - The Orchestration Layer Powering HirePilot\'s Autonomous Recruiting OS',
      summary: 'How Agent Mode unifies sourcing, sales automation, and REX planning into a controlled execution layer.',
      tag: 'Agent Mode',
      gradient: 'from-purple-700 to-indigo-800',
      icon: 'fa-tower-observation',
      date: 'Feb 21, 2026',
    },
    {
      id: 33,
      href: '/blog/sniper-2-0-dependency-aware-sourcing',
      title: 'Sniper 2.0: Intelligent, Dependency-Aware AI Sourcing for Recruiters',
      summary: 'How Sniper 2.0 adds dependency-aware execution, guardrails, and structured policies for reliable sourcing at scale.',
      tag: 'AI Sourcing',
      gradient: 'from-indigo-700 to-blue-800',
      icon: 'fa-crosshairs',
      date: 'Feb 21, 2026',
    },
    {
      id: 32,
      href: '/blog/recruiters-to-revenue-operators',
      title: 'Turning Recruiters Into Revenue Operators: How HirePilot Connects Pipeline to Profit',
      summary: 'How HirePilot connects deals, pipeline, placements, invoicing, and dashboards so teams can run recruiting as a revenue operation.',
      tag: 'Revenue Operations',
      gradient: 'from-green-700 to-emerald-700',
      icon: 'fa-chart-line',
      date: 'Feb 21, 2026',
    },
    {
      id: 31,
      href: '/blog/custom-tables-dashboards-command-center',
      title: 'Custom Tables & Dashboards: Build Your Own Recruiting Command Center',
      summary: 'Replace spreadsheet drift with connected data models and live dashboards built for recruiting operations.',
      tag: 'Operations',
      gradient: 'from-blue-700 to-cyan-700',
      icon: 'fa-table-columns',
      date: 'Feb 21, 2026',
    },
    {
      id: 30,
      href: '/blog/why-we-made-a-full-ats-free',
      title: 'Why We Made a Full ATS Free',
      summary: 'Why candidate tracking is foundational infrastructure, and why HirePilot monetizes advanced execution instead of basic ATS access.',
      tag: 'Product Philosophy',
      gradient: 'from-emerald-600 to-teal-700',
      icon: 'fa-unlock',
      date: 'Feb 21, 2026',
    },
    {
      id: 29,
      href: '/blog/founder-mission-manual-barriers',
      title: 'From the Founder - My Mission With HirePilot: Removing Manual Barriers From Recruiting',
      summary: 'A founder letter on why HirePilot is built to reduce operational friction and amplify recruiters with careful AI automation.',
      tag: 'From the Founder',
      gradient: 'from-violet-700 to-indigo-700',
      icon: 'fa-bullseye',
      date: 'Feb 21, 2026',
    },
    {
      id: 28,
      href: '/blog/hirepilot-workflow-replacement',
      title: 'How HirePilot Fits Into (And Replaces) Your Current Recruiting Workflow',
      summary: 'A step-by-step breakdown of how HirePilot replaces fragmented recruiting stacks and becomes your end-to-end command center.',
      tag: 'Playbook',
      gradient: 'from-blue-700 to-violet-700',
      icon: 'fa-sitemap',
      date: 'Feb 21, 2026',
    },
    {
      id: 27,
      href: '/blog/hirepilot-2-0-recruiting-os',
      title: '🏛 HirePilot 2.0: From Outreach Tool to Autonomous Recruiting Operating System',
      summary: 'HirePilot 2.0 unifies sourcing, outreach, pipelines, collaboration, deals, billing, and AI automation into one recruiting operating system.',
      tag: 'Product Update',
      gradient: 'from-indigo-600 to-purple-700',
      icon: 'fa-building-columns',
      date: 'Feb 21, 2026',
    },
    {
      id: 26,
      href: '/blog/jobcollaboration',
      title: '👥 Job REQ Collaboration - Work Together, Hire Faster',
      summary: 'Hiring is a team sport — and now, HirePilot makes it seamless. Bring hiring managers, clients, teammates, or guests into the recruiting process without friction.',
      tag: 'Collaboration',
      gradient: 'from-blue-600 to-indigo-600',
      icon: 'fa-users',
      date: 'Sep 14, 2025',
    },
    {
      id: 25,
      href: '/blog/hirepilot-full-ats',
      title: 'HirePilot Just Became a Full ATS - And It\'s Free',
      summary: 'One AI-powered system for sourcing, outreach, pipelines, job apps, and hiring.',
      tag: 'Product Update',
      gradient: 'from-violet-600 to-fuchsia-600',
      icon: 'fa-bolt',
      date: 'Sep 14, 2025',
    },
    {
      id: 24,
      href: '/blog/free-plan-playbook',
      title: 'How to Win Clients and Close Hires Using the Free Plan',
      summary: 'A no-budget playbook to book calls, send outbound, and make placements with HirePilot Free.',
      tag: 'Playbook',
      gradient: 'from-green-500 to-emerald-600',
      icon: 'fa-seedling',
      date: 'Sep 9, 2025',
    },
    {
      id: 23,
      href: '/blog/ats-integrations',
      title: 'Integrating HirePilot with Greenhouse, Lever, and Ashby via Zapier & Webhooks',
      summary: 'Step-by-step guide to connect your ATS to HirePilot using Zapier, webhooks, and native triggers.',
      tag: 'Integrations',
      gradient: 'from-blue-600 to-purple-600',
      icon: 'fa-plug-circle-bolt',
      date: 'Aug 29, 2025',
    },
    {
      id: 22,
      href: '/blog/agentmode',
      title: 'Introducing Agent Mode: Let REX Run Your Outbound',
      summary: 'Turn on Agent Mode to have REX source, message, and manage weekly campaigns for you.',
      tag: 'AI Automation',
      gradient: 'from-blue-600 to-indigo-600',
      icon: 'fa-rocket',
      date: 'Aug 26, 2025',
    },
    {
      id: 21,
      href: '/blog/zapierguide',
      title: 'HirePilot + Zapier/Make: Your No-Code Recruiting Superpowers',
      summary: 'Connect HirePilot to Slack, Google Sheets, HubSpot, Trello, and more — automate recruiting workflows in minutes without code.',
      tag: 'Integrations',
      gradient: 'from-purple-500 to-pink-600',
      icon: 'fa-plug',
      date: 'Aug 9, 2025',
    },
    {
      id: 16,
      href: '/blog/email-deliverability-1',
      title: 'The #1 Mistake Recruiters Make When Sending Emails at Scale',
      summary: 'Why sending 200+ cold emails from Gmail or Outlook destroys your domain reputation and what to do instead.',
      tag: 'Email Deliverability',
      gradient: 'from-red-500 to-orange-600',
      icon: 'fa-triangle-exclamation',
      date: 'Jul 24, 2025',
    },
    {
      id: 17,
      href: '/blog/email-deliverability-2',
      title: 'How to Protect Your Domain Reputation Like a Pro',
      summary: 'Complete guide to SPF, DKIM, DMARC setup and domain warm-up strategies for maximum deliverability.',
      tag: 'Email Deliverability',
      gradient: 'from-green-500 to-emerald-600',
      icon: 'fa-shield-halved',
      date: 'Jul 24, 2025',
    },
    {
      id: 18,
      href: '/blog/email-deliverability-3',
      title: 'Gmail, Outlook, and the Harsh Truth About Free Email Providers',
      summary: 'Why free email platforms throttle bulk outreach and what dedicated sending services offer instead.',
      tag: 'Email Deliverability',
      gradient: 'from-orange-500 to-yellow-600',
      icon: 'fa-envelope-circle-check',
      date: 'Jul 24, 2025',
    },
    {
      id: 19,
      href: '/blog/email-deliverability-4',
      title: 'SendGrid Best Practices for HirePilot Users',
      summary: 'Optimize SendGrid for maximum deliverability, compliance, and performance with step-by-step setup guides.',
      tag: 'Email Deliverability',
      gradient: 'from-purple-500 to-violet-600',
      icon: 'fa-server',
      date: 'Jul 24, 2025',
    },
    {
      id: 20,
      href: '/blog/email-deliverability-5',
      title: 'How to Avoid Spam Filters and Get More Replies',
      summary: 'Master email copywriting, formatting, and technical best practices to reach the inbox and get responses.',
      tag: 'Email Deliverability',
      gradient: 'from-teal-500 to-cyan-600',
      icon: 'fa-inbox',
      date: 'Jul 24, 2025',
    },
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
        <section id="blog-hero" className="bg-gradient-to-br from-gray-900 via-gray-900 to-black py-20">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              The HirePilot Blog
            </h1>
            <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
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
                  className="w-full px-6 py-4 bg-gray-900/60 border-2 border-gray-700 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-violet-500 search-glow text-lg shadow-sm"
                />
                <i className="fa-solid fa-search absolute right-6 top-1/2 -translate-y-1/2 text-violet-400 text-xl" />
              </div>
            </div>

            {/* Dynamic Filter pills */}
            <div id="filter-pills" className="flex flex-wrap justify-center gap-3">
              {tags.map(t=> (
                <button
                  key={t}
                  onClick={()=>{setActiveTag(t);setVisible(6);}}
                  className={`px-6 py-2 rounded-xl font-medium transition ${activeTag===t? 'bg-violet-600 text-white':'bg-gray-800 text-gray-200 hover:bg-gray-700'}`}
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