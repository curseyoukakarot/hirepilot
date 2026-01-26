-- Phase 3.6: Workspace naming defaults + team sync (idempotent)

begin;

-- Update default workspace creation to prefer company name and team plan
create or replace function public.ensure_default_workspace_for_user(p_user_id uuid)
returns uuid
language plpgsql
as $$
declare
  existing_id uuid;
  ws_id uuid;
  ws_name text;
  plan_name text;
  role_name text;
  team_id uuid;
  seat_ct int;
  company_name text;
  first_name text;
begin
  select wm.workspace_id
    into existing_id
  from public.workspace_members wm
  where wm.user_id = p_user_id
  order by wm.created_at asc
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  -- Determine name base (company → full_name → first_name → My)
  if public.column_exists('users','company') then
    select nullif(trim(u.company),'') into company_name
    from public.users u
    where u.id = p_user_id;
  end if;
  if public.column_exists('users','first_name') then
    select nullif(trim(u.first_name),'') into first_name
    from public.users u
    where u.id = p_user_id;
  end if;

  if company_name is not null and length(company_name) > 0 then
    ws_name := company_name;
  elsif first_name is not null and length(first_name) > 0 then
    ws_name := first_name || '''s Workspace';
  else
    ws_name := 'My Workspace';
  end if;

  select coalesce(u.plan, 'free'), coalesce(u.role, ''), u.team_id
    into plan_name, role_name, team_id
  from public.users u
  where u.id = p_user_id;

  -- Normalize plan to team if role indicates team admin
  if lower(role_name) in ('team_admin','teamadmin') then
    plan_name := 'team';
  end if;

  if lower(plan_name) = 'team' then
    seat_ct := greatest(5, (
      select count(*)::int from public.users u2
      where u2.team_id = team_id and coalesce(u2.role,'') not ilike 'job_seeker%'
    ));
  else
    seat_ct := 1;
  end if;

  insert into public.workspaces (name, type, plan, seat_count, created_by)
  values (ws_name, 'recruiter', coalesce(plan_name, 'free'), seat_ct, p_user_id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role, status, created_at)
  values (ws_id, p_user_id, 'owner', 'active', now())
  on conflict (workspace_id, user_id) do nothing;

  return ws_id;
end;
$$;

-- Sync team members into owner's workspace (team_admin only)
create or replace function public.sync_team_workspace_members(p_user_id uuid)
returns void
language plpgsql
as $$
declare
  ws_id uuid;
  t_id uuid;
  role_name text;
  seat_ct int;
begin
  select u.team_id, coalesce(u.role,'') into t_id, role_name
  from public.users u
  where u.id = p_user_id;

  if t_id is null then
    return;
  end if;

  if lower(role_name) not in ('team_admin','teamadmin') then
    return;
  end if;

  select wm.workspace_id
    into ws_id
  from public.workspace_members wm
  where wm.user_id = p_user_id
  order by wm.created_at asc
  limit 1;

  if ws_id is null then
    ws_id := public.ensure_default_workspace_for_user(p_user_id);
  end if;

  seat_ct := greatest(5, (
    select count(*)::int from public.users u3
    where u3.team_id = t_id and coalesce(u3.role,'') not ilike 'job_seeker%'
  ));

  update public.workspaces
    set plan = 'team', seat_count = seat_ct
    where id = ws_id;

  insert into public.workspace_members (workspace_id, user_id, role, status, invited_by, created_at)
  select ws_id, u.id, 'member', 'active', p_user_id, now()
  from public.users u
  where u.team_id = t_id
    and u.id <> p_user_id
    and coalesce(u.role,'') not ilike 'job_seeker%'
  on conflict (workspace_id, user_id) do nothing;
end;
$$;

-- Optional backfill: ensure team workspaces reflect team membership
create or replace function public.backfill_team_workspace_members()
returns void
language plpgsql
as $$
declare
  r record;
begin
  for r in
    select id from public.users
    where team_id is not null
      and lower(coalesce(role,'')) in ('team_admin','teamadmin')
  loop
    perform public.sync_team_workspace_members(r.id);
  end loop;
end;
$$;

commit;
