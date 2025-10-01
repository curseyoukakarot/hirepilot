-- Fix auth create failures due to profiles email unique index conflicts
-- and incorrect column references in email sync trigger.

begin;

-- 1) Drop problematic unique index on profiles.email (lower) if it exists.
--    This index can cause "Database error creating new user" when a duplicate
--    email profile row exists from earlier data imports.
do $$
begin
  if exists (
    select 1 from pg_indexes 
    where schemaname = 'public' and indexname = 'profiles_email_unique_idx'
  ) then
    execute 'drop index if exists public.profiles_email_unique_idx';
  end if;
end$$;

-- 2) Ensure handle_new_user() uses idempotent upsert by id
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;$$;

-- 3) Fix sync_email_change() to update profiles by id (not user_id)
create or replace function public.sync_email_change()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.users
  set email = new.email
  where id = new.id;

  update public.profiles
  set email = new.email
  where id = new.id;

  update public.user_settings
  set email = new.email
  where user_id = new.id;

  return new;
end;
$$;

commit;


