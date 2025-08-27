-- Sales Agent core schema (idempotent)

create table if not exists sales_agent_policies (
  user_id uuid primary key,
  policy jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists sales_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lead_id uuid references sourcing_leads(id) on delete set null,
  channel text not null check (channel in ('email','linkedin','web')),
  external_thread_id text,
  status text not null default 'awaiting_prospect',
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  meta jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_sales_threads_user on sales_threads(user_id, status);

create table if not exists sales_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references sales_threads(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound','draft')),
  sender text,
  recipient text,
  subject text,
  body text,
  assets jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_sales_messages_thread on sales_messages(thread_id, created_at);

create table if not exists sales_actions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references sales_threads(id) on delete cascade,
  action text not null,
  payload jsonb,
  created_at timestamptz default now()
);


