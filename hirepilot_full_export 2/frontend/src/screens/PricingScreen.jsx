// At the top of PricingScreen.jsx
import { useState } from 'react';

export default function PricingScreen() {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async (priceId) => {
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();

      if (response.ok) {
        window.location.href = data.url;
      } else {
        alert(`Failed to create checkout: ${data.error}`);
      }
    } catch (err) {
      alert('Something went wrong. Try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white py-16 px-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-10 text-center">Choose a Plan</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Starter Plan */}
        <div className="border p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Starter</h2>
          <p className="text-4xl font-bold mb-4">$99<span className="text-sm text-gray-500">/mo</span></p>
          <ul className="text-sm mb-6 text-gray-600">
            <li>✅ 500 Credits</li>
            <li>✅ 1 User</li>
            <li>✅ 1 Job Req</li>
            <li>✅ Credit Rollover</li>
            <li>✅ 7-Day Free Trial</li>
          </ul>
          <button
            disabled={loading}
            onClick={() => handleCheckout('price_1R9DL8AMuJmulDbpjDHxSuJQ')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md"
          >
            {loading ? 'Redirecting...' : 'Get Starter'}
          </button>
        </div>

        {/* Pro Plan */}
        <div className="border p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Pro</h2>
          <p className="text-4xl font-bold mb-4">$249<span className="text-sm text-gray-500">/mo</span></p>
          <ul className="text-sm mb-6 text-gray-600">
            <li>✅ 2000 Credits</li>
            <li>✅ 2 Users</li>
            <li>✅ 3 Job Reqs</li>
            <li>✅ Credit Rollover</li>
            <li>✅ 7-Day Free Trial</li>
          </ul>
          <button
            disabled={loading}
            onClick={() => handleCheckout('price_1R9DLsAMuJmulDbpwfB9IcgO')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md"
          >
            {loading ? 'Redirecting...' : 'Get Pro'}
          </button>
        </div>

        {/* Team Plan */}
        <div className="border p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Team</h2>
          <p className="text-4xl font-bold mb-4">$499<span className="text-sm text-gray-500">/mo</span></p>
          <ul className="text-sm mb-6 text-gray-600">
            <li>✅ 5000 Credits</li>
            <li>✅ 3 Users</li>
            <li>✅ 5 Job Reqs</li>
            <li>✅ Credit Rollover</li>
            <li>✅ 7-Day Free Trial</li>
          </ul>
          <button
            disabled={loading}
            onClick={() => handleCheckout('price_1R9DMUAMuJmulDbpbXnqCS5k')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md"
          >
            {loading ? 'Redirecting...' : 'Get Team'}
          </button>
        </div>
      </div>
    </div>
  );
}
