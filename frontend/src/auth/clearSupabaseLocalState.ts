/**
 * Clears Supabase auth state from browser storage WITHOUT contacting Supabase.
 *
 * We use this instead of `supabase.auth.signOut({ scope: 'local' })` in flows like
 * impersonation/session handoff where we want to avoid stale tokens but MUST NOT
 * risk revoking the original session on the server.
 */
export function clearSupabaseLocalState(): void {
  try {
    if (typeof window === 'undefined') return;

    const keys = [
      // recruiter app storage key
      'hirepilot-auth',
      // jobs app storage key
      'hp_jobseeker_auth',
      // Supabase internal (rare but defensive)
      'supabase.auth.token',
    ];

    for (const k of keys) {
      try {
        window.localStorage?.removeItem?.(k);
      } catch {}
      try {
        window.sessionStorage?.removeItem?.(k);
      } catch {}
    }
  } catch {}
}


