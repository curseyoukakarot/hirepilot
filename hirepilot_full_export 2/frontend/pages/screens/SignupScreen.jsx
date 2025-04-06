import React, { useState } from 'react';
import { FaBriefcase, FaGoogle, FaLinkedin, FaCircleCheck, FaCircleExclamation } from 'react-icons/fa6';

export default function SignupScreen() {
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Replace with real signup logic
    const alreadyExists = false; // simulate
    if (alreadyExists) {
      setError(true);
      setSuccess(false);
    } else {
      setError(false);
      setSuccess(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex items-center space-x-2">
            <FaBriefcase className="text-indigo-600 text-3xl" />
            <h1 className="text-3xl font-bold text-gray-900">HirePilot</h1>
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold leading-9 text-gray-900">Create your account</h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <span className="font-medium text-indigo-600 hover:text-indigo-500 cursor-pointer">Sign in</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-4">
            <button className="w-full flex justify-center items-center gap-3 bg-white px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
              <FaGoogle className="text-[20px]" /> Sign up with Google
            </button>
            <button className="w-full flex justify-center items-center gap-3 bg-[#0A66C2] px-4 py-3 border border-[#0A66C2] rounded-md shadow-sm text-sm font-medium text-white hover:bg-[#004182]">
              <FaLinkedin className="text-[20px]" /> Sign up with LinkedIn
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">Or sign up with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first-name" className="block text-sm font-medium text-gray-700">First name</label>
                <input id="first-name" name="first-name" type="text" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
              </div>
              <div>
                <label htmlFor="last-name" className="block text-sm font-medium text-gray-700">Last name</label>
                <input id="last-name" name="last-name" type="text" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Work email</label>
              <input id="email" name="email" type="email" required placeholder="you@company.com" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <input id="password" name="password" type="password" required placeholder="••••••••" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
            </div>

            <div className="flex items-center">
              <input id="terms" name="terms" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <label htmlFor="terms" className="ml-2 block text-sm text-gray-900">
                I agree to the <span className="text-indigo-600 hover:text-indigo-500 cursor-pointer">Terms</span> and <span className="text-indigo-600 hover:text-indigo-500 cursor-pointer">Privacy Policy</span>
              </label>
            </div>

            <button type="submit" className="w-full flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600">
              Create account
            </button>
          </form>

          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-4">
              <div className="flex">
                <FaCircleExclamation className="text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error creating account</h3>
                  <p className="text-sm text-red-700 mt-1">This email is already registered. Please try signing in instead.</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-md bg-green-50 p-4">
              <div className="flex">
                <FaCircleCheck className="text-green-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Account created successfully!</h3>
                  <p className="text-sm text-green-700 mt-1">Please check your email to verify your account.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
