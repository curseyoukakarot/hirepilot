import { createClient } from '@supabase/supabase-js';

// Service-role client (no auth helpers) for admin operations
export const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Back-compat alias used across src/ (service-role DB client)
export const supabaseDb = supabase;

// Dedicated admin client to avoid accidental helper injection
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false } }
);