import React from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import PublicBreadcrumbs from '../components/PublicBreadcrumbs';

export default function UseCasesRecruitingAgencies() {
  return (
    <div className="h-full text-base-content">
      <PublicNavbar />
      <main className="bg-gray-900">
        <style>{`::-webkit-scrollbar { display: none; }`}</style>
        
        {/* Hero */}
        <section id="hero-section" className="pt-32 bg-gray-900 py-24 px-6">
          <div className="max-w-5xl mx-auto text-center">
            <div className="max-w-6xl mx-auto mb-4 text-left">
              <PublicBreadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Use Cases', href: '/use-cases' }, { label: 'Recruiting Agencies' }]} />
            </div>
            <div className="mb-6">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-900/50 text-indigo-300 mb-6 border border-indigo-800">
                <i className="fa-solid fa-users mr-2"></i>
                For Executive Search & Recruiting Agencies
              </span>
            </div>
            <h1 className="text-6xl font-bold mb-6 leading-tight text-white">
              Built for Executive Search & <span className="text-indigo-400">Recruiting Agencies</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              Source talent, run outreach, manage client pipelines, and collect payments — all from one AI-powered platform.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/signup" className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition-colors shadow-lg">
                Start Free Trial
                <i className="fa-solid fa-arrow-right ml-2"></i>
              </a>
              <a href="/demo" className="border border-gray-700 text-gray-300 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-800 transition-colors">
                Watch Demo
                <i className="fa-solid fa-play ml-2"></i>
              </a>
            </div>
          </div>
        </section>

        {/* Problem / Solution */}
        <section id="problem-solution" className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div id="problem-side">
              <h2 className="text-4xl font-bold mb-6 text-white">Stop duct taping your recruiting process.</h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-red-900/50 rounded-full flex items-center justify-center mt-0.5 border border-red-800">
                    <i className="fa-solid fa-times text-red-400 text-sm"></i>
                  </div>
                  <p className="text-gray-400">You're tracking clients in spreadsheets</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-red-900/50 rounded-full flex items-center justify-center mt-0.5 border border-red-800">
                    <i className="fa-solid fa-times text-red-400 text-sm"></i>
                  </div>
                  <p className="text-gray-400">You're sending outreach manually or with janky tools</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-red-900/50 rounded-full flex items-center justify-center mt-0.5 border border-red-800">
                    <i className="fa-solid fa-times text-red-400 text-sm"></i>
                  </div>
                  <p className="text-gray-400">You're chasing feedback and collecting payment over email</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-red-900/50 rounded-full flex items-center justify-center mt-0.5 border border-red-800">
                    <i className="fa-solid fa-times text-red-400 text-sm"></i>
                  </div>
                  <p className="text-gray-400">You have zero visibility across clients, roles, or performance</p>
                </div>
              </div>
            </div>
            
            <div id="solution-side" className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 rounded-2xl p-8 shadow-lg border border-indigo-800">
              <h3 className="text-2xl font-semibold mb-6 text-white">HirePilot replaces all that with:</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-900/50 rounded-full flex items-center justify-center mt-0.5 border border-green-800">
                    <i className="fa-solid fa-check text-green-400 text-sm"></i>
                  </div>
                  <p className="text-gray-300"><strong className="text-white">Sniper:</strong> Source top candidates from LinkedIn & job boards</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-900/50 rounded-full flex items-center justify-center mt-0.5 border border-green-800">
                    <i className="fa-solid fa-check text-green-400 text-sm"></i>
                  </div>
                  <p className="text-gray-300"><strong className="text-white">REX:</strong> Schedule AI-driven outreach & follow-ups</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-900/50 rounded-full flex items-center justify-center mt-0.5 border border-green-800">
                    <i className="fa-solid fa-check text-green-400 text-sm"></i>
                  </div>
                  <p className="text-gray-300"><strong className="text-white">Client tables + dashboards:</strong> Share real-time status updates</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-900/50 rounded-full flex items-center justify-center mt-0.5 border border-green-800">
                    <i className="fa-solid fa-check text-green-400 text-sm"></i>
                  </div>
                  <p className="text-gray-300"><strong className="text-white">Stripe-integrated billing:</strong> Automate deposits & invoices</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow-section" className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-6 text-white">Your new recruiting workflow, powered by HirePilot</h2>
              <p className="text-xl text-gray-400">From prospecting to placement — without the chaos.</p>
            </div>
            
            <div className="grid md:grid-cols-4 gap-8">
              <div id="workflow-step-1" className="bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-700 relative">
                <div className="text-5xl mb-4">🎯</div>
                <h4 className="font-semibold text-xl mb-3 text-white">Source Candidates</h4>
                <p className="text-gray-400">Use Sniper to pull top talent from LinkedIn, Indeed, and other job boards.</p>
                <div className="absolute -right-4 top-1/2 transform -translate-y-1/2 hidden md:block">
                  <i className="fa-solid fa-arrow-right text-indigo-600 text-2xl"></i>
                </div>
              </div>
              
              <div id="workflow-step-2" className="bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-700 relative">
                <div className="text-5xl mb-4">🤖</div>
                <h4 className="font-semibold text-xl mb-3 text-white">Automate Outreach</h4>
                <p className="text-gray-400">REX handles your emails, messages, and follow-ups — scheduled weekly.</p>
                <div className="absolute -right-4 top-1/2 transform -translate-y-1/2 hidden md:block">
                  <i className="fa-solid fa-arrow-right text-indigo-600 text-2xl"></i>
                </div>
              </div>
              
              <div id="workflow-step-3" className="bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-700 relative">
                <div className="text-5xl mb-4">📊</div>
                <h4 className="font-semibold text-xl mb-3 text-white">Track Clients</h4>
                <p className="text-gray-400">Use tables & dashboards to show real-time status and candidate flow.</p>
                <div className="absolute -right-4 top-1/2 transform -translate-y-1/2 hidden md:block">
                  <i className="fa-solid fa-arrow-right text-indigo-600 text-2xl"></i>
                </div>
              </div>
              
              <div id="workflow-step-4" className="bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-700">
                <div className="text-5xl mb-4">💳</div>
                <h4 className="font-semibold text-xl mb-3 text-white">Collect Payment</h4>
                <p className="text-gray-400">Use our Stripe integration to trigger invoices or deposits automatically.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section id="features-grid" className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-white">Everything you need to scale your recruiting business</h2>
            <p className="text-xl text-gray-400">Powerful tools designed specifically for executive search and recruiting agencies</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div id="feature-1" className="p-6 rounded-xl border border-gray-700 hover:border-indigo-600 transition-all duration-300 bg-gray-800">
              <div className="w-12 h-12 bg-indigo-900/50 rounded-lg flex items-center justify-center mb-4 border border-indigo-800">
                <i className="fa-solid fa-search text-indigo-400 text-xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">AI-Powered Sourcing</h3>
              <p className="text-gray-400">Find perfect candidates faster with intelligent search across multiple platforms and databases.</p>
            </div>
            
            <div id="feature-2" className="p-6 rounded-xl border border-gray-700 hover:border-indigo-600 transition-all duration-300 bg-gray-800">
              <div className="w-12 h-12 bg-indigo-900/50 rounded-lg flex items-center justify-center mb-4 border border-indigo-800">
                <i className="fa-solid fa-envelope text-indigo-400 text-xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Smart Outreach</h3>
              <p className="text-gray-400">Personalized email sequences and follow-ups that actually get responses from top talent.</p>
            </div>
            
            <div id="feature-3" className="p-6 rounded-xl border border-gray-700 hover:border-indigo-600 transition-all duration-300 bg-gray-800">
              <div className="w-12 h-12 bg-indigo-900/50 rounded-lg flex items-center justify-center mb-4 border border-indigo-800">
                <i className="fa-solid fa-chart-line text-indigo-400 text-xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Real-time Analytics</h3>
              <p className="text-gray-400">Track performance, monitor pipelines, and optimize your recruiting process with detailed insights.</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="cta-section" className="bg-gray-900 py-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6 text-white">Built for Modern Recruiting Teams</h2>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Stop losing deals and wasting time — HirePilot helps you scale client delivery, sourcing, and outreach in one place.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/signup" className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition-colors shadow-lg">
                Try HirePilot Free
                <i className="fa-solid fa-arrow-right ml-2"></i>
              </a>
              <a href="/demo" className="border border-gray-600 text-gray-300 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-800 transition-colors">
                Schedule Demo
                <i className="fa-solid fa-calendar ml-2"></i>
              </a>
            </div>
            <p className="text-sm text-gray-400 mt-6">Start For Free, No Credit Card Required • No setup fees • Cancel anytime</p>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}


