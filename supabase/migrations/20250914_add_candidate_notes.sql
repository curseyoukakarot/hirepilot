-- Candidate Notes table for collaborative drawer
create table if not exists public.candidate_notes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  author_id uuid references public.users(id),
  author_name text,
  author_avatar_url text,
  note_text text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_candidate_notes_candidate_id on public.candidate_notes(candidate_id);

-- Trigger to maintain updated_at
create or replace function public.handle_updated_at_candidate_notes()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_updated_at_candidate_notes on public.candidate_notes;
create trigger trg_updated_at_candidate_notes
before update on public.candidate_notes
for each row execute function public.handle_updated_at_candidate_notes();

-- Enable RLS and policies
alter table public.candidate_notes enable row level security;

-- Read policy: collaborators or invited guests on the job linked via candidate_jobs can read
drop policy if exists "read_candidate_notes_by_collaborators" on public.candidate_notes;
create policy "read_candidate_notes_by_collaborators" on public.candidate_notes
for select to authenticated using (
  exists (
    select 1
    from public.candidate_jobs cj
    where cj.candidate_id = candidate_notes.candidate_id
      and (
        exists (
          select 1 from public.job_collaborators jc
          where jc.job_id = cj.job_id and jc.user_id = auth.uid()
        )
        or exists (
          select 1 from public.job_guest_collaborators jg
          join public.users u on lower(u.email) = lower(jg.email)
          where jg.job_id = cj.job_id and u.id = auth.uid()
        )
      )
  )
);

-- Write policy: collaborators or guests can insert
drop policy if exists "insert_candidate_notes_by_collaborators" on public.candidate_notes;
create policy "insert_candidate_notes_by_collaborators" on public.candidate_notes
for insert to authenticated with check (
  exists (
    select 1
    from public.candidate_jobs cj
    where cj.candidate_id = candidate_notes.candidate_id
      and (
        exists (
          select 1 from public.job_collaborators jc
          where jc.job_id = cj.job_id and jc.user_id = auth.uid()
        )
        or exists (
          select 1 from public.job_guest_collaborators jg
          join public.users u on lower(u.email) = lower(jg.email)
          where jg.job_id = cj.job_id and u.id = auth.uid()
        )
      )
  )
);

-- Update/Delete policy: only author can update/delete their own note
drop policy if exists "update_own_candidate_notes" on public.candidate_notes;
create policy "update_own_candidate_notes" on public.candidate_notes
for update to authenticated using (author_id = auth.uid());

drop policy if exists "delete_own_candidate_notes" on public.candidate_notes;
create policy "delete_own_candidate_notes" on public.candidate_notes
for delete to authenticated using (author_id = auth.uid());


