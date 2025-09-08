import React from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function FreeForever() {
  return (
    <div className="bg-gray-900 text-white min-h-screen">
      {/* Public Navbar (fixed) */}
      <PublicNavbar />

      {/* Content wrapper with top padding to clear fixed navbar */}
      <main className="pt-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="flex items-center justify-center md:justify-between gap-4">
            <a href="/pricing" className="inline-flex items-center text-sm text-blue-300 hover:text-white">
              <i className="fa-solid fa-tag mr-2" /> See all plans
            </a>
            <a href="/signup?plan=free" className="hidden md:inline-flex items-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Get Started Free
            </a>
          </div>
        </div>
        {/* Free Plan Section */}
        <section id="free-plan-section" className="bg-gray-900 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div id="section-header" className="text-center mb-16">
              <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">Hire Smarter — for Free.</h1>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                REX finds the leads, writes the messages, and helps you reach out — all without paying a dime.<br />
                <span className="font-semibold text-gray-200">No credit card required. No fluff. Just real recruiting power.</span>
              </p>
            </div>

            {/* Main Content */}
            <div className="grid lg:grid-cols-2 gap-16 items-start">
              {/* Left Column - Benefits */}
              <div id="benefits-column">
                <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-2xl p-8 mb-8 border border-gray-600">
                  <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                    <i className="fas fa-gift text-green-400 mr-3" />
                    What You Get (Free Plan)
                  </h3>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <i className="fas fa-check-circle text-green-400 mt-1 mr-3 flex-shrink-0" />
                      <span className="text-gray-300"><strong className="text-white">50 credits per month</strong> for enrichment, sourcing, or outreach</span>
                    </li>
                    <li className="flex items-start">
                      <i className="fas fa-check-circle text-green-400 mt-1 mr-3 flex-shrink-0" />
                      <span className="text-gray-300"><strong className="text-white">Chrome Extension</strong> with profile + search scraping</span>
                    </li>
                    <li className="flex items-start">
                      <i className="fas fa-check-circle text-green-400 mt-1 mr-3 flex-shrink-0" />
                      <span className="text-gray-300"><strong className="text-white">Send LinkedIn messages or emails</strong> — manually or automated</span>
                    </li>
                    <li className="flex items-start">
                      <i className="fas fa-check-circle text-green-400 mt-1 mr-3 flex-shrink-0" />
                      <span className="text-gray-300"><strong className="text-white">Upload unlimited leads</strong> via CSV</span>
                    </li>
                    <li className="flex items-start">
                      <i className="fas fa-check-circle text-green-400 mt-1 mr-3 flex-shrink-0" />
                      <span className="text-gray-300"><strong className="text-white">3 job reqs, 3 active campaigns</strong></span>
                    </li>
                    <li className="flex items-start">
                      <i className="fas fa-check-circle text-green-400 mt-1 mr-3 flex-shrink-0" />
                      <span className="text-gray-300"><strong className="text-white">REX AI assistant</strong> for sourcing, JD parsing, Boolean, and messaging</span>
                    </li>
                    <li className="flex items-start">
                      <i className="fas fa-check-circle text-green-400 mt-1 mr-3 flex-shrink-0" />
                      <span className="text-gray-300"><strong className="text-white">Slack alerts + Gmail, Outlook, or Sendgrid</strong> integration</span>
                    </li>
                  </ul>
                </div>

                {/* Credit Usage Box */}
                <div id="credit-usage-box" className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-6 border border-green-500/30">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <i className="fas fa-lightbulb text-yellow-400 mr-3" />
                    Use your 50 free credits however you want:
                  </h4>
                  <div className="grid grid-cols-1 gap-3 text-sm text-gray-300">
                    <div className="flex items-center">
                      <i className="fas fa-envelope text-blue-400 mr-2 w-4" />
                      Enrich leads with verified emails
                    </div>
                    <div className="flex items-center">
                      <i className="fab fa-linkedin text-blue-500 mr-2 w-4" />
                      Pull profiles straight from LinkedIn or Sales Navigator
                    </div>
                    <div className="flex items-center">
                      <i className="fas fa-robot text-purple-400 mr-2 w-4" />
                      Trigger AI-written outreach via email or LinkedIn
                    </div>
                    <div className="flex items-center">
                      <i className="fas fa-search text-indigo-400 mr-2 w-4" />
                      Source candidates from our Apollo house account
                    </div>
                    <div className="flex items-center">
                      <i className="fas fa-save text-green-400 mr-2 w-4" />
                      Save your custom LinkedIn messages + apply at scale
                    </div>
                  </div>
                </div>

                {/* Testimonial */}
                <div id="testimonial" className="mt-8 bg-gray-800 p-6 rounded-xl border border-gray-600 shadow-sm">
                  <div className="flex items-start">
                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg" alt="User" className="w-12 h-12 rounded-full mr-4" />
                    <div>
                      <p className="text-gray-300 italic">"I booked 2 interviews using just the free plan."</p>
                      <p className="text-sm text-gray-400 mt-2">Sarah M., Technical Recruiter</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Feature Comparison */}
              <div id="comparison-column">
                <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-600">
                  <div className="p-8">
                    <h3 className="text-2xl font-bold text-white mb-8 text-center">Feature Comparison</h3>
                    {/* Credit Counter */}
                    <div className="mb-8 p-4 bg-gray-700 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-300">Monthly Credits</span>
                        <span className="text-sm text-gray-400">34 of 50 used</span>
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-2">
                        <div className="bg-green-400 h-2 rounded-full" style={{ width: '68%' }} />
                      </div>
                    </div>

                    {/* Comparison Table */}
                    <div className="overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-600">
                            <th className="text-left py-3 text-white font-semibold">Feature</th>
                            <th className="text-center py-3 text-white font-semibold">Free</th>
                            <th className="text-center py-3 text-white font-semibold">Pro</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          <tr>
                            <td className="py-3 text-gray-300 flex items-center"><i className="fas fa-robot text-purple-400 mr-2" />REX AI Chat</td>
                            <td className="text-center py-3"><i className="fas fa-check text-green-400" /></td>
                            <td className="text-center py-3"><i className="fas fa-check text-green-400" /></td>
                          </tr>
                          <tr>
                            <td className="py-3 text-gray-300 flex items-center"><i className="fab fa-chrome text-blue-400 mr-2" />Chrome Extension</td>
                            <td className="text-center py-3"><i className="fas fa-check text-green-400" /></td>
                            <td className="text-center py-3"><i className="fas fa-check text-green-400" /></td>
                          </tr>
                          <tr>
                            <td className="py-3 text-gray-300 flex items-center"><i className="fas fa-coins text-yellow-400 mr-2" />Monthly Credits</td>
                            <td className="text-center py-3 font-semibold text-white">50</td>
                            <td className="text-center py-3 font-semibold text-white">500+</td>
                          </tr>
                          <tr>
                            <td className="py-3 text-gray-300 flex items-center"><i className="fas fa-envelope text-blue-400 mr-2" />Enrichment</td>
                            <td className="text-center py-3"><i className="fas fa-check text-green-400" /></td>
                            <td className="text-center py-3"><i className="fas fa-check text-green-400" /></td>
                          </tr>
                          <tr>
                            <td className="py-3 text-gray-300 flex items-center"><i className="fab fa-linkedin text-blue-500 mr-2" />Auto LinkedIn Messages</td>
                            <td className="text-center py-3"><i className="fas fa-check text-green-400" /></td>
                            <td className="text-center py-3"><i className="fas fa-check text-green-400" /></td>
                          </tr>
                          <tr>
                            <td className="py-3 text-gray-300 flex items-center"><i className="fas fa-stream text-indigo-400 mr-2" />Sequences + Follow-ups</td>
                            <td className="text-center py-3"><i className="fas fa-times text-red-400" /></td>
                            <td className="text-center py-3"><i className="fas fa-check text-green-400" /></td>
                          </tr>
                          <tr>
                            <td className="py-3 text-gray-300 flex items-center"><i className="fas fa-download text-green-400 mr-2" />CSV Export</td>
                            <td className="text-center py-3"><i className="fas fa-times text-red-400" /></td>
                            <td className="text-center py-3"><i className="fas fa-check text-green-400" /></td>
                          </tr>
                          <tr>
                            <td className="py-3 text-gray-300 flex items-center"><i className="fas fa-bolt text-yellow-400 mr-2" />Agent Mode</td>
                            <td className="text-center py-3"><i className="fas fa-times text-red-400" /></td>
                            <td className="text-center py-3"><i className="fas fa-check text-green-400" /></td>
                          </tr>
                          <tr>
                            <td className="py-3 text-gray-300 flex items-center"><i className="fab fa-slack text-purple-500 mr-2" />Slack + Email Connect</td>
                            <td className="text-center py-3"><i className="fas fa-check text-green-400" /></td>
                            <td className="text-center py-3"><i className="fas fa-check text-green-400" /></td>
                          </tr>
                          <tr>
                            <td className="py-3 text-gray-300 flex items-center"><i className="fas fa-plug text-orange-400 mr-2" />Zapier, Skrapp, Hunter</td>
                            <td className="text-center py-3"><i className="fas fa-times text-red-400" /></td>
                            <td className="text-center py-3"><i className="fas fa-check text-green-400" /></td>
                          </tr>
                          <tr>
                            <td className="py-3 text-gray-300 flex items-center"><i className="fas fa-bullhorn text-red-400 mr-2" />Campaigns</td>
                            <td className="text-center py-3 font-semibold text-white">3</td>
                            <td className="text-center py-3 font-semibold text-white">∞</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Public Footer */}
      <PublicFooter />
    </div>
  );
}


