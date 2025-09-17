-- Email sync trigger and constraints
-- Ensures changes in auth.users.email cascade to app tables

-- Function to cascade email updates
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
  where user_id = new.id;

  update public.user_settings
  set email = new.email
  where user_id = new.id;

  return new;
end;
$$;

drop trigger if exists sync_email_change on auth.users;
create trigger sync_email_change
after update of email on auth.users
for each row
execute function public.sync_email_change();

-- Guardrails: unique email across user-facing tables
-- First, deduplicate any existing duplicates by nulling secondary entries.
-- This avoids migration failure when introducing uniqueness.

-- Deduplicate public.users (keep the earliest created row per email)
with ranked as (
  select id, email,
         row_number() over (partition by lower(email) order by created_at asc nulls last, id) as rn
  from public.users
  where email is not null
)
update public.users u
set email = concat('dedup+', r.id::text, '@invalid.local')
from ranked r
where u.id = r.id and r.rn > 1;

-- Deduplicate public.profiles
with ranked_p as (
  select user_id, email,
         row_number() over (partition by lower(email) order by user_id) as rn
  from public.profiles
  where email is not null
)
update public.profiles p
set email = concat('dedup+', r.user_id::text, '@invalid.local')
from ranked_p r
where p.user_id = r.user_id and r.rn > 1;

-- Deduplicate public.user_settings
with ranked_s as (
  select user_id, email,
         row_number() over (partition by lower(email) order by user_id) as rn
  from public.user_settings
  where email is not null
)
update public.user_settings s
set email = concat('dedup+', r.user_id::text, '@invalid.local')
from ranked_s r
where s.user_id = r.user_id and r.rn > 1;

-- Now enforce uniqueness using case-insensitive partial unique indexes
create unique index if not exists users_email_unique_idx
  on public.users (lower(email)) where email is not null;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email)) where email is not null;

create unique index if not exists user_settings_email_unique_idx
  on public.user_settings (lower(email)) where email is not null;


