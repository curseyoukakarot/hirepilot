create table if not exists public.interview_prep_packs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.interview_sessions(id) on delete cascade,
  overall_score jsonb not null,
  strengths jsonb not null,
  focus_areas jsonb not null,
  best_answers jsonb not null,
  practice_plan jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_interview_prep_packs_session_id on public.interview_prep_packs(session_id);

alter table public.interview_prep_packs enable row level security;

drop policy if exists interview_prep_packs_select_own on public.interview_prep_packs;
create policy interview_prep_packs_select_own
on public.interview_prep_packs
for select
to authenticated
using (
  exists (
    select 1
    from public.interview_sessions s
    where s.id = interview_prep_packs.session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists interview_prep_packs_insert_own on public.interview_prep_packs;
create policy interview_prep_packs_insert_own
on public.interview_prep_packs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.interview_sessions s
    where s.id = interview_prep_packs.session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists interview_prep_packs_update_own on public.interview_prep_packs;
create policy interview_prep_packs_update_own
on public.interview_prep_packs
for update
to authenticated
using (
  exists (
    select 1
    from public.interview_sessions s
    where s.id = interview_prep_packs.session_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.interview_sessions s
    where s.id = interview_prep_packs.session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists interview_prep_packs_delete_own on public.interview_prep_packs;
create policy interview_prep_packs_delete_own
on public.interview_prep_packs
for delete
to authenticated
using (
  exists (
    select 1
    from public.interview_sessions s
    where s.id = interview_prep_packs.session_id
      and s.user_id = auth.uid()
  )
);
