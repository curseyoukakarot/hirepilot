-- Restore minimal public.profiles table and auth.users trigger used by Supabase starter templates
-- Root cause observed: ERROR: relation "profiles" does not exist during /admin/users create

-- 1) Create profiles table if missing
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  website text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Optional: basic updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- 2) Create handle_new_user() function (idempotent) to insert a profile on auth user creation
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;$$;

-- 3) Recreate trigger hooking auth.users → profiles insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 4) Grants (keep simple; adjust as needed)
grant select, insert, update, delete on table public.profiles to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;


