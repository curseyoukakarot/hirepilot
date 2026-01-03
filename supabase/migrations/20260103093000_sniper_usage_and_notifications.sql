-- Sniper v1: daily connect quota bookkeeping + job notification idempotency

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------------------------
-- 1) Daily usage (per user, per day) for LinkedIn connect requests
-- ------------------------------------------------------------------------------------

create table if not exists public.sniper_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null,
  day date not null,
  connect_reserved integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists idx_sniper_daily_usage_workspace_day on public.sniper_daily_usage(workspace_id, day);

drop trigger if exists trg_sniper_daily_usage_updated_at on public.sniper_daily_usage;
create trigger trg_sniper_daily_usage_updated_at
before update on public.sniper_daily_usage
for each row execute procedure public.set_updated_at();

alter table public.sniper_daily_usage enable row level security;

drop policy if exists sniper_daily_usage_select on public.sniper_daily_usage;
create policy sniper_daily_usage_select on public.sniper_daily_usage
for select using (user_id = auth.uid() and public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_daily_usage_upsert on public.sniper_daily_usage;
create policy sniper_daily_usage_upsert on public.sniper_daily_usage
for all using (user_id = auth.uid() and public.sniper_is_in_workspace(workspace_id))
with check (user_id = auth.uid() and public.sniper_is_in_workspace(workspace_id));

-- Atomic reservation helper (prevents race conditions)
create or replace function public.sniper_reserve_daily_connects(
  p_user_id uuid,
  p_workspace_id uuid,
  p_day date,
  p_delta integer,
  p_limit integer default 20
)
returns table(used_today integer, remaining_today integer)
language plpgsql
as $$
declare
  next_used integer;
begin
  if p_delta is null or p_delta <= 0 then
    select connect_reserved into next_used
      from public.sniper_daily_usage
      where user_id = p_user_id and day = p_day;
    next_used := coalesce(next_used, 0);
    return query select next_used, greatest(0, p_limit - next_used);
    return;
  end if;

  insert into public.sniper_daily_usage (user_id, workspace_id, day, connect_reserved)
  values (p_user_id, p_workspace_id, p_day, p_delta)
  on conflict (user_id, day) do update
    set connect_reserved = public.sniper_daily_usage.connect_reserved + excluded.connect_reserved,
        workspace_id = excluded.workspace_id,
        updated_at = now()
    where public.sniper_daily_usage.connect_reserved + excluded.connect_reserved <= p_limit
  returning connect_reserved into next_used;

  if next_used is null then
    -- cap exceeded; expose current usage in error detail
    select connect_reserved into next_used
      from public.sniper_daily_usage
      where user_id = p_user_id and day = p_day;
    next_used := coalesce(next_used, 0);
    raise exception 'daily_connect_limit_exceeded'
      using errcode = 'P0001', detail = next_used::text;
  end if;

  return query select next_used, greatest(0, p_limit - next_used);
end;
$$;

grant execute on function public.sniper_reserve_daily_connects(uuid, uuid, date, integer, integer) to authenticated;

-- ------------------------------------------------------------------------------------
-- 2) Job notification idempotency
-- ------------------------------------------------------------------------------------

alter table public.sniper_jobs add column if not exists notified_at timestamptz null;
create index if not exists idx_sniper_jobs_notified_at on public.sniper_jobs(workspace_id, notified_at);


