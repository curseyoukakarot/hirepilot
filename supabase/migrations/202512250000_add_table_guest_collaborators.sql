-- Table guest collaborators (email-based invites) for custom_tables
-- Mirrors the Job REQ guest collaborator pattern, but roles map to tables view/edit.

begin;

create table if not exists public.table_guest_collaborators (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.custom_tables(id) on delete cascade,
  email text not null,
  role text not null check (role in ('view','edit')),
  invited_by uuid references public.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted')),
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_table_guest_collaborators_table on public.table_guest_collaborators(table_id);
create index if not exists idx_table_guest_collaborators_email on public.table_guest_collaborators(email);
create unique index if not exists uq_table_guest_collaborators_table_email on public.table_guest_collaborators(table_id, email);

-- updated_at trigger (reuse if exists)
drop trigger if exists trg_table_guest_collaborators_updated_at on public.table_guest_collaborators;
create trigger trg_table_guest_collaborators_updated_at
before update on public.table_guest_collaborators
for each row
execute procedure public.set_updated_at();

alter table public.table_guest_collaborators enable row level security;

-- Service-role backend uses this table; no client-side access required.
drop policy if exists table_guest_collaborators_no_client_access on public.table_guest_collaborators;
create policy table_guest_collaborators_no_client_access
on public.table_guest_collaborators
for all
using (false)
with check (false);

commit;


