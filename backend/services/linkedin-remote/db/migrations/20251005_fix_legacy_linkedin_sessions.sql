-- Reconcile legacy linkedin_sessions schema (user_id PK without id column)
-- Add id column if missing so new API selecting 'id' works

alter table if exists public.linkedin_sessions
  add column if not exists id uuid default gen_random_uuid();

-- Create an index on id for fast lookups if it wasn't the primary key
create index if not exists idx_linkedin_sessions_id on public.linkedin_sessions(id);

-- Ensure status/login_method exist for new flow (safety)
alter table if exists public.linkedin_sessions add column if not exists status text;
alter table if exists public.linkedin_sessions add column if not exists login_method text;


