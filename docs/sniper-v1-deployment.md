## Sniper v1 Deployment / Migration Notes

### Overview
Sniper v1 introduces a **single unified Sniper system**:
- One API surface: `GET/POST /api/sniper/*`
- One queue/worker: `sniper:v1`
- One data model: `sniper_targets`, `sniper_jobs`, `sniper_job_items`, `sniper_settings`, `user_linkedin_auth`
- Optional execution provider: **Airtop** (recommended) or **Local Playwright** (fallback)

Legacy Sniper/Intelligence systems remain in the repo but are **disabled** when v1 flags are enabled.

### Required Environment Variables (Backend)
- **Feature flags**
  - `SNIPER_V1_ENABLED=true`
  - `SNIPER_INTELLIGENCE_ENABLED=false` (recommended for v1 launch)
- **Queue / DB**
  - `REDIS_URL`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ENCRYPTION_KEY` (32 bytes hex)
- **Airtop (recommended)**
  - `AIRTOP_PROVIDER_ENABLED=true`
  - `AIRTOP_API_KEY=...`
  - `SNIPER_PROVIDER_DEFAULT=airtop` (or `local_playwright`)
- **Local Playwright fallback**
  - `BROWSER_PROVIDER=playwright` (default) or `browserless`
  - `BROWSERLESS_WS` (if `BROWSER_PROVIDER=browserless`)

### Required Environment Variables (Frontend)
- `VITE_SNIPER_V1_ENABLED=true`
- `VITE_SNIPER_INTELLIGENCE_ENABLED=false`

### Database migrations
Apply:
- `supabase/migrations/20260102190000_sniper_v1.sql`
- `supabase/migrations/20260102193000_remove_deprecated_sniper_tables.sql`

Notes:
- v1 migration **renames** legacy `sniper_targets`, `sniper_jobs`, `sniper_settings` tables to `*_legacy` if they exist (best-effort, idempotent).
- v1 migration **backfills** legacy post-url targets into v1 `sniper_targets` (best-effort).

### Operational notes
- Airtop profiles are stored per user/workspace in `user_linkedin_auth.airtop_profile_id`.
- Airtop embedded login is initiated via `POST /api/sniper/linkedin/auth/start` and completed via `POST /api/sniper/linkedin/auth/complete`.
- Airtop profile persistence happens on session termination (per Airtop docs). If a user closes the modal early, ask them to retry and click “I’m logged in”.


