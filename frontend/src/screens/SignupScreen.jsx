import React, { useState } from 'react';
import { FaBriefcase, FaGoogle, FaLinkedin, FaCircleCheck, FaCircleExclamation, FaMicrosoft } from 'react-icons/fa6';
import { supabase } from '../lib/supabase';
import { apiPost } from '../lib/api';
import { toast } from 'react-hot-toast';

export default function SignupScreen() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const checkoutSessionId = urlParams.get('session_id');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const firstName = e.target['first-name'].value;
    const lastName = e.target['last-name'].value;
    const email = e.target.email.value;
    const password = e.target.password.value;

    // Step 1: Sign up user in Supabase auth
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          onboarding_complete: false,
        },
      },
    });

    if (signupError) {
      console.error('Signup error:', signupError);
      setError(signupError.message);
      return;
    }

    const userId = signupData?.user?.id;
    if (!userId) {
      setError('Signup succeeded but no user ID returned.');
      return;
    }

    // User row will now be created automatically via a database trigger

    // Step 2: Send Slack notification (non-blocking)
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
                <p className="text-sm text-green-700 mt-1">Please check your email to verify your account.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
