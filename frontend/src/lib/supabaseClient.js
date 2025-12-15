import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lqcsassinqfruvpgcooo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const host =
  typeof window !== 'undefined'
    ? window.location.hostname
    : (typeof process !== 'undefined' && process.env.HOSTNAME) || '';
const isJobsHost = typeof window !== 'undefined' && host.startsWith('jobs.');
const storageKey = isJobsHost ? 'hp_jobseeker_auth' : 'hirepilot-auth';
const rootCookieDomain =
  typeof window !== 'undefined' && host.endsWith('thehirepilot.com') ? '.thehirepilot.com' : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    flowType: 'pkce',
    cookieOptions: {
      domain: rootCookieDomain,
      path: '/',
      sameSite: 'lax',
      secure: true,
      maxAge: 60 * 60 * 24 * 365, // 1 year
    },
  }
});

// Attach globally for debug
if (typeof window !== 'undefined') {
  window.supabase = supabase;
  console.log("⚡ Supabase client attached to window.supabase");
}

// Post-auth bootstrap to force correct app role (job seeker)
if (typeof window !== 'undefined' && isJobsHost) {
  const apiBase =
    import.meta.env.VITE_BACKEND_URL ||
    (window.location.host.endsWith('thehirepilot.com') ? 'https://api.thehirepilot.com' : 'http://localhost:8080');

  const urlParams = new URLSearchParams(window.location.search);
  const forceBootstrap = urlParams.get('forceBootstrap') === '1';

  supabase.auth.onAuthStateChange(async (_event, session) => {
    const token = session?.access_token;
    const userId = session?.user?.id;
    if (!token || !userId) return;
    const key = `hp_js_bootstrap_${userId}`;
    if (!forceBootstrap && sessionStorage.getItem(key) === 'done') return;
    try {
      console.info('[bootstrap] calling from frontend', {
        host: window.location.host,
        path: window.location.pathname,
        forceBootstrap,
      });
      await fetch(`${apiBase.replace(/\/$/, '')}/api/auth/bootstrap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ app: 'job_seeker' }),
      });
      sessionStorage.setItem(key, 'done');
    } catch (err) {
      console.warn('job-seeker bootstrap failed', err);
    }
  });
}