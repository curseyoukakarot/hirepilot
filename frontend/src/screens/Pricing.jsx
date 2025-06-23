import React from 'react';

export default function Pricing() {
  return (
    <div className="h-full text-base-content">
      {/* Navbar */}
      <header id="navbar" className="fixed w-full top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="HirePilot Logo" className="h-8 w-8" />
              <span className="text-xl font-bold">HirePilot</span>
            </a>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="/copilot" className="text-gray-600 hover:text-gray-900">Your Recruiting Co-Pilot</a>
            <a href="/handsfree" className="text-gray-600 hover:text-gray-900">Done For You Hiring</a>
            <a href="/pricing" className="text-blue-600 font-medium">Pricing</a>
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

      <div id="pricing-page" className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        {/* Page Header (hero) */}
        <div id="hero-header" className="pt-32 pb-20 px-6 text-center">
          <span className="inline-block text-blue-600 bg-blue-50 rounded-full px-4 py-1 text-sm mb-4">Pricing</span>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Perfect Plan</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">Select the plan that best fits your needs. All plans include a 7-day free trial with full access to all features.</p>
        </div>

        {/* Pricing Plans */}
        <div id="pricing-plans" className="max-w-7xl mx-auto px-6 mb-24">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <div id="starter-plan" className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Starter</h2>
                  <p className="text-gray-500 mt-1">Perfect for individuals</p>
                </div>
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">Popular</span>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">$99</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>350 credits/month</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>$50 per 1,000 extra credits</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>1 user</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Unlimited Job Reqs</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Credit rollover</span></li>
              </ul>
              <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors">Get Started for Free</button>
            </div>

            {/* Pro Plan */}
            <div id="pro-plan" className="bg-white rounded-2xl p-8 border-2 border-blue-500 shadow-lg hover:shadow-xl transition-shadow duration-300 transform scale-105">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Pro</h2>
                  <p className="text-gray-500 mt-1">Best for small teams</p>
                </div>
                <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">Best Value</span>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">$249</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>1,000 credits/month</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>$45 per 1,000 extra credits</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Access to live customer chat support</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Schedule and Automate Outreach Campaigns</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Credit rollover</span></li>
              </ul>
              <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors">Get Started for Free</button>
            </div>

            {/* Team Plan */}
            <div id="team-plan" className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Team</h2>
                  <p className="text-gray-500 mt-1">For growing companies</p>
                </div>
                <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">Enterprise</span>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">$99</span>
                <span className="text-gray-500">/month per user</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>5,000 credits/month</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>$40 per 1,000 extra credits</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>5 users</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Hiring Scaling Support</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Access to REX - your Recruiting AI assistant</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>API Access</span></li>
              </ul>
              <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors">Get Started for Free</button>
            </div>
          </div>
        </div>

        {/* Done-For-You Section */}
        <div id="dfy-section" className="bg-gray-900 py-20 px-6">
          <div className="max-w-7xl mx-auto text-center mb-16">
            <span className="inline-block text-blue-400 bg-blue-900 rounded-full px-4 py-1 text-sm mb-4">Done-For-You</span>
            <h2 className="text-3xl font-bold text-white mb-4">Premium Done-For-You Packages</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Let our expert team handle everything for you. Choose the package that matches your requirements.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            <div id="dfy-basic" className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">Done-For-You – 1 Role</h3>
              <p className="text-gray-400 mb-6">Perfect for single position hiring</p>
              <div className="flex items-center justify-center mb-8">
                <i className="fa-solid fa-user-tie text-4xl text-blue-400"></i>
              </div>
              <button className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors">Contact Us</button>
            </div>

            <div id="dfy-standard" className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">Done-For-You – 3 Roles</h3>
              <p className="text-gray-400 mb-6">Ideal for multiple position monthly hiring</p>
              <div className="flex items-center justify-center mb-8">
                <i className="fa-solid fa-users text-4xl text-blue-400"></i>
              </div>
              <button className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors">Contact Us</button>
            </div>

            <div id="dfy-premium" className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">Done-For-You – 5 Roles</h3>
              <p className="text-gray-400 mb-6">Best for department-wide hiring</p>
              <p className="text-gray-400 mb-6">More than 5? Happy to support - Let us know what your needs are!</p>
              <div className="flex items-center justify-center mb-8">
                <i className="fa-solid fa-building-user text-4xl text-blue-400"></i>
              </div>
              <button className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors">Contact Us</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer id="footer" className="bg-gray-900 text-white py-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-4 gap-12 mb-12">
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <img src="/logo.png" alt="HirePilot Logo" className="h-8 w-8" />
                  <span className="text-xl font-bold">HirePilot</span>
                </div>
                <p className="text-gray-400">AI-powered recruiting platform that helps you hire better, faster.</p>
                <div className="mt-6 flex gap-4">
                  <span className="text-gray-400 hover:text-white cursor-pointer"><i className="fa-brands fa-linkedin text-xl"></i></span>
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
            <div className="pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">© 2025 HirePilot. All rights reserved.</div>
          </div>
        </footer>
      </div>
    </div>
  );
} 