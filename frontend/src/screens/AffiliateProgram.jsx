import React, { useEffect } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function AffiliateProgram() {
  useEffect(() => {
    // Earnings calculator functionality
    const updateEarnings = () => {
      const diySlider = document.getElementById('diy-slider');
      const dfySlider = document.getElementById('dfy-slider');
      const diyEarnings = document.getElementById('diy-earnings');
      const dfyEarnings = document.getElementById('dfy-earnings');
      const totalEarnings = document.getElementById('total-earnings');

      if (diySlider && dfySlider && diyEarnings && dfyEarnings && totalEarnings) {
        const diyValue = parseInt(diySlider.value);
        const dfyValue = parseInt(dfySlider.value);
        
        const diyTotal = diyValue * 150; // $150 per DIY user
        const dfyTotal = dfyValue * 1200; // $1200 per DFY client per month
        
        diyEarnings.textContent = `$${diyTotal.toLocaleString()}`;
        dfyEarnings.textContent = `$${dfyTotal.toLocaleString()}`;
        totalEarnings.textContent = `$${(diyTotal + dfyTotal).toLocaleString()}`;
      }
    };

    // Set up event listeners after component mounts
    const timer = setTimeout(() => {
      const diySlider = document.getElementById('diy-slider');
      const dfySlider = document.getElementById('dfy-slider');
      
      if (diySlider && dfySlider) {
        diySlider.addEventListener('input', updateEarnings);
        dfySlider.addEventListener('input', updateEarnings);
        
        // Initial calculation
        updateEarnings();
      }
    }, 100);

    // Cleanup
    return () => {
      clearTimeout(timer);
      const diySlider = document.getElementById('diy-slider');
      const dfySlider = document.getElementById('dfy-slider');
      
      if (diySlider && dfySlider) {
        diySlider.removeEventListener('input', updateEarnings);
        dfySlider.removeEventListener('input', updateEarnings);
      }
    };
  }, []);

  return (
    <div className="bg-white">
      <PublicNavbar />

      {/* Hero Section */}
      <section id="hero" className="relative bg-gradient-to-br from-blue-50 to-indigo-100 h-[600px] overflow-hidden pt-20">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  Earn Big by Referring the 
                  <span className="text-blue-600"> Future of Hiring</span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Turn your network into monthly income. Join the HirePilot Affiliate Program and get paid to share a tool that sells itself.
                </p>
                <p className="text-lg text-gray-500">
                  Whether you're a recruiter, founder, consultant, or just plugged-in — you can get paid to refer our AI-powered hiring system to teams that need it most.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors">
                  Join the Program
                </button>
                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  <span className="flex items-center">
                    <i className="fa-solid fa-users mr-2 text-blue-600"></i>
                    Used by 300+ recruiters
                  </span>
                  <span className="flex items-center">
                    <i className="fa-solid fa-dollar-sign mr-2 text-yellow-500"></i>
                    Up to $7,200 per referral
                  </span>
                </div>
              </div>
            </div>
            <div className="relative">
              <img className="w-full h-96 object-cover rounded-2xl shadow-2xl" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/400c793d5a-31a43ac6d2b2c756521e.png" alt="modern dashboard interface with AI hiring analytics and Slack notifications, professional tech aesthetic" />
              <div className="absolute -bottom-4 -right-4 bg-white rounded-lg shadow-lg p-4">
                <div className="flex items-center space-x-2">
                  <i className="fa-solid fa-chart-line text-green-500"></i>
                  <span className="text-sm font-semibold">+42% hiring efficiency</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600">Three simple steps to start earning</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-200 transition-colors">
                <i className="fa-solid fa-share text-blue-600 text-2xl"></i>
              </div>
              <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-4 text-sm font-bold">1</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Share your custom link</h3>
              <p className="text-gray-600">Via email, social, or DM — however you prefer to connect with your network.</p>
            </div>
            <div className="text-center group">
              <div className="bg-yellow-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-yellow-200 transition-colors">
                <i className="fa-solid fa-user-plus text-yellow-600 text-2xl"></i>
              </div>
              <div className="bg-yellow-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-4 text-sm font-bold">2</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Someone signs up or books a call</h3>
              <p className="text-gray-600">We handle the selling, demos, and onboarding — you just make the introduction.</p>
            </div>
            <div className="text-center group">
              <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-green-200 transition-colors">
                <i className="fa-solid fa-dollar-sign text-green-600 text-2xl"></i>
              </div>
              <div className="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-4 text-sm font-bold">3</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">You get paid</h3>
              <p className="text-gray-600">One-time or recurring payments depending on the plan they choose.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Earnings Calculator */}
      <section id="earnings-calculator" className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">See What You Could Earn</h2>
            <p className="text-xl text-gray-600">Adjust the sliders to calculate your potential income</p>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-lg font-semibold text-gray-900 mb-4">DIY Users per Month</label>
                  <input type="range" id="diy-slider" min="1" max="100" defaultValue="10" className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                  <div className="flex justify-between text-sm text-gray-500 mt-2">
                    <span>1</span>
                    <span>100</span>
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600" id="diy-earnings">$1,500</div>
                    <div className="text-sm text-gray-600">One-time commission</div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-lg font-semibold text-gray-900 mb-4">DFY Clients per Month</label>
                  <input type="range" id="dfy-slider" min="1" max="10" defaultValue="2" className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                  <div className="flex justify-between text-sm text-gray-500 mt-2">
                    <span>1</span>
                    <span>10</span>
                  </div>
                  <div className="mt-4 p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600" id="dfy-earnings">$2,400</div>
                    <div className="text-sm text-gray-600">Monthly recurring (6 months)</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-8 text-center p-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-white">
              <div className="text-3xl font-bold" id="total-earnings">$3,900</div>
              <div className="text-lg">Total Monthly Potential</div>
            </div>
          </div>
        </div>
      </section>

      {/* Partner Tiers */}
      <section id="partner-tiers" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Partner Tier System</h2>
            <p className="text-xl text-gray-600">Unlock rewards as you grow</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200">
              <div className="text-center mb-4">
                <i className="fa-solid fa-star text-gray-400 text-3xl mb-2"></i>
                <h3 className="text-xl font-bold text-gray-900">Starter</h3>
                <p className="text-sm text-gray-600">0-2 Referrals</p>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center"><i className="fa-solid fa-check text-green-500 mr-2"></i>Basic payouts</li>
                <li className="flex items-center"><i className="fa-solid fa-check text-green-500 mr-2"></i>Dashboard access</li>
              </ul>
            </div>
            <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-600">
              <div className="text-center mb-4">
                <i className="fa-solid fa-star text-blue-600 text-3xl mb-2"></i>
                <h3 className="text-xl font-bold text-gray-900">Pro Partner</h3>
                <p className="text-sm text-gray-600">3-9 Referrals</p>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center"><i className="fa-solid fa-check text-green-500 mr-2"></i>Early access to features</li>
                <li className="flex items-center"><i className="fa-solid fa-check text-green-500 mr-2"></i>Bonus tools</li>
              </ul>
            </div>
            <div className="bg-yellow-50 rounded-xl p-6 border-2 border-yellow-600">
              <div className="text-center mb-4">
                <i className="fa-solid fa-crown text-yellow-600 text-3xl mb-2"></i>
                <h3 className="text-xl font-bold text-gray-900">Elite</h3>
                <p className="text-sm text-gray-600">10+ Referrals</p>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center"><i className="fa-solid fa-check text-green-500 mr-2"></i>Private Slack</li>
                <li className="flex items-center"><i className="fa-solid fa-check text-green-500 mr-2"></i>Custom swag</li>
              </ul>
            </div>
            <div className="bg-purple-50 rounded-xl p-6 border-2 border-purple-500">
              <div className="text-center mb-4">
                <i className="fa-solid fa-trophy text-purple-500 text-3xl mb-2"></i>
                <h3 className="text-xl font-bold text-gray-900">Legend</h3>
                <p className="text-sm text-gray-600">25+ Referrals</p>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center"><i className="fa-solid fa-check text-green-500 mr-2"></i>VIP status</li>
                <li className="flex items-center"><i className="fa-solid fa-check text-green-500 mr-2"></i>Co-marketing</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why Join */}
      <section id="why-join" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Promote HirePilot?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <i className="fa-solid fa-check-circle text-green-500 text-xl mt-1"></i>
                <div>
                  <h3 className="font-semibold text-gray-900">AI sourcing tech recruiters actually love</h3>
                  <p className="text-gray-600 text-sm">Built by recruiters, for recruiters</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <i className="fa-solid fa-check-circle text-green-500 text-xl mt-1"></i>
                <div>
                  <h3 className="font-semibold text-gray-900">Price points that are easy to sell</h3>
                  <p className="text-gray-600 text-sm">$99–$499 DIY, $5K–$15K DFY</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <i className="fa-solid fa-check-circle text-green-500 text-xl mt-1"></i>
                <div>
                  <h3 className="font-semibold text-gray-900">Recurring commissions + instant payouts</h3>
                  <p className="text-gray-600 text-sm">Get paid monthly for DFY referrals</p>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <i className="fa-solid fa-check-circle text-green-500 text-xl mt-1"></i>
                <div>
                  <h3 className="font-semibold text-gray-900">Dedicated partner support</h3>
                  <p className="text-gray-600 text-sm">We help you succeed</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <i className="fa-solid fa-check-circle text-green-500 text-xl mt-1"></i>
                <div>
                  <h3 className="font-semibold text-gray-900">Real customers → real revenue</h3>
                  <p className="text-gray-600 text-sm">Proven product with happy users</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Real Results</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="flex items-center mb-4">
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg" alt="Ashley" className="w-12 h-12 rounded-full mr-4" />
                <div>
                  <h4 className="font-semibold text-gray-900">Ashley</h4>
                  <p className="text-sm text-gray-600">Head of Talent, Series B SaaS</p>
                </div>
              </div>
              <p className="text-gray-700 italic">"HirePilot helped us fill two roles in weeks. Total game-changer."</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="flex items-center mb-4">
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" alt="Cameron" className="w-12 h-12 rounded-full mr-4" />
                <div>
                  <h4 className="font-semibold text-gray-900">Cameron</h4>
                  <p className="text-sm text-gray-600">Recruiting Agency Owner</p>
                </div>
              </div>
              <p className="text-gray-700 italic">"This saves 10 hours a week and actually works. It's my go-to sourcing engine."</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="flex items-center mb-4">
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg" alt="Marcus" className="w-12 h-12 rounded-full mr-4" />
                <div>
                  <h4 className="font-semibold text-gray-900">Marcus</h4>
                  <p className="text-sm text-gray-600">VP Engineering</p>
                </div>
              </div>
              <p className="text-gray-700 italic">"Finally found quality candidates without the endless screening calls."</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="final-cta" className="py-20 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Partner With the Future of Hiring?</h2>
          <p className="text-xl text-blue-100 mb-8">Start referring in under 2 minutes. No approval needed. Your audience will thank you.</p>
          <button className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors">
            Join Now
          </button>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}