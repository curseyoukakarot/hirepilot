-- Store raw PhantomBuster output
create table leads_raw (
  id              uuid primary key default gen_random_uuid(),
  campaign_run_id uuid references campaign_runs(id),
  linkedin_url    text,
  first_name      text,
  last_name       text,
  title           text,
  company_name    text,
  location        text,
  raw_payload     jsonb,
  enriched        boolean default false,
  created_at      timestamptz default now()
);

-- Add enrichment columns to leads table
alter table leads
  add column if not exists enrichment_source text,     -- apollo | xyz
  add column if not exists confidence        numeric;  -- Apollo confidence score

-- Store Apollo OAuth tokens
create table apollo_accounts (
  user_id       uuid primary key references users(id),
  access_token  text,
  refresh_token text,
  expires_at    timestamptz  -- when the access_token expires
);

-- Add indexes for performance
create index if not exists idx_leads_raw_enriched on leads_raw(enriched);
create index if not exists idx_leads_raw_campaign_run on leads_raw(campaign_run_id); 