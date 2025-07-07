-- Create webhooks table to allow users to register external URLs
-- that HirePilot will POST events to.

create extension if not exists "pgcrypto";

create table if not exists webhooks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  url text not null,
  secret text not null, -- shared secret for signature HMAC
  event text not null,  -- e.g. lead.created, lead.updated, lead.stage_changed
  created_at timestamptz default now()
);

alter table webhooks enable row level security;

-- Allow users to see / manage only their own webhooks
create policy "webhooks_select_own" on webhooks
  for select using ( user_id = auth.uid() );

create policy "webhooks_insert_own" on webhooks
  for insert with check ( user_id = auth.uid() );

create policy "webhooks_delete_own" on webhooks
  for delete using ( user_id = auth.uid() );

-- indexes
create index if not exists idx_webhooks_user_id on webhooks(user_id);
create index if not exists idx_webhooks_event on webhooks(event); 