-- Track whether we've sent the Job Seeker welcome email.
alter table if exists public.users
  add column if not exists job_seeker_welcome_sent_at timestamptz;


