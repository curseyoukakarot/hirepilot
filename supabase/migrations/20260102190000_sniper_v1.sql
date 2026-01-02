-- Sniper v1 unified system (targets + jobs + items + settings + LinkedIn auth)
-- Goal: one Sniper model for v1 launch; legacy Sniper/Intelligence tables remain but are not used by v1.
-- NOTE: This migration renames a few legacy tables to *_legacy to free canonical names.

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

-- ------------------------------------------------------------------------------------
-- 0) Rename legacy tables that conflict with v1 names (best-effort, idempotent)
-- ------------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='sniper_targets')
     and not exists (select 1 from information_schema.tables where table_schema='public' and table_name='sniper_targets_legacy')
  then
    execute 'alter table public.sniper_targets rename to sniper_targets_legacy';
  end if;
exception when others then
  -- ignore (permissions / already renamed / etc.)
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='sniper_jobs')
     and not exists (select 1 from information_schema.tables where table_schema='public' and table_name='sniper_jobs_legacy')
  then
    execute 'alter table public.sniper_jobs rename to sniper_jobs_legacy';
  end if;
exception when others then
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='sniper_settings')
     and not exists (select 1 from information_schema.tables where table_schema='public' and table_name='sniper_settings_legacy')
  then
    execute 'alter table public.sniper_settings rename to sniper_settings_legacy';
  end if;
exception when others then
end $$;

-- ------------------------------------------------------------------------------------
-- 1) Core v1 tables
-- ------------------------------------------------------------------------------------

create table if not exists public.sniper_targets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  type text not null check (type in ('linkedin_post_engagement')),
  post_url text not null,
  status text not null check (status in ('active','paused')) default 'active',
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sniper_targets_workspace_created on public.sniper_targets(workspace_id, created_at desc);
create index if not exists idx_sniper_targets_created_by on public.sniper_targets(created_by, created_at desc);
create index if not exists idx_sniper_targets_status on public.sniper_targets(workspace_id, status);

drop trigger if exists trg_sniper_targets_updated_at on public.sniper_targets;
create trigger trg_sniper_targets_updated_at
before update on public.sniper_targets
for each row execute procedure public.set_updated_at();

create table if not exists public.sniper_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  target_id uuid null references public.sniper_targets(id) on delete set null,
  job_type text not null check (job_type in ('prospect_post_engagers','send_connect_requests','send_messages')),
  provider text not null check (provider in ('airtop','local_playwright')),
  input_json jsonb not null default '{}'::jsonb,
  status text not null check (status in ('queued','running','succeeded','failed','partially_succeeded','canceled')) default 'queued',
  attempts integer not null default 0,
  error_code text null,
  error_message text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sniper_jobs_workspace_created on public.sniper_jobs(workspace_id, created_at desc);
create index if not exists idx_sniper_jobs_target on public.sniper_jobs(target_id, created_at desc);
create index if not exists idx_sniper_jobs_status on public.sniper_jobs(workspace_id, status);

drop trigger if exists trg_sniper_jobs_updated_at on public.sniper_jobs;
create trigger trg_sniper_jobs_updated_at
before update on public.sniper_jobs
for each row execute procedure public.set_updated_at();

create table if not exists public.sniper_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.sniper_jobs(id) on delete cascade,
  workspace_id uuid not null,
  profile_url text not null,
  action_type text not null check (action_type in ('connect','message','extract')),
  scheduled_for timestamptz null,
  status text not null check (status in ('queued','running','success','failed','skipped')) default 'queued',
  result_json jsonb null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sniper_job_items_job on public.sniper_job_items(job_id, created_at asc);
create index if not exists idx_sniper_job_items_workspace_status on public.sniper_job_items(workspace_id, status, created_at desc);
create index if not exists idx_sniper_job_items_scheduled on public.sniper_job_items(workspace_id, scheduled_for);

drop trigger if exists trg_sniper_job_items_updated_at on public.sniper_job_items;
create trigger trg_sniper_job_items_updated_at
before update on public.sniper_job_items
for each row execute procedure public.set_updated_at();

-- One settings row per workspace
create table if not exists public.sniper_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  provider_preference text not null check (provider_preference in ('airtop','local_playwright')) default 'airtop',
  max_actions_per_day integer not null default 120,
  max_actions_per_hour integer not null default 30,
  min_delay_seconds integer not null default 20,
  max_delay_seconds integer not null default 60,
  active_hours_json jsonb not null default '{"days":[1,2,3,4,5],"start":"09:00","end":"17:00","runOnWeekends":false}'::jsonb,
  timezone text not null default 'America/Chicago',
  safety_mode boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

drop trigger if exists trg_sniper_settings_updated_at on public.sniper_settings;
create trigger trg_sniper_settings_updated_at
before update on public.sniper_settings
for each row execute procedure public.set_updated_at();

create table if not exists public.user_linkedin_auth (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null,
  airtop_profile_id text null,
  airtop_last_auth_at timestamptz null,
  local_li_at text null,
  local_jsessionid text null,
  status text not null check (status in ('ok','needs_reauth','checkpointed')) default 'needs_reauth',
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

drop trigger if exists trg_user_linkedin_auth_updated_at on public.user_linkedin_auth;
create trigger trg_user_linkedin_auth_updated_at
before update on public.user_linkedin_auth
for each row execute procedure public.set_updated_at();

-- Internal helper table for Airtop embedded-auth handshakes
create table if not exists public.sniper_airtop_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null,
  airtop_session_id text not null,
  airtop_window_id text not null,
  airtop_profile_name text not null,
  status text not null check (status in ('active','completed','expired')) default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sniper_airtop_auth_sessions_user on public.sniper_airtop_auth_sessions(user_id, created_at desc);
create index if not exists idx_sniper_airtop_auth_sessions_status on public.sniper_airtop_auth_sessions(status, created_at desc);

drop trigger if exists trg_sniper_airtop_auth_sessions_updated_at on public.sniper_airtop_auth_sessions;
create trigger trg_sniper_airtop_auth_sessions_updated_at
before update on public.sniper_airtop_auth_sessions
for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------------------------------
-- 2) Data migration (minimal): bring forward legacy post_url targets into v1
-- ------------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='sniper_targets_legacy') then
    -- Migrate only legacy targets that had a post_url (v1 only supports LinkedIn post engagement)
    insert into public.sniper_targets (workspace_id, created_by, name, type, post_url, status, settings_json, created_at, updated_at)
    select
      coalesce((select u.team_id from public.users u where u.id = t.user_id), t.user_id) as workspace_id,
      t.user_id as created_by,
      coalesce(nullif(substr(coalesce(t.post_url,''), 1, 120), ''), 'LinkedIn Post') as name,
      'linkedin_post_engagement' as type,
      t.post_url as post_url,
      case when lower(coalesce(t.status,'')) = 'paused' then 'paused' else 'active' end as status,
      '{}'::jsonb as settings_json,
      coalesce(t.created_at, now()) as created_at,
      coalesce(t.created_at, now()) as updated_at
    from public.sniper_targets_legacy t
    where t.post_url is not null and length(t.post_url) > 0
    on conflict do nothing;
  end if;
exception when others then
  -- best-effort only; do not block deploy
end $$;

-- ------------------------------------------------------------------------------------
-- 3) RLS policies (team/workspace-aware via users.team_id)
-- ------------------------------------------------------------------------------------

-- workspace membership check helper:
-- allow if (workspace_id == my team_id) OR (workspace_id == my user_id for solo workspaces)
create or replace function public.sniper_is_in_workspace(workspace uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and (u.team_id = workspace or u.id = workspace)
  );
$$;

alter table public.sniper_targets enable row level security;
alter table public.sniper_jobs enable row level security;
alter table public.sniper_job_items enable row level security;
alter table public.sniper_settings enable row level security;
alter table public.user_linkedin_auth enable row level security;
alter table public.sniper_airtop_auth_sessions enable row level security;

-- sniper_targets
drop policy if exists sniper_targets_select on public.sniper_targets;
create policy sniper_targets_select on public.sniper_targets
for select using (public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_targets_insert on public.sniper_targets;
create policy sniper_targets_insert on public.sniper_targets
for insert with check (created_by = auth.uid() and public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_targets_update on public.sniper_targets;
create policy sniper_targets_update on public.sniper_targets
for update using (public.sniper_is_in_workspace(workspace_id))
with check (public.sniper_is_in_workspace(workspace_id));

-- sniper_jobs
drop policy if exists sniper_jobs_select on public.sniper_jobs;
create policy sniper_jobs_select on public.sniper_jobs
for select using (public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_jobs_insert on public.sniper_jobs;
create policy sniper_jobs_insert on public.sniper_jobs
for insert with check (created_by = auth.uid() and public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_jobs_update on public.sniper_jobs;
create policy sniper_jobs_update on public.sniper_jobs
for update using (public.sniper_is_in_workspace(workspace_id))
with check (public.sniper_is_in_workspace(workspace_id));

-- sniper_job_items
drop policy if exists sniper_job_items_select on public.sniper_job_items;
create policy sniper_job_items_select on public.sniper_job_items
for select using (public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_job_items_insert on public.sniper_job_items;
create policy sniper_job_items_insert on public.sniper_job_items
for insert with check (public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_job_items_update on public.sniper_job_items;
create policy sniper_job_items_update on public.sniper_job_items
for update using (public.sniper_is_in_workspace(workspace_id))
with check (public.sniper_is_in_workspace(workspace_id));

-- sniper_settings
drop policy if exists sniper_settings_select on public.sniper_settings;
create policy sniper_settings_select on public.sniper_settings
for select using (public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_settings_upsert on public.sniper_settings;
create policy sniper_settings_upsert on public.sniper_settings
for all using (public.sniper_is_in_workspace(workspace_id))
with check (public.sniper_is_in_workspace(workspace_id));

-- user_linkedin_auth
drop policy if exists user_linkedin_auth_select on public.user_linkedin_auth;
create policy user_linkedin_auth_select on public.user_linkedin_auth
for select using (user_id = auth.uid() and public.sniper_is_in_workspace(workspace_id));

drop policy if exists user_linkedin_auth_upsert on public.user_linkedin_auth;
create policy user_linkedin_auth_upsert on public.user_linkedin_auth
for all using (user_id = auth.uid() and public.sniper_is_in_workspace(workspace_id))
with check (user_id = auth.uid() and public.sniper_is_in_workspace(workspace_id));

-- sniper_airtop_auth_sessions (owner-only)
drop policy if exists sniper_airtop_auth_sessions_select on public.sniper_airtop_auth_sessions;
create policy sniper_airtop_auth_sessions_select on public.sniper_airtop_auth_sessions
for select using (user_id = auth.uid() and public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_airtop_auth_sessions_upsert on public.sniper_airtop_auth_sessions;
create policy sniper_airtop_auth_sessions_upsert on public.sniper_airtop_auth_sessions
for all using (user_id = auth.uid() and public.sniper_is_in_workspace(workspace_id))
with check (user_id = auth.uid() and public.sniper_is_in_workspace(workspace_id));


