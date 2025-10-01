-- Fix user bootstrap failures: ensure user_settings is initialized without
-- RLS violations, add expected columns to public.users, and align
-- job_guest_collaborators schema with backend usage.

begin;

-- 1) Initialize user_settings on auth.users insert using SECURITY DEFINER
--    so it bypasses RLS safely. Idempotent upsert by user_id.
create or replace function public.initialize_user_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Recreate trigger to hook into auth.users creation
drop trigger if exists on_auth_user_settings_init on auth.users;
create trigger on_auth_user_settings_init
after insert on auth.users
for each row execute function public.initialize_user_settings();

-- 2) Ensure expected columns exist on public.users referenced by API
alter table public.users
  add column if not exists plan text,
  add column if not exists remaining_credits integer default 0,
  add column if not exists monthly_credits integer default 0,
  add column if not exists plan_updated_at timestamptz,
  add column if not exists is_guest boolean default false;

-- 3) Align job_guest_collaborators with backend usage (status/user_id/updated_at)
alter table public.job_guest_collaborators
  add column if not exists status text default 'pending',
  add column if not exists user_id uuid references public.users(id) on delete set null,
  add column if not exists updated_at timestamptz default now();

-- Constrain status to expected values
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'job_guest_collaborators' and c.conname = 'job_guest_collaborators_status_chk'
  ) then
    alter table public.job_guest_collaborators
      add constraint job_guest_collaborators_status_chk
      check (status in ('pending','accepted','declined'));
  end if;
end$$;

commit;


