-- Add enhanced insights gating metadata
alter table public.leads
  add column if not exists enhanced_insights_unlocked boolean not null default false,
  add column if not exists enhanced_insights jsonb default '{}'::jsonb;

alter table public.candidates
  add column if not exists enhanced_insights_unlocked boolean not null default false,
  add column if not exists enhanced_insights jsonb default '{}'::jsonb;

