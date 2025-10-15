## Webhooks: userCreated

This webhook ensures new signups are correctly initialized across tables and metadata.

What it does:
- Upserts `public.users` with free defaults when no paid plan is detected.
- Seeds `public.user_credits` (default 50 for free signups).
- Removes any stale `subscriptions` for free signups.
- Syncs Supabase Auth `app_metadata.role` to `free` to prevent missing role on social signups.

Notes
- If your environment stores roles as `super_admin` vs `SUPER_ADMIN`, keep using lowercase `super_admin` consistently for JWT checks and RLS policies.
- If roles are arrays, adapt the webhook update to set `{ roles: ['free'] }` instead of `{ role: 'free' }`.

Related migration
- See `supabase/migrations/20251015_enhance_social_signup_free.sql` for the trigger function that sets defaults and seeds credits at the database level.


