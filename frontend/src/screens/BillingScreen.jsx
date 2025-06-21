// BillingScreen.jsx (wired to Stripe usage + invoice fetch)
import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { PRICING_CONFIG } from '../config/pricing';
import { supabase } from '../lib/supabase';

// Debug environment variables
console.log('Environment variables:', {
  stripeKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  mode: import.meta.env.MODE,
  allEnvVars: import.meta.env
});

// Check if Stripe key exists
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
if (!stripeKey) {
  console.error('Stripe publishable key is missing. Please check your .env.local file.');
}

const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

export default function BillingScreen() {
  const [billingOverview, setBillingOverview] = useState({
    subscription: null,
    credits: 0,
    recentUsage: [],
    recentInvoices: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRecruitPro, setIsRecruitPro] = useState(false);

  const BACKEND = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    fetchBillingOverview();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.user_metadata?.role || user?.user_metadata?.account_type;
      if (role === 'RecruitPro') setIsRecruitPro(true);
    })();
  }, []);

  const fetchBillingOverview = async () => {
    try {
      console.log('Fetching billing overview...');
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${BACKEND}/api/billing/overview`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        credentials: 'include'
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('Raw response:', responseText);

      if (!response.ok) {
        throw new Error(`Failed to fetch billing overview: ${responseText}`);
      }

      const data = JSON.parse(responseText);
      setBillingOverview(data);
    } catch (err) {
      console.error('Error fetching billing overview:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId, interval) => {
    if (!stripePromise) {
      setError('Stripe is not properly configured. Please check your environment variables.');
      return;
    }

    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${BACKEND}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        credentials: 'include',
        body: JSON.stringify({ planId, interval })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create checkout session: ${errorText}`);
      }

      const { sessionId } = await response.json();
      
      const stripe = await stripePromise;
      const { error } = await stripe.redirectToCheckout({ sessionId });
      
      if (error) {
        throw new Error(error.message);
      }
    } catch (err) {
      console.error('Error creating checkout session:', err);
      setError(err.message);
    }
  };

  const handleManageSubscription = async () => {
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${BACKEND}/api/billing/portal`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create portal session: ${errorText}`);
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      console.error('Error creating portal session:', err);
      setError(err.message);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription?')) return;

    try {
      const response = await fetch(`${BACKEND}/api/billing/cancel`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to cancel subscription: ${errorText}`);
      }

      await fetchBillingOverview();
    } catch (err) {
      console.error('Error canceling subscription:', err);
      setError(err.message);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  if (error) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-600">{error}</div>;

  const { subscription, credits, recentUsage, recentInvoices } = billingOverview;
  const currentPlan = subscription?.planTier ? PRICING_CONFIG[subscription.planTier] : null;

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
        {/* Current Plan */}
        <section className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-semibold mb-2">
                {currentPlan ? `${currentPlan.name} Plan` : 'No Active Plan'}
              </h2>
              {subscription && (
                <p className="text-gray-600">
                  Next billing date: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
            {!isRecruitPro && (
              <div className="space-x-4">
                <button
                  onClick={handleManageSubscription}
                  className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50"
                >
                  Manage Subscription
                </button>
                {!currentPlan && (
                  <button
                    onClick={() => handleUpgrade('pro', 'monthly')}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Upgrade Plan
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Credit Usage */}
          <div className="mt-8">
            <div className="flex justify-between mb-2 font-medium">
              <span>Credits Available</span>
              <span>{credits.toLocaleString()} credits</span>
            </div>
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${currentPlan ? (credits / currentPlan.credits) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </section>

        {/* Usage History */}
        <section className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">Recent Usage</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Description</th>
                <th className="text-left py-3 px-4">Credits</th>
                <th className="text-left py-3 px-4">Type</th>
              </tr>
            </thead>
            <tbody>
              {recentUsage.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="py-3 px-4">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">{entry.description}</td>
                  <td className="py-3 px-4">{Math.abs(entry.amount)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-sm ${
                      entry.type === 'credit' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {entry.type === 'credit' ? 'Added' : 'Used'}
                    </span>
                  </td>
                </tr>
              ))}
              {recentUsage.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-4 text-center text-gray-500">
                    No recent usage
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Billing History */}
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
              {recentInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-b">
                  <td className="py-3 px-4">
                    {new Date(invoice.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">{invoice.stripe_invoice_id}</td>
                  <td className="py-3 px-4">
                    ${(invoice.amount / 100).toFixed(2)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-sm ${
                      invoice.status === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <a
                      href={`${BACKEND}/api/billing/invoice/${invoice.stripe_invoice_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <span className="fa-solid fa-download"></span>
                    </a>
                  </td>
                </tr>
              ))}
              {recentInvoices.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-4 text-center text-gray-500">
                    No billing history
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Cancel Subscription */}
        {subscription && subscription.status !== 'canceled' && (
          <section className="mt-8 text-center">
            <button
              onClick={handleCancelSubscription}
              className="text-red-600 hover:text-red-700 font-medium"
            >
              Cancel Subscription
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
