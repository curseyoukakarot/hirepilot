import React, { useEffect } from 'react';
import AffiliateHeader from './AffiliateHeader';

export default function AffiliateDashboard() {
  useEffect(() => {
    // Load external libs used by the provided HTML (optional if already globally available)
    // FontAwesome, Highcharts can be included via index.html; Tailwind is already present in app
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen">
      <AffiliateHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <section id="welcome-banner" className="mb-8">
          <div className="bg-gradient-to-r from-blue-500 to-emerald-500 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <img className="h-16 w-16 rounded-full border-4 border-white/20" src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg" alt="Profile" />
                <div>
                  <h2 className="text-2xl font-bold">Welcome back, Sarah!</h2>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">Pro Partner</span>
                    <span className="text-white/80 text-sm">Member since Jan 2025</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <div className="text-sm text-white/80 mb-1">Your Referral Link</div>
                  <div className="flex items-center space-x-2">
                    <code className="text-sm bg-white/20 px-3 py-1 rounded">hirepilot.com/ref/sarah123</code>
                    <button className="bg-white/20 hover:bg-white/30 p-2 rounded" onClick={() => navigator.clipboard.writeText('hirepilot.com/ref/sarah123')}>
                      <i className="fa-regular fa-copy" />
                    </button>
                    <button className="bg-white/20 hover:bg-white/30 p-2 rounded">
                      <i className="fa-solid fa-qrcode" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Earnings Overview */}
        <section id="earnings-overview" className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Lifetime Earnings</h3>
                <i className="fa-solid fa-chart-line text-emerald-500 text-xl" />
              </div>
              <div className="text-4xl font-bold text-gray-900 mb-2">$12,450.00</div>
              <div className="text-sm text-emerald-500 font-medium">+15% from last month</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">This Month</h3>
                <i className="fa-solid fa-calendar-days text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">$2,100</div>
              <div className="text-xs text-emerald-500">+8% vs last month</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Total Referrals</h3>
                <i className="fa-solid fa-users text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">47</div>
              <div className="text-xs text-gray-500">5 this month</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Next Payout</h3>
                <i className="fa-regular fa-calendar text-blue-500" />
              </div>
              <div className="text-lg font-bold text-gray-900">Aug 15</div>
              <div className="text-xs text-gray-500">$850 pending</div>
            </div>
          </div>
        </section>

        {/* Tier Progress */}
        <section id="tier-progress" className="mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Your Partner Tier: Pro Partner</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex space-x-8">
                  {[
                    { icon: 'fa-check', label: 'Starter', sub: '0-2 referrals', active: true },
                    { icon: 'fa-star', label: 'Pro', sub: '3-9 referrals', active: true },
                    { icon: 'fa-crown', label: 'Elite', sub: '10+ referrals', active: false },
                    { icon: 'fa-trophy', label: 'Legend', sub: '25+ referrals', active: false }
                  ].map((t, i) => (
                    <div className="text-center" key={i}>
                      <div className={`w-12 h-12 ${t.active ? 'bg-emerald-500' : 'bg-gray-200'} rounded-full flex items-center justify-center mb-2`}>
                        <i className={`fa-solid ${t.icon} ${t.active ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      <div className={`text-sm font-medium ${t.active ? 'text-gray-900' : 'text-gray-500'}`}>{t.label}</div>
                      <div className={`text-xs ${t.active ? 'text-gray-500' : 'text-gray-400'}`}>{t.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '70%' }} />
              </div>
              <div className="text-sm text-gray-600">3 more referrals to unlock Elite tier</div>
            </div>
          </div>
        </section>

        {/* Referral Activity & Payout History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <section id="referral-activity" className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Referral Activity</h3>
              <div className="flex space-x-2">
                <button className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm">Table</button>
                <button className="px-3 py-1 bg-gray-100 text-gray-600 rounded-md text-sm">Timeline</button>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { email: 'john@example.com', sub: 'DIY - Pro ($249/mo)', amt: '$100', status: 'Active', statusColor: 'text-emerald-500' },
                { email: 'sarah@company.com', sub: 'DFY - Enterprise', amt: '$500', status: 'Trial', statusColor: 'text-amber-500' }
              ].map((r, i) => (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg" key={i}>
                  <div>
                    <div className="font-medium text-gray-900">{r.email}</div>
                    <div className="text-sm text-gray-500">{r.sub}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${r.statusColor}`}>{r.amt}</div>
                    <div className="text-xs text-gray-500">{r.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section id="payout-history" className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Payouts</h3>
            <div className="space-y-4">
              {[
                { date: 'Aug 4, 2025', method: 'PayPal', amt: '$1,200.00', statusIcon: 'fa-check-circle', statusLabel: 'Paid', statusColor: 'text-emerald-500' },
                { date: 'Jul 25, 2025', method: 'ACH Transfer', amt: '$850.00', statusIcon: 'fa-clock', statusLabel: 'Pending', statusColor: 'text-amber-500' }
              ].map((p, i) => (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg" key={i}>
                  <div>
                    <div className="font-medium text-gray-900">{p.date}</div>
                    <div className="text-sm text-gray-500">{p.method}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{p.amt}</div>
                    <div className={`flex items-center text-xs ${p.statusColor}`}>
                      <i className={`fa-solid ${p.statusIcon} mr-1`} />
                      {p.statusLabel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Assets & Swipe Copy */}
        <section id="assets-swipe" className="mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Promote HirePilot</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: 'fa-regular fa-copy', title: 'Swipe Copy', sub: 'Email & DM scripts' },
                { icon: 'fa-brands fa-instagram', title: 'Social Templates', sub: 'Ready-made posts' },
                { icon: 'fa-regular fa-images', title: 'Promo Images', sub: 'Branded assets' },
                { icon: 'fa-regular fa-file-powerpoint', title: 'Demo Deck', sub: 'Presentation slides' }
              ].map((a, i) => (
                <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer" key={i}>
                  <div className="flex items-center space-x-3">
                    <i className={`${a.icon} text-blue-500 text-xl`} />
                    <div>
                      <div className="font-medium text-gray-900">{a.title}</div>
                      <div className="text-sm text-gray-500">{a.sub}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Help & Support */}
        <section id="help-support" className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Need Help?</h3>
              <div className="flex space-x-6 text-sm">
                <span className="text-blue-500 hover:underline cursor-pointer">How does commission work?</span>
                <span className="text-blue-500 hover:underline cursor-pointer">How do I get paid?</span>
                <span className="text-blue-500 hover:underline cursor-pointer">How do I move up tiers?</span>
              </div>
            </div>
            <button className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors">
              <i className="fa-regular fa-comment mr-2" />
              Support Chat
            </button>
          </div>
        </section>
      </main>

      {/* Floating Referral Link */}
      <div id="floating-link" className="fixed bottom-6 right-6 bg-white rounded-lg shadow-lg p-4 border border-gray-200">
        <div className="text-xs text-gray-500 mb-1">Quick Copy</div>
        <div className="flex items-center space-x-2">
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">hirepilot.com/ref/sarah123</code>
          <button className="text-blue-500 hover:text-blue-600" onClick={() => navigator.clipboard.writeText('hirepilot.com/ref/sarah123')}>
            <i className="fa-regular fa-copy" />
          </button>
        </div>
      </div>
    </div>
  );
}


