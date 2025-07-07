import React from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function ChromeExtension() {
  return (
    <div className="bg-gray-950 text-white font-sans">
      {/* Header */}
      <PublicNavbar />

      {/* Hero Section */}
      <section id="hero" className="pt-24 pb-20 px-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden h-[700px] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-600/10" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />

        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-full px-6 py-2 mb-8">
            <i className="fas fa-shield-alt text-green-400 mr-2" />
            <span className="text-sm text-gray-300">Secure LinkedIn Integration</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent leading-tight">
            Seamlessly Connect<br />LinkedIn to HirePilot
          </h1>

          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            The HirePilot Extension helps you securely capture your <code className="bg-gray-800 px-3 py-1 rounded-lg text-green-400 font-mono">li_at</code> cookie so you can run LinkedIn-based sourcing and outreach inside HirePilot — no copy-paste needed.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-2xl">
              <i className="fab fa-chrome mr-2" />
              Coming Soon to Chrome Web Store
            </button>
            <button className="border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300">
              <i className="fas fa-play mr-2" />
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            How It Works
          </h2>
          <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
            To enable HirePilot's AI sourcing features on LinkedIn, you'll need to provide your session cookie. This Chrome Extension automates that process — no dev tools needed.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: 'fa-download',
              title: '1. Install',
              desc: 'Install the extension from the Chrome Web Store with a single click. No configuration required.'
            },
            {
              icon: 'fa-mouse-pointer',
              title: '2. Activate',
              desc: 'Click the HirePilot icon while logged into LinkedIn. The extension will automatically detect your session.'
            },
            {
              icon: 'fa-check-circle',
              title: '3. Done',
              desc: 'Your cookie is automatically copied for use in HirePilot. Start sourcing leads immediately.'
            }
          ].map(card => (
            <div key={card.title} className="gradient-border">
              <div className="gradient-border-inner p-8 h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6">
                  <i className={`fas ${card.icon} text-white text-2xl`} />
                </div>
                <h3 className="text-2xl font-semibold mb-4 text-white">{card.title}</h3>
                <p className="text-gray-300 leading-relaxed">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-20 px-6 bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent flex items-center justify-center">
              <i className="fas fa-shield-alt mr-3" />
              Why We Need Your Cookie
            </h2>
            <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
              HirePilot uses your session to access LinkedIn data during lead sourcing. We never store or share your cookie. You remain in full control and can revoke access at any time.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="space-y-6">
                {[{
                  iconBg: 'bg-green-500',
                  icon: 'fa-lock',
                  title: 'Secure by Design',
                  desc: 'Your cookie is processed locally and never stored on our servers.'
                }, {
                  iconBg: 'bg-blue-500',
                  icon: 'fa-eye-slash',
                  title: 'No Tracking',
                  desc: 'We don\'t monitor your LinkedIn activity or collect personal data.'
                }, {
                  iconBg: 'bg-purple-500',
                  icon: 'fa-user-shield',
                  title: 'Full Control',
                  desc: 'Revoke access anytime by logging out of LinkedIn or uninstalling the extension.'
                }].map(item => (
                  <div key={item.title} className="flex items-start space-x-4">
                    <div className={`w-8 h-8 ${item.iconBg} rounded-full flex items-center justify-center flex-shrink-0 mt-1`}>
                      <i className={`fas ${item.icon} text-white text-sm`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                      <p className="text-gray-300">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-800 rounded-2xl p-8">
              <h3 className="text-xl font-semibold mb-6 text-white">Extension Permissions</h3>
              <ul className="space-y-4">
                <li className="flex items-start space-x-3">
                  <i className="fas fa-check text-green-400 mt-1" />
                  <span className="text-gray-300">Only accesses cookies on <strong className="text-white">LinkedIn domains</strong></span>
                </li>
                <li className="flex items-start space-x-3">
                  <i className="fas fa-times text-red-400 mt-1" />
                  <span className="text-gray-300">Does <strong className="text-white">not</strong> read emails or modify your profile</span>
                </li>
                <li className="flex items-start space-x-3">
                  <i className="fas fa-times text-red-400 mt-1" />
                  <span className="text-gray-300">Does <strong className="text-white">not</strong> track your browsing activity</span>
                </li>
                <li className="flex items-start space-x-3">
                  <i className="fas fa-check text-green-400 mt-1" />
                  <span className="text-gray-300">Restricted to <strong className="text-white">HirePilot integration</strong> only</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="cta" className="py-20 px-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Streamline Your LinkedIn Sourcing?</h2>
          <p className="text-xl text-gray-300 mb-10">Join the many recruiters already using HirePilot to accelerate their hiring process.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105">
              <i className="fab fa-chrome mr-2" />
              Add to Chrome (Coming Soon)
            </button>
            <button className="border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300">
              <i className="fas fa-envelope mr-2" />
              Get Notified
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter />

      {/* Custom styles removed from global scope */}
      <style>{`
        /* Hide scrollbars */
        ::-webkit-scrollbar { display: none; }
        html, body { -ms-overflow-style: none; scrollbar-width: none; }
        /* Gradient border helper */
        .gradient-border {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4);
          padding: 2px;
          border-radius: 12px;
        }
        .gradient-border-inner { background: #111827; border-radius: 10px; }
        /* Hover lift */
        .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
      `}</style>
    </div>
  );
} 