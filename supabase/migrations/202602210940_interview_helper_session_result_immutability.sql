create or replace function public.prevent_interview_session_result_mutation()
returns trigger
language plpgsql
as $$
begin
  -- Once a session is completed, result linkage/state is immutable at the DB layer.
  if old.status = 'completed' then
    if old.status is distinct from new.status
       or old.ended_at is distinct from new.ended_at
       or old.prep_pack_id is distinct from new.prep_pack_id then
      raise exception 'completed interview session result fields are immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_interview_session_result_mutation on public.interview_sessions;
create trigger trg_prevent_interview_session_result_mutation
before update on public.interview_sessions
for each row
execute function public.prevent_interview_session_result_mutation();
