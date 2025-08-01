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
        <div id="hero-header" className="pt-32 pb-20 px-6 text-center">
          <span className="inline-block text-blue-600 bg-blue-50 rounded-full px-4 py-1 text-sm mb-4">Pricing</span>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Perfect Plan</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">Select the plan that best fits your needs. All plans include a 7-day free trial with full access to all features.</p>
          {/* Billing cycle toggle */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <span className={annual ? 'text-gray-500 cursor-pointer' : 'font-semibold'} onClick={() => setAnnual(false)}>Monthly</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" value="annual" className="sr-only peer" checked={annual} onChange={() => setAnnual(!annual)} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className={annual ? 'font-semibold' : 'text-gray-500 cursor-pointer'} onClick={() => setAnnual(true)}>Annual</span>
          </div>
        </div>

        {/* Pricing Plans */}
        <div id="pricing-plans" className="max-w-7xl mx-auto px-6 mb-24">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <div id="starter-plan" className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Starter</h2>
                  <p className="text-gray-500 mt-1">Perfect for individuals</p>
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
              <ul className="space-y-4 mb-8">
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>350 credits/month</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Apollo Hunter and Skrapp Email Enrichment Integrations</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>1 user</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Unlimited Job Reqs</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Credit rollover</span></li>
              </ul>
              <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors" onClick={() => handleCheckout('starter')}>Get Started for Free</button>
            </div>

            {/* Pro Plan */}
            <div id="pro-plan" className="bg-white rounded-2xl p-8 border-2 border-blue-500 shadow-lg hover:shadow-xl transition-shadow duration-300 transform scale-105">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Pro</h2>
                  <p className="text-gray-500 mt-1">Best for small teams</p>
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
              <ul className="space-y-4 mb-8">
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Everything in Starter plus:</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>1000 credits/month</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Connect to Zapier or Make</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Access to REX - your Recruiting AI assistant</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Credit rollover</span></li>
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
              <p className="text-gray-700 font-medium mb-4">Everything in Starter and Pro plus:</p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>5,000 credits/month</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>5 users</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Access to live customer chat support</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>Hiring Scaling Support</span></li>
                <li className="flex items-center text-gray-700"><i className="fa-solid fa-check text-green-500 mr-3"></i><span>API Access</span></li>
              </ul>
              <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors" onClick={() => handleCheckout('team')}>Get Started for Free</button>
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
            <p className="text-gray-400 max-w-2xl mx-auto">Let our expert team handle everything for you. Choose the package that matches your requirements.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            <div id="dfy-basic" className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">Done-For-You – 1-3 Roles</h3>
              <p className="text-gray-400 mb-6">Perfect for single position hiring</p>
              <div className="flex items-center justify-center mb-8">
                <i className="fa-solid fa-user-tie text-4xl text-blue-400"></i>
              </div>
              <a href="https://form.typeform.com/to/UubjS8Rh" target="_blank" rel="noopener" className="block text-center w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors">Contact Us</a>
            </div>

            <div id="dfy-standard" className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">Done-For-You – 4-6 Roles</h3>
              <p className="text-gray-400 mb-6">Ideal for multiple position monthly hiring</p>
              <div className="flex items-center justify-center mb-8">
                <i className="fa-solid fa-users text-4xl text-blue-400"></i>
              </div>
              <a href="https://form.typeform.com/to/UubjS8Rh" target="_blank" rel="noopener" className="block text-center w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors">Contact Us</a>
            </div>

            <div id="dfy-premium" className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">Done-For-You – 7-10 Roles</h3>
              <p className="text-gray-400 mb-6">Best for department-wide hiring</p>
              <p className="text-gray-400 mb-6">More than 10? Happy to support - Let us know what your needs are!</p>
              <div className="flex items-center justify-center mb-8">
                <i className="fa-solid fa-building-user text-4xl text-blue-400"></i>
              </div>
              <a href="https://form.typeform.com/to/UubjS8Rh" target="_blank" rel="noopener" className="block text-center w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors">Contact Us</a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <PublicFooter />
      </div>
    </div>
  );
} 