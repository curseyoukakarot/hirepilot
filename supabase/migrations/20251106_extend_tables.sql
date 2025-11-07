-- Extend custom_tables with optional import_sources to track origins
alter table if exists public.custom_tables
  add column if not exists import_sources jsonb default '[]'::jsonb;


