-- Harden auth helper functions so RLS checks that consult public.users do not
-- fail with "permission denied for table users" during token validation.
-- These functions are read-only and safe to run as SECURITY DEFINER.

begin;

-- Ensure stable search_path for SECURITY DEFINER functions
set local search_path = public;

-- Recreate role_for() with SECURITY DEFINER (read-only)
create or replace function public.role_for()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r text;
  claims jsonb;
begin
  -- Prefer app DB role if present
  begin
    select u.role into r from public.users u where u.id = auth.uid();
  exception when others then
    r := null;
  end;
  if r is not null then
    return r;
  end if;

  -- Fallback to JWT app/user metadata
  claims := coalesce(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb);
  r := coalesce(
    (claims -> 'app_metadata' ->> 'role'),
    (claims -> 'user_metadata' ->> 'role'),
    null
  );
  if r is not null then
    return r;
  end if;

  return 'authenticated';
end;
$$;

-- Recreate is_admin() with SECURITY DEFINER (delegates to role_for)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.role_for() in (
    'admin','super_admin','team_admin','team_admins','owner','account_owner','org_admin'
  );
$$;

commit;


