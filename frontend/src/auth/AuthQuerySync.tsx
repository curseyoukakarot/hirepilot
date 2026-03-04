import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { usePlan } from '../context/PlanContext';

const PUBLIC_PATH_PREFIXES = [
  '/login', '/signup', '/join', '/reset-password', '/auth/',
  '/copilot', '/enterprise', '/pricing', '/rex', '/rexsupport',
  '/chromeextension', '/terms', '/apidoc', '/test-gmail',
  '/affiliates', '/blog', '/producthunt', '/dfydashboard',
  '/freeforever', '/jobs/share', '/apply', '/use-cases',
  '/gtm-guide', '/gtm-strategy', '/partners', '/p/', '/f/',
  '/forms/public', '/accept-guest', '/signout',
];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PATH_PREFIXES.some(p => pathname.startsWith(p));
}

export default function AuthQuerySync() {
  const queryClient = useQueryClient();
  const { refresh } = usePlan();
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  const wasAuthRef = useRef(
    sessionStorage.getItem('hp_was_authenticated') === '1'
  );

  // Keep locationRef current so the listener closure always sees latest pathname
  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      const evt = String(event || '').toUpperCase();

      // Invalidate cached user/plan/credits/settings queries on auth state changes
      queryClient.invalidateQueries({
        predicate: (q) => {
          try {
            const key = JSON.stringify(q.queryKey || []).toLowerCase();
            return key.includes('user')
              || key.includes('plan')
              || key.includes('credit')
              || key.includes('me')
              || key.includes('settings');
          } catch {
            return false;
          }
        }
      });

      // Ensure PlanContext is refreshed promptly
      if (evt === 'SIGNED_IN' || evt === 'TOKEN_REFRESHED' || evt === 'USER_UPDATED' || evt === 'SIGNED_OUT') {
        // Give a tiny delay to allow session cookie sync to complete
        setTimeout(() => { refresh().catch(() => {}); }, 50);
      }

      // --- SESSION EXPIRY DETECTION ---

      // Track that the user was authenticated (survives page reloads via sessionStorage)
      if (evt === 'SIGNED_IN' || evt === 'TOKEN_REFRESHED') {
        wasAuthRef.current = true;
        try { sessionStorage.setItem('hp_was_authenticated', '1'); } catch {}
      }

      if (evt === 'SIGNED_OUT') {
        const wasAuth = wasAuthRef.current;
        wasAuthRef.current = false;
        try { sessionStorage.removeItem('hp_was_authenticated'); } catch {}

        // Check if this was an intentional sign-out (user clicked "Sign Out")
        let intentional = false;
        try {
          intentional = sessionStorage.getItem('hp_intentional_signout') === '1';
          sessionStorage.removeItem('hp_intentional_signout');
        } catch {}

        // Only show toast + redirect when:
        // 1. User was previously authenticated (not a first-visit)
        // 2. Sign-out was NOT intentional (session expired, not user action)
        // 3. User is on a protected page (not a public landing page)
        if (wasAuth && !intentional && !isPublicPath(locationRef.current)) {
          toast.error('Your session has expired. Please sign in again.', {
            duration: 4000,
            id: 'session-expired',
          });
          navigate('/login', { replace: true });
        }
      }
    });

    return () => { try { sub.subscription?.unsubscribe?.(); } catch {} };
  }, [queryClient, refresh, navigate]);

  return null;
}
