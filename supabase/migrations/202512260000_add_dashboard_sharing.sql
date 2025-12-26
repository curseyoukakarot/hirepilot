-- Dashboards sharing (recruiter-only) for public.user_dashboards
-- Adds:
-- - collaborators jsonb on user_dashboards (like custom_tables)
-- - dashboard_guest_collaborators for invite-by-email (pending/accepted)
-- - RLS: allow owner + collaborators; block job_seeker_* accounts; prevent adding job seekers as collaborators

begin;

-- 1) Add collaborators column to user_dashboards (idempotent)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='user_dashboards' and column_name='collaborators'
  ) then
    alter table public.user_dashboards add column collaborators jsonb not null default '[]'::jsonb;
  end if;
end $$;

create index if not exists idx_user_dashboards_collaborators_gin
on public.user_dashboards using gin (collaborators jsonb_path_ops);

-- 2) Guest invites by email (no client-side access required)
create table if not exists public.dashboard_guest_collaborators (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.user_dashboards(id) on delete cascade,
  email text not null,
  role text not null check (role in ('view','edit')),
  invited_by uuid references public.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted')),
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dashboard_guest_collaborators_dashboard on public.dashboard_guest_collaborators(dashboard_id);
create index if not exists idx_dashboard_guest_collaborators_email on public.dashboard_guest_collaborators(email);
create unique index if not exists uq_dashboard_guest_collaborators_dashboard_email on public.dashboard_guest_collaborators(dashboard_id, email);

drop trigger if exists trg_dashboard_guest_collaborators_updated_at on public.dashboard_guest_collaborators;
create trigger trg_dashboard_guest_collaborators_updated_at
before update on public.dashboard_guest_collaborators
for each row
execute procedure public.set_updated_at();

alter table public.dashboard_guest_collaborators enable row level security;
drop policy if exists dashboard_guest_collaborators_no_client_access on public.dashboard_guest_collaborators;
create policy dashboard_guest_collaborators_no_client_access
on public.dashboard_guest_collaborators
for all
using (false)
with check (false);

-- 3) RLS for user_dashboards (replace owner-only policies with sharing-aware policies)
alter table public.user_dashboards enable row level security;

drop policy if exists user_dashboards_select on public.user_dashboards;
drop policy if exists user_dashboards_modify on public.user_dashboards;

-- SELECT: recruiter-side only; owner OR collaborator
create policy user_dashboards_select
on public.user_dashboards
for select
using (
  exists (
    select 1 from public.users me
    where me.id = auth.uid()
      and me.role not ilike 'job_seeker%'
  )
  and (
    user_id = auth.uid()
    or exists (
      select 1
      from jsonb_array_elements(collaborators) as c
      where (c->>'user_id') = (auth.uid())::text
    )
  )
);

-- INSERT: recruiter-side only; owner as auth.uid(); collaborators cannot include job seekers
create policy user_dashboards_insert
on public.user_dashboards
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.users me
    where me.id = auth.uid()
      and me.role not ilike 'job_seeker%'
  )
  and not exists (
    select 1
    from jsonb_array_elements(collaborators) as c
    join public.users u on u.id::text = (c->>'user_id')
    where u.role ilike 'job_seeker%'
  )
);

-- UPDATE: recruiter-side only; owner OR edit-collaborator; collaborators cannot include job seekers
create policy user_dashboards_update
on public.user_dashboards
for update
using (
  exists (
    select 1 from public.users me
    where me.id = auth.uid()
      and me.role not ilike 'job_seeker%'
  )
  and (
    user_id = auth.uid()
    or exists (
      select 1
      from jsonb_array_elements(collaborators) as c
      where (c->>'user_id') = (auth.uid())::text
        and coalesce((c->>'role')::text, 'view') = 'edit'
    )
  )
)
with check (
  exists (
    select 1 from public.users me
    where me.id = auth.uid()
      and me.role not ilike 'job_seeker%'
  )
  and (
    user_id = auth.uid()
    or exists (
      select 1
      from jsonb_array_elements(collaborators) as c
      where (c->>'user_id') = (auth.uid())::text
        and coalesce((c->>'role')::text, 'view') = 'edit'
    )
  )
  and not exists (
    select 1
    from jsonb_array_elements(collaborators) as c
    join public.users u on u.id::text = (c->>'user_id')
    where u.role ilike 'job_seeker%'
  )
);

-- DELETE: recruiter-side only; owner only
create policy user_dashboards_delete
on public.user_dashboards
for delete
using (
  exists (
    select 1 from public.users me
    where me.id = auth.uid()
      and me.role not ilike 'job_seeker%'
  )
  and user_id = auth.uid()
);

commit;


