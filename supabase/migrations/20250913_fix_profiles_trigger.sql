-- Ensure profiles has expected email column and correct trigger for auth user creation

-- 1) Add missing columns if they do not exist
alter table if exists public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists website text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- 2) Replace handle_new_user() to insert id and email (now guaranteed to exist)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;$$;

-- 3) Ensure trigger is present
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


