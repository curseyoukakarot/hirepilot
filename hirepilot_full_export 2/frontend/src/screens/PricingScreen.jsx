import React from 'react';
import { getStripe } from '../lib/stripe';

const pricingPlans = [
  {
    name: 'Starter',
    priceId: 'price_1R9DL8AMuJmulDbpjDHxSuJQ',
    price: 99,
    credits: 500,
    addon: 50,
    users: 1,
    reqs: 1,
    rollover: true,
  },
  {
    name: 'Pro',
    priceId: 'price_1R9DLsAMuJmulDbpwfB9IcgO',
    price: 249,
    credits: 2000,
    addon: 45,
    users: 2,
    reqs: 3,
    rollover: true,
  },
  {
    name: 'Team',
    priceId: 'price_1R9DMUAMuJmulDbpbXnqCS5k',
    price: 449,
    credits: 5000,
    addon: 40,
    users: 3,
    reqs: 5,
    rollover: true,
  },
];

const dfyPackages = [
  { name: 'Done-For-You – 1 Role', priceId: 'price_1R9DO0AMuJmulDbpEWMoyrar' },
  { name: 'Done-For-You – 2 Roles', priceId: 'price_1R9DQDAMuJmulDbpt5gEl8xt' },
  { name: 'Done-For-You – 3 Roles', priceId: 'price_1R9DQyAMuJmulDbpCnqRRw88' },
];

export default function PricingScreen() {
  const handleCheckout = async (priceId) => {
    const res = await fetch('/api/createCheckoutSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    });

    const { sessionId } = await res.json();
    const stripe = await getStripe();
    stripe.redirectToCheckout({ sessionId });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-6">
      <h1 className="text-3xl font-bold text-center text-gray-900 mb-12">Pricing Plans</h1>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {pricingPlans.map((plan) => (
          <div key={plan.name} className="bg-white border rounded-xl p-6 shadow-sm flex flex-col">
            <h2 className="text-xl font-semibold mb-2">{plan.name}</h2>
            <p className="text-4xl font-bold mb-4">${plan.price}/mo</p>
            <ul className="text-gray-600 mb-6 space-y-2">
              <li>{plan.credits} credits/month</li>
              <li>${plan.addon} per 1,000 extra credits</li>
              <li>{plan.users} user{plan.users > 1 ? 's' : ''}</li>
              <li>{plan.reqs} job req{plan.reqs > 1 ? 's' : ''}</li>
              <li>Credit Rollover: {plan.rollover ? 'Yes' : 'No'}</li>
              <li>7-Day Free Trial</li>
            </ul>
            <button
              onClick={() => handleCheckout(plan.priceId)}
              className="mt-auto bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
            >
              Choose {plan.name}
            </button>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-bold text-center text-gray-900 mt-20 mb-8">Done-For-You Packages</h2>
      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {dfyPackages.map((pkg) => (
          <div key={pkg.priceId} className="bg-white border rounded-xl p-6 text-center">
            <h3 className="text-lg font-semibold mb-2">{pkg.name}</h3>
            <p className="text-gray-600 mb-4">Contact our team to get started</p>
            <button
              onClick={() => handleCheckout(pkg.priceId)}
              className="bg-green-600 text-white py-2 px-6 rounded-md hover:bg-green-700"
            >
              Purchase Now
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
