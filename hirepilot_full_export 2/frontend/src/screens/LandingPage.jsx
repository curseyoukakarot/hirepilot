import React from "react";
import { Link } from "react-router-dom";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="fixed w-full top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-rocket text-blue-600 text-2xl"></i>
            <span className="text-xl font-bold">HirePilot</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/copilot" className="text-gray-600 hover:text-gray-900">Recruiting Co-Pilot</Link>
            <Link to="/handsfree" className="text-gray-600 hover:text-gray-900">Hands Free Hiring</Link>
            <Link to="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/" className="hidden md:block text-gray-600 hover:text-gray-900">Sign in</Link>
            <Link to="/signup" className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-2.5 rounded-lg hover:shadow-lg transition-all duration-200">
              Start for Free
            </Link>
          </div>
          <button className="md:hidden text-gray-600">
            <i className="fa-solid fa-bars text-2xl"></i>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-500 via-blue-200 to-white pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-6 md:px-10 flex flex-col-reverse md:flex-row items-center justify-between gap-12">
          <div className="w-full md:w-1/2 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight text-gray-900">
              Hire Better, Faster — <br className="hidden md:block" />
              <span className="text-blue-900">On Autopilot.</span>
            </h1>
            <p className="mt-6 text-lg text-gray-800">
              AI-powered recruiting that saves you 100+ hours per hire.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 sm:justify-start justify-center">
              <Link to="/signup" className="group bg-white text-blue-600 font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-white/25 transition-all duration-200">
                Start for Free <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
              </Link>
              <Link to="/demo" className="bg-blue-900 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:bg-blue-800 transition-all duration-200">
                <i className="fa-regular fa-calendar mr-2"></i> Book Demo
              </Link>
            </div>
          </div>
          <div className="w-full md:w-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-white/10 rounded-2xl transform rotate-6"></div>
              <div className="relative rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/20 bg-white">
                <img className="w-full h-auto" src="/images/performance-dashboard.png" alt="Dashboard UI" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By */}
      <section className="py-12 bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-sm text-gray-500 uppercase tracking-wider mb-8">Trusted by innovative companies worldwide</p>
          <div className="flex justify-center flex-wrap gap-12 opacity-70">
            <i className="fa-brands fa-google text-gray-400 text-4xl"></i>
            <i className="fa-brands fa-microsoft text-gray-400 text-4xl"></i>
            <i className="fa-brands fa-apple text-gray-400 text-4xl"></i>
            <i className="fa-brands fa-amazon text-gray-400 text-4xl"></i>
            <i className="fa-brands fa-meta text-gray-400 text-4xl"></i>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6">Build your recruiting engine in minutes</h2>
          <p className="text-xl mb-10 opacity-90">Join thousands of companies hiring better with AI.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup" className="bg-white text-blue-600 font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200">
              Get Started Free <i className="fa-solid fa-arrow-right ml-2"></i>
            </Link>
            <Link to="/demo" className="border-2 border-white text-white font-semibold py-4 px-8 rounded-lg hover:bg-white/10 transition-colors duration-200">
              <i className="fa-regular fa-calendar mr-2"></i> Schedule Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <i className="fa-solid fa-rocket text-blue-500 text-2xl"></i>
                <span className="text-xl font-bold">HirePilot</span>
              </div>
              <p className="text-gray-400">AI-powered recruiting platform that helps you hire better, faster.</p>
              <div className="mt-6 flex gap-4">
                <a href="#" className="text-gray-400 hover:text-white"><i className="fa-brands fa-twitter text-xl"></i></a>
                <a href="#" className="text-gray-400 hover:text-white"><i className="fa-brands fa-linkedin text-xl"></i></a>
                <a href="#" className="text-gray-400 hover:text-white"><i className="fa-brands fa-facebook text-xl"></i></a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-4">Product</h4>
              <ul className="space-y-3 text-gray-400">
                <li><Link to="#" className="hover:text-white">Features</Link></li>
                <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link to="#" className="hover:text-white">Enterprise</Link></li>
                <li><Link to="#" className="hover:text-white">Case Studies</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-4">Company</h4>
              <ul className="space-y-3 text-gray-400">
                <li><Link to="#" className="hover:text-white">About</Link></li>
                <li><Link to="#" className="hover:text-white">Blog</Link></li>
                <li><Link to="#" className="hover:text-white">Careers</Link></li>
                <li><Link to="#" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-4">Support</h4>
              <ul className="space-y-3 text-gray-400">
                <li><Link to="#" className="hover:text-white">Help Center</Link></li>
                <li><Link to="#" className="hover:text-white">Documentation</Link></li>
                <li><Link to="#" className="hover:text-white">API Reference</Link></li>
                <li><Link to="#" className="hover:text-white">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
            © 2025 HirePilot. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
