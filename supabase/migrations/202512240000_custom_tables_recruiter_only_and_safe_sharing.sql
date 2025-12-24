-- Recruiter-only access + safe sharing for custom_tables
-- - Prevent job seeker accounts (role like job_seeker%) from accessing /tables
-- - Prevent adding job seeker users as collaborators

begin;

-- Helper predicate: current auth user is recruiter-side (not job_seeker_*)
-- We inline as EXISTS checks inside policies to avoid relying on custom functions.

-- SELECT: owner or collaborator can view, but only recruiter-side users
drop policy if exists custom_tables_select on public.custom_tables;
create policy custom_tables_select
on public.custom_tables
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

-- INSERT: only as self owner; recruiter-side only; collaborators must not include job seekers
drop policy if exists custom_tables_insert on public.custom_tables;
create policy custom_tables_insert
on public.custom_tables
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

-- UPDATE: owner or edit-collaborator; recruiter-side only; collaborators must not include job seekers
drop policy if exists custom_tables_update on public.custom_tables;
create policy custom_tables_update
on public.custom_tables
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

-- DELETE: owner only; recruiter-side only
drop policy if exists custom_tables_delete on public.custom_tables;
create policy custom_tables_delete
on public.custom_tables
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


