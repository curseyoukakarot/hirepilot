import React from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

const HomePage = () => {
  return (
    <div className="bg-white font-sans">
      <style>{`
        ::-webkit-scrollbar { display: none; }
        html, body {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Header */}
      <PublicNavbar />

      {/* Hero Section */}
      <section id="hero" className="pt-24 pb-16 bg-gradient-to-b from-blue-600 to-white min-h-[900px] flex items-center">
        <div className="w-full px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-12 items-center">
              <div className="lg:col-span-2 space-y-8">
                <div className="space-y-4">
                  <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                    Your AI Recruiting Agent — 
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Find, Engage & Hire</span>{' '}at Scale
                  </h1>
                  <p className="text-xl text-gray-600 leading-relaxed">
                    Automate sourcing, messaging, follow-ups, and tracking—all powered by smart AI agents and workflow automations that plug into your tools.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a href="/pricing" className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center space-x-2">
                    <span>Start Free</span>
                    <i className="fas fa-arrow-right"></i>
                  </a>
                  <a href="https://form.typeform.com/to/cnUZ9PgW" target="_blank" rel="noopener" className="border border-white text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white/10 transition-colors flex items-center justify-center space-x-2">
                    <i className="fas fa-play"></i>
                    <span>Watch Demo</span>
                  </a>
                </div>
              </div>
              <div className="lg:col-span-3 relative flex justify-center">
                <img className="w-full h-auto object-contain rounded-xl shadow-2xl" src="/homepage-hero-1.png" alt="modern AI recruiting dashboard interface with chat bot, candidate profiles, and automation workflows, sleek dark UI design" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section id="problem" className="py-16 bg-gray-900 text-white">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-4xl font-bold">Recruiting is broken. Manual. Repetitive. Time-consuming.</h2>
            <p className="text-xl text-gray-300 leading-relaxed">
              We built HirePilot to replace hours of sourcing, messaging, follow-ups, and tracking with AI-powered agents that never sleep. Whether you're a recruiter, founder, or hiring manager—HirePilot runs your playbook faster and better.
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">What Can HirePilot Do?</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-800 p-8 rounded-xl hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-search text-white text-xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">AI Sourcing Agent</h3>
              <p className="text-gray-300">Automatically discover and prioritize candidates based on your ideal profile.</p>
            </div>
            <div className="bg-gray-800 p-8 rounded-xl hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-envelope text-white text-xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Smart Outreach + Follow-Up</h3>
              <p className="text-gray-300">Personalized messages with automated follow-up logic until they respond.</p>
            </div>
            <div className="bg-gray-800 p-8 rounded-xl hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-cogs text-white text-xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Workflow Automation</h3>
              <p className="text-gray-300">Customize sourcing → messaging → scheduling workflows that run in the background.</p>
            </div>
            <div className="bg-gray-800 p-8 rounded-xl hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-robot text-white text-xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">REX Recruiting Agent</h3>
              <p className="text-gray-300">Talk to REX in Slack or in-app to assign tasks, get candidates, or automate your day.</p>
            </div>
            <div className="bg-gray-800 p-8 rounded-xl hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-chart-line text-white text-xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Live Analytics & Campaign Tracking</h3>
              <p className="text-gray-300">See outreach stats, reply rates, and funnel performance in real time.</p>
            </div>
            <div className="bg-gray-800 p-8 rounded-xl hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <img src="/zapier-icon.png" alt="Zapier" className="h-7 w-7 filter brightness-0 invert" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Plug & Play Integrations</h3>
              <p className="text-gray-300">Works with Apollo, PhantomBuster, Slack, Gmail, Outlook, Calendars, ATS tools.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Who Is HirePilot For?</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                <i className="fas fa-building text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">Recruiting Agencies</h3>
              <p className="text-gray-600 text-center">Scale outreach & get client results faster.</p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                <i className="fas fa-users text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">In-House Teams</h3>
              <p className="text-gray-600 text-center">Source, message, and hire without adding headcount.</p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-cyan-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                <i className="fas fa-rocket text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">Founders/Startups</h3>
              <p className="text-gray-600 text-center">Automate your hiring pipeline with zero recruiting experience.</p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                <i className="fas fa-chart-bar text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">Growth Teams</h3>
              <p className="text-gray-600 text-center">Expand into new markets with candidate/partner sourcing flows.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-gray-600 mb-8">Sync your HirePilot recruiting flows with tools you already have</p>
          <div className="flex justify-center items-center space-x-12 opacity-60">
            <img src="/apollo-logo-v2.png" alt="Apollo" className="h-8" />
            <i className="fa-brands fa-linkedin text-4xl text-gray-400" />
            <i className="fa-brands fa-slack text-4xl text-gray-400" />
            <img src="/zapier-icon.png" alt="Zapier" className="h-8 filter grayscale brightness-75" />
            <img src="/make-logo-v1.png" alt="Make" className="h-8 w-auto filter grayscale brightness-75" />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-gradient-to-b from-white to-blue-600">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How HirePilot Works</h2>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="space-y-12">
              <div className="flex items-center space-x-8">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xl font-bold">1</span>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-2">Define Your Ideal Candidate</h3>
                  <p className="text-gray-600">Roles, skills, regions</p>
                </div>
              </div>
              <div className="flex items-center space-x-8">
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xl font-bold">2</span>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-2">Activate Your Campaign</h3>
                  <p className="text-gray-600">Use our AI templates or write your own</p>
                </div>
              </div>
              <div className="flex items-center space-x-8">
                <div className="w-16 h-16 bg-cyan-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xl font-bold">3</span>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-2">Let REX Run the Show</h3>
                  <p className="text-gray-600">Sourcing, outreach, follow-ups auto‑run</p>
                </div>
              </div>
              <div className="flex items-center space-x-8">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xl font-bold">4</span>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-2">Get Responses & Book Interviews</h3>
                  <p className="text-gray-600">Direct to your calendar, Slack, or ATS</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section id="social-proof" className="py-20 bg-gray-900 text-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-8">Built for teams that want more hires in less time</h2>
            <div className="grid md:grid-cols-4 gap-8 mb-16">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500 mb-2">5,200+</div>
                <div className="text-gray-300">Candidates Sourced</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-500 mb-2">300+</div>
                <div className="text-gray-300">Interviews Booked</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-cyan-500 mb-2">1,000s</div>
                <div className="text-gray-300">Hours Saved</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500 mb-2">$50K+</div>
                <div className="text-gray-300">Revenue Enabled</div>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-gray-800 p-8 rounded-xl">
              <p className="text-lg mb-6">"I landed my first client in 3 weeks with HirePilot!"</p>
              <div>
                <div className="font-semibold">Sarah J.</div>
                <div className="text-gray-400">Freelance Tech Recruiter</div>
              </div>
            </div>
            <div className="bg-gray-800 p-8 rounded-xl">
              <p className="text-lg mb-6">"I made 8k in my first 6 weeks"</p>
              <div>
                <div className="font-semibold">Dejanira (Dej) L.</div>
                <div className="text-gray-400">Freelance Tech Recruiter</div>
              </div>
            </div>
            <div className="bg-gray-800 p-8 rounded-xl">
              <p className="text-lg mb-6">"The automated scheduling and engagement features have saved countless hours of manual work."</p>
              <div>
                <div className="font-semibold">Emily R.</div>
                <div className="text-gray-400">Talent Lead</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Plans for every team. Try it free.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-gray-50 p-8 rounded-xl border">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Starter</h3>
              <p className="text-gray-600 mb-6">For solo recruiters</p>
              <p className="text-gray-600 mb-6">LinkedIn and Apollo Lead Sources</p>
              <p className="text-gray-600 mb-6">Access to Zapier and Make</p>
              <a href="/pricing" className="w-full bg-gray-800 text-white py-3 rounded-lg hover:bg-gray-900 transition-colors block text-center">Get Started</a>
            </div>
            <div className="bg-blue-600 p-8 rounded-xl text-white transform scale-105">
              <h3 className="text-2xl font-bold mb-4">Pro and Team</h3>
              <p className="text-blue-100 mb-6">For teams & agencies</p>
              <p className="text-blue-100 mb-6">Access to REX your Recruiting AI Assistant</p>
              <a href="/pricing" className="w-full bg-white text-blue-600 py-3 rounded-lg hover:bg-gray-100 transition-colors font-semibold block text-center">Get Started</a>
            </div>
            <div className="bg-gray-50 p-8 rounded-xl border">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">DFY</h3>
              <p className="text-gray-600 mb-6">Let our team run the playbook for you</p>
              <a href="https://form.typeform.com/to/cnUZ9PgW" target="_blank" rel="noopener" className="w-full bg-gray-800 text-white py-3 rounded-lg hover:bg-gray-900 transition-colors block text-center">Contact Us</a>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="final-cta" className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-4xl font-bold">Start hiring smarter with AI</h2>
            <p className="text-xl text-blue-100">Recruiting shouldn't be slow. Let HirePilot automate it for you.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/pricing" className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors">Get Started Free</a>
              <a href="https://form.typeform.com/to/cnUZ9PgW" target="_blank" rel="noopener" className="border border-white text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white/10 transition-colors">Watch Demo</a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
};

export default HomePage;