-- ==========================================================================
-- Company Open Jobs: cached job postings revealed via Apollo API.
-- Keyed by (workspace_id, company_key) for deduplication.
-- ==========================================================================

create table if not exists public.company_open_jobs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null,
  revealed_by     uuid not null references auth.users(id) on delete cascade,

  -- Company identification
  company_name    text not null,
  company_url     text,                    -- LinkedIn company URL (if available)
  apollo_org_id   text,                    -- Apollo organization ID once resolved

  -- Normalized key for dedup: "li:<linkedin-slug>" or "name:<normalized-name>"
  company_key     text not null,

  -- The actual job postings data from Apollo
  job_postings    jsonb not null default '[]'::jsonb,
  -- Shape: [{ title, url, location, department, posted_at }]

  -- Apollo org metadata (useful for display + AI context)
  apollo_org_data jsonb,

  -- Credit tracking
  credits_charged int not null default 0,
  using_personal_key boolean not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Primary lookup: workspace + company_key (deduplication — prevents double-charging)
create unique index if not exists idx_company_open_jobs_dedup
  on public.company_open_jobs(workspace_id, company_key);

-- Query by workspace for listing
create index if not exists idx_company_open_jobs_workspace
  on public.company_open_jobs(workspace_id, created_at desc);

-- Updated_at trigger
drop trigger if exists trg_company_open_jobs_updated_at on public.company_open_jobs;
create trigger trg_company_open_jobs_updated_at
  before update on public.company_open_jobs
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.company_open_jobs enable row level security;

drop policy if exists company_open_jobs_select on public.company_open_jobs;
create policy company_open_jobs_select on public.company_open_jobs
  for select using (public.sniper_is_in_workspace(workspace_id));

drop policy if exists company_open_jobs_insert on public.company_open_jobs;
create policy company_open_jobs_insert on public.company_open_jobs
  for insert with check (public.sniper_is_in_workspace(workspace_id));

drop policy if exists company_open_jobs_update on public.company_open_jobs;
create policy company_open_jobs_update on public.company_open_jobs
  for update using (public.sniper_is_in_workspace(workspace_id))
  with check (public.sniper_is_in_workspace(workspace_id));
