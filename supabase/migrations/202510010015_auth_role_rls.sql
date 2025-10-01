-- Canonical role resolution helpers and baseline RLS policies (safe, non-enforcing)
-- NOTE: This migration does NOT enable RLS on any table. Policies are inert until
--       RLS is explicitly enabled with: ALTER TABLE ... ENABLE ROW LEVEL SECURITY;

-- Helper: current JWT claims as jsonb
create or replace function public.jwt_claims()
returns jsonb
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb);
$$;

-- Helper: canonical role for current user
create or replace function public.role_for()
returns text
language plpgsql
stable
as $$
declare
  r text;
  claims jsonb;
begin
  -- 1) Prefer app DB role
  begin
    select u.role into r from public.users u where u.id = auth.uid();
  exception when others then
    r := null;
  end;
  if r is not null then
    return r;
  end if;

  -- 2) Fallback to JWT app_metadata.role or user_metadata.role
  claims := public.jwt_claims();
  r := coalesce(
    (claims -> 'app_metadata' ->> 'role'),
    (claims -> 'user_metadata' ->> 'role'),
    null
  );
  if r is not null then
    return r;
  end if;

  -- 3) Default
  return 'authenticated';
end;
$$;

-- Helper: is admin-like role
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.role_for() in ('admin','super_admin','team_admin','team_admins');
$$;

-- Baseline (non-enforcing) policies for key tables. These only take effect if RLS is enabled.
-- public.users
do $$
begin
  if not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'users' and p.policyname = 'users_select_owner_or_admin'
  ) then
    execute $p1$create policy users_select_owner_or_admin on public.users
      for select
      using (
        (id = auth.uid()) or public.is_admin()
      )$p1$;
  end if;

  if not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'users' and p.policyname = 'users_update_owner_or_admin'
  ) then
    execute $p2$create policy users_update_owner_or_admin on public.users
      for update
      using (
        (id = auth.uid()) or public.is_admin()
      )
      with check (
        (id = auth.uid()) or public.is_admin()
      )$p2$;
  end if;
end$$;

-- public.user_settings
do $$
begin
  if not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'user_settings' and p.policyname = 'user_settings_owner_or_admin'
  ) then
    execute $p3$create policy user_settings_owner_or_admin on public.user_settings
      for all
      using (
        (user_id = auth.uid()) or public.is_admin()
      )
      with check (
        (user_id = auth.uid()) or public.is_admin()
      )$p3$;
  end if;
end$$;

-- public.user_credits
do $$
begin
  if not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'user_credits' and p.policyname = 'user_credits_owner_or_admin'
  ) then
    execute $p4$create policy user_credits_owner_or_admin on public.user_credits
      for all
      using (
        (user_id = auth.uid()) or public.is_admin()
      )
      with check (
        (user_id = auth.uid()) or public.is_admin()
      )$p4$;
  end if;
end$$;

-- Optional: add future policy stubs for other tables here as needed

-- Safety note: We intentionally do NOT enable RLS here.
-- To enable on a table, run (in a controlled rollout):
--   alter table public.users enable row level security;
--   alter table public.user_settings enable row level security;
--   alter table public.user_credits enable row level security;


