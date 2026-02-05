-- Job Seeker Agent v1 tables + leads persona

begin;

create extension if not exists pgcrypto;

-- Helper: updated_at trigger (reuse if already present)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------------------
-- Job Seeker Agent runs
-- -------------------------------------------------------------------
create table if not exists public.jobseeker_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  status text not null check (status in ('queued','running','paused_throttled','paused_scheduled','succeeded','failed','canceled')) default 'queued',
  search_url text not null,
  job_limit integer not null default 100,
  priority text not null check (priority in ('standard','high','urgent')) default 'standard',
  context text null,
  schedule_enabled boolean not null default false,
  schedule_cron text null,
  next_run_at timestamptz null,
  progress_json jsonb not null default '{}'::jsonb,
  stats_json jsonb not null default '{}'::jsonb,
  last_error text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jobseeker_agent_runs_user_status_created
  on public.jobseeker_agent_runs(user_id, status, created_at desc);
create index if not exists idx_jobseeker_agent_runs_next_run
  on public.jobseeker_agent_runs(next_run_at);

drop trigger if exists trg_jobseeker_agent_runs_updated_at on public.jobseeker_agent_runs;
create trigger trg_jobseeker_agent_runs_updated_at
before update on public.jobseeker_agent_runs
for each row execute procedure public.set_updated_at();

-- -------------------------------------------------------------------
-- Job Seeker Agent run items
-- -------------------------------------------------------------------
create table if not exists public.jobseeker_agent_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.jobseeker_agent_runs(id) on delete cascade,
  item_type text not null check (item_type in ('job','target')),
  job_url text null,
  company text null,
  title text null,
  location text null,
  job_data_json jsonb null,
  target_profile_url text null,
  target_name text null,
  target_title text null,
  match_score integer null,
  target_data_json jsonb null,
  status text not null check (status in ('queued','running','success','failed','skipped')) default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jobseeker_agent_run_items_run_type
  on public.jobseeker_agent_run_items(run_id, item_type);
create index if not exists idx_jobseeker_agent_run_items_target_profile
  on public.jobseeker_agent_run_items(target_profile_url);

drop trigger if exists trg_jobseeker_agent_run_items_updated_at on public.jobseeker_agent_run_items;
create trigger trg_jobseeker_agent_run_items_updated_at
before update on public.jobseeker_agent_run_items
for each row execute procedure public.set_updated_at();

-- -------------------------------------------------------------------
-- Job Seeker Cloud Engine settings
-- -------------------------------------------------------------------
create table if not exists public.jobseeker_cloud_engine_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  airtop_profile_id text null,
  status text not null check (status in ('ok','needs_reauth','disconnected')) default 'needs_reauth',
  connected_at timestamptz null,
  daily_job_page_limit integer not null default 50,
  daily_profile_limit integer not null default 100,
  max_concurrency integer not null default 1,
  cooldown_minutes integer not null default 30,
  notify_email boolean not null default true,
  notify_inapp boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);

create index if not exists idx_jobseeker_cloud_engine_settings_user
  on public.jobseeker_cloud_engine_settings(user_id);

drop trigger if exists trg_jobseeker_cloud_engine_settings_updated_at on public.jobseeker_cloud_engine_settings;
create trigger trg_jobseeker_cloud_engine_settings_updated_at
before update on public.jobseeker_cloud_engine_settings
for each row execute procedure public.set_updated_at();

-- -------------------------------------------------------------------
-- Job Seeker Cloud Engine usage (daily counters)
-- -------------------------------------------------------------------
create table if not exists public.jobseeker_cloud_engine_usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  day date not null,
  job_pages_read integer not null default 0,
  profiles_read integer not null default 0,
  last_updated_at timestamptz not null default now(),
  unique (user_id, workspace_id, day)
);

create index if not exists idx_jobseeker_cloud_engine_usage_user_day
  on public.jobseeker_cloud_engine_usage_daily(user_id, day);

-- -------------------------------------------------------------------
-- Leads persona tagging for job seeker leads
-- -------------------------------------------------------------------
alter table public.leads add column if not exists persona_type text null;
create index if not exists idx_leads_persona_user on public.leads(persona_type, user_id);

-- -------------------------------------------------------------------
-- RLS policies
-- -------------------------------------------------------------------
alter table public.jobseeker_agent_runs enable row level security;
alter table public.jobseeker_agent_run_items enable row level security;
alter table public.jobseeker_cloud_engine_settings enable row level security;
alter table public.jobseeker_cloud_engine_usage_daily enable row level security;

drop policy if exists "jobseeker_runs_select_own" on public.jobseeker_agent_runs;
create policy "jobseeker_runs_select_own" on public.jobseeker_agent_runs
  for select using (user_id = auth.uid());

drop policy if exists "jobseeker_runs_insert_own" on public.jobseeker_agent_runs;
create policy "jobseeker_runs_insert_own" on public.jobseeker_agent_runs
  for insert with check (user_id = auth.uid());

drop policy if exists "jobseeker_runs_update_own" on public.jobseeker_agent_runs;
create policy "jobseeker_runs_update_own" on public.jobseeker_agent_runs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "jobseeker_runs_delete_own" on public.jobseeker_agent_runs;
create policy "jobseeker_runs_delete_own" on public.jobseeker_agent_runs
  for delete using (user_id = auth.uid());

drop policy if exists "jobseeker_run_items_select_own" on public.jobseeker_agent_run_items;
create policy "jobseeker_run_items_select_own" on public.jobseeker_agent_run_items
  for select using (
    exists (
      select 1 from public.jobseeker_agent_runs r
      where r.id = jobseeker_agent_run_items.run_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "jobseeker_run_items_insert_own" on public.jobseeker_agent_run_items;
create policy "jobseeker_run_items_insert_own" on public.jobseeker_agent_run_items
  for insert with check (
    exists (
      select 1 from public.jobseeker_agent_runs r
      where r.id = jobseeker_agent_run_items.run_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "jobseeker_run_items_update_own" on public.jobseeker_agent_run_items;
create policy "jobseeker_run_items_update_own" on public.jobseeker_agent_run_items
  for update using (
    exists (
      select 1 from public.jobseeker_agent_runs r
      where r.id = jobseeker_agent_run_items.run_id
        and r.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.jobseeker_agent_runs r
      where r.id = jobseeker_agent_run_items.run_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "jobseeker_run_items_delete_own" on public.jobseeker_agent_run_items;
create policy "jobseeker_run_items_delete_own" on public.jobseeker_agent_run_items
  for delete using (
    exists (
      select 1 from public.jobseeker_agent_runs r
      where r.id = jobseeker_agent_run_items.run_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "jobseeker_cloud_settings_select_own" on public.jobseeker_cloud_engine_settings;
create policy "jobseeker_cloud_settings_select_own" on public.jobseeker_cloud_engine_settings
  for select using (user_id = auth.uid());

drop policy if exists "jobseeker_cloud_settings_insert_own" on public.jobseeker_cloud_engine_settings;
create policy "jobseeker_cloud_settings_insert_own" on public.jobseeker_cloud_engine_settings
  for insert with check (user_id = auth.uid());

drop policy if exists "jobseeker_cloud_settings_update_own" on public.jobseeker_cloud_engine_settings;
create policy "jobseeker_cloud_settings_update_own" on public.jobseeker_cloud_engine_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "jobseeker_cloud_usage_select_own" on public.jobseeker_cloud_engine_usage_daily;
create policy "jobseeker_cloud_usage_select_own" on public.jobseeker_cloud_engine_usage_daily
  for select using (user_id = auth.uid());

drop policy if exists "jobseeker_cloud_usage_insert_own" on public.jobseeker_cloud_engine_usage_daily;
create policy "jobseeker_cloud_usage_insert_own" on public.jobseeker_cloud_engine_usage_daily
  for insert with check (user_id = auth.uid());

drop policy if exists "jobseeker_cloud_usage_update_own" on public.jobseeker_cloud_engine_usage_daily;
create policy "jobseeker_cloud_usage_update_own" on public.jobseeker_cloud_engine_usage_daily
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

commit;
