/**
 * Helpers for distinguishing intentional sign-outs (user clicked "Sign Out")
 * from session-expiry sign-outs (token/cookie expired silently).
 *
 * Call `markIntentionalSignOut()` immediately before every
 * `supabase.auth.signOut()` so the global session-expiry guard in
 * AuthQuerySync does NOT show the "session expired" toast.
 */

export function markIntentionalSignOut(): void {
  try {
    sessionStorage.setItem('hp_intentional_signout', '1');
  } catch {}
}
