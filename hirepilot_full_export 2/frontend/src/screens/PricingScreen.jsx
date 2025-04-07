import React from 'react';

export default function PricingScreen() {
  const handleCheckout = async (priceId) => {
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Failed to redirect to Stripe.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Something went wrong.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-900">Pricing</h1>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Monthly Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Starter */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900">Starter</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">$99</p>
            <p className="text-sm text-gray-500 mb-6">500 credits • 1 user • 1 job • 7 day trial</p>
            <button
              onClick={() => handleCheckout('price_1R9DL8AMuJmulDbpjDHxSuJQ')}
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Start Free Trial
            </button>
          </div>

          {/* Pro */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900">Pro</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">$249</p>
            <p className="text-sm text-gray-500 mb-6">2000 credits • 2 users • 3 jobs • 7 day trial</p>
            <button
              onClick={() => handleCheckout('price_1R9DLsAMuJmulDbpwfB9IcgO')}
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Start Free Trial
            </button>
          </div>

          {/* Team */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900">Team</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">$449</p>
            <p className="text-sm text-gray-500 mb-6">5000 credits • 3 users • 5 jobs • 7 day trial</p>
            <button
              onClick={() => handleCheckout('price_1R9DMUAMuJmulDbpbXnqCS5k')}
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Start Free Trial
            </button>
          </div>
        </div>

        {/* Add-On & DFY Packages */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Done-For-You Packages</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* DFY 1 Role */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-gray-900">1 Role</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">$5,000</p>
              <p className="text-sm text-gray-500 mb-6">Full-service recruiting for a single role</p>
              <button
                onClick={() => handleCheckout('price_1R9DO0AMuJmulDbpEWMoyrar')}
                className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Buy Now
              </button>
            </div>

            {/* DFY 2 Roles */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-gray-900">2 Roles</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">$8,000</p>
              <p className="text-sm text-gray-500 mb-6">Recruiting for two positions, fast</p>
              <button
                onClick={() => handleCheckout('price_1R9DQDAMuJmulDbpt5gEl8xt')}
                className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Buy Now
              </button>
            </div>

            {/* DFY 3 Roles */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-gray-900">3 Roles</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">$12,000</p>
              <p className="text-sm text-gray-500 mb-6">Complete team buildout solution</p>
              <button
                onClick={() => handleCheckout('price_1R9DQyAMuJmulDbpCnqRRw88')}
                className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
