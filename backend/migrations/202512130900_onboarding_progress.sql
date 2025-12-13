-- Onboarding progress + credit uniqueness for job seeker onboarding

create table if not exists job_seeker_onboarding_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  step_key text not null,
  completed_at timestamptz not null default now(),
  metadata jsonb,
  constraint job_seeker_onboarding_progress_pkey primary key (user_id, step_key)
);

-- Ensure credit ledger uniqueness for onboarding steps
-- If credit_ledger doesn't exist, skip (assume preexisting)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'credit_ledger') then
    -- add column reason/ref_key if missing (safe add)
    if not exists (
      select 1 from information_schema.columns
      where table_name = 'credit_ledger' and column_name = 'reason'
    ) then
      alter table credit_ledger add column reason text;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_name = 'credit_ledger' and column_name = 'ref_key'
    ) then
      alter table credit_ledger add column ref_key text;
    end if;

    -- unique index to prevent double-award per step
    create unique index if not exists credit_ledger_onboarding_uniq
      on credit_ledger (user_id, reason, ref_key)
      where reason = 'onboarding_step';
  end if;
end
$$;

-- Optional: index to fetch user progress quickly
create index if not exists idx_onboarding_progress_user on job_seeker_onboarding_progress (user_id);
