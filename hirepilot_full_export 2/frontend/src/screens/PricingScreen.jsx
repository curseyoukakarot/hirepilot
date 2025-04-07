import React from 'react';

export default function PricingScreen() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-8">Pricing Plans</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Starter Plan */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-2">Starter</h2>
            <p className="text-gray-600 mb-4">Perfect for individuals getting started</p>
            <div className="text-3xl font-bold mb-2">$99<span className="text-lg font-medium">/mo</span></div>
            <ul className="text-sm text-gray-700 mb-6 space-y-1">
              <li>500 credits</li>
              <li>$50 per additional 1,000</li>
              <li>1 user • 1 job req</li>
              <li>Credit rollover: Yes</li>
              <li>7 day free trial</li>
            </ul>
            <form action="/api/stripe/checkout" method="POST">
              <input type="hidden" name="priceId" value="price_1R9DL8AMuJmulDbpjDHxSuJQ" />
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Subscribe</button>
            </form>
          </div>

          {/* Pro Plan */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-2">Pro</h2>
            <p className="text-gray-600 mb-4">Great for scaling recruiters</p>
            <div className="text-3xl font-bold mb-2">$249<span className="text-lg font-medium">/mo</span></div>
            <ul className="text-sm text-gray-700 mb-6 space-y-1">
              <li>2,000 credits</li>
              <li>$45 per additional 1,000</li>
              <li>2 users • 3 job reqs</li>
              <li>Credit rollover: Yes</li>
              <li>7 day free trial</li>
            </ul>
            <form action="/api/stripe/checkout" method="POST">
              <input type="hidden" name="priceId" value="price_1R9DLsAMuJmulDbpwfB9IcgO" />
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Subscribe</button>
            </form>
          </div>

          {/* Team Plan */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-2">Team</h2>
            <p className="text-gray-600 mb-4">Built for agencies and power users</p>
            <div className="text-3xl font-bold mb-2">$499<span className="text-lg font-medium">/mo</span></div>
            <ul className="text-sm text-gray-700 mb-6 space-y-1">
              <li>5,000 credits</li>
              <li>$40 per additional 1,000</li>
              <li>3 users • 5 job reqs</li>
              <li>Credit rollover: Yes</li>
              <li>7 day free trial</li>
            </ul>
            <form action="/api/stripe/checkout" method="POST">
              <input type="hidden" name="priceId" value="price_1R9DMUAMuJmulDbpbXnqCS5k" />
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Subscribe</button>
            </form>
          </div>
        </div>

        {/* DFY Section */}
        <div className="mt-16">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Done-For-You Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-medium mb-1">1 Role</h3>
              <p className="text-2xl font-bold mb-4">$5,000</p>
              <form action="/api/stripe/checkout" method="POST">
                <input type="hidden" name="priceId" value="price_1R9DO0AMuJmulDbpEWMoyrar" />
                <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">Buy Now</button>
              </form>
            </div>
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-medium mb-1">2 Roles</h3>
              <p className="text-2xl font-bold mb-4">$8,000</p>
              <form action="/api/stripe/checkout" method="POST">
                <input type="hidden" name="priceId" value="price_1R9DQDAMuJmulDbpt5gEl8xt" />
                <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">Buy Now</button>
              </form>
            </div>
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-medium mb-1">3 Roles</h3>
              <p className="text-2xl font-bold mb-4">$12,000</p>
              <form action="/api/stripe/checkout" method="POST">
                <input type="hidden" name="priceId" value="price_1R9DQyAMuJmulDbpCnqRRw88" />
                <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">Buy Now</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
