-- Add Slack OAuth storage columns for user_settings
alter table public.user_settings
  add column if not exists slack_access_token text,
  add column if not exists slack_team_id text,
  add column if not exists slack_bot_user_id text;
