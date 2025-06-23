import React from 'react';

export default function Handsfree() {
  return (
    <div className="h-full text-base-content">
      <div id="main" className="min-h-screen bg-white text-gray-900">
        {/* Header */}
        <header id="header" className="fixed w-full top-0 bg-white/90 backdrop-blur-sm z-50 border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="HirePilot Logo" className="h-8 w-8" />
              <span className="font-bold text-xl">HirePilot</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="/copilot" className="text-gray-600 hover:text-gray-900">Your Recruiting Co-Pilot</a>
              <a href="/handsfree" className="text-blue-600 font-medium">Done For You Hiring</a>
              <a href="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
            </nav>
            <div className="flex items-center gap-4">
              <a href="/login" className="text-gray-600 hover:text-gray-900">Sign in</a>
              <a href="/start" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Start for Free</a>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section id="hero" className="pt-32 pb-20 bg-gradient-to-b from-blue-500 via-blue-200 to-white">
          <div className="max-w-7xl mx-auto px-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="w-full md:w-1/2 text-center md:text-left">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight text-gray-900">
                We Find.<br />You Interview.
              </h1>
              <p className="mt-6 text-xl text-gray-800">
                With our Done For You service, we handle all the heavy lifting — sourcing, outreach, and scheduling — so you can just show up to interviews with top-tier candidates, ready to hire.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 sm:justify-start justify-center">
                <a href="/consultation" className="bg-white text-blue-600 font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-white/25 transition-all duration-200">
                  <i className="fa-regular fa-calendar-check mr-2"></i>
                  Schedule Free Consultation
                </a>
                <a href="/start" className="bg-blue-900 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:bg-blue-800 transition-all duration-200">
                  Get Started Free
                </a>
              </div>
            </div>
            <div className="w-full md:w-1/2">
              <div className="rounded-xl overflow-hidden shadow-2xl">
                <img className="w-full h-auto" src="/handsfree-hp.png" alt="HirePilot handsfree hiring dashboard" />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-4">Everything You Need to Hire Fast</h2>
            <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">A complete recruiting solution that handles sourcing, scheduling, and everything in between.</p>

            <div className="grid md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div id="feature-1" className="flex gap-4 items-start bg-gray-50 p-6 rounded-xl hover:bg-gray-100 transition-colors">
                  <i className="fa-solid fa-briefcase text-blue-600 text-2xl"></i>
                  <div>
                    <h4 className="font-semibold text-lg">Full-Service Sourcing</h4>
                    <p className="text-gray-600">You send us the job. We find and engage top candidates.</p>
                  </div>
                </div>

                <div id="feature-2" className="flex gap-4 items-start bg-gray-50 p-6 rounded-xl hover:bg-gray-100 transition-colors">
                  <i className="fa-solid fa-users text-blue-600 text-2xl"></i>
                  <div>
                    <h4 className="font-semibold text-lg">Unlimited Team Access</h4>
                    <p className="text-gray-600">Invite hiring managers, ops, and execs to collaborate.</p>
                  </div>
                </div>

                <div id="feature-3" className="flex gap-4 items-start bg-gray-50 p-6 rounded-xl hover:bg-gray-100 transition-colors">
                  <i className="fa-brands fa-slack text-blue-600 text-2xl"></i>
                  <div>
                    <h4 className="font-semibold text-lg">Slack-first Collaboration</h4>
                    <p className="text-gray-600">Review candidates and track status inside Slack.</p>
                  </div>
                </div>

                <div id="feature-4" className="flex gap-4 items-start bg-gray-50 p-6 rounded-xl hover:bg-gray-100 transition-colors">
                  <i className="fa-solid fa-plug text-blue-600 text-2xl"></i>
                  <div>
                    <h4 className="font-semibold text-lg">ATS Integration</h4>
                    <p className="text-gray-600">Seamlessly sync with your hiring stack.</p>
                  </div>
                </div>

                <div id="feature-5" className="flex gap-4 items-start bg-gray-50 p-6 rounded-xl hover:bg-gray-100 transition-colors">
                  <i className="fa-regular fa-calendar-check text-blue-600 text-2xl"></i>
                  <div>
                    <h4 className="font-semibold text-lg">Calendar-Ready Interviews</h4>
                    <p className="text-gray-600">Just show up. We schedule every call for you.</p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="sticky top-32">
                  <img className="rounded-xl shadow-2xl" src="/hp-copilot.png" alt="HirePilot platform pipeline view" />
                  <div className="absolute -bottom-6 right-6 bg-white p-4 rounded-xl shadow-lg">
                    <div className="flex items-center gap-3">
                      <i className="fa-solid fa-check-circle text-green-500 text-xl"></i>
                      <span className="text-sm font-medium">Connected with Slack</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section id="process" className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-600 mb-12 max-w-2xl mx-auto">From kickoff to interviews — we handle every step of the sourcing process.</p>

            <div className="grid md:grid-cols-3 gap-10">
              <div id="step-1" className="bg-white p-8 rounded-xl shadow-md relative">
                <div className="w-14 h-14 mx-auto mb-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">1</div>
                <h4 className="font-semibold text-xl mb-3">Kickoff Call</h4>
                <p className="text-gray-600">We align on your goals, culture, and ideal candidate profile.</p>
                <div className="absolute top-1/2 right-0 hidden md:block">
                  <i className="fa-solid fa-arrow-right text-blue-200 text-4xl transform translate-x-1/2"></i>
                </div>
              </div>

              <div id="step-2" className="bg-white p-8 rounded-xl shadow-md relative">
                <div className="w-14 h-14 mx-auto mb-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">2</div>
                <h4 className="font-semibold text-xl mb-3">We Source &amp; Engage</h4>
                <p className="text-gray-600">Our recruiters + AI handle outreach to find perfect matches.</p>
                <div className="absolute top-1/2 right-0 hidden md:block">
                  <i className="fa-solid fa-arrow-right text-blue-200 text-4xl transform translate-x-1/2"></i>
                </div>
              </div>

              <div id="step-3" className="bg-white p-8 rounded-xl shadow-md">
                <div className="w-14 h-14 mx-auto mb-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">3</div>
                <h4 className="font-semibold text-xl mb-3">You Interview</h4>
                <p className="text-gray-600">Qualified candidates show up on your calendar.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Real Results</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">See what our clients say about their hiring success</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div id="testimonial-1" className="bg-gray-50 p-8 rounded-xl">
                <div className="flex items-center gap-4 mb-6">
                  <img src="/michael-chen.png" alt="Michael Chen" className="w-16 h-16 rounded-full" />
                  <div>
                    <h4 className="font-semibold">Michael Chen</h4>
                    <p className="text-gray-600">CTO</p>
                  </div>
                </div>
                <p className="text-lg text-gray-700">"In 30 days, we filled 3 roles — all scheduled on my calendar. Easiest hires I've ever made."</p>
              </div>

              <div id="testimonial-2" className="bg-gray-50 p-8 rounded-xl">
                <div className="flex items-center gap-4 mb-6">
                  <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg" alt="Client" className="w-16 h-16 rounded-full" />
                  <div>
                    <h4 className="font-semibold">Sarah Williams</h4>
                    <p className="text-gray-600">Head of Talent</p>
                  </div>
                </div>
                <p className="text-lg text-gray-700">"Their team became an extension of ours. The quality of candidates and speed of hiring exceeded our expectations."</p>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section id="comparison" className="py-20 bg-gray-50">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-12">Compare Our Solutions</h2>

            <div className="overflow-hidden bg-white rounded-xl shadow-lg">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-4 text-left">Feature</th>
                    <th className="p-4 text-center">Core HirePilot Service</th>
                    <th className="p-4 text-center bg-blue-50">Done For You Hiring</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="p-4">You manage sourcing</td>
                    <td className="p-4 text-center"><i className="fa-solid fa-check text-green-500"></i></td>
                    <td className="p-4 text-center bg-blue-50"><i className="fa-solid fa-xmark text-gray-400"></i></td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-4">We manage sourcing</td>
                    <td className="p-4 text-center"><i className="fa-solid fa-xmark text-gray-400"></i></td>
                    <td className="p-4 text-center bg-blue-50"><i className="fa-solid fa-check text-green-500"></i></td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-4">AI Messaging</td>
                    <td className="p-4 text-center"><i className="fa-solid fa-check text-green-500"></i></td>
                    <td className="p-4 text-center bg-blue-50"><i className="fa-solid fa-check text-green-500"></i></td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-4">Human recruiters</td>
                    <td className="p-4 text-center"><i className="fa-solid fa-xmark text-gray-400"></i></td>
                    <td className="p-4 text-center bg-blue-50"><i className="fa-solid fa-check text-green-500"></i></td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-4">Slack support</td>
                    <td className="p-4 text-center"><i className="fa-solid fa-xmark text-gray-400"></i></td>
                    <td className="p-4 text-center bg-blue-50"><i className="fa-solid fa-check text-green-500"></i></td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-4">ATS Sync</td>
                    <td className="p-4 text-center"><i className="fa-solid fa-xmark text-gray-400"></i></td>
                    <td className="p-4 text-center bg-blue-50"><i className="fa-solid fa-check text-green-500"></i></td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-4">Calendar Scheduling</td>
                    <td className="p-4 text-center"><i className="fa-solid fa-xmark text-gray-400"></i></td>
                    <td className="p-4 text-center bg-blue-50"><i className="fa-solid fa-check text-green-500"></i></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="cta" className="py-20 bg-blue-600 text-white">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold mb-6">Let us run your recruiting process — while you focus on closing the best candidates.</h2>
            <p className="text-xl mb-10 opacity-90">Book a consultation or view candidate samples to get started today.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/consultation" className="bg-white text-blue-600 font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200">
                <i className="fa-regular fa-calendar mr-2"></i>
                Book Consultation
              </a>
              <a href="/start" className="border-2 border-white text-white font-semibold py-4 px-8 rounded-lg hover:bg-white/10 transition-colors duration-200">
                Get Started Free
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