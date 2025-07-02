// SigninScreen.jsx
import React, { useState } from 'react';
import { FaGoogle, FaLinkedin, FaCircleCheck, FaCircleExclamation, FaMicrosoft } from 'react-icons/fa6';
import { supabase } from '../lib/supabase'; // make sure this is imported at the top
import { useNavigate } from 'react-router-dom';

export default function SigninScreen() {
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(true);
      setSuccess(false);
    } else {
      setError(false);
      setSuccess(true);
      // Optional: redirect to dashboard
      navigate("/dashboard");
    }
  };

// OAuth sign-in handlers
const handleGoogleSignin = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/dashboard` }
  });
};
const handleMicrosoftSignin = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: { redirectTo: `${window.location.origin}/dashboard` }
  });
};

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #f0f7ff 100%)' }}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex items-center space-x-2">
            <img src="/logo.png" className="w-8 h-8" alt="HirePilot" />
            <h1 className="text-3xl font-bold text-gray-900">HirePilot</h1>
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold leading-9 text-gray-900">Sign in to your account</h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <a href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500 cursor-pointer">Sign up</a>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-8 py-10 shadow-lg sm:rounded-2xl sm:px-10 flex flex-col items-center">
          {/* OAuth Buttons */}
          <div className="space-y-4 mb-6 w-full">
            <button type="button" onClick={handleGoogleSignin} className="w-full flex justify-center items-center gap-3 bg-white px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
              <FaGoogle className="text-[20px]" /> Sign in with Google
            </button>
            <button type="button" onClick={handleMicrosoftSignin} className="w-full flex justify-center items-center gap-3 bg-white px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
              <FaMicrosoft className="text-[20px] text-blue-600" /> Sign in with Outlook/365
            </button>
          </div>
          <div className="relative my-6 w-full">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">Or sign in with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 w-full">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input id="email" name="email" type="email" required placeholder="you@company.com" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition text-sm bg-gray-50" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input id="password" name="password" type="password" required placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition text-sm bg-gray-50" />
            </div>

            <button type="submit" className="w-full flex justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500 transition">
              Sign in
            </button>
          </form>

          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-4">
              <div className="flex">
                <FaCircleExclamation className="text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Invalid credentials</h3>
                  <p className="text-sm text-red-700 mt-1">Please check your email and password.</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-md bg-green-50 p-4">
              <div className="flex">
                <FaCircleCheck className="text-green-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Signed in successfully</h3>
                  <p className="text-sm text-green-700 mt-1">Redirecting to your dashboard...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
