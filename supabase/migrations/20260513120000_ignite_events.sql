begin;

-- -------------------------------------------------------------------
-- Ignite Events module
-- Internal events: client_id is null, event hosted by Ignite team
-- External (client) events: client_id references public.ignite_clients
-- -------------------------------------------------------------------

create table if not exists public.ignite_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.workspaces(id) on delete set null,
  client_id uuid null references public.ignite_clients(id) on delete set null,
  kind text not null default 'internal' check (kind in ('internal', 'external')),
  status text not null default 'draft' check (status in ('draft', 'planning', 'live', 'closed')),
  name text not null,
  client_name_override text null,
  start_date date null,
  end_date date null,
  city text null,
  venue text null,
  headcount integer not null default 0,
  primary_contact text null,
  owner_name text null,
  description text null,
  target_margin_pct numeric(6, 2) not null default 20,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ignite_events_workspace
  on public.ignite_events(workspace_id, created_at desc);
create index if not exists idx_ignite_events_client
  on public.ignite_events(client_id);
create index if not exists idx_ignite_events_status
  on public.ignite_events(status, start_date desc);

drop trigger if exists trg_ignite_events_updated_at on public.ignite_events;
create trigger trg_ignite_events_updated_at
before update on public.ignite_events
for each row execute procedure public.set_updated_at();

create table if not exists public.ignite_event_sponsors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.ignite_events(id) on delete cascade,
  name text not null,
  kind text not null default 'cash' check (kind in ('cash', 'in_kind')),
  amount numeric(14, 2) not null default 0,
  status text not null default 'prospect' check (status in ('prospect', 'committed', 'invoiced', 'paid')),
  contact text null,
  notes text null,
  referral_owner text null,
  referral_percent numeric(5, 2) null,
  sort_order integer not null default 0,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ignite_event_sponsors_event
  on public.ignite_event_sponsors(event_id, sort_order);

drop trigger if exists trg_ignite_event_sponsors_updated_at on public.ignite_event_sponsors;
create trigger trg_ignite_event_sponsors_updated_at
before update on public.ignite_event_sponsors
for each row execute procedure public.set_updated_at();

create table if not exists public.ignite_event_costs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.ignite_events(id) on delete cascade,
  category text not null,
  description text not null,
  vendor text null,
  qty numeric(14, 4) not null default 1,
  unit_cost numeric(14, 4) not null default 0,
  status text not null default 'budgeted' check (status in ('budgeted', 'committed', 'invoiced', 'paid')),
  notes text null,
  sort_order integer not null default 0,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ignite_event_costs_event
  on public.ignite_event_costs(event_id, sort_order);

drop trigger if exists trg_ignite_event_costs_updated_at on public.ignite_event_costs;
create trigger trg_ignite_event_costs_updated_at
before update on public.ignite_event_costs
for each row execute procedure public.set_updated_at();

create table if not exists public.ignite_event_documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.ignite_events(id) on delete cascade,
  name text not null,
  doc_type text not null default 'misc' check (doc_type in ('beo', 'invoice', 'contract', 'quote', 'misc')),
  file_url text null,
  file_path text null,
  uploaded_by uuid null references auth.users(id) on delete set null,
  uploaded_by_name text null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ignite_event_documents_event
  on public.ignite_event_documents(event_id, created_at desc);

-- -------------------------------------------------------------------
-- Row-level security: team-only for the cost ledger.
-- (Costs reveal Ignite's margin, so we don't expose to ignite_client role.)
-- -------------------------------------------------------------------

alter table public.ignite_events enable row level security;
alter table public.ignite_event_sponsors enable row level security;
alter table public.ignite_event_costs enable row level security;
alter table public.ignite_event_documents enable row level security;

drop policy if exists ignite_events_team_access on public.ignite_events;
create policy ignite_events_team_access on public.ignite_events
  for all
  using (public.ignite_is_team_member())
  with check (public.ignite_is_team_member());

drop policy if exists ignite_event_sponsors_team_access on public.ignite_event_sponsors;
create policy ignite_event_sponsors_team_access on public.ignite_event_sponsors
  for all
  using (public.ignite_is_team_member())
  with check (public.ignite_is_team_member());

drop policy if exists ignite_event_costs_team_access on public.ignite_event_costs;
create policy ignite_event_costs_team_access on public.ignite_event_costs
  for all
  using (public.ignite_is_team_member())
  with check (public.ignite_is_team_member());

drop policy if exists ignite_event_documents_team_access on public.ignite_event_documents;
create policy ignite_event_documents_team_access on public.ignite_event_documents
  for all
  using (public.ignite_is_team_member())
  with check (public.ignite_is_team_member());

commit;
