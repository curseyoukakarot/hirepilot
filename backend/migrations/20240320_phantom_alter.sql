-- Add title column to leads table
alter table leads add column if not exists title text;

-- Create optional pool of HirePilot-owned LinkedIn cookies
create table if not exists hirepilot_cookies (
  id                uuid primary key default gen_random_uuid(),
  cookie            text not null,
  status            text default 'idle',        -- idle | in_use
  last_used_at      timestamptz
);

-- Add index on status for faster lookups
create index if not exists idx_hirepilot_cookies_status on hirepilot_cookies(status); 