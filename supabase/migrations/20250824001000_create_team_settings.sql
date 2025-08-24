-- Team-level settings table to control Agent Mode for teams (admin-scoped)
create table if not exists team_settings (
  team_admin_id uuid primary key references auth.users(id) on delete cascade,
  agent_mode_enabled boolean default false,
  updated_at timestamptz default now()
);

-- Index for lookups by admin
create index if not exists idx_team_settings_admin on team_settings(team_admin_id);


