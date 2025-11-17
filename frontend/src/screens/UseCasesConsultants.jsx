import React from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function UseCasesConsultants() {
  return (
    <div className="h-full text-base-content">
      <PublicNavbar />
      <main className="font-sans bg-gray-900">
        <style>{`::-webkit-scrollbar { display: none; }`}</style>

        {/* Hero Section */}
        <section id="hero" className="pt-32 py-24 px-6 text-center max-w-5xl mx-auto">
          <div className="mb-6">
            <span className="bg-indigo-900/50 text-indigo-300 px-4 py-2 rounded-full text-sm font-semibold border border-indigo-800">
              For Independent Consultants
            </span>
          </div>
          <h1 className="text-6xl font-bold mb-6 leading-tight text-white">
            Built for Independent<br />
            <span className="text-indigo-400">Consultants & Experts</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed">
            Streamline how you find clients, run projects, and get paid — with one AI-powered platform designed for strategic advisors.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/signup" className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl">
              Start for Free
            </a>
            <a href="/demo" className="flex items-center space-x-2 text-gray-300 hover:text-white font-semibold">
              <i className="fas fa-play-circle text-indigo-400"></i>
              <span>Watch Demo</span>
            </a>
          </div>
        </section>

        {/* Problem → Solution Section */}
        <section id="problem-solution" className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div>
                <h2 className="text-4xl font-bold mb-6 text-white leading-tight">
                  You deliver strategy — but you're running on <span className="text-red-400">duct tape</span>
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-red-900/30 rounded-full flex items-center justify-center mt-0.5">
                      <i className="fas fa-times text-red-400 text-xs"></i>
                    </div>
                    <p className="text-gray-400">Your lead generation is sporadic or dependent on referrals</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-red-900/30 rounded-full flex items-center justify-center mt-0.5">
                      <i className="fas fa-times text-red-400 text-xs"></i>
                    </div>
                    <p className="text-gray-400">Project scopes and timelines live across multiple tools</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-red-900/30 rounded-full flex items-center justify-center mt-0.5">
                      <i className="fas fa-times text-red-400 text-xs"></i>
                    </div>
                    <p className="text-gray-400">Follow-up and client updates often get buried or delayed</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-red-900/30 rounded-full flex items-center justify-center mt-0.5">
                      <i className="fas fa-times text-red-400 text-xs"></i>
                    </div>
                    <p className="text-gray-400">Billing is manual or inconsistent (and follow-up is awkward)</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-indigo-900/30 to-blue-900/30 rounded-2xl p-8 shadow-xl border border-indigo-800">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <i className="fas fa-rocket text-white"></i>
                </div>
                <h3 className="text-2xl font-bold text-white">HirePilot gives you:</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-900/30 rounded-full flex items-center justify-center mt-0.5">
                    <i className="fas fa-check text-green-400 text-xs"></i>
                  </div>
                  <p className="text-gray-300 font-medium">Automated outreach to fill your pipeline with qualified leads</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-900/30 rounded-full flex items-center justify-center mt-0.5">
                    <i className="fas fa-check text-green-400 text-xs"></i>
                  </div>
                  <p className="text-gray-300 font-medium">Client-facing tables and dashboards to track project scope & status</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-900/30 rounded-full flex items-center justify-center mt-0.5">
                    <i className="fas fa-check text-green-400 text-xs"></i>
                  </div>
                  <p className="text-gray-300 font-medium">Structured onboarding & delivery with forms and updates</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-900/30 rounded-full flex items-center justify-center mt-0.5">
                    <i className="fas fa-check text-green-400 text-xs"></i>
                  </div>
                  <p className="text-gray-300 font-medium">Recurring billing, deposits, or milestone payments via Stripe</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="bg-gray-800 py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-6 text-white">From proposal to payout — all in one place</h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">Stop stitching together tools. Run a clean, modern consulting business on autopilot.</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-gray-900 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-800 group">
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">🧲</div>
                <h4 className="font-bold text-xl mb-3 text-white">Lead Generation</h4>
                <p className="text-gray-400 leading-relaxed">REX campaigns help you book intro calls with founders, ops teams, or execs.</p>
              </div>
              
              <div className="bg-gray-900 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-800 group">
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">📋</div>
                <h4 className="font-bold text-xl mb-3 text-white">Proposal & Kickoff</h4>
                <p className="text-gray-400 leading-relaxed">Send intake forms, define goals, and align timelines from one workspace.</p>
              </div>
              
              <div className="bg-gray-900 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-800 group">
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">🗂️</div>
                <h4 className="font-bold text-xl mb-3 text-white">Project Tracking</h4>
                <p className="text-gray-400 leading-relaxed">Use tables & tasks to show deliverables, status, and communication.</p>
              </div>
              
              <div className="bg-gray-900 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-800 group">
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">💵</div>
                <h4 className="font-bold text-xl mb-3 text-white">Billing</h4>
                <p className="text-gray-400 leading-relaxed">Use our Stripe integration to bill per project, month, or phase.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 px-6 bg-gray-900">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-6 text-white">Everything you need to scale your practice</h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">Professional tools that work as hard as you do</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="p-6 rounded-xl border border-gray-800 hover:border-indigo-600 hover:shadow-lg transition-all bg-gray-800/50">
                <div className="w-12 h-12 bg-indigo-900/50 rounded-lg flex items-center justify-center mb-4">
                  <i className="fas fa-search text-indigo-400"></i>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-white">AI-Powered Outreach</h3>
                <p className="text-gray-400">Automatically identify and reach out to prospects that match your ideal client profile.</p>
              </div>
              
              <div className="p-6 rounded-xl border border-gray-800 hover:border-indigo-600 hover:shadow-lg transition-all bg-gray-800/50">
                <div className="w-12 h-12 bg-indigo-900/50 rounded-lg flex items-center justify-center mb-4">
                  <i className="fas fa-chart-line text-indigo-400"></i>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-white">Project Dashboards</h3>
                <p className="text-gray-400">Keep clients informed with real-time project status, deliverables, and milestones.</p>
              </div>
              
              <div className="p-6 rounded-xl border border-gray-800 hover:border-indigo-600 hover:shadow-lg transition-all bg-gray-800/50">
                <div className="w-12 h-12 bg-indigo-900/50 rounded-lg flex items-center justify-center mb-4">
                  <i className="fas fa-credit-card text-indigo-400"></i>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-white">Smart Billing</h3>
                <p className="text-gray-400">Automated invoicing, payment tracking, and gentle follow-ups for overdue accounts.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="cta" className="py-24 px-6 text-center bg-gradient-to-br from-indigo-600 to-purple-700">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-5xl font-bold mb-6 text-white leading-tight">
              You advise others how to scale —<br />
              <span className="text-indigo-200">now scale yourself</span>
            </h2>
            <p className="text-xl text-indigo-100 mb-10 max-w-2xl mx-auto leading-relaxed">
              HirePilot turns your solo practice into a streamlined business — with zero overhead and maximum efficiency.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/signup" className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-lg hover:shadow-xl">
                Start for Free
              </a>
              <a href="/demo" className="text-white border border-white/30 px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-all">
                Schedule Demo
              </a>
            </div>
            <p className="text-indigo-200 text-sm mt-6">No credit card required • 14-day free trial</p>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}


