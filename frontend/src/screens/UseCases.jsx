import React from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import PublicBreadcrumbs from '../components/PublicBreadcrumbs';

export default function UseCases() {
  return (
    <div className="h-full text-base-content">
      <PublicNavbar />
      <main className="bg-gray-900">
        <style>{`
          ::-webkit-scrollbar { display: none; }
          .hover-lift:hover { transform: translateY(-8px); }
          .gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          .card-shadow { box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3); }
          .card-shadow:hover { box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4); }
        `}</style>

        {/* Hero */}
        <section id="hero" className="pt-32 pb-24 px-6 text-center max-w-5xl mx-auto">
          <div className="max-w-6xl mx-auto mb-4">
            <PublicBreadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Use Cases' }]} />
          </div>
          <div className="mb-6">
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-indigo-900 text-indigo-300">
              <i className="fa-solid fa-rocket mr-2"></i>
              Built for Modern Service Businesses
            </span>
          </div>
          <h1 className="text-6xl font-bold mb-6 leading-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Built for Agencies, Solopreneurs & Fractional Operators
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Automate your client outreach, service delivery, and billing — all from one beautiful, AI-powered system that grows with your business.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/signup" className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-indigo-700 transition shadow-lg">
              Start Free Trial
            </a>
            <a href="/demo" className="border border-gray-700 text-gray-300 px-8 py-4 rounded-xl font-semibold hover:bg-gray-800 transition">
              Watch Demo
            </a>
          </div>
        </section>

        {/* Use Cases grid */}
        <section id="use-cases" className="py-20 px-6 bg-gray-800">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 text-white">Perfect for Every Service Business</h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                See how HirePilot transforms operations across different industries and business models
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <a href="/use-cases/recruiting-agencies" className="group bg-gray-900 p-8 rounded-2xl card-shadow hover-lift transition-all duration-300 border border-gray-800">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-blue-900 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-800 transition">
                    <i className="fa-solid fa-users text-2xl text-blue-400"></i>
                  </div>
                  <h3 className="text-2xl font-semibold mb-3 text-white">Recruiting Agencies</h3>
                  <p className="text-gray-400 leading-relaxed">Source leads, run outreach, manage pipelines, and collect payment — without spreadsheets or VAs.</p>
                </div>
                <div className="flex items-center text-indigo-400 font-semibold group-hover:text-indigo-300 transition">
                  <span>Explore</span>
                  <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition"></i>
                </div>
              </a>

              <a href="/use-cases/fractional-executives" className="group bg-gray-900 p-8 rounded-2xl card-shadow hover-lift transition-all duration-300 border border-gray-800">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-purple-900 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-800 transition">
                    <i className="fa-solid fa-brain text-2xl text-purple-400"></i>
                  </div>
                  <h3 className="text-2xl font-semibold mb-3 text-white">Fractional COOs & Executives</h3>
                  <p className="text-gray-400 leading-relaxed">Offer sprints or retainers, run client delivery, and get paid — all from one dashboard.</p>
                </div>
                <div className="flex items-center text-indigo-400 font-semibold group-hover:text-indigo-300 transition">
                  <span>Explore</span>
                  <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition"></i>
                </div>
              </a>

              <a href="/use-cases/consultants" className="group bg-gray-900 p-8 rounded-2xl card-shadow hover-lift transition-all duration-300 border border-gray-800">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-green-900 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-800 transition">
                    <i className="fa-solid fa-chart-line text-2xl text-green-400"></i>
                  </div>
                  <h3 className="text-2xl font-semibold mb-3 text-white">Sales Consultants</h3>
                  <p className="text-gray-400 leading-relaxed">Create your own ICPs, automate messaging, book calls, and track results in real-time.</p>
                </div>
                <div className="flex items-center text-indigo-400 font-semibold group-hover:text-indigo-300 transition">
                  <span>Explore</span>
                  <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition"></i>
                </div>
              </a>

              <div className="group bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-2xl border-2 border-dashed border-gray-700 flex flex-col justify-center items-center text-center md:col-span-2">
                <div className="w-16 h-16 bg-indigo-900 rounded-xl flex items-center justify-center mb-4">
                  <i className="fa-solid fa-plus text-2xl text-indigo-400"></i>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Your Business Model</h3>
                <p className="text-gray-400 text-sm mb-4">Don't see your use case? HirePilot adapts to any service business.</p>
                <a href="/contact" className="text-indigo-400 font-medium hover:text-indigo-300 transition">Get Custom Demo →</a>
              </div>
            </div>
          </div>
        </section>

        {/* Features preview */}
        <section id="features-preview" className="py-20 px-6 bg-gray-900">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 text-white">One Platform, Endless Possibilities</h2>
              <p className="text-xl text-gray-400">Everything you need to run and scale your service business</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6">
                <div className="w-20 h-20 bg-blue-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <i className="fa-solid fa-robot text-3xl text-blue-400"></i>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-white">AI-Powered Automation</h3>
                <p className="text-gray-400">Smart workflows that handle routine tasks while you focus on growth</p>
              </div>
              
              <div className="text-center p-6">
                <div className="w-20 h-20 bg-green-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <i className="fa-solid fa-credit-card text-3xl text-green-400"></i>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-white">Seamless Payments</h3>
                <p className="text-gray-400">Get paid faster with automated invoicing and payment processing</p>
              </div>
              
              <div className="text-center p-6">
                <div className="w-20 h-20 bg-purple-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <i className="fa-solid fa-chart-bar text-3xl text-purple-400"></i>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-white">Real-time Analytics</h3>
                <p className="text-gray-400">Track performance and make data-driven decisions with detailed insights</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="cta" className="py-24 px-6 gradient-bg">
          <div className="max-w-4xl mx-auto text-center text-white">
            <h2 className="text-5xl font-bold mb-6">Start Your Free Account</h2>
            <p className="text-xl mb-8 opacity-90 leading-relaxed">
              Try HirePilot for free and see how easy it is to run your service business without the chaos. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/signup" className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-semibold hover:bg-gray-100 transition shadow-lg">
                Get Started Free
              </a>
              <a href="/demo" className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold hover:bg-white hover:bg-opacity-10 transition">
                Schedule Demo
              </a>
            </div>
            <p className="text-sm mt-6 opacity-75">14-day free trial • No setup fees • Cancel anytime</p>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}


