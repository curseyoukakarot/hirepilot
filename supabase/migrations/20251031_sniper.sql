-- Remote sessions and sniper jobs tables
-- Ensure pgcrypto or gen_random_uuid() is available (Supabase includes it)

create table if not exists remote_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  user_id uuid not null,
  name text not null,
  encrypted_session_data bytea not null,
  metadata jsonb,
  health jsonb,
  last_tested_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_remote_sessions_user on remote_sessions(user_id);
create index if not exists idx_remote_sessions_account on remote_sessions(account_id);

create table if not exists sniper_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  user_id uuid not null,
  campaign_id uuid,
  session_id uuid,
  source text not null,
  action text not null,
  payload jsonb,
  status text not null default 'queued',
  result jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_sniper_jobs_account on sniper_jobs(account_id);
create index if not exists idx_sniper_jobs_user on sniper_jobs(user_id);
create index if not exists idx_sniper_jobs_session on sniper_jobs(session_id);
create index if not exists idx_sniper_jobs_status on sniper_jobs(status);


