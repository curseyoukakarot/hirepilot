import React from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function ChromeExtension() {
  return (
    <div className="bg-gray-950 text-white font-sans">
      {/* Header */}
      <PublicNavbar />

      {/* Hero Section */}
      <section id="hero" className="pt-24 pb-20 px-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden h-[700px] flex items-center">
        {/* Existing hero background gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-600/10" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />

        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-full px-6 py-2 mb-8">
            <i className="fas fa-shield-alt text-green-400 mr-2" />
            <span className="text-sm text-gray-300">Secure LinkedIn Integration</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent leading-tight">
            Seamlessly Connect<br />LinkedIn to HirePilot
          </h1>

          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            The HirePilot Extension now lets you securely capture your <code className="bg-gray-800 px-3 py-1 rounded-lg text-green-400 font-mono">li_at</code> cookie and pull leads from LinkedIn Sales Navigator into HirePilot — no copy-paste needed.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a 
              href="https://chromewebstore.google.com/detail/hirepilot-cookie-helper/iiegpolacomfhkfcdgppbgkgkdbfemce?pli=1" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-2xl inline-block"
            >
              <i className="fab fa-chrome mr-2" />
              Add to Chrome
            </a>
            <button className="border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300">
              <i className="fas fa-play mr-2" />
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* New Features Section */}
      <section id="new-features" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            New in Version 2.0 – Advanced Sourcing Power
          </h2>
          <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
            The HirePilot Chrome Extension is more than just a cookie helper. It now enables real-time lead scraping, connection request automation, and enhanced workflow controls for LinkedIn Sales Navigator.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: 'fa-link',
              title: '1-Click Cookie Capture',
              desc: 'Securely authenticate LinkedIn once — no manual copy-paste needed. Your session is encrypted and ready for use in HirePilot.'
            },
            {
              icon: 'fa-users',
              title: 'Sales Navigator Scraping',
              desc: 'Select and sync leads directly from your Sales Navigator search results into HirePilot campaigns, no spreadsheets required.'
            },
            {
              icon: 'fa-paper-plane',
              title: 'Connection Request Automation',
              desc: 'Send personalized LinkedIn connection requests directly from HirePilot using your session. Automate outreach safely and at scale.'
            },
            {
              icon: 'fa-search',
              title: 'Smart Search Navigation',
              desc: 'Navigate through Sales Navigator search pages seamlessly while the extension captures high-quality lead data.'
            },
            {
              icon: 'fa-database',
              title: 'Real-Time Data Sync',
              desc: 'Instantly enrich leads with Name, Title, Company, and LinkedIn URLs as you browse — no extra clicks.'
            },
            {
              icon: 'fa-shield-check',
              title: 'Privacy-First Design',
              desc: 'Your LinkedIn session is stored securely, and HirePilot only retrieves public profile data needed for sourcing workflows.'
            }
          ].map(card => (
            <div key={card.title} className="gradient-border hover-lift">
              <div className="gradient-border-inner p-8 h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6">
                  <i className={`fas ${card.icon} text-white text-2xl`} />
                </div>
                <h3 className="text-2xl font-semibold mb-4 text-white">{card.title}</h3>
                <p className="text-gray-300 leading-relaxed">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sourcing Tips Section */}
      <section id="sourcing-tips" className="py-20 px-6 bg-gray-900/50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
            Pro Tips for Finding High-Quality Leads
          </h2>
          <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed mb-12">
            The extension captures what you see. Here’s how to ensure your Sales Navigator searches bring back top-tier candidates.
          </p>

          <div className="grid md:grid-cols-3 gap-8 text-left">
            {[
              {
                icon: 'fa-filter',
                title: 'Use Sales Navigator Filters',
                desc: 'Narrow down by Seniority, Function, Company Size, and Location to target the right decision-makers.'
              },
              {
                icon: 'fa-code',
                title: 'Leverage Boolean Search',
                desc: 'Use AND/OR operators to create precision search queries. Example: "VP of Marketing" AND SaaS.'
              },
              {
                icon: 'fa-save',
                title: 'Save and Refresh Searches',
                desc: 'Save key search strings to revisit and refresh lists as new leads match your criteria over time.'
              }
            ].map(card => (
              <div key={card.title} className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className={`fas ${card.icon} text-white text-lg`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">{card.title}</h3>
                  <p className="text-gray-300">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section (unchanged) */}
      {/* CTA Section (unchanged) */}
      <PublicFooter />

      {/* Custom styles remain */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        html, body { -ms-overflow-style: none; scrollbar-width: none; }
        .gradient-border {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4);
          padding: 2px;
          border-radius: 12px;
        }
        .gradient-border-inner { background: #111827; border-radius: 10px; }
        .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
      `}</style>
    </div>
  );
}
