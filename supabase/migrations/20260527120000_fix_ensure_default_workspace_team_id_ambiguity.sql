-- Fix: "column reference \"team_id\" is ambiguous" raised when inserting into
-- leads/candidates/etc. for users on the team plan.
--
-- ensure_default_workspace_for_user declared a local variable named `team_id`
-- and then referenced it as `team_id` (unqualified) on the RHS of
-- `where u2.team_id = team_id`, which Postgres treats as ambiguous between the
-- local variable and the column. Rename the local to v_team_id.

begin;

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
  v_team_id uuid;
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
    into plan_name, role_name, v_team_id
  from public.users u
  where u.id = p_user_id;

  if lower(role_name) in ('team_admin','teamadmin') then
    plan_name := 'team';
  end if;

  if lower(plan_name) = 'team' then
    seat_ct := greatest(5, (
      select count(*)::int from public.users u2
      where u2.team_id = v_team_id and coalesce(u2.role,'') not ilike 'job_seeker%'
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

commit;
