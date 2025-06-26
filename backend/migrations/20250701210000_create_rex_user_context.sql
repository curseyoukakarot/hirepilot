-- SQL migration: create rex_user_context table
create extension if not exists "uuid-ossp";

create table if not exists rex_user_context (
  id uuid primary key default uuid_generate_v4(),
  supabase_user_id uuid references auth.users(id) on delete cascade,
  slack_user_id text,
  slack_user_email text,
  latest_campaign_id text,
  updated_at timestamptz default now()
);

-- index for quick lookup by slack_user_id
create index if not exists idx_slack_user_id on rex_user_context(slack_user_id);
-- index for supabase_user_id
create index if not exists idx_supabase_user_id on rex_user_context(supabase_user_id); 