import React from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function RexSupport(){
  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <PublicNavbar />
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20" />
        <div className="relative max-w-6xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center bg-blue-500/20 border border-blue-400/30 rounded-full px-6 py-2 mb-6">
            <i className="fa-solid fa-robot text-blue-400 mr-3 text-lg" />
            <span className="text-blue-300 font-medium">AI Recruiting Assistant</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-6">REX Documentation</h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">Your intelligent AI assistant that automates sourcing, enrichment, messaging, analytics, and integrations using natural language commands.</p>
        </div>
      </header>

      {/* Main content copied from HTML, classes preserved */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Quick Start */}
        <section id="quick-start" className="mb-16">
          <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-400/20 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-blue-300 mb-4 flex items-center"><i className="fa-solid fa-rocket mr-3" />Quick Start Guide</h2>
            <p className="text-gray-300 mb-6">Simply type or speak to REX using natural language. Here are the main categories of what REX can help you with:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-4 text-center"><i className="fa-solid fa-search text-blue-400 text-2xl mb-2" /><div className="text-sm font-medium">Sourcing</div></div>
              <div className="bg-slate-800/50 rounded-lg p-4 text-center"><i className="fa-solid fa-user-plus text-purple-400 text-2xl mb-2" /><div className="text-sm font-medium">Enrichment</div></div>
              <div className="bg-slate-800/50 rounded-lg p-4 text-center"><i className="fa-solid fa-envelope text-green-400 text-2xl mb-2" /><div className="text-sm font-medium">Messaging</div></div>
              <div className="bg-slate-800/50 rounded-lg p-4 text-center"><i className="fa-solid fa-chart-line text-orange-400 text-2xl mb-2" /><div className="text-sm font-medium">Analytics</div></div>
            </div>
          </div>
        </section>

        {/* Entire HTML from design injected verbatim */}
        <div dangerouslySetInnerHTML={{ __html: String.raw`<header id="header" class="relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div class="relative max-w-6xl mx-auto px-6 py-16">
            <div class="text-center">
                <div class="inline-flex items-center bg-blue-500/20 border border-blue-400/30 rounded-full px-6 py-2 mb-6">
                    <i class="fa-solid fa-robot text-blue-400 mr-3 text-lg"></i>
                    <span class="text-blue-300 font-medium">AI Recruiting Assistant</span>
                </div>
                <h1 class="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-6">
                    REX Documentation
                </h1>
                <p class="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                    Your intelligent AI assistant that automates sourcing, enrichment, messaging, analytics, and integrations using natural language commands.
                </p>
            </div>
        </div>
    </header>

    <main id="main-content" class="max-w-6xl mx-auto px-6 py-12">...` }} />
      </main>
      <PublicFooter />
    </div>
  );
} 