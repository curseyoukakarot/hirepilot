import React from 'react';
import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header id="header" className="fixed w-full top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="HirePilot Logo" className="h-8 w-8" />
            <span className="text-xl font-bold">HirePilot</span>
          </a>
          <nav className="hidden md:flex items-center gap-8">
            <a href="/copilot" className="text-gray-600 hover:text-gray-900">Your Recruiting Co-Pilot</a>
            <a href="/handsfree" className="text-gray-600 hover:text-gray-900">Done For You Hiring</a>
            <a href="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
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

      {/* Hero Section */}
      <section id="hero" className="bg-gradient-to-b from-blue-500 via-blue-200 to-white pt-32 pb-20">
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
              <a href="#" className="group bg-white text-blue-600 font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-white/25 transition-all duration-200">
                Start for Free <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
              </a>
              <a href="#" className="bg-blue-900 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:bg-blue-800 transition-all duration-200">
                <i className="fa-regular fa-calendar mr-2"></i> Book Demo
              </a>
            </div>
          </div>
          <div className="w-full md:w-1/2">
            <div className="w-full md:w-full flex justify-center">
              <div className="relative max-w-6xl w-full">
                <div className="absolute inset-0 bg-white/10 rounded-2xl transform rotate-6"></div>
                <div className="relative rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/20 bg-white">
                  <img className="w-full h-auto" src="/hero1.png" alt="HirePilot – AI recruiting assistant illustration" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-semibold text-center mb-4">How It Works</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">Our AI-powered platform streamlines your hiring process in three simple steps</p>
          <div className="grid md:grid-cols-3 gap-8">
            <div id="step-1" className="bg-white p-8 rounded-xl shadow-sm text-center group hover:shadow-lg transition-shadow duration-200">
              <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-2xl group-hover:scale-110 transition-transform duration-200">1</div>
              <h3 className="font-semibold text-xl mb-3">Submit your job</h3>
              <p className="text-gray-600">Describe your ideal candidate and let our AI do the heavy lifting.</p>
            </div>
            <div id="step-2" className="bg-white p-8 rounded-xl shadow-sm text-center group hover:shadow-lg transition-shadow duration-200">
              <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-2xl group-hover:scale-110 transition-transform duration-200">2</div>
              <h3 className="font-semibold text-xl mb-3">Source Candidates</h3>
              <p className="text-gray-600">Finds and engage quickly with candidates that are the right fit for your role.</p>
            </div>
            <div id="step-3" className="bg-white p-8 rounded-xl shadow-sm text-center group hover:shadow-lg transition-shadow duration-200">
              <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-2xl group-hover:scale-110 transition-transform duration-200">3</div>
              <h3 className="font-semibold text-xl mb-3">Interviews Scheduled</h3>
              <p className="text-gray-600">Qualified candidates are automatically scheduled for interviews.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6 space-y-20">
          <div id="feature-1" className="flex flex-col md:flex-row items-center gap-12">
            <div className="md:w-1/2">
              <div className="flex gap-4">
                <span className="inline-block text-blue-600 bg-blue-50 px-8 py-2 rounded-full text-sm font-medium mb-6 whitespace-nowrap">
                  <i className="fa-brands fa-linkedin mr-2"></i> LinkedIn Integration
                </span>
                <span className="inline-block text-purple-700 bg-purple-100 px-8 py-2 rounded-full text-sm font-medium mb-6 flex items-center gap-2 whitespace-nowrap">
                  <img src="/apollo-logo-v2.png" alt="Apollo" className="h-5 w-5" /> Apollo Integration
                </span>
                <span className="inline-block text-green-700 bg-green-100 px-8 py-2 rounded-full text-sm font-medium mb-6 flex items-center gap-2 whitespace-nowrap">
                  <i className="fa-solid fa-envelope"></i> Outreach Integrations
                </span>
              </div>
              <h3 className="text-3xl font-semibold mb-6">Source with Accuracy</h3>
              <p className="text-gray-600 mb-6">
                Find and engage with qualified candidates across platforms that bring you the best talent.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-gray-700">
                  <i className="fa-solid fa-check text-green-500"></i>
                  Smart candidate matching
                </li>
                <li className="flex items-center gap-3 text-gray-700">
                  <i className="fa-solid fa-check text-green-500"></i>
                  Automated outreach
                </li>
              </ul>
            </div>
            <div className="md:w-1/2">
              <div className="rounded-xl overflow-hidden shadow-xl">
                <img className="w-full h-auto" src="/linkedin-sn.png" alt="LinkedIn Sales Navigator dashboard" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Full-width reverse blue gradient background for feature-2 */}
      <div className="w-full bg-gradient-to-t from-blue-500 via-blue-200 to-white py-20">
        <section className="max-w-6xl mx-auto px-6">
          <div id="feature-2" className="flex flex-col md:flex-row-reverse items-center gap-12">
            <div className="md:w-1/2">
              <div className="inline-block text-blue-600 bg-blue-50 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <i className="fa-solid fa-robot mr-2"></i> AI-Powered
              </div>
              <h3 className="text-3xl font-semibold mb-6">Personalized GPT Outreach</h3>
              <p className="text-gray-600 mb-6">
                AI-powered messaging that speaks to candidates in a personal, engaging way.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-gray-700">
                  <i className="fa-solid fa-check text-green-500"></i>
                  Custom message templates
                </li>
                <li className="flex items-center gap-3 text-gray-700">
                  <i className="fa-solid fa-check text-green-500"></i>
                  Response analysis
                </li>
              </ul>
            </div>
            <div className="md:w-1/2">
              <div className="rounded-xl overflow-hidden shadow-xl">
                <img className="w-full h-auto" src="/ai-outreach.png" alt="AI messaging interface with candidate conversation and response analytics" />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-semibold text-center mb-4">What Our Customers Say</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">Join thousands of satisfied customers who have transformed their hiring process</p>
          <div className="grid md:grid-cols-3 gap-8">
            <div id="testimonial-1" className="bg-white p-8 rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200">
              <div className="flex items-center gap-4 mb-6">
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg" alt="Sarah Johnson" className="w-12 h-12 rounded-full" />
                <div>
                  <div className="font-medium">Sarah J.</div>
                  <div className="text-sm text-gray-500">Freelance Tech Recruiter</div>
                </div>
              </div>
              <p className="text-gray-700 italic">"I landed my first client in 3 weeks with HirePilot!"</p>
              <div className="mt-6 text-yellow-400 flex gap-1">
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
              </div>
            </div>

            <div id="testimonial-2" className="bg-white p-8 rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200">
              <div className="flex items-center gap-4 mb-6">
                <img src="/dejanira.jpeg" alt="Dejanira (Dej) L." className="w-12 h-12 rounded-full" />
                <div>
                  <div className="font-medium">Dejanira (Dej) L.</div>
                  <div className="text-sm text-gray-500">Freelance Tech Recruiter</div>
                </div>
              </div>
              <p className="text-gray-700 italic">"I made 8k in my first 6 weeks"</p>
              <div className="mt-6 text-yellow-400 flex gap-1">
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
              </div>
            </div>

            <div id="testimonial-3" className="bg-white p-8 rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200">
              <div className="flex items-center gap-4 mb-6">
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg" alt="Emily Rodriguez" className="w-12 h-12 rounded-full" />
                <div>
                  <div className="font-medium">Emily R.</div>
                  <div className="text-sm text-gray-500">Talent Lead</div>
                </div>
              </div>
              <p className="text-gray-700 italic">"The automated scheduling and engagement features have saved countless hours of manual work."</p>
              <div className="mt-6 text-yellow-400 flex gap-1">
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="py-20 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6">Build your recruiting engine in minutes</h2>
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
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <img src="/logo.png" alt="HirePilot Logo" className="h-8 w-8" />
                <span className="text-xl font-bold">HirePilot</span>
              </div>
              <p className="text-gray-400">
                AI-powered recruiting platform that helps you hire better, faster.
              </p>
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
          <div className="pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
            © 2025 HirePilot. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage; 