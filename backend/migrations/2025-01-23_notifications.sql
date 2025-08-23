-- Notifications and Agent Interactions for Sourcing Agent
-- Migration: 2025-01-23_notifications.sql

-- Actionable notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source text default 'inapp',         -- inapp|slack
  thread_key text,                     -- e.g. 'sourcing:<campaignId>:<leadId>'
  title text not null,
  body_md text,
  actions jsonb,                       -- [{id,type,label,...}]
  created_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_notifications_thread on notifications(thread_key);
create index if not exists idx_notifications_created_at on notifications(created_at);
create index if not exists idx_notifications_unread on notifications(user_id, read_at) where read_at is null;

-- User interactions on notifications (buttons, inputs, etc)
create table if not exists agent_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source text not null,                -- inapp|slack
  thread_key text,
  action_type text not null,           -- button|select|input
  action_id text not null,
  data jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_interactions_user on agent_interactions(user_id);
create index if not exists idx_interactions_thread on agent_interactions(thread_key);
create index if not exists idx_interactions_created_at on agent_interactions(created_at);
create index if not exists idx_interactions_action on agent_interactions(action_type, action_id);

-- Add notification type for better categorization
alter table notifications add column if not exists type text default 'general';
create index if not exists idx_notifications_type on notifications(type);

-- Add metadata for richer interactions
alter table agent_interactions add column if not exists metadata jsonb;
alter table agent_interactions add column if not exists processed_at timestamptz;
alter table agent_interactions add column if not exists result jsonb;

-- Performance indexes for common queries
create index if not exists idx_notifications_user_unread_recent on notifications(user_id, created_at desc) 
  where read_at is null;
create index if not exists idx_interactions_thread_recent on agent_interactions(thread_key, created_at desc);

-- Ensure thread_key exists in agent_runs table (from previous migration)
alter table agent_runs add column if not exists thread_key text;
create index if not exists idx_agent_runs_thread_key on agent_runs(thread_key);

-- Comments for documentation
comment on table notifications is 'Actionable notifications for users with interactive elements';
comment on table agent_interactions is 'User interactions with notification actions (buttons, inputs, etc)';
comment on column notifications.thread_key is 'Unique identifier for conversation threads (e.g., sourcing:<campaignId>:<leadId>)';
comment on column notifications.actions is 'JSON array of interactive elements: [{id, type, label, ...}]';
comment on column agent_interactions.data is 'User input data from interaction (button clicks, form inputs, etc)';
comment on column agent_interactions.metadata is 'Additional context about the interaction';
comment on column agent_interactions.result is 'Processing result or response from the interaction';
