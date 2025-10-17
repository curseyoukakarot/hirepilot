import { supabase } from '../lib/supabaseClient';

function isEnabled(): boolean {
  try {
    // Only enable when explicitly set to 'true'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flag = (import.meta as any)?.env?.VITE_ENABLE_SESSION_COOKIE_AUTH;
    return String(flag || 'false').toLowerCase() === 'true';
  } catch {
    return false;
  }
}

async function setCookieFromToken(accessToken: string | null | undefined): Promise<void> {
  if (!accessToken) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backend: string = ((import.meta as any)?.env?.VITE_BACKEND_URL) || (typeof window !== 'undefined' ? 'https://api.thehirepilot.com' : '');
    if (!backend) return;
    // Optional CSRF
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enableCsrf = String(((import.meta as any)?.env?.VITE_ENABLE_CSRF) || 'false').toLowerCase() === 'true';
      if (enableCsrf) {
        const csrfRes = await fetch(`${backend}/api/auth/csrf`, { credentials: 'include' });
        const csrfJson = await csrfRes.json().catch(() => ({}));
        if (csrfJson?.token) headers['x-csrf-token'] = csrfJson.token as string;
      }
    } catch {}
    await fetch(`${backend}/api/auth/session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ access_token: accessToken }),
      credentials: 'include'
    }).catch(()=>{});
  } catch {}
}

async function clearCookie(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backend: string = ((import.meta as any)?.env?.VITE_BACKEND_URL) || (typeof window !== 'undefined' ? 'https://api.thehirepilot.com' : '');
    if (!backend) return;
    // Optional CSRF
    let headers: Record<string, string> = {};
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enableCsrf = String(((import.meta as any)?.env?.VITE_ENABLE_CSRF) || 'false').toLowerCase() === 'true';
      if (enableCsrf) {
        const csrfRes = await fetch(`${backend}/api/auth/csrf`, { credentials: 'include' });
        const csrfJson = await csrfRes.json().catch(() => ({}));
        if (csrfJson?.token) headers['x-csrf-token'] = csrfJson.token as string;
      }
    } catch {}
    await fetch(`${backend}/api/auth/session`, {
      method: 'DELETE',
      headers,
      credentials: 'include'
    }).catch(()=>{});
  } catch {}
}

export function startSessionCookieSync(): () => void {
  if (!isEnabled()) {
    return () => {};
  }

  // On boot, reflect current session into cookie
  (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await setCookieFromToken(session.access_token);
      } else {
        await clearCookie();
      }
    } catch {}
  })();

  const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
    const evt = String(event || '').toUpperCase();
    if (evt === 'SIGNED_IN' || evt === 'TOKEN_REFRESHED' || evt === 'USER_UPDATED') {
      const token = session?.access_token;
      await setCookieFromToken(token);
      return;
    }
    if (evt === 'SIGNED_OUT') {
      await clearCookie();
      return;
    }
  });

  return () => { try { subscription.subscription?.unsubscribe?.(); } catch {} };
}


