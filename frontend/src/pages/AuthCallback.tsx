import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

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
          body: JSON.stringify({}),
        });
      } catch (err) {
        console.warn('[auth callback] bootstrap failed', err);
      }
    };

    (async () => {
      try {
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
        if (event === 'SIGNED_IN' && session?.access_token) {
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
