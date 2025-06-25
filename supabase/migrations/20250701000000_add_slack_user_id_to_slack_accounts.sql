-- Adds slack_user_id column to slack_accounts for slash command mapping
alter table public.slack_accounts add column if not exists slack_user_id text unique; 