// BillingScreen.jsx (wired to Stripe usage + invoice fetch)
import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { PRICING_CONFIG } from '../config/pricing';
import { supabase } from '../lib/supabase';
import { usePlan } from '../context/PlanContext';

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
  const { refresh: refreshPlan, plan: planTier, isFree } = usePlan();
  const [billingOverview, setBillingOverview] = useState({
    subscription: null,
    credits: 0,
    recentUsage: [],
    recentInvoices: [],
    nextInvoice: null,
    seatUsage: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRecruitPro, setIsRecruitPro] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [creditInfo, setCreditInfo] = useState({
    totalCredits: 0,
    usedCredits: 0,
    remainingCredits: 0
  });

  const BACKEND = import.meta.env.VITE_BACKEND_URL;

  // Plan/role-based plan mapping
  const getRolePlanName = (role) => {
    if (isFree || String(planTier || '').toLowerCase() === 'free') return 'Free Plan';
    const planMap = {
      'member': 'Starter Plan',
      'admin': 'Pro Plan', 
      'team_admin': 'Team Plan',
      'RecruitPro': 'RecruitPro Plan',
      'super_admin': 'Admin Plan'
    };
    return planMap[role] || (planTier ? `${planTier[0].toUpperCase()}${planTier.slice(1)} Plan` : 'Starter Plan');
  };

  // Get plan/role-based credit limits
  const getRoleCreditLimit = (role) => {
    if (isFree || String(planTier || '').toLowerCase() === 'free') return 50;
    const creditLimits = {
      'member': 350,
      'admin': 1000,
      'team_admin': 5000,
      'RecruitPro': 1000,
      'super_admin': 10000
    };
    return creditLimits[role] || 350;
  };

  useEffect(() => {
    fetchBillingOverview();
    fetchUserRoleAndCredits();
  }, []);

  const fetchUserRoleAndCredits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user role from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user role:', userError);
        return;
      }

      const role = userData?.role || user?.user_metadata?.role || user?.user_metadata?.account_type || 'member';
      setUserRole(role);
      setIsRecruitPro(role === 'RecruitPro');

      // Get credit information with backend fallback
      let total = 0, used = 0, remaining = 0;
      try {
        const { data: creditData } = await supabase
          .from('user_credits')
          .select('total_credits, used_credits, remaining_credits')
          .eq('user_id', user.id)
          .maybeSingle();
        if (creditData) {
          total = Number(creditData.total_credits || 0);
          used = Number(creditData.used_credits || 0);
          remaining = Number(creditData.remaining_credits || 0);
        }
      } catch {}

      if (!total && !remaining) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const resp = await fetch(`${BACKEND}/api/credits/status`, {
            headers: { 'Authorization': `Bearer ${session?.access_token}` },
            credentials: 'include'
          });
          if (resp.ok) {
            const js = await resp.json();
            total = Number(js.total_credits || 0);
            used = Number(js.used_credits || 0);
            remaining = Number(js.remaining_credits || 0);
          }
        } catch {}
      }

      if (!total && !remaining) {
        const defaultCredits = getRoleCreditLimit(role);
        total = defaultCredits; remaining = defaultCredits; used = 0;
      }

      setCreditInfo({ totalCredits: total, usedCredits: used, remainingCredits: remaining });
    } catch (err) {
      console.error('Error fetching user data:', err);
    }
  };

  const fetchBillingOverview = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${BACKEND}/api/billing/overview`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch billing overview: ${errorText}`);
      }

      const data = await response.json();
      setBillingOverview({
        subscription: data.subscription,
        credits: data.credits || 0,
        recentUsage: data.recentUsage || [],
        recentInvoices: data.recentInvoices || [],
        nextInvoice: data.nextInvoice,
        seatUsage: data.seatUsage
      });
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

      // Resolve priceId from frontend config (ensures correct live/test ID is sent)
      const priceId = PRICING_CONFIG?.[planId]?.priceIds?.[interval];
      if (!priceId) {
        throw new Error(`Missing priceId for ${planId}/${interval}. Check VITE_STRIPE_PRICE_ID_* envs in frontend build.`);
      }

      const response = await fetch(`${BACKEND}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        credentials: 'include',
        body: JSON.stringify({ planId, interval, priceId })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create checkout session: ${errorText}`);
      }

      const { sessionId, url, livemode } = await response.json();

      // Prefer hosted Checkout URL redirect to avoid SDK init CSP/401 issues
      if (url) {
        window.location.href = url;
        return;
      }

      const stripe = await stripePromise;
      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) throw new Error(error.message);
    } catch (err) {
      console.error('Error creating checkout session:', err);
      setError(err.message);
    } finally {
      // After returning from checkout, refresh plan context next mount
      try { await refreshPlan(); } catch {}
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

  const { subscription, credits, recentUsage, recentInvoices, nextInvoice, seatUsage } = billingOverview;
  const currentPlan = subscription?.planTier ? PRICING_CONFIG[subscription.planTier] : (isFree ? { name: 'Free', credits: 50 } : null);
  
  // Calculate credit usage percentage for animation
  const creditUsagePercentage = creditInfo.totalCredits > 0 
    ? Math.min((creditInfo.usedCredits / creditInfo.totalCredits) * 100, 100)
    : 0;

  // Calculate remaining percentage for the "available" part of the bar
  const creditRemainingPercentage = creditInfo.totalCredits > 0
    ? Math.max(((creditInfo.totalCredits - creditInfo.usedCredits) / creditInfo.totalCredits) * 100, 0)
    : 100;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current Plan */}
        <section className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-semibold mb-2">
                {currentPlan ? `${currentPlan.name} Plan` : getRolePlanName(userRole)}
              </h2>
              {subscription && (
                <p className="text-gray-600">
                  Next billing date: {nextInvoice ? new Date(nextInvoice).toLocaleDateString() : '–'}
                </p>
              )}
            </div>
            {!isRecruitPro && !isFree && (
              <div className="space-x-4">
                <button
                  onClick={handleManageSubscription}
                  className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50"
                >
                  Manage Subscription
                </button>
              </div>
            )}
          </div>

          {/* Animated Credit Usage */}
          <div className="mt-8">
            <div className="flex justify-between mb-2 font-medium">
              <span>Credit Usage</span>
              <span>{creditInfo.usedCredits.toLocaleString()} / {creditInfo.totalCredits.toLocaleString()} used</span>
            </div>
            <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden mb-2">
              {/* Used credits bar (animated) */}
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all duration-1000 ease-out"
                style={{ 
                  width: `${creditUsagePercentage}%`,
                  animation: 'slideIn 1.5s ease-out'
                }}
              ></div>
              {/* Remaining credits bar (animated) */}
              <div
                className="absolute top-0 h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-1000 ease-out"
                style={{ 
                  left: `${creditUsagePercentage}%`,
                  width: `${creditRemainingPercentage}%`,
                  animation: 'slideIn 1.8s ease-out'
                }}
              ></div>
            </div>
            
            {/* Credit status indicators */}
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gradient-to-r from-red-500 to-orange-500 rounded-full mr-2"></div>
                  <span className="text-gray-600">Used: {creditInfo.usedCredits.toLocaleString()}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-green-500 rounded-full mr-2"></div>
                  <span className="text-gray-600">Available: {creditInfo.remainingCredits.toLocaleString()}</span>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                creditUsagePercentage > 90 
                  ? 'bg-red-100 text-red-800' 
                  : creditUsagePercentage > 75 
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
              }`}>
                {creditUsagePercentage > 90 ? 'Critical' : creditUsagePercentage > 75 ? 'High Usage' : 'Healthy'}
              </span>
            </div>

            {/* Seat Usage */}
            {seatUsage && (
              <div className="mt-6">
                <div className="flex justify-between mb-2 font-medium">
                  <span>Seats Used</span>
                  <span>{seatUsage.used} / {seatUsage.included} seats</span>
                </div>
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ 
                      width: `${seatUsage.included ? Math.min((seatUsage.used / seatUsage.included) * 100, 100) : 0}%`,
                      animation: 'slideIn 2s ease-out'
                    }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Upgrade Section */}
        {(isFree || !currentPlan) && (
          <section className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Upgrade Plan</h2>
            <p className="text-gray-600 mb-6">Choose a plan and billing cycle. Your data remains intact; premium features unlock immediately after checkout.</p>
            <div className="grid md:grid-cols-3 gap-6">
              {(['starter','pro','team']).map((planId) => (
                <div key={planId} className="border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold capitalize">{PRICING_CONFIG[planId].name}</h3>
                    <span className="text-sm text-gray-500">{PRICING_CONFIG[planId].credits.toLocaleString()} credits/mo</span>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-2 mb-4 list-disc pl-5">
                    {PRICING_CONFIG[planId].features.slice(0,3).map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleUpgrade(planId, 'monthly')} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Monthly</button>
                    <button onClick={() => handleUpgrade(planId, 'annual')} className="flex-1 bg-gray-100 text-gray-800 py-2 rounded-lg hover:bg-gray-200">Annual</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
      
      {/* Add CSS animation styles */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            width: 0%;
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }
        
        .animate-pulse-subtle {
          animation: pulse 2s infinite;
        }
      `}</style>
    </div>
  );
}
