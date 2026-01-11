-- Agentic Scheduler Sourcing (run logs + lead tagging + preferences)
-- Idempotent: safe to run multiple times.

-- 1) Run logs: persistent memory per schedule run
create table if not exists schedule_run_logs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references schedules(id) on delete cascade,
  user_id uuid not null,
  persona_id uuid,
  campaign_id uuid,
  ran_at timestamptz not null default now(),
  next_run_at timestamptz,

  -- Attempts + decisioning
  attempts jsonb not null default '[]'::jsonb,
  accepted_query jsonb,
  metrics jsonb not null default '{}'::jsonb,
  quality_score int,
  confidence numeric,
  decision text,
  failure_mode text,

  -- Outcome counts
  leads_found_count int,
  leads_deduped_count int,
  leads_inserted_count int,

  -- Outreach
  outreach_enabled boolean default false,
  outreach_queued_count int,

  -- Notifications
  notify_user boolean default false,
  notify_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_schedule_run_logs_schedule_ran_at
  on schedule_run_logs(schedule_id, ran_at desc);

create index if not exists idx_schedule_run_logs_user_ran_at
  on schedule_run_logs(user_id, ran_at desc);

-- 2) Schedules: lightweight “memory” + preferences for next run
alter table schedules add column if not exists last_quality_score int;
alter table schedules add column if not exists last_accepted_query jsonb;
alter table schedules add column if not exists consecutive_failures int not null default 0;
alter table schedules add column if not exists agentic_prefs jsonb not null default '{}'::jsonb;

-- 3) Lead tagging: enable /leads?run_id=... and deep links
alter table sourcing_leads add column if not exists scheduler_run_id uuid;
create index if not exists idx_sourcing_leads_scheduler_run_id on sourcing_leads(scheduler_run_id);

alter table leads add column if not exists scheduler_run_id uuid;
create index if not exists idx_leads_scheduler_run_id on leads(scheduler_run_id);

-- 4) User notification toggles (opt-in for email)
alter table user_settings add column if not exists scheduler_email_results boolean not null default false;
alter table user_settings add column if not exists scheduler_slack_results boolean not null default true;

