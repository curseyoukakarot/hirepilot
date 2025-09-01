-- Add flags to control live human engagement and REX suppression
alter table if exists rex_live_sessions
  add column if not exists human_engaged_at timestamptz,
  add column if not exists rex_disabled boolean default false;

