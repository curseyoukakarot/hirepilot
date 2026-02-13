begin;

create extension if not exists pgcrypto;

-- Shared updated_at trigger helper (safe to replace)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------------------
-- Core Ignite entities
-- -------------------------------------------------------------------
create table if not exists public.ignite_clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.workspaces(id) on delete set null,
  name text not null,
  legal_name text null,
  external_ref text null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ignite_clients_workspace_id on public.ignite_clients(workspace_id);
create index if not exists idx_ignite_clients_name on public.ignite_clients(name);

drop trigger if exists trg_ignite_clients_updated_at on public.ignite_clients;
create trigger trg_ignite_clients_updated_at
before update on public.ignite_clients
for each row execute procedure public.set_updated_at();

create table if not exists public.ignite_client_users (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.workspaces(id) on delete set null,
  client_id uuid null references public.ignite_clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('ignite_admin', 'ignite_team', 'ignite_client')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_ignite_client_users_user_client_role
  on public.ignite_client_users(user_id, client_id, role);
create index if not exists idx_ignite_client_users_user_status
  on public.ignite_client_users(user_id, status);
create index if not exists idx_ignite_client_users_client
  on public.ignite_client_users(client_id);

drop trigger if exists trg_ignite_client_users_updated_at on public.ignite_client_users;
create trigger trg_ignite_client_users_updated_at
before update on public.ignite_client_users
for each row execute procedure public.set_updated_at();

create table if not exists public.ignite_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.workspaces(id) on delete set null,
  client_id uuid not null references public.ignite_clients(id) on delete cascade,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'internal_review', 'client_preview', 'shared', 'archived')),
  pricing_mode text not null default 'cost_plus' check (pricing_mode in ('cost_plus', 'turnkey')),
  currency text not null default 'USD',
  assumptions_json jsonb not null default '{}'::jsonb,
  settings_json jsonb not null default '{}'::jsonb,
  computed_json jsonb not null default '{}'::jsonb,
  current_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ignite_proposals_client_status
  on public.ignite_proposals(client_id, status, created_at desc);
create index if not exists idx_ignite_proposals_workspace_id
  on public.ignite_proposals(workspace_id);

drop trigger if exists trg_ignite_proposals_updated_at on public.ignite_proposals;
create trigger trg_ignite_proposals_updated_at
before update on public.ignite_proposals
for each row execute procedure public.set_updated_at();

create table if not exists public.ignite_proposal_options (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.ignite_proposals(id) on delete cascade,
  option_key text not null,
  label text not null,
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  pricing_mode text null check (pricing_mode in ('cost_plus', 'turnkey')),
  package_price numeric(14, 2) null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_id, option_key)
);

create index if not exists idx_ignite_proposal_options_proposal
  on public.ignite_proposal_options(proposal_id, sort_order);

drop trigger if exists trg_ignite_proposal_options_updated_at on public.ignite_proposal_options;
create trigger trg_ignite_proposal_options_updated_at
before update on public.ignite_proposal_options
for each row execute procedure public.set_updated_at();

create table if not exists public.ignite_proposal_line_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.ignite_proposals(id) on delete cascade,
  option_id uuid null references public.ignite_proposal_options(id) on delete cascade,
  category text not null,
  line_name text not null,
  description text null,
  qty numeric(14, 4) not null default 0,
  unit_cost numeric(14, 4) not null default 0,
  apply_service boolean not null default false,
  service_rate numeric(8, 6) not null default 0,
  apply_tax boolean not null default false,
  tax_rate numeric(8, 6) not null default 0,
  tax_applies_after_service boolean not null default true,
  sort_order integer not null default 0,
  is_hidden_from_client boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ignite_proposal_line_items_proposal
  on public.ignite_proposal_line_items(proposal_id, sort_order);
create index if not exists idx_ignite_proposal_line_items_option
  on public.ignite_proposal_line_items(option_id);

drop trigger if exists trg_ignite_proposal_line_items_updated_at on public.ignite_proposal_line_items;
create trigger trg_ignite_proposal_line_items_updated_at
before update on public.ignite_proposal_line_items
for each row execute procedure public.set_updated_at();

create table if not exists public.ignite_proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.ignite_proposals(id) on delete cascade,
  version_number integer not null,
  label text null,
  snapshot_json jsonb not null default '{}'::jsonb,
  computed_json jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (proposal_id, version_number)
);

create index if not exists idx_ignite_proposal_versions_proposal
  on public.ignite_proposal_versions(proposal_id, version_number desc);

create table if not exists public.ignite_exports (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.ignite_proposals(id) on delete cascade,
  version_id uuid null references public.ignite_proposal_versions(id) on delete set null,
  export_type text not null check (export_type in ('pdf', 'xlsx')),
  export_view text not null default 'internal' check (export_view in ('internal', 'client')),
  status text not null default 'queued' check (status in ('queued', 'completed', 'failed')),
  file_url text null,
  file_path text null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ignite_exports_proposal_created
  on public.ignite_exports(proposal_id, created_at desc);

create table if not exists public.ignite_share_links (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.ignite_proposals(id) on delete cascade,
  client_id uuid not null references public.ignite_clients(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz null,
  revoked_at timestamptz null,
  max_access_count integer null,
  access_count integer not null default 0,
  last_accessed_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ignite_share_links_proposal
  on public.ignite_share_links(proposal_id, created_at desc);
create index if not exists idx_ignite_share_links_token
  on public.ignite_share_links(token);

create table if not exists public.ignite_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.workspaces(id) on delete set null,
  client_id uuid null references public.ignite_clients(id) on delete cascade,
  name text not null,
  description text null,
  data_json jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ignite_templates_workspace
  on public.ignite_templates(workspace_id, created_at desc);
create index if not exists idx_ignite_templates_client
  on public.ignite_templates(client_id);

drop trigger if exists trg_ignite_templates_updated_at on public.ignite_templates;
create trigger trg_ignite_templates_updated_at
before update on public.ignite_templates
for each row execute procedure public.set_updated_at();

create table if not exists public.ignite_vendor_rate_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.workspaces(id) on delete set null,
  client_id uuid null references public.ignite_clients(id) on delete cascade,
  name text not null,
  vendor_name text null,
  category text null,
  currency text not null default 'USD',
  rates_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ignite_vendor_rate_cards_workspace
  on public.ignite_vendor_rate_cards(workspace_id, created_at desc);
create index if not exists idx_ignite_vendor_rate_cards_client
  on public.ignite_vendor_rate_cards(client_id);

drop trigger if exists trg_ignite_vendor_rate_cards_updated_at on public.ignite_vendor_rate_cards;
create trigger trg_ignite_vendor_rate_cards_updated_at
before update on public.ignite_vendor_rate_cards
for each row execute procedure public.set_updated_at();

create table if not exists public.ignite_venue_presets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.workspaces(id) on delete set null,
  client_id uuid null references public.ignite_clients(id) on delete cascade,
  name text not null,
  location text null,
  data_json jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ignite_venue_presets_workspace
  on public.ignite_venue_presets(workspace_id, created_at desc);
create index if not exists idx_ignite_venue_presets_client
  on public.ignite_venue_presets(client_id);

drop trigger if exists trg_ignite_venue_presets_updated_at on public.ignite_venue_presets;
create trigger trg_ignite_venue_presets_updated_at
before update on public.ignite_venue_presets
for each row execute procedure public.set_updated_at();

create table if not exists public.ignite_client_defaults (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.ignite_clients(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  defaults_json jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ignite_client_defaults_workspace
  on public.ignite_client_defaults(workspace_id);

drop trigger if exists trg_ignite_client_defaults_updated_at on public.ignite_client_defaults;
create trigger trg_ignite_client_defaults_updated_at
before update on public.ignite_client_defaults
for each row execute procedure public.set_updated_at();

-- -------------------------------------------------------------------
-- Access helpers for Ignite-only role model
-- -------------------------------------------------------------------
create or replace function public.ignite_is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ignite_client_users icu
    where icu.user_id = auth.uid()
      and icu.status = 'active'
      and icu.role in ('ignite_admin', 'ignite_team')
  );
$$;

create or replace function public.ignite_client_ids_for_user()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct icu.client_id
  from public.ignite_client_users icu
  where icu.user_id = auth.uid()
    and icu.status = 'active'
    and icu.role = 'ignite_client'
    and icu.client_id is not null;
$$;

create or replace function public.ignite_can_access_client(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.ignite_is_team_member()
    or exists (
      select 1
      from public.ignite_client_users icu
      where icu.user_id = auth.uid()
        and icu.status = 'active'
        and icu.role = 'ignite_client'
        and icu.client_id = p_client_id
    );
$$;

create or replace function public.ignite_can_access_proposal(p_proposal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ignite_proposals p
    where p.id = p_proposal_id
      and public.ignite_can_access_client(p.client_id)
  );
$$;

-- -------------------------------------------------------------------
-- Row-level security
-- -------------------------------------------------------------------
alter table public.ignite_clients enable row level security;
alter table public.ignite_client_users enable row level security;
alter table public.ignite_proposals enable row level security;
alter table public.ignite_proposal_options enable row level security;
alter table public.ignite_proposal_line_items enable row level security;
alter table public.ignite_proposal_versions enable row level security;
alter table public.ignite_exports enable row level security;
alter table public.ignite_share_links enable row level security;
alter table public.ignite_templates enable row level security;
alter table public.ignite_vendor_rate_cards enable row level security;
alter table public.ignite_venue_presets enable row level security;
alter table public.ignite_client_defaults enable row level security;

-- ignite_clients
drop policy if exists ignite_clients_select on public.ignite_clients;
create policy ignite_clients_select on public.ignite_clients
  for select using (public.ignite_can_access_client(id));

drop policy if exists ignite_clients_team_write on public.ignite_clients;
create policy ignite_clients_team_write on public.ignite_clients
  for all
  using (public.ignite_is_team_member())
  with check (public.ignite_is_team_member());

-- ignite_client_users
drop policy if exists ignite_client_users_select on public.ignite_client_users;
create policy ignite_client_users_select on public.ignite_client_users
  for select using (
    public.ignite_is_team_member()
    or user_id = auth.uid()
  );

drop policy if exists ignite_client_users_team_write on public.ignite_client_users;
create policy ignite_client_users_team_write on public.ignite_client_users
  for all
  using (public.ignite_is_team_member())
  with check (public.ignite_is_team_member());

-- ignite_proposals
drop policy if exists ignite_proposals_select on public.ignite_proposals;
create policy ignite_proposals_select on public.ignite_proposals
  for select using (public.ignite_can_access_client(client_id));

drop policy if exists ignite_proposals_team_write on public.ignite_proposals;
create policy ignite_proposals_team_write on public.ignite_proposals
  for all
  using (public.ignite_is_team_member())
  with check (public.ignite_is_team_member());

-- ignite_proposal_options
drop policy if exists ignite_proposal_options_select on public.ignite_proposal_options;
create policy ignite_proposal_options_select on public.ignite_proposal_options
  for select using (public.ignite_can_access_proposal(proposal_id));

drop policy if exists ignite_proposal_options_team_write on public.ignite_proposal_options;
create policy ignite_proposal_options_team_write on public.ignite_proposal_options
  for all
  using (
    public.ignite_is_team_member()
    and public.ignite_can_access_proposal(proposal_id)
  )
  with check (
    public.ignite_is_team_member()
    and public.ignite_can_access_proposal(proposal_id)
  );

-- ignite_proposal_line_items
drop policy if exists ignite_proposal_line_items_select on public.ignite_proposal_line_items;
create policy ignite_proposal_line_items_select on public.ignite_proposal_line_items
  for select using (public.ignite_can_access_proposal(proposal_id));

drop policy if exists ignite_proposal_line_items_team_write on public.ignite_proposal_line_items;
create policy ignite_proposal_line_items_team_write on public.ignite_proposal_line_items
  for all
  using (
    public.ignite_is_team_member()
    and public.ignite_can_access_proposal(proposal_id)
  )
  with check (
    public.ignite_is_team_member()
    and public.ignite_can_access_proposal(proposal_id)
  );

-- ignite_proposal_versions
drop policy if exists ignite_proposal_versions_select on public.ignite_proposal_versions;
create policy ignite_proposal_versions_select on public.ignite_proposal_versions
  for select using (public.ignite_can_access_proposal(proposal_id));

drop policy if exists ignite_proposal_versions_team_write on public.ignite_proposal_versions;
create policy ignite_proposal_versions_team_write on public.ignite_proposal_versions
  for all
  using (
    public.ignite_is_team_member()
    and public.ignite_can_access_proposal(proposal_id)
  )
  with check (
    public.ignite_is_team_member()
    and public.ignite_can_access_proposal(proposal_id)
  );

-- ignite_exports
drop policy if exists ignite_exports_select on public.ignite_exports;
create policy ignite_exports_select on public.ignite_exports
  for select using (public.ignite_can_access_proposal(proposal_id));

drop policy if exists ignite_exports_team_write on public.ignite_exports;
create policy ignite_exports_team_write on public.ignite_exports
  for all
  using (
    public.ignite_is_team_member()
    and public.ignite_can_access_proposal(proposal_id)
  )
  with check (
    public.ignite_is_team_member()
    and public.ignite_can_access_proposal(proposal_id)
  );

-- ignite_share_links
drop policy if exists ignite_share_links_select on public.ignite_share_links;
create policy ignite_share_links_select on public.ignite_share_links
  for select using (public.ignite_can_access_proposal(proposal_id));

drop policy if exists ignite_share_links_team_write on public.ignite_share_links;
create policy ignite_share_links_team_write on public.ignite_share_links
  for all
  using (
    public.ignite_is_team_member()
    and public.ignite_can_access_proposal(proposal_id)
  )
  with check (
    public.ignite_is_team_member()
    and public.ignite_can_access_proposal(proposal_id)
  );

-- team-only config tables
drop policy if exists ignite_templates_team_access on public.ignite_templates;
create policy ignite_templates_team_access on public.ignite_templates
  for all
  using (public.ignite_is_team_member())
  with check (public.ignite_is_team_member());

drop policy if exists ignite_vendor_rate_cards_team_access on public.ignite_vendor_rate_cards;
create policy ignite_vendor_rate_cards_team_access on public.ignite_vendor_rate_cards
  for all
  using (public.ignite_is_team_member())
  with check (public.ignite_is_team_member());

drop policy if exists ignite_venue_presets_team_access on public.ignite_venue_presets;
create policy ignite_venue_presets_team_access on public.ignite_venue_presets
  for all
  using (public.ignite_is_team_member())
  with check (public.ignite_is_team_member());

drop policy if exists ignite_client_defaults_select on public.ignite_client_defaults;
create policy ignite_client_defaults_select on public.ignite_client_defaults
  for select using (
    public.ignite_is_team_member()
    or public.ignite_can_access_client(client_id)
  );

drop policy if exists ignite_client_defaults_team_write on public.ignite_client_defaults;
create policy ignite_client_defaults_team_write on public.ignite_client_defaults
  for all
  using (public.ignite_is_team_member())
  with check (public.ignite_is_team_member());

commit;
