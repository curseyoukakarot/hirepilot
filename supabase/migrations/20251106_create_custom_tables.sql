-- Create custom_tables to store flexible recruiting-focused tables
create extension if not exists pgcrypto;

create table if not exists public.custom_tables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- Array of column definitions, example:
  -- [{"name":"Deal Title","type":"text"},{"name":"Value","type":"number"},{"name":"Projected","type":"formula","formula":"Value*0.9"}]
  schema_json jsonb not null default '[]'::jsonb,
  -- Array of row objects, example:
  -- [{"Deal Title":"Enterprise Exec","Value":20000}]
  data_json jsonb not null default '[]'::jsonb,
  -- Array of collaborators: [{"user_id":"<uuid>","role":"edit"|"view"}]
  collaborators jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_custom_tables_updated_at on public.custom_tables;
create trigger trg_custom_tables_updated_at
before update on public.custom_tables
for each row
execute procedure public.set_updated_at();

-- Indexes for collaborators querying
create index if not exists idx_custom_tables_user_id on public.custom_tables(user_id);
create index if not exists idx_custom_tables_collaborators_gin on public.custom_tables using gin (collaborators jsonb_path_ops);

-- RLS
alter table public.custom_tables enable row level security;

-- Helper expressions for JSONB collaborators:
-- EXISTS collaborator (any role)
--   exists (select 1 from jsonb_array_elements(collaborators) as c
--           where (c->>'user_id')::uuid = auth.uid())
-- EXISTS collaborator with edit role
--   exists (select 1 from jsonb_array_elements(collaborators) as c
--           where (c->>'user_id')::uuid = auth.uid() and (c->>'role') = 'edit')

-- SELECT: owner or collaborator can view
drop policy if exists custom_tables_select on public.custom_tables;
create policy custom_tables_select
on public.custom_tables
for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from jsonb_array_elements(collaborators) as c
    where (c->>'user_id')::uuid = auth.uid()
  )
);

-- INSERT: only as self owner
drop policy if exists custom_tables_insert on public.custom_tables;
create policy custom_tables_insert
on public.custom_tables
for insert
with check (user_id = auth.uid());

-- UPDATE: owner or edit-collaborator
drop policy if exists custom_tables_update on public.custom_tables;
create policy custom_tables_update
on public.custom_tables
for update
using (
  user_id = auth.uid()
  or exists (
    select 1 from jsonb_array_elements(collaborators) as c
    where (c->>'user_id')::uuid = auth.uid() and (c->>'role') = 'edit'
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1 from jsonb_array_elements(collaborators) as c
    where (c->>'user_id')::uuid = auth.uid() and (c->>'role') = 'edit'
  )
);

-- DELETE: owner only
drop policy if exists custom_tables_delete on public.custom_tables;
create policy custom_tables_delete
on public.custom_tables
for delete
using (user_id = auth.uid());

comment on table public.custom_tables is 'Flexible user-scoped recruiting data tables (jsonb schema/data).';
comment on column public.custom_tables.schema_json is 'Array of column defs with type in [text,status,number,date,formula].';
comment on column public.custom_tables.data_json is 'Array of row objects keyed by column name.';
comment on column public.custom_tables.collaborators is 'Array of {user_id, role} for simple sharing.';


