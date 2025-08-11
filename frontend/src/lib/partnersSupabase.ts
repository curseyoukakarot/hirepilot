import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_PARTNERS_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_PARTNERS_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const partnersSupabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    storageKey: 'partners-auth'
  }
});


