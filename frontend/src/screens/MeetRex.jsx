import React from 'react';

export default function MeetRex() {
  return (
    <div className="bg-slate-50 font-sans">
      {/* Header copied from HomePage */}
      <header id="header" className="fixed w-full top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="HirePilot Logo" className="h-8 w-8" />
            <span className="text-xl font-bold">HirePilot</span>
          </a>
          <nav className="hidden md:flex items-center gap-8">
            <a href="/copilot" className="text-gray-600 hover:text-gray-900">Your Recruiting Co-Pilot</a>
            <a href="/handsfree" className="text-gray-600 hover:text-gray-900">Done For You Hiring</a>
            <a href="/rex" className="text-blue-600 font-medium">Meet REX</a>
            <a href="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
          </nav>
          <div className="flex items-center gap-4">
            <a href="/login" className="hidden md:block text-gray-600 hover:text-gray-900">Sign in</a>
            <a href="/pricing" className="gradient-bg text-white px-6 py-2.5 rounded-lg hover:shadow-lg transition-all duration-200">Start for Free</a>
          </div>
          <button className="md:hidden text-gray-600"><i className="fa-solid fa-bars text-2xl" /></button>
        </div>
      </header>

      {/* Hero */}
      <section id="hero" className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white h-[700px] flex items-center">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Meet REX – Your AI <span className="gradient-text">Recruiting Co-Pilot</span>
            </h1>
            <p className="text-xl text-slate-300 mb-8 leading-relaxed">
              Source leads. Enrich data. Send outreach. Book interviews.<br />All inside one smart assistant—powered by your workflow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="/pricing" className="gradient-bg px-8 py-4 rounded-lg font-semibold text-lg hover:shadow-2xl transition-shadow">Try REX Free</a>
              <a href="#chat-preview" className="border-2 border-white/30 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/10 transition-colors flex items-center gap-2"><i className="fa-solid fa-play" />See REX in Action</a>
            </div>
          </div>
          <div className="relative">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <div className="space-y-4">
                <div className="chat-bubble bg-blue-500 text-white p-3 rounded-lg rounded-bl-none max-w-xs">
                  Hi! I found 15 qualified candidates for your React Developer role. Want me to start outreach?
                </div>
                <div className="bg-white/20 p-3 rounded-lg rounded-br-none max-w-xs ml-auto">
                  Yes, use the personalized template
                </div>
                <div className="chat-bubble bg-blue-500 text-white p-3 rounded-lg rounded-bl-none max-w-xs">
                  Perfect! I've sent 15 messages and scheduled 3 interviews for next week. Check your calendar!
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">How REX Works</h2>
            <p className="text-xl text-slate-600">Three simple steps to transform your recruiting workflow</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            {[
              {
                icon: 'fa-search',
                title: 'Source & Score',
                desc: 'REX scans your campaigns, recommends the best candidates, and enriches them using Apollo, LinkedIn, and Proxycurl.'
              },
              {
                icon: 'fa-envelope',
                title: 'Automate Outreach',
                desc: 'One-click message generation, follow-ups, and personalized outreach at scale.'
              },
              {
                icon: 'fa-calendar',
                title: 'Book Interviews on Autopilot',
                desc: 'Syncs with your calendar. Candidates get scheduled, Slack keeps you updated.'
              }
            ].map(c => (
              <div key={c.title} className="text-center hover-lift">
                <div className="w-20 h-20 gradient-bg rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className={`fa-solid ${c.icon} text-slate-900 text-2xl`} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">{c.title}</h3>
                <p className="text-slate-600 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-gradient-to-b from-white via-blue-200 via-blue-500 to-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">What Can REX Do?</h2>
            <p className="text-xl text-slate-600">Everything you need to recruit smarter, not harder</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              ['fa-magnifying-glass','Candidate Discovery','AI-powered sourcing across multiple platforms'],
              ['fa-robot','AI Messaging','Personalized outreach at scale'],
              ['fa-slack','Slack & Calendar Integration','Seamless workflow integration'],
              ['fa-plug','Zapier & Make Triggers','Connect with 1000+ apps'],
              ['fa-phone','Phone & Email Lookup','Complete contact enrichment'],
              ['fa-gears','Custom Workflows','Tailored automation rules']
            ].map(([icon,title,desc])=> (
              <div key={title} className="bg-white p-8 rounded-xl border border-slate-200 hover-lift">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <i className={`fa-solid ${icon} text-slate-800 text-3xl`} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-20 bg-gradient-to-b from-white via-blue-200 to-blue-500">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Built for Busy Recruiters</h2>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            {[
              {icon:'fa-building',title:'Agency Recruiters',desc:'Scale outreach without extra headcount'},
              {icon:'fa-users',title:'In-House Teams',desc:'Sync with ATS, Slack, and calendar'},
              {icon:'fa-user',title:'Solopreneurs',desc:'Full automation, no extra tools needed'}
            ].map(c=>(
              <div key={c.title} className="text-center">
                <div className="bg-white/30 backdrop-blur-sm p-8 rounded-xl mb-6">
                  <i className={`fa-solid ${c.icon} text-4xl text-purple-600 mb-4`} />
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">{c.title}</h3>
                  <p className="text-slate-600">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Results */}
      <section id="results" className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Proven Results</h2>
            <p className="text-xl text-slate-300">See the impact REX makes on your recruiting metrics</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              ['12x','Faster lead-to-interview pipeline'],
              ['80%','Reduction in manual outreach'],
              ['10+','Hours saved per week, per recruiter']
            ].map(([stat,text])=> (
              <div key={stat} className="text-center">
                <div className="text-6xl font-bold gradient-text mb-4">{stat}</div>
                <p className="text-xl text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chat Preview */}
      <section id="chat-preview" className="py-20 bg-slate-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-8">Try Chatting with REX on Slack</h2>
          <div className="bg-white rounded-2xl p-8 border border-slate-200 max-w-2xl mx-auto">
            <div className="mb-6 flex justify-center">
              <img src="/REX-slack.gif" alt="REX Slack Preview" className="rounded-xl max-w-full" />
            </div>
            <a href="/login" className="gradient-bg text-white px-8 py-4 rounded-lg font-semibold">Ask REX a Question</a>
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section id="pricing-cta" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="bg-gradient-to-r from-purple-200 to-blue-300 rounded-2xl p-12 border border-purple-300/30">
            <h2 className="text-4xl font-bold text-slate-900 mb-6">Ready to Meet REX?</h2>
            <p className="text-xl text-slate-600 mb-8">REX is included with all Team plans. Start your 7-day free trial today.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <a href="/pricing" className="bg-white text-blue-600 border-2 border-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50">Start for Free →</a>
              <a href="/pricing" className="border-2 border-purple-200 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-purple-50">View Pricing</a>
            </div>
            <p className="text-sm text-slate-500">Start for free. Credits used for enrichment</p>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section id="trust" className="py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-slate-600 mb-8">Sync your HirePilot recruiting flows with tools you already have</p>
          <div className="flex justify-center items-center space-x-12 opacity-60">
            <img src="/apollo-logo-v2.png" alt="Apollo" className="h-8" />
            <i className="fa-brands fa-linkedin text-4xl text-slate-400" />
            <i className="fa-brands fa-slack text-4xl text-slate-400" />
            <i className="fa-brands fa-zap text-4xl text-slate-400" />
            <img src="/make-logo-v1.png" alt="Make" className="h-8 w-auto" />
          </div>
        </div>
      </section>

      {/* Footer copied from HomePage */}
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
                <span className="text-gray-400 hover:text-white cursor-pointer"><i className="fa-brands fa-linkedin text-xl" /></span>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-4">Product</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="/copilot" className="hover:text-white">Your Recruiting Co-Pilot</a></li>
                <li><a href="/handsfree" className="hover:text-white">Done For You Hiring</a></li>
                <li><a href="/rex" className="hover:text-white">Meet REX</a></li>
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
  );
} 