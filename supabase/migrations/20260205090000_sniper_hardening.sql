-- Sniper v1 hardening: status taxonomy, throttling, artifacts

create extension if not exists pgcrypto;

-- Settings: per-user + per-workspace daily caps and cooldown
alter table public.sniper_settings add column if not exists max_connects_per_day integer not null default 20;
alter table public.sniper_settings add column if not exists max_messages_per_day integer not null default 100;
alter table public.sniper_settings add column if not exists max_page_interactions_per_day integer not null default 300;
alter table public.sniper_settings add column if not exists max_workspace_connects_per_day integer not null default 200;
alter table public.sniper_settings add column if not exists max_workspace_messages_per_day integer not null default 500;
alter table public.sniper_settings add column if not exists max_workspace_page_interactions_per_day integer not null default 1500;
alter table public.sniper_settings add column if not exists cooldown_minutes integer not null default 120;

-- Job scheduling metadata
alter table public.sniper_jobs add column if not exists next_run_at timestamptz null;

-- Job item artifacts and diagnostics
alter table public.sniper_job_items add column if not exists error_code text null;
alter table public.sniper_job_items add column if not exists last_step text null;
alter table public.sniper_job_items add column if not exists strategy_used text null;
alter table public.sniper_job_items add column if not exists screenshot_path text null;

-- Status taxonomy update
alter table public.sniper_jobs drop constraint if exists sniper_jobs_status_check;
alter table public.sniper_jobs add constraint sniper_jobs_status_check
check (status in ('queued','running','succeeded','failed','partially_succeeded','canceled','paused_throttled','paused_cooldown'));

alter table public.sniper_job_items drop constraint if exists sniper_job_items_status_check;
alter table public.sniper_job_items add constraint sniper_job_items_status_check
check (status in (
  'queued','running',
  'succeeded_verified','succeeded_noop_already_connected','succeeded_noop_already_pending',
  'failed_restricted','failed_verification',
  'paused_throttled','paused_cooldown',
  'skipped','failed'
));

-- ------------------------------------------------------------------------------------
-- Daily usage tracking (per-user + per-workspace)
-- ------------------------------------------------------------------------------------

create table if not exists public.sniper_action_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null,
  day date not null,
  connects_sent integer not null default 0,
  messages_sent integer not null default 0,
  profiles_visited integer not null default 0,
  job_pages_visited integer not null default 0,
  last_action_at timestamptz null,
  cooldown_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id, day)
);

create index if not exists idx_sniper_action_usage_workspace_day on public.sniper_action_usage_daily(workspace_id, day);

drop trigger if exists trg_sniper_action_usage_updated_at on public.sniper_action_usage_daily;
create trigger trg_sniper_action_usage_updated_at
before update on public.sniper_action_usage_daily
for each row execute procedure public.set_updated_at();

alter table public.sniper_action_usage_daily enable row level security;

drop policy if exists sniper_action_usage_select on public.sniper_action_usage_daily;
create policy sniper_action_usage_select on public.sniper_action_usage_daily
for select using (user_id = auth.uid() and public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_action_usage_upsert on public.sniper_action_usage_daily;
create policy sniper_action_usage_upsert on public.sniper_action_usage_daily
for all using (user_id = auth.uid() and public.sniper_is_in_workspace(workspace_id))
with check (user_id = auth.uid() and public.sniper_is_in_workspace(workspace_id));

create table if not exists public.sniper_workspace_usage_daily (
  workspace_id uuid not null,
  day date not null,
  connects_sent integer not null default 0,
  messages_sent integer not null default 0,
  profiles_visited integer not null default 0,
  job_pages_visited integer not null default 0,
  last_action_at timestamptz null,
  cooldown_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, day)
);

create index if not exists idx_sniper_workspace_usage_day on public.sniper_workspace_usage_daily(workspace_id, day);

drop trigger if exists trg_sniper_workspace_usage_updated_at on public.sniper_workspace_usage_daily;
create trigger trg_sniper_workspace_usage_updated_at
before update on public.sniper_workspace_usage_daily
for each row execute procedure public.set_updated_at();

alter table public.sniper_workspace_usage_daily enable row level security;

drop policy if exists sniper_workspace_usage_select on public.sniper_workspace_usage_daily;
create policy sniper_workspace_usage_select on public.sniper_workspace_usage_daily
for select using (public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_workspace_usage_upsert on public.sniper_workspace_usage_daily;
create policy sniper_workspace_usage_upsert on public.sniper_workspace_usage_daily
for all using (public.sniper_is_in_workspace(workspace_id))
with check (public.sniper_is_in_workspace(workspace_id));

-- Atomic reservation helper: user + workspace caps
create or replace function public.sniper_reserve_action_usage(
  p_user_id uuid,
  p_workspace_id uuid,
  p_day date,
  p_connect_delta integer default 0,
  p_message_delta integer default 0,
  p_profile_delta integer default 0,
  p_job_page_delta integer default 0,
  p_connect_limit integer default 20,
  p_message_limit integer default 100,
  p_profile_limit integer default 300,
  p_job_page_limit integer default 300,
  p_workspace_connect_limit integer default 200,
  p_workspace_message_limit integer default 500,
  p_workspace_profile_limit integer default 1500,
  p_workspace_job_page_limit integer default 1500,
  p_cooldown_until timestamptz default null
)
returns table(
  user_connects integer,
  user_messages integer,
  user_profiles integer,
  user_job_pages integer,
  workspace_connects integer,
  workspace_messages integer,
  workspace_profiles integer,
  workspace_job_pages integer,
  cooldown_until timestamptz
)
language plpgsql
as $$
declare
  u_connect integer;
  u_message integer;
  u_profile integer;
  u_job integer;
  w_connect integer;
  w_message integer;
  w_profile integer;
  w_job integer;
  cooldown_out timestamptz;
begin
  if coalesce(p_connect_delta,0) < 0 then p_connect_delta := 0; end if;
  if coalesce(p_message_delta,0) < 0 then p_message_delta := 0; end if;
  if coalesce(p_profile_delta,0) < 0 then p_profile_delta := 0; end if;
  if coalesce(p_job_page_delta,0) < 0 then p_job_page_delta := 0; end if;

  if (p_connect_delta + p_message_delta + p_profile_delta + p_job_page_delta) = 0 then
    select connects_sent, messages_sent, profiles_visited, job_pages_visited, cooldown_until
      into u_connect, u_message, u_profile, u_job, cooldown_out
      from public.sniper_action_usage_daily
      where user_id = p_user_id and workspace_id = p_workspace_id and day = p_day;
    u_connect := coalesce(u_connect, 0);
    u_message := coalesce(u_message, 0);
    u_profile := coalesce(u_profile, 0);
    u_job := coalesce(u_job, 0);

    select connects_sent, messages_sent, profiles_visited, job_pages_visited, cooldown_until
      into w_connect, w_message, w_profile, w_job, p_cooldown_until
      from public.sniper_workspace_usage_daily
      where workspace_id = p_workspace_id and day = p_day;
    w_connect := coalesce(w_connect, 0);
    w_message := coalesce(w_message, 0);
    w_profile := coalesce(w_profile, 0);
    w_job := coalesce(w_job, 0);
    cooldown_out := greatest(coalesce(cooldown_out, 'epoch'::timestamptz), coalesce(p_cooldown_until, 'epoch'::timestamptz));
    return query select u_connect, u_message, u_profile, u_job, w_connect, w_message, w_profile, w_job, cooldown_out;
    return;
  end if;

  insert into public.sniper_action_usage_daily (
    user_id, workspace_id, day,
    connects_sent, messages_sent, profiles_visited, job_pages_visited,
    last_action_at, cooldown_until
  ) values (
    p_user_id, p_workspace_id, p_day,
    p_connect_delta, p_message_delta, p_profile_delta, p_job_page_delta,
    now(), p_cooldown_until
  )
  on conflict (user_id, workspace_id, day) do update
    set connects_sent = public.sniper_action_usage_daily.connects_sent + excluded.connects_sent,
        messages_sent = public.sniper_action_usage_daily.messages_sent + excluded.messages_sent,
        profiles_visited = public.sniper_action_usage_daily.profiles_visited + excluded.profiles_visited,
        job_pages_visited = public.sniper_action_usage_daily.job_pages_visited + excluded.job_pages_visited,
        last_action_at = now(),
        cooldown_until = case
          when excluded.cooldown_until is null then public.sniper_action_usage_daily.cooldown_until
          else greatest(coalesce(public.sniper_action_usage_daily.cooldown_until, excluded.cooldown_until), excluded.cooldown_until)
        end
    where public.sniper_action_usage_daily.connects_sent + excluded.connects_sent <= p_connect_limit
      and public.sniper_action_usage_daily.messages_sent + excluded.messages_sent <= p_message_limit
      and public.sniper_action_usage_daily.profiles_visited + excluded.profiles_visited <= p_profile_limit
      and public.sniper_action_usage_daily.job_pages_visited + excluded.job_pages_visited <= p_job_page_limit
  returning connects_sent, messages_sent, profiles_visited, job_pages_visited, cooldown_until
  into u_connect, u_message, u_profile, u_job, cooldown_out;

  if u_connect is null then
    select connects_sent, messages_sent, profiles_visited, job_pages_visited, cooldown_until
      into u_connect, u_message, u_profile, u_job, cooldown_out
      from public.sniper_action_usage_daily
      where user_id = p_user_id and workspace_id = p_workspace_id and day = p_day;
    u_connect := coalesce(u_connect, 0);
    u_message := coalesce(u_message, 0);
    u_profile := coalesce(u_profile, 0);
    u_job := coalesce(u_job, 0);
    raise exception 'daily_user_limit_exceeded'
      using errcode = 'P0001', detail = json_build_object(
        'connects_sent', u_connect,
        'messages_sent', u_message,
        'profiles_visited', u_profile,
        'job_pages_visited', u_job
      )::text;
  end if;

  insert into public.sniper_workspace_usage_daily (
    workspace_id, day,
    connects_sent, messages_sent, profiles_visited, job_pages_visited,
    last_action_at, cooldown_until
  ) values (
    p_workspace_id, p_day,
    p_connect_delta, p_message_delta, p_profile_delta, p_job_page_delta,
    now(), p_cooldown_until
  )
  on conflict (workspace_id, day) do update
    set connects_sent = public.sniper_workspace_usage_daily.connects_sent + excluded.connects_sent,
        messages_sent = public.sniper_workspace_usage_daily.messages_sent + excluded.messages_sent,
        profiles_visited = public.sniper_workspace_usage_daily.profiles_visited + excluded.profiles_visited,
        job_pages_visited = public.sniper_workspace_usage_daily.job_pages_visited + excluded.job_pages_visited,
        last_action_at = now(),
        cooldown_until = case
          when excluded.cooldown_until is null then public.sniper_workspace_usage_daily.cooldown_until
          else greatest(coalesce(public.sniper_workspace_usage_daily.cooldown_until, excluded.cooldown_until), excluded.cooldown_until)
        end
    where public.sniper_workspace_usage_daily.connects_sent + excluded.connects_sent <= p_workspace_connect_limit
      and public.sniper_workspace_usage_daily.messages_sent + excluded.messages_sent <= p_workspace_message_limit
      and public.sniper_workspace_usage_daily.profiles_visited + excluded.profiles_visited <= p_workspace_profile_limit
      and public.sniper_workspace_usage_daily.job_pages_visited + excluded.job_pages_visited <= p_workspace_job_page_limit
  returning connects_sent, messages_sent, profiles_visited, job_pages_visited, cooldown_until
  into w_connect, w_message, w_profile, w_job, p_cooldown_until;

  if w_connect is null then
    select connects_sent, messages_sent, profiles_visited, job_pages_visited, cooldown_until
      into w_connect, w_message, w_profile, w_job, p_cooldown_until
      from public.sniper_workspace_usage_daily
      where workspace_id = p_workspace_id and day = p_day;
    w_connect := coalesce(w_connect, 0);
    w_message := coalesce(w_message, 0);
    w_profile := coalesce(w_profile, 0);
    w_job := coalesce(w_job, 0);
    raise exception 'daily_workspace_limit_exceeded'
      using errcode = 'P0001', detail = json_build_object(
        'connects_sent', w_connect,
        'messages_sent', w_message,
        'profiles_visited', w_profile,
        'job_pages_visited', w_job
      )::text;
  end if;

  cooldown_out := greatest(coalesce(cooldown_out, 'epoch'::timestamptz), coalesce(p_cooldown_until, 'epoch'::timestamptz));
  return query select u_connect, u_message, u_profile, u_job, w_connect, w_message, w_profile, w_job, cooldown_out;
end;
$$;

grant execute on function public.sniper_reserve_action_usage(
  uuid, uuid, date, integer, integer, integer, integer,
  integer, integer, integer, integer, integer, integer, integer, integer,
  timestamptz
) to authenticated;

