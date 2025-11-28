import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client that only instantiates in the browser.
 * The sandbox page needs this to pull the signed-in user's Slack channels.
 */
export const getSupabaseBrowserClient = (): SupabaseClient | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Sandbox] Missing NEXT_PUBLIC_SUPABASE_* env vars; Slack channels unavailable.');
    return null;
  }

  const storage = (() => {
    try {
      return window.localStorage;
    } catch (error) {
      console.warn('[Sandbox] localStorage unavailable; Supabase session persistence disabled.', error);
      return undefined;
    }
  })();

  cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'hirepilot-auth',
      storage,
    },
  });

  return cachedClient;
};

