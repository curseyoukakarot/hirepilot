-- Add stage and notes to clients
alter table if exists clients
  add column if not exists stage text default 'prospect',
  add column if not exists notes text;

-- Optional simple check constraint for stage values
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clients_stage_check') then
    alter table clients add constraint clients_stage_check
      check (stage in ('prospect','active'));
  end if;
end $$;

