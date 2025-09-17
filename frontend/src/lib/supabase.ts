// Add type declaration for import.meta.env
declare global {
  interface ImportMeta {
    env: {
      VITE_SUPABASE_URL: string;
      VITE_SUPABASE_ANON_KEY: string;
      VITE_BACKEND_URL: string;
    };
  }
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (window.location.host.endsWith('thehirepilot.com') ? 'https://lqcsassinqfruvpgcooo.supabase.co' : '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (window as any).VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,     // ✅ critical fix
    storageKey: 'hirepilot-auth',
    storage: window.localStorage
  }
});

// 🐛 Debug helper: expose supabase globally in dev mode
if (import.meta.env.DEV) {
  (window as any).supabase = supabase;
  console.log('⚡ Supabase client attached to window.supabase (dev only)');
} 