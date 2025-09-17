import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaBriefcase, FaGoogle, FaLinkedin, FaCircleCheck, FaCircleExclamation, FaMicrosoft } from 'react-icons/fa6';
import { supabase } from '../lib/supabaseClient';
import { apiPost } from '../lib/api';
import { toast } from 'react-hot-toast';
import { usePlan } from '../context/PlanContext';

export default function SignupScreen() {
  const { refresh } = usePlan();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const urlParams = new URLSearchParams(window.location.search);
  const checkoutSessionId = urlParams.get('session_id');
  const planParam = urlParams.get('plan');

  // Allow direct signup; default to free plan if no Stripe session
  useEffect(() => {
    // Keep page accessible; no redirect
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const firstName = e.target['first-name'].value;
    const lastName = e.target['last-name'].value;
    const email = e.target.email.value;
    const password = e.target.password.value;
    const company = e.target.company?.value || '';
    const linkedinUrl = e.target.linkedin_url?.value || '';

    // Step 1: Create user via backend (email_confirm true)
    let userId;
    try {
      const created = await apiPost('/api/auth/signup', {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        metadata: {
          company,
          linkedin_url: linkedinUrl
        }
      }, { requireAuth: false });
      userId = created?.user?.id;
    } catch (err) {
      console.error('Backend signup error:', err);
      setError(err.message || 'Signup failed');
      return;
    }

    if (!userId) {
      setError('Signup succeeded but no user ID returned.');
      return;
    }

    // Create user profile row with plan assignment (free by default when not via Stripe)
    try {
      const assignedPlan = (planParam === 'free' || !checkoutSessionId) ? 'free' : (planParam || 'free');
      await apiPost('/api/createUser', {
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        company,
        linkedin_url: linkedinUrl,
        plan: assignedPlan,
      }, { requireAuth: false });
    } catch (err) {
      console.error('createUser error (non-blocking):', err);
    }

    // Step 2: Sign the user in immediately (session created client-side)
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;
    } catch (err) {
      console.error('Immediate sign-in failed:', err);
      // Continue; user can sign in manually
    }

    // Step 3: Send Slack notification (non-blocking)
    try {
      await apiPost('/api/sendSlackNotification', {
        event_type: 'user_signed_up',
        user_email: email,
      }, { requireAuth: false });
    } catch (err) {
      console.error('Slack notification error:', err);
    }

    // If signup originated from Stripe Checkout, link the session to this user
    if (checkoutSessionId) {
      try {
        await apiPost('/api/stripe/link-session', {
          sessionId: checkoutSessionId,
          userId: userId
        });
      } catch (err) {
        console.error('link session error', err);
      }
    }

    setSuccess(true);
    // Refresh plan context and navigate into app
    try { await refresh(); } catch {}
    navigate('/dashboard');

    // Attempt to grant Product Hunt promo credits if cookie present
    try {
      if (document.cookie.includes('hp_ref=ph')) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/promotions/grant-ph', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
            credentials: 'include'
          });
        }
      }
    } catch (err) {
      console.warn('PH promo grant failed (non-blocking)', err);
    }
  };

  // OAuth signup handlers
  const handleGoogleSignup = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    });
  };
  const handleMicrosoftSignup = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    });
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #f0f7ff 100%)' }}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center space-x-2">
          <img src="/logo.png" className="w-8 h-8" alt="HirePilot" />
          <h1 className="text-3xl font-bold text-gray-900">HirePilot</h1>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">Create your account</h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">Sign in</a>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-8 py-10 shadow-lg sm:rounded-2xl sm:px-10 flex flex-col items-center">
          {/* OAuth Buttons */}
          <div className="space-y-4 mb-6 w-full">
            <button type="button" onClick={handleGoogleSignup} className="w-full flex justify-center items-center gap-3 bg-white px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
              <FaGoogle className="text-[20px]" /> Sign up with Google
            </button>
            <button type="button" onClick={handleMicrosoftSignup} className="w-full flex justify-center items-center gap-3 bg-white px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
              <FaMicrosoft className="text-[20px] text-blue-600" /> Sign up with Outlook/365
            </button>
          </div>
          <div className="relative my-6 w-full">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">Or sign up with email</span>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6 w-full">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input id="first-name" name="first-name" type="text" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition text-sm bg-gray-50" />
              </div>
              <div>
                <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input id="last-name" name="last-name" type="text" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition text-sm bg-gray-50" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input id="company" name="company" type="text" placeholder="Company name (optional)" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition text-sm bg-gray-50" />
              </div>
              <div>
                <label htmlFor="linkedin_url" className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Profile URL</label>
                <input id="linkedin_url" name="linkedin_url" type="url" placeholder="https://www.linkedin.com/in/username" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition text-sm bg-gray-50" />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Work email</label>
              <input id="email" name="email" type="email" required placeholder="you@company.com" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition text-sm bg-gray-50" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input id="password" name="password" type="password" required placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition text-sm bg-gray-50" />
            </div>

            <div className="flex items-center">
              <input id="terms" name="terms" type="checkbox" required className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <label htmlFor="terms" className="ml-2 block text-sm text-gray-900">
                I agree to the <span className="text-indigo-600 hover:text-indigo-500">Terms</span> and <span className="text-indigo-600 hover:text-indigo-500">Privacy Policy</span>
              </label>
            </div>

            <button type="submit" className="w-full flex justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500 transition">
              Create account
            </button>
          </form>

          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-4 flex">
              <FaCircleExclamation className="text-red-400 mt-1" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-md bg-green-50 p-4 flex">
              <FaCircleCheck className="text-green-400 mt-1" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Account created successfully!</h3>
                <p className="text-sm text-green-700 mt-1">You're being redirected…</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
