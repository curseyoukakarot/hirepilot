import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';

function getCookie(name: string): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie ? document.cookie.split(';') : [];
    for (const cookie of cookies) {
      const [k, ...rest] = cookie.trim().split('=');
      if (k === name) return rest.join('=');
    }
    return null;
  } catch {
    return null;
  }
}

function setCookie(name: string, value: string, opts?: { maxAgeSeconds?: number; domain?: string }) {
  try {
    if (typeof document === 'undefined') return;
    const maxAge = typeof opts?.maxAgeSeconds === 'number' ? `; Max-Age=${opts.maxAgeSeconds}` : '';
    const domain = opts?.domain ? `; Domain=${opts.domain}` : '';
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${value}; Path=/; SameSite=Lax${secure}${domain}${maxAge}`;
  } catch {}
}

function deleteCookie(name: string, opts?: { domain?: string }) {
  setCookie(name, 'deleted', { maxAgeSeconds: 0, domain: opts?.domain });
}

export default function ImpersonationBanner({ offsetTop = 0 }: { offsetTop?: number }) {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalSession, setOriginalSession] = useState<{ access_token: string; refresh_token: string } | null>(null);

  useEffect(() => {
    // Check if we're currently impersonating
    // Prefer cross-subdomain cookie (works between app.thehirepilot.com <-> jobs.thehirepilot.com)
    const cookie = getCookie('hp_super_admin_session');
    if (cookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(cookie));
        const access_token = parsed?.access_token || parsed?.a;
        const refresh_token = parsed?.refresh_token || parsed?.r;
        if (access_token && refresh_token) {
          setIsImpersonating(true);
          setOriginalSession({ access_token, refresh_token });
          return;
        }
      } catch {}
    }

    // Back-compat (older localStorage format used by earlier implementation)
    try {
      const storedSession = localStorage.getItem('superAdminSession');
      if (!storedSession) return;
      const parsed = JSON.parse(storedSession);
      const access_token = parsed?.data?.session?.access_token;
      const refresh_token = parsed?.data?.session?.refresh_token;
      if (access_token && refresh_token) {
        setIsImpersonating(true);
        setOriginalSession({ access_token, refresh_token });
      }
    } catch {}
  }, []);

  const exitImpersonation = async () => {
    try {
      const rootDomain =
        typeof window !== 'undefined' && window.location.hostname.endsWith('thehirepilot.com')
          ? '.thehirepilot.com'
          : undefined;
      const host = typeof window !== 'undefined' ? window.location.hostname : '';

      const cookie = getCookie('hp_super_admin_session');
      let access_token: string | undefined;
      let refresh_token: string | undefined;

      if (cookie) {
        try {
          const parsed = JSON.parse(decodeURIComponent(cookie));
          access_token = parsed?.access_token || parsed?.a;
          refresh_token = parsed?.refresh_token || parsed?.r;
        } catch {}
      }

      if (!access_token || !refresh_token) {
        // Fallback: legacy localStorage format
        try {
          const storedSession = localStorage.getItem('superAdminSession');
          if (storedSession) {
            const parsed = JSON.parse(storedSession);
            access_token = parsed?.data?.session?.access_token;
            refresh_token = parsed?.data?.session?.refresh_token;
          }
        } catch {}
      }

      if (!access_token || !refresh_token) {
        toast.error('Missing original session; please sign in again.');
        return;
      }

      const returnToRaw = getCookie('hp_super_admin_return');

      // IMPORTANT:
      // When exiting impersonation from jobs.*, do NOT attempt to set the super admin session on the jobs origin.
      // jobs.* uses a different storage key and may immediately call /auth/v1/user with a stale/invalid session_id,
      // producing a 403 session_not_found. Instead, clear the current (job seeker) local session and hand off to app.*
      // using hp_restore_once, then restore on app.thehirepilot.com/auth/callback.
      if (host.startsWith('jobs.')) {
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {}

        // Clear impersonation markers (so banner disappears)
        try {
          localStorage.removeItem('superAdminSession');
        } catch {}
        deleteCookie('hp_super_admin_session', { domain: rootDomain });
        deleteCookie('hp_super_admin_return', { domain: rootDomain });

        setIsImpersonating(false);
        setOriginalSession(null);

        const payload = encodeURIComponent(JSON.stringify({ access_token, refresh_token }));
        setCookie('hp_restore_once', payload, { maxAgeSeconds: 60 * 5, domain: rootDomain });

        let dest = 'https://app.thehirepilot.com/auth/callback?from=%2Fdashboard';
        try {
          if (returnToRaw) {
            const returnTo = decodeURIComponent(returnToRaw);
            const u = new URL(returnTo);
            const from = `${u.pathname}${u.search}${u.hash || ''}` || '/dashboard';
            dest = `${u.origin}/auth/callback?from=${encodeURIComponent(from)}&handoff=app`;
          }
        } catch {}
        if (!dest.includes('handoff=')) dest = `${dest}${dest.includes('?') ? '&' : '?'}handoff=app`;
        window.location.href = dest;
        return;
      }

      // Restore the original super admin session on THIS origin (app.*).
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) {
        console.error('Error restoring session:', error);
        toast.error('Failed to restore original session');
        return;
      }

      // Clear impersonation markers
      try {
        localStorage.removeItem('superAdminSession');
      } catch {}
      deleteCookie('hp_super_admin_session', { domain: rootDomain });
      deleteCookie('hp_super_admin_return', { domain: rootDomain });

      setIsImpersonating(false);
      setOriginalSession(null);

      // Same-origin restore: just refresh UI
      window.location.reload();
    } catch (error) {
      console.error('Error exiting impersonation:', error);
      toast.error('Failed to exit impersonation');
    }
  };

  if (!isImpersonating) return null;

  return (
    <div
      className="bg-red-600 text-white p-3 text-center fixed w-full z-50 shadow-lg"
      style={{ top: offsetTop }}
    >
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">You are impersonating another user</span>
        </div>
        <button
          onClick={exitImpersonation}
          className="px-4 py-2 bg-white text-red-600 rounded-md font-medium hover:bg-gray-100 transition-colors"
        >
          Exit Impersonation
        </button>
      </div>
    </div>
  );
}
