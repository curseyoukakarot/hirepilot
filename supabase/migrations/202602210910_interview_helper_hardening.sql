create table if not exists public.interview_helper_idempotency (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  idempotency_key text not null,
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists idx_interview_helper_idempotency_user_key_created
  on public.interview_helper_idempotency(user_id, idempotency_key, created_at desc);

alter table public.interview_sessions
  add column if not exists prep_pack_id uuid null references public.interview_prep_packs(id) on delete set null;

create or replace function public.prevent_interview_prep_pack_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.overall_score is distinct from new.overall_score
     or old.strengths is distinct from new.strengths
     or old.focus_areas is distinct from new.focus_areas
     or old.best_answers is distinct from new.best_answers
     or old.practice_plan is distinct from new.practice_plan then
    raise exception 'interview_prep_pack is immutable after creation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_interview_prep_pack_mutation on public.interview_prep_packs;
create trigger trg_prevent_interview_prep_pack_mutation
before update on public.interview_prep_packs
for each row
execute function public.prevent_interview_prep_pack_mutation();
