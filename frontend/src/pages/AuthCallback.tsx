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
    const code = params.get('code') || undefined;
    const oauthError = params.get('error_description') || params.get('error') || undefined;

    const redirect = () => {
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
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.warn('[auth callback] exchangeCodeForSession failed', error);
        } else if (data?.session?.access_token) {
          await bootstrap(data.session.access_token);
          redirect();
          return;
        }
      }

      // 2) Handle implicit hash tokens defensively (older flows / edge cases).
      try {
        const hash = window.location.hash || '';
        if (hash.includes('access_token=')) {
          const hp = new URLSearchParams(hash.replace(/^#/, ''));
          const access_token = hp.get('access_token') || undefined;
          const refresh_token = hp.get('refresh_token') || undefined;
          if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (!error && data?.session?.access_token) {
              await bootstrap(data.session.access_token);
              redirect();
            }
          }
        }
      } catch {}
    };

    (async () => {
      try {
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
          redirect();
          return;
        }
      } catch {
        // fall through to listener
      }

      const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.access_token) {
          await bootstrap(session.access_token);
          redirect();
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
