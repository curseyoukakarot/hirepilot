import React, { useState } from 'react';
import { apiPost } from '../lib/api';
import { supabase } from '../lib/supabase';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function Pricing() {
  const [annual, setAnnual] = useState(false);

  const priceMap = {
    monthly: {
      starter: import.meta.env.VITE_STRIPE_PRICE_ID_STARTER_MONTHLY,
      pro: import.meta.env.VITE_STRIPE_PRICE_ID_PRO_MONTHLY,
      team: import.meta.env.VITE_STRIPE_PRICE_ID_TEAM_MONTHLY,
    },
    annual: {
      starter: import.meta.env.VITE_STRIPE_PRICE_ID_STARTER_ANNUAL,
      pro: import.meta.env.VITE_STRIPE_PRICE_ID_PRO_ANNUAL,
      team: import.meta.env.VITE_STRIPE_PRICE_ID_TEAM_ANNUAL,
    }
  };

  const handleCheckout = async (planTier) => {
    try {
      const priceId = priceMap[annual ? 'annual' : 'monthly'][planTier];
      const { data: { user } } = await supabase.auth.getUser();
      const res = await apiPost('/api/stripe/create-checkout-session', {
        priceId,
        planTier,
        userId: user?.id || null
      }, { requireAuth: false });
      window.location = res.url || `https://checkout.stripe.com/pay/${res.sessionId}`;
    } catch (err) {
      console.error('checkout error', err);
      alert('Unable to start checkout');
    }
  };

  return (
    <div className="h-full text-base-content">
      {/* Navbar */}
      <PublicNavbar />

      <div id="pricing-page" className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        {/* Page Header (hero) */}
        <div id="hero-header" className="pt-32 pb-20 px-6 text-center bg-gray-200">
          <span className="inline-block text-blue-600 bg-blue-50 rounded-full px-4 py-1 text-sm mb-4">Pricing</span>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Perfect Plan</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">Select the plan that best fits your needs. All plans include a 7-day free trial with full access to all features.</p>
          {/* Billing cycle toggle */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <span className={annual ? 'text-gray-500 cursor-pointer' : 'font-semibold'} onClick={() => setAnnual(false)}>Monthly</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" value="annual" className="sr-only peer" checked={annual} onChange={() => setAnnual(!annual)} />
              <div className="w-14 h-8 bg-white border border-gray-500 shadow-sm peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className={annual ? 'font-semibold' : 'text-gray-500 cursor-pointer'} onClick={() => setAnnual(true)}>Annual</span>
          </div>
        </div>

        {/* All-features banner (no paragraphs) */}
        <div className="w-full bg-gray-200 py-6">
          <div className="max-w-4xl mx-auto px-6 text-center" aria-label="all-features-banner">
            <h3 className="text-xl font-semibold text-gray-900">All plans include every feature.</h3>
          </div>
        </div>

        {/* All features included checklist (moved above pricing) */}
        <div className="w-full bg-gray-200 py-10">
          <div className="max-w-6xl mx-auto px-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">All features on paid plans include:</h3>
              <div className="grid sm:grid-cols-2 gap-3 text-gray-700">
                <div className="flex items-start"><span className="mr-3">🤖</span><span>REX AI: candidate analysis, message drafts, smart follow-ups</span></div>
                <div className="flex items-start"><span className="mr-3">🧰</span><span>Campaigns & Sequences with reply tracking</span></div>
                <div className="flex items-start"><span className="mr-3">🔎</span><span>Enrichment (Apollo/Hunter/Skrapp) with graceful fallbacks</span></div>
                <div className="flex items-start"><span className="mr-3">🔗</span><span>LinkedIn requests & profile capture (via extension/automation)</span></div>
                <div className="flex items-start"><span className="mr-3">✉️</span><span>Email sending + deliverability helpers</span></div>
                <div className="flex items-start"><span className="mr-3">🧵</span><span>Unified Inbox (see replies per campaign/lead)</span></div>
                <div className="flex items-start"><span className="mr-3">🧭</span><span>Analytics Dashboard (success rate, replies, interviews, hires)</span></div>
                <div className="flex items-start"><span className="mr-3">🧩</span><span>Integrations: Slack, Zapier, Make, ATS, Webhooks</span></div>
                <div className="flex items-start"><span className="mr-3">📅</span><span>Calendar scheduling & interview coordination</span></div>
                <div className="flex items-start"><span className="mr-3">🧑‍💼</span><span>Unlimited job reqs (no caps)</span></div>
              </div>
              <p className="text-sm text-gray-500 mt-4" aria-label="credits-explainer">Credits power enrichment, AI analysis, automations, and outreach actions. Add more credits any time.</p>
            </div>
          </div>
        </div>

        {/* Pricing Plans (full-width, 4 across on xl) */}
        <div className="w-full py-12">
          <div id="pricing-plans" className="max-w-screen-2xl 2xl:max-w-[1800px] mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 items-stretch">
            {/* Free Forever Plan */}
            <div id="free-plan" className="relative bg-white rounded-2xl p-8 border border-green-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="absolute -top-3 left-4 bg-green-600 text-white text-xs px-2 py-1 rounded-full">New</div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Free Forever</h2>
                  <p className="text-gray-500 mt-1">Start free. No credit card.</p>
                </div>
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">$0/mo</span>
              </div>
              <div className="text-gray-700 mb-4" aria-label="credit-info-free">
                <div className="font-semibold">50 credits / month</div>
              </div>
              <ul className="space-y-3 mb-8 flex-1 text-gray-700" aria-label="free-features">
                <li className="flex items-center"><i className="fa-solid fa-chrome text-blue-600 mr-3"></i><span>Chrome Extension</span></li>
                <li className="flex items-center"><i className="fa-solid fa-robot text-purple-600 mr-3"></i><span>REX AI (core)</span></li>
                <li className="flex items-center"><i className="fa-solid fa-envelope text-indigo-600 mr-3"></i><span>Send LinkedIn/emails (no sequences)</span></li>
                <li className="flex items-center"><i className="fa-solid fa-folder-open text-gray-600 mr-3"></i><span>Save templates</span></li>
                <li className="flex items-center"><i className="fa-solid fa-briefcase text-gray-600 mr-3"></i><span>3 job reqs & 3 active campaigns</span></li>
                <li className="flex items-center"><i className="fa-brands fa-slack text-blue-500 mr-3"></i><span>Slack/Gmail/Outlook connect</span></li>
                <li className="flex items-center"><i className="fa-solid fa-ban text-red-500 mr-3"></i><span>No sequences / exports / Agent Mode</span></li>
              </ul>
              <a href="/signup?plan=free" className="block w-full text-center bg-green-600 text-white py-4 rounded-xl font-semibold hover:bg-green-700 transition-colors">Get Started Free</a>
              <div className="text-xs text-gray-500 mt-2 text-center">No credit card required</div>
            </div>
            {/* Starter Plan */}
            <div id="starter-plan" className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Starter</h2>
                  <p className="text-gray-500 mt-1">Perfect for individuals & small teams</p>
                </div>
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">Popular</span>
              </div>
              {(() => {
                const price = annual ? 79 : 99;
                return (
                  <div className="mb-6">
                    <span className="text-5xl font-bold text-gray-900">${price}</span>
                    <span className="text-gray-500">/month</span>
                  </div>
                );
              })()}
              <div className="text-gray-700 mb-4" aria-label="credit-info-starter">
                <div className="font-semibold">350 credits / month</div>
              </div>
              <ul className="space-y-4 mb-8 flex-1" aria-label="starter-features">
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-recycle text-green-500 mr-3"></i><span>Credit rollover while subscribed</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-plug text-blue-600 mr-3"></i><span>Unlimited job reqs & campaigns</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-wrench text-gray-600 mr-3"></i><span>Add credits anytime from Billing</span></li>
              </ul>
              <p className="text-gray-500 text-sm mb-6">Ideal for: 1 active role, light weekly sourcing, fast validation.</p>
              <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors" onClick={() => handleCheckout('starter')}>Get Started for Free</button>
            </div>

            {/* Pro Plan */}
            <div id="pro-plan" className="bg-white rounded-2xl p-8 border-2 border-blue-500 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Pro</h2>
                  <p className="text-gray-500 mt-1">Built for growing teams</p>
                </div>
                <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">Best Value</span>
              </div>
              {(() => {
                const price = annual ? 199 : 249;
                return (
                  <div className="mb-6">
                    <span className="text-5xl font-bold text-gray-900">${price}</span>
                    <span className="text-gray-500">/month</span>
                  </div>
                );
              })()}
              <div className="text-gray-700 mb-4" aria-label="credit-info-pro">
                <div className="font-semibold">1,000 credits / month</div>
              </div>
              <ul className="space-y-4 mb-8 flex-1" aria-label="pro-features">
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Everything in Starter (all features unlocked)</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-recycle text-green-500 mr-3"></i><span>Credit rollover while subscribed</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-repeat text-blue-600 mr-3"></i><span>Higher-volume outreach + enrichment</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-chart-line text-purple-600 mr-3"></i><span>Perfect for 2–3 concurrent roles and A/B testing</span></li>
              </ul>
              <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors" onClick={() => handleCheckout('pro')}>Get Started for Free</button>
            </div>

            {/* Team Plan */}
            <div id="team-plan" className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Team</h2>
                  <p className="text-gray-500 mt-1">For growing companies</p>
                </div>
                <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">Enterprise</span>
              </div>
              {(() => {
                const price = annual ? 69 : 99;
                return (
                  <div className="mb-6">
                    <span className="text-5xl font-bold text-gray-900">${price}</span>
                    <span className="text-gray-500">/month per user</span>
                  </div>
                );
              })()}
              <div className="text-gray-700 mb-4" aria-label="credit-info-team">
                <div className="font-semibold">5,000 credits / month</div>
              </div>
              <ul className="space-y-4 mb-8 flex-1" aria-label="team-features">
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Everything in Starter & Pro (all features unlocked)</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-users text-blue-600 mr-3"></i><span>5 users included (contact us if you need more)</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-recycle text-green-500 mr-3"></i><span>Credit rollover while subscribed</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-brain text-purple-600 mr-3"></i><span>High-throughput sourcing + automations</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-folder-tree text-blue-600 mr-3"></i><span>Great for multi-role pipelines and weekly hiring cycles</span></li>
              </ul>
              <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors" onClick={() => handleCheckout('team')}>Get Started for Free</button>
            </div>
          </div>
        </div>
        </div>

        {/* (Removed) duplicate features card below pricing; keep fine print */}
        <div className="w-full bg-gray-200 py-6">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-xs text-gray-500" aria-label="credits-explainer">
              How credits work: Each sourcing/enrichment/automation step consumes credits (e.g., enrichment lookups, AI analysis, outbound actions). Credits roll over while your plan is active, and you can buy top-ups at any time.
            </div>
          </div>
        </div>

        {/* ROI Comparison Section */}
        <div id="roi-comparison" className="bg-white py-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block text-blue-600 bg-blue-50 rounded-full px-4 py-1 text-sm mb-4">Why HirePilot</span>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">What You'd Pay Without HirePilot</h2>
            <p className="text-gray-600 mb-10 max-w-2xl mx-auto">Compare the cost of building your own recruiting stack with what you get inside HirePilot.</p>

            <div className="grid sm:grid-cols-2 gap-6 text-left max-w-3xl mx-auto">
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 p-4 rounded-xl shadow-sm">
                <span className="text-gray-700 font-medium">Sourcer</span>
                <span className="text-red-600 font-semibold">$2,000/mo</span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 p-4 rounded-xl shadow-sm">
                <span className="text-gray-700 font-medium">Recruiter</span>
                <span className="text-red-600 font-semibold">$5,000/mo</span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 p-4 rounded-xl shadow-sm">
                <span className="text-gray-700 font-medium">Outreach Automation</span>
                <span className="text-red-600 font-semibold">$300/mo</span>
              </div>
              <div className="flex items-center justify-between bg-green-50 border border-green-200 p-4 rounded-xl shadow-sm">
                <span className="text-gray-700 font-medium">HirePilot</span>
                <span className="text-green-600 font-semibold">$99/mo</span>
              </div>
            </div>

            <div className="mt-12 text-center">
              <p className="text-xl font-bold text-blue-600">→ Save over <span className="text-green-600">$6,000/month</span> and make better hires</p>
            </div>
          </div>
        </div>

        {/* Done-For-You Section */}
        <div id="dfy-section" className="bg-gray-900 py-20 px-6">
          <div className="max-w-7xl mx-auto text-center mb-16">
            <span className="inline-block text-blue-400 bg-blue-900 rounded-full px-4 py-1 text-sm mb-4">Done-For-You</span>
            <h2 className="text-3xl font-bold text-white mb-4">Premium Done-For-You Packages</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Unlimited candidates. Let our expert team handle everything for you. Choose the package that matches your requirements.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto items-stretch">
            <div id="dfy-basic" className="bg-gray-800 rounded-2xl p-8 border border-gray-700 flex flex-col">
              <h3 className="text-xl font-bold text-white mb-4">Done-For-You – 1-3 Roles</h3>
              <p className="text-gray-400 mb-6">Perfect for single position hiring</p>
              <div className="flex items-center justify-center mb-8">
                <i className="fa-solid fa-user-tie text-4xl text-blue-400"></i>
              </div>
              <a href="https://form.typeform.com/to/UubjS8Rh" target="_blank" rel="noopener" className="block text-center w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors mt-auto">Contact Us</a>
            </div>

            <div id="dfy-standard" className="bg-gray-800 rounded-2xl p-8 border border-gray-700 flex flex-col">
              <h3 className="text-xl font-bold text-white mb-4">Done-For-You – 4-6 Roles</h3>
              <p className="text-gray-400 mb-6">Ideal for multiple position monthly hiring</p>
              <div className="flex items-center justify-center mb-8">
                <i className="fa-solid fa-users text-4xl text-blue-400"></i>
              </div>
              <a href="https://form.typeform.com/to/UubjS8Rh" target="_blank" rel="noopener" className="block text-center w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors mt-auto">Contact Us</a>
            </div>

            <div id="dfy-premium" className="bg-gray-800 rounded-2xl p-8 border border-gray-700 flex flex-col">
              <h3 className="text-xl font-bold text-white mb-4">Done-For-You – 7-10 Roles</h3>
              <p className="text-gray-400 mb-6">Best for department-wide hiring</p>
              <p className="text-gray-400 mb-6">More than 10? Happy to support - Let us know what your needs are!</p>
              <div className="flex items-center justify-center mb-8">
                <i className="fa-solid fa-building-user text-4xl text-blue-400"></i>
              </div>
              <a href="https://form.typeform.com/to/UubjS8Rh" target="_blank" rel="noopener" className="block text-center w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors mt-auto">Contact Us</a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <PublicFooter />
      </div>
    </div>
  );
} 