-- pool of PhantomBuster scripts HirePilot owns
create table phantoms (
  id                uuid primary key default gen_random_uuid(),
  phantom_id        text  not null,             -- PB script ID
  label             text,
  status            text default 'idle',        -- idle | running | error
  last_run_at       timestamptz
);

-- each campaign launch = one run
create table campaign_runs (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid references campaigns(id),
  phantom_id        uuid references phantoms(id),
  pb_run_id         text,                       -- PB run id
  source_type       text,                       -- linkedin | apollo | csv
  status            text default 'queued',      -- queued | running | completed | failed
  started_at        timestamptz,
  finished_at       timestamptz
);

create index on campaign_runs (campaign_id);

-- Optional pool of HirePilot-owned LinkedIn cookies
create table hirepilot_cookies (
  id                uuid primary key default gen_random_uuid(),
  cookie            text not null,
  status            text default 'idle',        -- idle | in_use
  last_used_at      timestamptz
);

-- Ensure leads table has required columns
alter table leads add column if not exists first_name text;
alter table leads add column if not exists last_name text;
alter table leads add column if not exists title text;           -- Job title (preferred)
alter table leads add column if not exists headline text;        -- Legacy field
alter table leads add column if not exists company_name text;
alter table leads add column if not exists email text;
alter table leads add column if not exists phone text;
alter table leads add column if not exists linkedin_url text;
alter table leads add column if not exists source_payload jsonb;

-- Insert the default Phantom
insert into phantoms (phantom_id, label, status)
values ('7214484821939232', 'HP Search Link Main', 'idle');

-- Create realtime publication for campaign_runs
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    drop publication supabase_realtime;
  end if;
end
$$;

create publication supabase_realtime;
alter publication supabase_realtime add table campaign_runs; 