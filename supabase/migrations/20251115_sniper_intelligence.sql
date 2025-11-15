-- Sniper Intelligence System core tables
create extension if not exists pgcrypto;

-- 1) sniper_runs --------------------------------------------------------------
create table if not exists public.sniper_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid null,
  workflow_slug text not null,
  source_platform text not null,
  params jsonb not null default '{}'::jsonb,
  status text not null check (status in ('queued','running','completed','failed')) default 'queued',
  error text null,
  discovered_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill columns if an older sniper_runs table already exists (legacy schema)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='sniper_runs') then
    alter table public.sniper_runs
      add column if not exists user_id uuid,
      add column if not exists team_id uuid,
      add column if not exists workflow_slug text,
      add column if not exists source_platform text,
      add column if not exists params jsonb not null default '{}'::jsonb,
      add column if not exists status text not null default 'queued',
      add column if not exists error text,
      add column if not exists discovered_count integer not null default 0,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();
  end if;
end $$;
create index if not exists idx_sniper_runs_user_created on public.sniper_runs(user_id, created_at desc);
create index if not exists idx_sniper_runs_team_created on public.sniper_runs(team_id, created_at desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_sniper_runs_updated_at on public.sniper_runs;
create trigger trg_sniper_runs_updated_at
before update on public.sniper_runs
for each row execute procedure public.set_updated_at();

-- 2) sniper_results -----------------------------------------------------------
create table if not exists public.sniper_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.sniper_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_platform text not null,
  normalized jsonb not null,
  raw jsonb null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sniper_results_run on public.sniper_results(run_id);
create index if not exists idx_sniper_results_user_type on public.sniper_results(user_id, source_type);

-- 3) zoominfo_enrichment_settings --------------------------------------------
create table if not exists public.zoominfo_enrichment_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_zoominfo_settings_user on public.zoominfo_enrichment_settings(user_id);
drop trigger if exists trg_zoominfo_settings_updated_at on public.zoominfo_enrichment_settings;
create trigger trg_zoominfo_settings_updated_at
before update on public.zoominfo_enrichment_settings
for each row execute procedure public.set_updated_at();

-- Backfill columns if an older zoominfo_enrichment_settings exists with different schema
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='zoominfo_enrichment_settings') then
    alter table public.zoominfo_enrichment_settings
      add column if not exists user_id uuid,
      add column if not exists enabled boolean not null default false,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();
  end if;
end $$;

-- 4) Optional: zoominfo_company_cache ----------------------------------------
create table if not exists public.zoominfo_company_cache (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  company_domain text null,
  zoominfo_url text null,
  payload jsonb null,
  last_scraped_at timestamptz not null default now()
);
create unique index if not exists idx_zoominfo_company_cache_domain on public.zoominfo_company_cache(coalesce(company_domain, ''));
create index if not exists idx_zoominfo_company_cache_name on public.zoominfo_company_cache(company_name);

-- RLS (owner-only) for runs/results/settings ---------------------------------
alter table public.sniper_runs enable row level security;
alter table public.sniper_results enable row level security;
alter table public.zoominfo_enrichment_settings enable row level security;

-- Policies
drop policy if exists sniper_runs_owner_select on public.sniper_runs;
create policy sniper_runs_owner_select
on public.sniper_runs for select
using (user_id = auth.uid());

drop policy if exists sniper_runs_owner_insert on public.sniper_runs;
create policy sniper_runs_owner_insert
on public.sniper_runs for insert
with check (user_id = auth.uid());

drop policy if exists sniper_runs_owner_update on public.sniper_runs;
create policy sniper_runs_owner_update
on public.sniper_runs for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists sniper_results_owner_select on public.sniper_results;
create policy sniper_results_owner_select
on public.sniper_results for select
using (user_id = auth.uid());

drop policy if exists sniper_results_owner_insert on public.sniper_results;
create policy sniper_results_owner_insert
on public.sniper_results for insert
with check (user_id = auth.uid());

drop policy if exists zoominfo_settings_owner_select on public.zoominfo_enrichment_settings;
create policy zoominfo_settings_owner_select
on public.zoominfo_enrichment_settings for select
using (user_id = auth.uid());

drop policy if exists zoominfo_settings_owner_upsert on public.zoominfo_enrichment_settings;
create policy zoominfo_settings_owner_upsert
on public.zoominfo_enrichment_settings for all
using (user_id = auth.uid())
with check (user_id = auth.uid());


