create table if not exists sniper_settings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  user_id uuid not null,
  settings jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists uq_sniper_settings_account on sniper_settings(account_id);
create index if not exists idx_sniper_settings_user on sniper_settings(user_id);

create table if not exists sniper_settings_audit (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  user_id uuid not null,
  before jsonb,
  after jsonb,
  created_at timestamptz default now()
);


