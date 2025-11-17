import React from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import PublicBreadcrumbs from '../components/PublicBreadcrumbs';

export default function UseCasesFractionalExecutives() {
  return (
    <div className="h-full text-base-content">
      <PublicNavbar />
      <main className="bg-gray-900">
        <style>{`::-webkit-scrollbar { display: none; }`}</style>

        {/* Hero */}
        <section id="hero" className="pt-32 py-24 px-6 text-center max-w-5xl mx-auto h-[600px] flex flex-col justify-center">
          <div className="max-w-4xl mx-auto">
            <div className="max-w-6xl mx-auto mb-4 text-left">
              <PublicBreadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Use Cases', href: '/use-cases' }, { label: 'Fractional Executives' }]} />
            </div>
            <h1 className="text-6xl font-bold mb-6 leading-tight text-white">
              Built for Fractional Executives & Solo Consultants
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              Sell retainers, run client delivery, and scale your time — without hiring a team.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <a href="/signup" className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition">
                Start Free Trial
              </a>
              <a href="/demo" className="text-indigo-400 font-semibold text-lg hover:text-indigo-300 transition flex items-center">
                Watch Demo <i className="fas fa-play-circle ml-2"></i>
              </a>
            </div>
          </div>
        </section>

        {/* Pain / Solution */}
        <section id="pain-solution" className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div id="pain-points">
              <h2 className="text-4xl font-bold mb-6 text-white">You're doing everything manually.</h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-red-900/50 rounded-full flex items-center justify-center mt-1">
                    <i className="fas fa-times text-red-400 text-sm"></i>
                  </div>
                  <p className="text-gray-300 text-lg">Manually emailing prospects and referrals</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-red-900/50 rounded-full flex items-center justify-center mt-1">
                    <i className="fas fa-times text-red-400 text-sm"></i>
                  </div>
                  <p className="text-gray-300 text-lg">Juggling client dashboards, docs, and notes across platforms</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-red-900/50 rounded-full flex items-center justify-center mt-1">
                    <i className="fas fa-times text-red-400 text-sm"></i>
                  </div>
                  <p className="text-gray-300 text-lg">Chasing payments or tracking invoices in spreadsheets</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-red-900/50 rounded-full flex items-center justify-center mt-1">
                    <i className="fas fa-times text-red-400 text-sm"></i>
                  </div>
                  <p className="text-gray-300 text-lg">Struggling to scale beyond your current bandwidth</p>
                </div>
              </div>
            </div>
            <div id="solution" className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-2xl p-8 shadow-lg border border-gray-600">
              <h3 className="text-3xl font-bold mb-6 text-white">HirePilot gives you:</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-900/50 rounded-full flex items-center justify-center mt-1">
                    <i className="fas fa-check text-green-400 text-sm"></i>
                  </div>
                  <p className="text-gray-200 text-lg">REX outreach campaigns to generate leads on autopilot</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-900/50 rounded-full flex items-center justify-center mt-1">
                    <i className="fas fa-check text-green-400 text-sm"></i>
                  </div>
                  <p className="text-gray-200 text-lg">Client dashboards to centralize updates, docs, and progress</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-900/50 rounded-full flex items-center justify-center mt-1">
                    <i className="fas fa-check text-green-400 text-sm"></i>
                  </div>
                  <p className="text-gray-200 text-lg">Automated Stripe billing for retainer or project-based payments</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-900/50 rounded-full flex items-center justify-center mt-1">
                    <i className="fas fa-check text-green-400 text-sm"></i>
                  </div>
                  <p className="text-gray-200 text-lg">Forms, tasks, and tables to standardize delivery and client success</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="bg-gray-800 py-20 px-6">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6 text-white">Your fractional business, fully automated</h2>
            <p className="text-xl text-gray-400 mb-12 max-w-3xl mx-auto">Run your entire client pipeline from outreach to delivery to payment — in one place.</p>
            <div className="grid md:grid-cols-4 gap-8 text-left">
              <div id="step-1" className="bg-gray-700 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-600">
                <div className="w-16 h-16 bg-indigo-900/50 rounded-2xl flex items-center justify-center mb-6">
                  <i className="fas fa-envelope text-indigo-400 text-2xl"></i>
                </div>
                <h4 className="font-bold text-xl mb-3 text-white">Lead Outreach</h4>
                <p className="text-gray-300 leading-relaxed">REX sends personalized outbound every week based on your ideal client persona.</p>
              </div>
              <div id="step-2" className="bg-gray-700 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-600">
                <div className="w-16 h-16 bg-green-900/50 rounded-2xl flex items-center justify-center mb-6">
                  <i className="fas fa-clipboard-list text-green-400 text-2xl"></i>
                </div>
                <h4 className="font-bold text-xl mb-3 text-white">Discovery & Onboarding</h4>
                <p className="text-gray-300 leading-relaxed">Use forms and dashboards to organize intake, goals, and kickoff materials.</p>
              </div>
              <div id="step-3" className="bg-gray-700 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-600">
                <div className="w-16 h-16 bg-blue-900/50 rounded-2xl flex items-center justify-center mb-6">
                  <i className="fas fa-folder-open text-blue-400 text-2xl"></i>
                </div>
                <h4 className="font-bold text-xl mb-3 text-white">Service Delivery</h4>
                <p className="text-gray-300 leading-relaxed">Run updates, share links, upload files, and manage status in your client table.</p>
              </div>
              <div id="step-4" className="bg-gray-700 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-600">
                <div className="w-16 h-16 bg-yellow-900/50 rounded-2xl flex items-center justify-center mb-6">
                  <i className="fas fa-credit-card text-yellow-400 text-2xl"></i>
                </div>
                <h4 className="font-bold text-xl mb-3 text-white">Billing & Renewals</h4>
                <p className="text-gray-300 leading-relaxed">Use Stripe integration to bill monthly or by milestone — automatically.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 px-6 bg-gray-900">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-6 text-white">Everything you need to run a fractional business</h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">Stop juggling multiple tools. HirePilot is your all-in-one platform for client acquisition, delivery, and retention.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div id="feature-1" className="text-center p-6">
                <div className="w-20 h-20 bg-indigo-900/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-robot text-indigo-400 text-3xl"></i>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">AI-Powered Outreach</h3>
                <p className="text-gray-400">Automated email sequences that book qualified discovery calls while you focus on delivery.</p>
              </div>
              <div id="feature-2" className="text-center p-6">
                <div className="w-20 h-20 bg-green-900/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-tachometer-alt text-green-400 text-3xl"></i>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">Client Dashboards</h3>
                <p className="text-gray-400">Give clients real-time visibility into project progress, deliverables, and next steps.</p>
              </div>
              <div id="feature-3" className="text-center p-6">
                <div className="w-20 h-20 bg-blue-900/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-chart-line text-blue-400 text-3xl"></i>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">Revenue Analytics</h3>
                <p className="text-gray-400">Track MRR, client lifetime value, and pipeline health to optimize your business.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="cta" className="py-24 px-6 text-center bg-gradient-to-br from-indigo-600 to-purple-700">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-5xl font-bold mb-6 text-white">Scale your solo business — without hiring anyone</h2>
            <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
              HirePilot is your virtual operator — helping you find clients, serve them, and get paid.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <a href="/signup" className="bg-white text-indigo-600 px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition shadow-lg">
                Try HirePilot Free
              </a>
              <a href="/demo" className="text-white font-semibold text-lg hover:text-indigo-200 transition flex items-center">
                Book a Demo <i className="fas fa-arrow-right ml-2"></i>
              </a>
            </div>
            <p className="text-indigo-200 text-sm mt-4">No credit card required • 14-day free trial</p>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}


