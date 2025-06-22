import React from 'react';

export default function Copilot() {
  return (
    <div className="h-full text-base-content">
      <div className="min-h-screen bg-white text-gray-900">
        {/* Header */}
        <header id="header" className="fixed w-full top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="HirePilot Logo" className="h-8 w-8" />
              <span className="text-xl font-bold">HirePilot</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <span className="text-blue-600 font-medium border-b-2 border-blue-600 pb-1 cursor-pointer">Recruiting Co-Pilot</span>
              <span className="text-gray-600 hover:text-gray-900 cursor-pointer">Hands Free Hiring</span>
              <span className="text-gray-600 hover:text-gray-900 cursor-pointer">Pricing</span>
            </nav>
            <div className="flex items-center gap-4">
              <span className="hidden md:block text-gray-600 hover:text-gray-900 cursor-pointer">Sign in</span>
              <a href="#" className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-2.5 rounded-lg hover:shadow-lg transition-all duration-200">
                Start for Free
              </a>
            </div>
            <button className="md:hidden text-gray-600">
              <i className="fa-solid fa-bars text-2xl"></i>
            </button>
          </div>
        </header>

        {/* Hero */}
        <section id="hero" className="bg-gradient-to-b from-blue-500 via-blue-200 to-white h-[800px] pt-32">
          <div className="max-w-7xl mx-auto px-6 md:px-10 flex flex-col-reverse md:flex-row items-center justify-between gap-12">
            <div className="w-full md:w-1/2 text-center md:text-left">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight text-gray-900">
                Sourcing Made Simple.
              </h1>
              <p className="mt-6 text-xl text-gray-800">
                Build your own pipeline in minutes, not months.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 sm:justify-start justify-center">
                <a href="#" className="group bg-white text-blue-600 font-semibold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200">
                  Start for Free <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                </a>
                <a href="#" className="bg-blue-900 text-white font-semibold py-3 px-8 rounded-lg shadow-lg hover:bg-blue-800 transition-all duration-200">
                  <i className="fa-regular fa-calendar mr-2"></i> Book Demo
                </a>
              </div>
            </div>
            <div className="w-full md:w-1/2">
              <div className="relative">
                <div className="absolute inset-0 bg-white/10 rounded-2xl transform rotate-6"></div>
                <div className="relative rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/20 bg-white">
                  <img className="w-full h-auto" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/1439dbe4ae-3b290a3e213b31f8d4e0.png" alt="modern recruitment dashboard UI with statistics and candidate profiles, professional design, blue theme" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-semibold mb-4">See HirePilot in action</h2>
            <p className="text-gray-600 mb-12 max-w-2xl mx-auto">Watch how our platform streamlines sourcing, messaging, and scheduling so you can hire faster.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div id="feature-1" className="bg-white p-6 rounded-xl shadow-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-magnifying-glass text-blue-600 text-xl"></i>
                </div>
                <h3 className="text-xl font-semibold mb-3">Smart Sourcing</h3>
                <p className="text-gray-600">AI-powered candidate matching and automated outreach campaigns</p>
              </div>
              <div id="feature-2" className="bg-white p-6 rounded-xl shadow-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-comments text-blue-600 text-xl"></i>
                </div>
                <h3 className="text-xl font-semibold mb-3">Intelligent Messaging</h3>
                <p className="text-gray-600">Personalized communication with candidates at scale</p>
              </div>
              <div id="feature-3" className="bg-white p-6 rounded-xl shadow-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-calendar-check text-blue-600 text-xl"></i>
                </div>
                <h3 className="text-xl font-semibold mb-3">Easy Scheduling</h3>
                <p className="text-gray-600">Automated interview scheduling and calendar management</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="cta" className="py-20 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold mb-6">Start your hiring process with HirePilot. Save 100+ hours per role.</h2>
            <p className="text-xl mb-10 opacity-90">Join thousands of companies hiring better with AI.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#" className="bg-white text-blue-600 font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200">
                Get Started Free <i className="fa-solid fa-arrow-right ml-2"></i>
              </a>
              <a href="#" className="border-2 border-white text-white font-semibold py-4 px-8 rounded-lg hover:bg-white/10 transition-colors duration-200">
                <i className="fa-regular fa-calendar mr-2"></i> Schedule Demo
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer id="footer" className="bg-gray-900 text-white py-16">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <img src="/logo.png" alt="HirePilot Logo" className="h-8 w-8" />
                <span className="text-xl font-bold">HirePilot</span>
              </div>
              <p className="text-gray-400">Revolutionizing hiring with AI-powered recruitment solutions.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><span className="hover:text-white cursor-pointer">Features</span></li>
                <li><span className="hover:text-white cursor-pointer">Pricing</span></li>
                <li><span className="hover:text-white cursor-pointer">Enterprise</span></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><span className="hover:text-white cursor-pointer">About</span></li>
                <li><span className="hover:text-white cursor-pointer">Careers</span></li>
                <li><span className="hover:text-white cursor-pointer">Blog</span></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><span className="hover:text-white cursor-pointer">Privacy</span></li>
                <li><span className="hover:text-white cursor-pointer">Terms</span></li>
                <li><span className="hover:text-white cursor-pointer">Security</span></li>
              </ul>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
} 