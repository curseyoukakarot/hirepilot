-- Vendor Payout system for IgniteGTM
-- Tracks event cost breakdowns, margins, and vendor payment splits

create table if not exists ignite_vendor_payouts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  proposal_id   uuid references ignite_proposals(id) on delete set null,
  client_id     uuid references ignite_clients(id) on delete set null,

  -- Event details
  event_name          text not null,
  event_date          text,
  client_name         text,

  -- Vendor details
  vendor_name         text not null,
  vendor_email        text not null,
  vendor_company      text,

  -- Financial breakdown (stored in cents for precision)
  client_charged_cents      bigint not null default 0,  -- total charged to client
  cost_items_json           jsonb not null default '[]', -- array of {label, amount_cents}
  total_costs_cents         bigint not null default 0,
  margin_cents              bigint not null default 0,   -- client_charged - total_costs
  vendor_split_percent      numeric(5,2) not null default 0,  -- vendor's % of margin
  ignite_split_percent      numeric(5,2) not null default 0,  -- ignite's % of margin
  vendor_payout_cents       bigint not null default 0,  -- margin * vendor_split%
  ignite_payout_cents       bigint not null default 0,  -- margin * ignite_split%
  notes                     text,

  -- Share token for public view
  share_token       text unique not null,

  -- Status
  status            text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'accepted')),
  email_sent_at     timestamptz,

  -- Metadata
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_ignite_vendor_payouts_share_token on ignite_vendor_payouts(share_token);
create index if not exists idx_ignite_vendor_payouts_workspace on ignite_vendor_payouts(workspace_id);
create index if not exists idx_ignite_vendor_payouts_proposal on ignite_vendor_payouts(proposal_id);
