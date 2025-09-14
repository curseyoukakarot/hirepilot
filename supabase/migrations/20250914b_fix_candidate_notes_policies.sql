-- Broaden candidate_notes policies to include job owners and creators

-- Recreate READ policy
drop policy if exists "read_candidate_notes_by_collaborators" on public.candidate_notes;
create policy "read_candidate_notes_by_collaborators" on public.candidate_notes
for select to authenticated using (
  exists (
    select 1
    from public.candidate_jobs cj
    join public.job_requisitions jr on jr.id = cj.job_id
    where cj.candidate_id = candidate_notes.candidate_id
      and (
        jr.user_id = auth.uid() or jr.created_by = auth.uid()
        or exists (select 1 from public.job_collaborators jc where jc.job_id = cj.job_id and jc.user_id = auth.uid())
        or exists (
          select 1 from public.job_guest_collaborators jg
          join public.users u on lower(u.email) = lower(jg.email)
          where jg.job_id = cj.job_id and u.id = auth.uid()
        )
      )
  )
);

-- Recreate INSERT policy
drop policy if exists "insert_candidate_notes_by_collaborators" on public.candidate_notes;
create policy "insert_candidate_notes_by_collaborators" on public.candidate_notes
for insert to authenticated with check (
  exists (
    select 1
    from public.candidate_jobs cj
    join public.job_requisitions jr on jr.id = cj.job_id
    where cj.candidate_id = candidate_notes.candidate_id
      and (
        jr.user_id = auth.uid() or jr.created_by = auth.uid()
        or exists (select 1 from public.job_collaborators jc where jc.job_id = cj.job_id and jc.user_id = auth.uid())
        or exists (
          select 1 from public.job_guest_collaborators jg
          join public.users u on lower(u.email) = lower(jg.email)
          where jg.job_id = cj.job_id and u.id = auth.uid()
        )
      )
  )
);


