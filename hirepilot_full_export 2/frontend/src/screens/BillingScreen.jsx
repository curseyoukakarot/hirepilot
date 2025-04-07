// BillingScreen.jsx (wired to Stripe usage + invoice fetch)
import React, { useEffect, useState } from 'react';

export default function BillingScreen() {
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [creditLimit, setCreditLimit] = useState(10000);
  const [usageHistory, setUsageHistory] = useState([]);
  const [billingHistory, setBillingHistory] = useState([]);

  useEffect(() => {
    fetch('/api/stripe/usage')
      .then(res => res.json())
      .then(data => {
        setCreditsUsed(data.totalUsed);
        setCreditLimit(data.limit);
        setUsageHistory(data.usage);
      });

    fetch('/api/stripe/invoices')
      .then(res => res.json())
      .then(data => setBillingHistory(data));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <span className="text-blue-600 text-2xl font-bold">⚡ HirePilot</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="fa-regular fa-bell text-gray-600" />
              <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" className="w-8 h-8 rounded-full" alt="user avatar" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Pro Plan</h2>
              <p className="text-gray-600">Your next billing date is March 15, 2025</p>
            </div>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Upgrade Plan</button>
          </div>

          <div className="mt-8">
            <div className="flex justify-between mb-2 font-medium">
              <span>Credits Used</span>
              <span>{creditsUsed.toLocaleString()} / {creditLimit.toLocaleString()}</span>
            </div>
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${(creditsUsed / creditLimit) * 100}%` }}
              ></div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">Usage History</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Description</th>
                <th className="text-left py-3 px-4">Credits</th>
                <th className="text-left py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {usageHistory.map((entry, i) => (
                <tr key={i} className="border-b">
                  <td className="py-3 px-4">{entry.date}</td>
                  <td className="py-3 px-4">{entry.description}</td>
                  <td className="py-3 px-4">{entry.credits}</td>
                  <td className="py-3 px-4">
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">{entry.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-6">Billing History</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Invoice</th>
                <th className="text-left py-3 px-4">Amount</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {billingHistory.map((entry, i) => (
                <tr key={i} className="border-b">
                  <td className="py-3 px-4">{entry.date}</td>
                  <td className="py-3 px-4">{entry.invoice}</td>
                  <td className="py-3 px-4">{entry.amount}</td>
                  <td className="py-3 px-4">
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">{entry.status}</span>
                  </td>
                  <td className="py-3 px-4">
                    <button className="text-blue-600 hover:text-blue-700">
                      <span className="fa-solid fa-download"></span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
