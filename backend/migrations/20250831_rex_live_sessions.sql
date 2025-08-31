-- Create table to track live human takeover sessions from REX widget
create table if not exists rex_live_sessions (
  id uuid primary key default gen_random_uuid(),
  widget_session_id text not null,
  slack_channel_id text not null,
  slack_thread_ts text not null,
  user_email text,
  user_name text,
  created_at timestamptz default now(),
  last_human_reply timestamptz,
  fallback_sent boolean default false
);

create index if not exists idx_rex_thread on rex_live_sessions(slack_thread_ts);
create index if not exists idx_rex_session on rex_live_sessions(widget_session_id);

