import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

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

function deleteCookie(name: string, opts?: { domain?: string }) {
  try {
    if (typeof document === 'undefined') return;
    const domain = opts?.domain ? `; Domain=${opts.domain}` : '';
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=deleted; Path=/; SameSite=Lax${secure}${domain}; Max-Age=0`;
  } catch {}
}

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let unsub: (() => void) | undefined;

    const apiBase =
      import.meta.env.VITE_BACKEND_URL ||
      (typeof window !== 'undefined' && window.location.host.endsWith('thehirepilot.com')
        ? 'https://api.thehirepilot.com'
        : 'http://localhost:8080');

    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const from = params.get('from') || '/dashboard';
    const app = params.get('app') || undefined;
    // Supabase may place `code` in either querystring or fragment depending on Site URL / redirects.
    const code =
      params.get('code') ||
      (() => {
        try {
          if (typeof window === 'undefined') return null;
          const raw = (window.location.hash || '').replace(/^#/, '');
          if (!raw) return null;
          const hp = new URLSearchParams(raw);
          return hp.get('code');
        } catch {
          return null;
        }
      })() ||
      undefined;
    const oauthError = params.get('error_description') || params.get('error') || undefined;
    const handoff = params.get('handoff') || undefined;
    const hasImplicitTokens =
      typeof window !== 'undefined' &&
      (() => {
        try {
          const raw = (window.location.hash || '').replace(/^#/, '');
          return raw.includes('access_token=') || raw.includes('refresh_token=') || raw.includes('code=');
        } catch {
          return false;
        }
      })();

    const isJobSeekerFromSession = (session: any): boolean => {
      try {
        const meta = session?.user?.user_metadata || {};
        const v = String(meta.account_type || meta.plan || meta.role || '').toLowerCase();
        return v === 'job_seeker' || v.startsWith('job_seeker_') || v.startsWith('jobseeker');
      } catch {
        return false;
      }
    };

    const redirect = async (session?: any) => {
      try {
        if (typeof window !== 'undefined') {
          const host = window.location.hostname || '';
          const isJobSeeker = String(app || '').toLowerCase() === 'job_seeker' || isJobSeekerFromSession(session);
          const isOnApp = host.startsWith('app.');
          const isOnJobs = host.startsWith('jobs.');

          // If we authenticated on the app domain but we need to land in jobs.*, perform a one-time handoff.
          const effectiveHandoff = handoff || (isJobSeeker ? 'jobs' : 'app');

          if (effectiveHandoff === 'jobs' && isJobSeeker && !isOnJobs) {
            const rootDomain = host.endsWith('thehirepilot.com') ? '.thehirepilot.com' : undefined;
            const access_token = session?.access_token;
            const refresh_token = session?.refresh_token;
            if (access_token && refresh_token) {
              const payload = encodeURIComponent(JSON.stringify({ access_token, refresh_token }));
              // 5 minute handoff window
              document.cookie = `hp_restore_once=${payload}; Path=/; SameSite=Lax;${window.location.protocol === 'https:' ? ' Secure;' : ''}${rootDomain ? ` Domain=${rootDomain};` : ''} Max-Age=${60 * 5}`;
            }
            const dest = `https://jobs.thehirepilot.com/auth/callback?from=${encodeURIComponent(from)}&app=job_seeker&forceBootstrap=1`;
            window.location.href = dest;
            return;
          }

          // If we authenticated on the marketing/root domain (or jobs) but need to land in app.*, handoff.
          if (effectiveHandoff === 'app' && !isOnApp) {
            const rootDomain = host.endsWith('thehirepilot.com') ? '.thehirepilot.com' : undefined;
            const access_token = session?.access_token;
            const refresh_token = session?.refresh_token;
            if (access_token && refresh_token) {
              const payload = encodeURIComponent(JSON.stringify({ access_token, refresh_token }));
              document.cookie = `hp_restore_once=${payload}; Path=/; SameSite=Lax;${window.location.protocol === 'https:' ? ' Secure;' : ''}${rootDomain ? ` Domain=${rootDomain};` : ''} Max-Age=${60 * 5}`;
            }
            const dest = `https://app.thehirepilot.com/auth/callback?from=${encodeURIComponent(from)}`;
            window.location.href = dest;
            return;
          }
        }
      } catch {
        // fall through to navigate
      }
      navigate(from, { replace: true });
    };

    const bootstrap = async (token: string) => {
      try {
        await fetch(`${apiBase.replace(/\/$/, '')}/api/auth/bootstrap`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(app ? { app } : {}),
        });
      } catch (err) {
        console.warn('[auth callback] bootstrap failed', err);
      }
    };

    const trySeedSessionFromUrl = async (): Promise<void> => {
      if (typeof window === 'undefined') return;

      // 1) If Supabase redirected with `code=...` (PKCE), exchange it explicitly.
      if (code) {
        // Clear any stale local session before exchanging.
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {}
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.warn('[auth callback] exchangeCodeForSession failed', error);
        } else if (data?.session?.access_token) {
          await bootstrap(data.session.access_token);
          await redirect(data.session);
          return;
        }
      }

      // 2) Handle implicit hash tokens defensively (older flows / edge cases).
      try {
        const hash = window.location.hash || '';
        const raw = hash.replace(/^#/, '');
        if (raw.includes('access_token=') || raw.includes('refresh_token=')) {
          const hp = new URLSearchParams(raw);
          const access_token = hp.get('access_token') || undefined;
          const refresh_token = hp.get('refresh_token') || undefined;
          if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (!error && data?.session?.access_token) {
              await bootstrap(data.session.access_token);
              await redirect(data.session);
            }
          }
        }
      } catch {}
    };

    (async () => {
      try {
        // If this is an auth callback or one-time restore, proactively clear any local cached session first.
        // This avoids Supabase calling /auth/v1/user with a stale JWT whose session_id no longer exists.
        // NOTE: Only do this when auth params/restore markers exist so we don't log out normal users.
        const shouldClearLocal =
          !!code || !!oauthError || !!handoff || hasImplicitTokens || (typeof document !== 'undefined' && !!getCookie('hp_restore_once'));
        if (shouldClearLocal) {
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {}
        }

        // Cross-domain restore: jobs.* -> app.* needs a one-time session seed.
        if (typeof window !== 'undefined') {
          const rootDomain = window.location.hostname.endsWith('thehirepilot.com') ? '.thehirepilot.com' : undefined;
          const restore = getCookie('hp_restore_once');
          if (restore) {
            try {
              const parsed = JSON.parse(decodeURIComponent(restore));
              const access_token = parsed?.access_token;
              const refresh_token = parsed?.refresh_token;
              if (access_token && refresh_token) {
                await supabase.auth.setSession({ access_token, refresh_token });
              }
            } catch {}
            deleteCookie('hp_restore_once', { domain: rootDomain });
          }
        }

        if (oauthError) {
          console.warn('[auth callback] provider error', oauthError);
        }

        // Ensure we try to seed session from callback params immediately (PKCE-safe).
        await trySeedSessionFromUrl();

        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) {
          await bootstrap(data.session.access_token);
          await redirect(data.session);
          return;
        }
      } catch {
        // fall through to listener
      }

      const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.access_token) {
          await bootstrap(session.access_token);
          await redirect(session);
        }
      });
      unsub = () => listener?.subscription?.unsubscribe?.();
    })();

    return () => {
      if (unsub) unsub();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="flex items-center gap-3 text-slate-200">
        <svg className="animate-spin h-5 w-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
          <circle className="opacity-25" cx="12" cy="12" r="10" />
          <path className="opacity-75" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span>Completing sign in…</span>
      </div>
    </div>
  );
}
