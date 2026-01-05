-- Track whether we've sent the Affiliate welcome email (to avoid resending on login).
alter table public.affiliates
  add column if not exists welcome_sent_at timestamptz;

-- Backfill: existing affiliates have already been welcomed (some repeatedly due to the bug),
-- so prevent one more email from being sent after this migration is deployed.
update public.affiliates
set welcome_sent_at = joined_at
where welcome_sent_at is null;


