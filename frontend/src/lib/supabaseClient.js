import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lqcsassinqfruvpgcooo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const isJobsHost = typeof window !== 'undefined' && window.location.hostname.startsWith('jobs.');
const storageKey = isJobsHost ? 'hp_jobseeker_auth' : 'hirepilot-auth';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }
});

// Attach globally for debug
window.supabase = supabase;
console.log("⚡ Supabase client attached to window.supabase");