-- Idempotent creation of zap_events table compatible with existing schema
create table if not exists public.zap_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_type text not null,
  event_data jsonb not null default '{}',
  source_table text,
  source_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_zap_events_created_at on public.zap_events (created_at desc);
create index if not exists idx_zap_events_event_type on public.zap_events (event_type);
create index if not exists idx_zap_events_user on public.zap_events (user_id);


