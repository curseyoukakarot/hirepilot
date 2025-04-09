import React from "react";
import { Link } from "react-router-dom";

const RecruitingCoPilot = () => {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="fixed w-full top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-rocket text-blue-600 text-2xl"></i>
            <span className="text-xl font-bold">HirePilot</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <span className="text-gray-600 hover:text-gray-900 cursor-pointer">Recruiting Co-Pilot</span>
            <span className="text-gray-600 hover:text-gray-900 cursor-pointer">Hands Free Hiring</span>
            <span className="text-gray-600 hover:text-gray-900 cursor-pointer">Pricing</span>
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/signin" className="hidden md:block text-gray-600 hover:text-gray-900 cursor-pointer">Sign in</Link>
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
              Sourcing Made Simple.
            </h1>
            <p className="mt-6 text-lg text-gray-800">
              Build your own pipeline in minutes, not months.
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
                <img className="w-full h-auto" src="/images/performance-dashboard.png" alt="Campaign performance screenshot" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* See HirePilot in Action */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-semibold mb-4">See HirePilot in action</h2>
          <p className="text-gray-600 mb-12 max-w-2xl mx-auto">Watch how our platform streamlines sourcing, messaging, and scheduling so you can hire faster.</p>
          <div className="rounded-xl overflow-hidden shadow-xl">
            <img className="w-full h-auto" src="/images/lead-profile-drawer.png" alt="Lead profile drawer screenshot" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6">Start your hiring process with HirePilot. Save 100+ hours per role.</h2>
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
    </div>
  );
};

export default RecruitingCoPilot;
