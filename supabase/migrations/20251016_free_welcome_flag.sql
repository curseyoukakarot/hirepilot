-- Add flag to track when Free Forever welcome email was sent
alter table if exists public.users
  add column if not exists free_welcome_sent_at timestamptz;


