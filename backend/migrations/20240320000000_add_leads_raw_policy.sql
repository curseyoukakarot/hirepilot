-- Enable RLS
alter table leads_raw enable row level security;

-- Allow service-role key (the worker) full access
create policy "svc full" on leads_raw
  for all using ( true ) with check ( true ); 