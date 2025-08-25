-- stores encrypted linkedin session by user
create table if not exists linkedin_sessions (
  user_id uuid primary key,
  enc_cookie text not null,
  enc_li_at text not null,
  enc_jsessionid text,
  updated_at timestamptz default now()
);

-- sniper targets (post/keyword watchers)
create table if not exists sniper_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null check (type in ('own','competitor','keyword')),
  post_url text,
  keyword_match text,
  daily_cap int not null default 15,
  active_from timestamptz default now(),
  active_to timestamptz,
  status text not null default 'active',
  campaign_id uuid references sourcing_campaigns(id) on delete set null,
  created_at timestamptz default now()
);

-- captured profiles per target
create table if not exists sniper_captures (
  id uuid primary key default gen_random_uuid(),
  target_id uuid references sniper_targets(id) on delete cascade,
  name text,
  company text,
  linkedin_url text,
  engaged_at timestamptz,
  captured_at timestamptz default now(),
  unique(target_id, linkedin_url)
);

-- run logs
create table if not exists sniper_runs (
  id uuid primary key default gen_random_uuid(),
  target_id uuid references sniper_targets(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz,
  success_count int default 0,
  error_count int default 0,
  log text
);

create index if not exists idx_sniper_targets_user on sniper_targets(user_id, status);
create index if not exists idx_sniper_captures_target on sniper_captures(target_id, captured_at);

-- Opener preferences on target
alter table sniper_targets
  add column if not exists send_opener boolean default false,
  add column if not exists opener_template_id uuid,
  add column if not exists opener_subject text,
  add column if not exists opener_body text;

-- Per-target daily opener send log (light)
create table if not exists sniper_opener_sends (
  id uuid primary key default gen_random_uuid(),
  target_id uuid references sniper_targets(id) on delete cascade,
  lead_id uuid references sourcing_leads(id) on delete cascade,
  email text,
  sent_at timestamptz default now()
);

create index if not exists idx_sniper_opener_sends_target_day
  on sniper_opener_sends(target_id, sent_at);


