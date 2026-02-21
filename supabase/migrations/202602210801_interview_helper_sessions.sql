create extension if not exists pgcrypto;

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  role_title text not null,
  company text null,
  level text null,
  mode text not null default 'supportive' check (mode in ('supportive', 'strict')),
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  consent_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_interview_sessions_user_id on public.interview_sessions(user_id);
create index if not exists idx_interview_sessions_started_at on public.interview_sessions(started_at desc);

create table if not exists public.interview_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  turn_index int not null,
  speaker text not null check (speaker in ('rex', 'user')),
  question_text text null,
  answer_text text null,
  coaching jsonb null,
  created_at timestamptz not null default now(),
  unique (session_id, turn_index, speaker)
);

create index if not exists idx_interview_turns_session_id on public.interview_turns(session_id);

alter table public.interview_sessions enable row level security;
alter table public.interview_turns enable row level security;

drop policy if exists interview_sessions_select_own on public.interview_sessions;
create policy interview_sessions_select_own
on public.interview_sessions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists interview_sessions_insert_own on public.interview_sessions;
create policy interview_sessions_insert_own
on public.interview_sessions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists interview_sessions_update_own on public.interview_sessions;
create policy interview_sessions_update_own
on public.interview_sessions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists interview_sessions_delete_own on public.interview_sessions;
create policy interview_sessions_delete_own
on public.interview_sessions
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists interview_turns_select_own on public.interview_turns;
create policy interview_turns_select_own
on public.interview_turns
for select
to authenticated
using (
  exists (
    select 1
    from public.interview_sessions s
    where s.id = interview_turns.session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists interview_turns_insert_own on public.interview_turns;
create policy interview_turns_insert_own
on public.interview_turns
for insert
to authenticated
with check (
  exists (
    select 1
    from public.interview_sessions s
    where s.id = interview_turns.session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists interview_turns_update_own on public.interview_turns;
create policy interview_turns_update_own
on public.interview_turns
for update
to authenticated
using (
  exists (
    select 1
    from public.interview_sessions s
    where s.id = interview_turns.session_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.interview_sessions s
    where s.id = interview_turns.session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists interview_turns_delete_own on public.interview_turns;
create policy interview_turns_delete_own
on public.interview_turns
for delete
to authenticated
using (
  exists (
    select 1
    from public.interview_sessions s
    where s.id = interview_turns.session_id
      and s.user_id = auth.uid()
  )
);
