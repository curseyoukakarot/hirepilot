// SigninScreen.jsx
import React, { useState, useEffect } from 'react';
import { FaGoogle, FaLinkedin, FaCircleCheck, FaCircleExclamation, FaMicrosoft } from 'react-icons/fa6';
import { supabase } from '../lib/supabaseClient'; // make sure this is imported at the top
import { useNavigate } from 'react-router-dom';

export default function SigninScreen() {
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passcodeLoading, setPasscodeLoading] = useState(false);
  const [passcodeSent, setPasscodeSent] = useState(false);
  const [passcodeError, setPasscodeError] = useState('');
  // Default ON so UI is visible even if env not set; backend still gated by its flags
  const enablePasscode = String((import.meta?.env && import.meta.env.VITE_ENABLE_PASSCODE_AUTH) || 'true').toLowerCase() === 'true';
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get('email');
    if (e) setEmail(e);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = String(e.target.email.value || '').trim().toLowerCase();
    const password = String(e.target.password.value || '');

    const base = (import.meta.env.VITE_BACKEND_URL || (window.location.host.endsWith('thehirepilot.com') ? 'https://api.thehirepilot.com' : 'http://localhost:8080')).replace(/\/$/, '');
    let { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error && String(error.message || '').toLowerCase().includes('invalid')) {
      try {
        await fetch(`${base}/api/guest-upsert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        const retry = await supabase.auth.signInWithPassword({ email, password });
        error = retry.error;
      } catch {}
    }

    if (error) { setError(true); setSuccess(false); return; }
    setError(false);
    setSuccess(true);
    const paramsNext = new URLSearchParams(window.location.search);
    const next = paramsNext.get('next');
    if (next) navigate(next); else navigate('/dashboard');
  };

  const handleMagicLink = async () => {
    if (!enablePasscode) return;
    try {
      setPasscodeError('');
      setPasscodeLoading(true);
      const emailInput = (document.getElementById('email') && document.getElementById('email').value) ? String(document.getElementById('email').value).trim().toLowerCase() : '';
      const targetEmail = emailInput || email;
      if (!targetEmail) { setPasscodeError('Enter your email first.'); return; }
      const base = (import.meta.env.VITE_BACKEND_URL || (window.location.host.endsWith('thehirepilot.com') ? 'https://api.thehirepilot.com' : 'http://localhost:8080')).replace(/\/$/, '');
      const res = await fetch(`${base}/api/auth/passcode/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
        credentials: 'include'
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to request magic link');
      }
      setPasscodeSent(true);
    } catch (e) {
      setPasscodeError(e?.message || 'Failed to request magic link');
    } finally {
      setPasscodeLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    if (!enablePasscode || !otpCode.trim()) return;
    try {
      setPasscodeError('');
      setOtpError('');
      setOtpLoading(true);
      const backend = (import.meta.env.VITE_BACKEND_URL || (window.location.host.endsWith('thehirepilot.com') ? 'https://api.thehirepilot.com' : 'http://localhost:8080')).replace(/\/$/, '');
      const emailInput = (document.getElementById('email') && document.getElementById('email').value) ? String(document.getElementById('email').value).trim().toLowerCase() : '';
      const res = await fetch(`${backend}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, code: otpCode.trim() })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to verify code');
      }
      // On success, redirect to app
      const redirect = import.meta?.env?.VITE_APP_WEB_URL || import.meta?.env?.VITE_FRONTEND_URL || window.location.origin;
      window.location.href = redirect;
    } catch (e) {
      setOtpError(e?.message || 'Failed to verify code');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpRequest = async () => {
    if (!enablePasscode) return;
    try {
      setOtpError('');
      setOtpLoading(true);
      const base = (import.meta.env.VITE_BACKEND_URL || (window.location.host.endsWith('thehirepilot.com') ? 'https://api.thehirepilot.com' : 'http://localhost:8080')).replace(/\/$/, '');
      const emailInput = (document.getElementById('email') && document.getElementById('email').value) ? String(document.getElementById('email').value).trim().toLowerCase() : '';
      if (!emailInput) { setOtpError('Enter your email first.'); return; }
      const res = await fetch(`${base}/api/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput }),
        credentials: 'include'
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to send code');
      }
      setOtpSent(true);
    } catch (e) {
      setOtpError(e?.message || 'Failed to send code');
    } finally {
      setOtpLoading(false);
    }
  };

// OAuth sign-in handlers
const resolveRedirect = () => (import.meta?.env?.VITE_APP_WEB_URL || import.meta?.env?.VITE_FRONTEND_URL || `${window.location.origin}/dashboard`);
const handleGoogleSignin = async () => {
  try {
    setOauthLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: resolveRedirect() }
    });
  } finally {
    setOauthLoading(false);
  }
};
const handleMicrosoftSignin = async () => {
  try {
    setOauthLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: { redirectTo: resolveRedirect() }
    });
  } finally {
    setOauthLoading(false);
  }
};

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0b0f17] via-[#0e1420] to-[#0b0f17]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex items-center space-x-2">
            <img src="/logo.png" className="w-8 h-8" alt="HirePilot" />
            <h1 className="text-3xl font-bold text-gray-100">HirePilot</h1>
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold leading-9 text-gray-100">Sign in to your account</h2>
        {/* Sign-up link removed to direct users through pricing page */}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-gray-900/80 border border-gray-700 px-8 py-10 shadow-2xl sm:rounded-2xl sm:px-10 flex flex-col items-center">
          {/* OAuth Buttons (visible by default; can disable with VITE_ENABLE_OAUTH=false) */}
          {String((import.meta?.env && import.meta.env.VITE_ENABLE_OAUTH) || 'true').toLowerCase() === 'true' && (
            <div className="space-y-4 mb-6 w-full">
              <button type="button" onClick={handleGoogleSignin} disabled={oauthLoading} className="w-full flex justify-center items-center gap-3 bg-gray-800 px-4 py-3 border border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-200 hover:bg-gray-700 disabled:opacity-60">
                <FaGoogle className="text-[20px]" /> {oauthLoading ? 'Redirecting…' : 'Sign in with Google'}
              </button>
              <button type="button" onClick={handleMicrosoftSignin} disabled={oauthLoading} className="w-full flex justify-center items-center gap-3 bg-gray-800 px-4 py-3 border border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-200 hover:bg-gray-700 disabled:opacity-60">
                <FaMicrosoft className="text-[20px] text-blue-600" /> {oauthLoading ? 'Redirecting…' : 'Sign in with Outlook/365'}
              </button>
            </div>
          )}
          <div className="relative my-6 w-full">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-gray-900/80 px-2 text-gray-400">Or sign in with email</span>
            </div>
          </div>

          {enablePasscode && (
            <div className="w-full mb-4 space-y-4">
              {/* Magic Link */}
              <div>
                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={passcodeLoading}
                  className="w-full flex justify-center items-center gap-3 bg-indigo-50 px-4 py-3 border border-indigo-200 rounded-md text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                >
                  {passcodeLoading ? 'Sending magic link…' : 'Continue with Email (Magic Link)'}
                </button>
                {passcodeSent && (
                  <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700">Check your inbox for a secure sign-in link.</div>
                )}
                {passcodeError && (
                  <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{passcodeError}</div>
                )}
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-gray-900/80 px-2 text-gray-500">or</span></div>
              </div>

              {/* OTP Code Sign-in */}
              <div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleOtpRequest}
                    disabled={otpLoading}
                    className="flex-1 flex justify-center items-center gap-3 bg-white px-4 py-3 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {otpLoading ? 'Sending code…' : 'Email me a 6‑digit code'}
                  </button>
                </div>
                {otpSent && (
                  <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700">We emailed you a 6‑digit code. Enter it below.</div>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0,6))}
                    placeholder="Enter 6‑digit code"
                    className="flex-1 px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition text-sm bg-gray-800 text-gray-200 placeholder-gray-400 tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={handleOtpVerify}
                    disabled={otpLoading || !otpCode}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    Verify code
                  </button>
                </div>
                {otpError && (
                  <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{otpError}</div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 w-full">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email address</label>
              <input id="email" name="email" type="email" required placeholder="you@company.com" className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition text-sm bg-gray-800 text-gray-200 placeholder-gray-400" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <input id="password" name="password" type="password" required placeholder="••••••••" className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition text-sm bg-gray-800 text-gray-200 placeholder-gray-400" />
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-sm text-indigo-400 hover:text-indigo-300 underline"
                >
                  Forgot password?
                </button>
              </div>
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

          {/* Affiliate partners CTA */}
          <div className="mt-6 text-center text-sm text-gray-400">
            <span>Affiliate Partners: </span>
            <a href="/partners/login" className="text-indigo-400 hover:text-indigo-300 underline">Sign in here</a>
          </div>
        </div>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowResetModal(false)} />
          <div className="relative bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-100">Reset your password</h3>
            <p className="mt-1 text-sm text-gray-400">Enter your account email. We'll send a secure link to reset your password.</p>

            {!resetSent ? (
              <form
                className="mt-4 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setResetError('');
                  setResetLoading(true);
                  try {
                    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (resetErr) {
                      setResetError(resetErr.message || 'Failed to send reset email.');
                    } else {
                      setResetSent(true);
                    }
                  } finally {
                    setResetLoading(false);
                  }
                }}
              >
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="reset-email">Email</label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition text-sm bg-gray-800 text-gray-200 placeholder-gray-400"
                  />
                </div>
                {resetError && (
                  <div className="rounded-md bg-red-900/30 border border-red-800 p-3 text-sm text-red-300">{resetError}</div>
                )}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button type="button" className="text-sm text-gray-300 hover:text-gray-200" onClick={() => setShowResetModal(false)}>Cancel</button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {resetLoading ? 'Sending…' : 'Send reset link'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-md bg-green-900/30 border border-green-800 p-3 text-sm text-green-300">
                  We sent a password reset link to {resetEmail}. Check your inbox.
                </div>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    onClick={() => setShowResetModal(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
