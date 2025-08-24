-- Adds agent_mode_enabled toggle to user_settings
alter table if exists user_settings
  add column if not exists agent_mode_enabled boolean default false;


