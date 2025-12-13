-- App (operator) onboarding progress

create table if not exists app_onboarding_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  step_key text not null,
  completed_at timestamptz not null default now(),
  metadata jsonb,
  constraint app_onboarding_progress_pkey primary key (user_id, step_key)
);

-- Unique credit ledger for app onboarding
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'credit_ledger') then
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
    create unique index if not exists credit_ledger_app_onboarding_uniq
      on credit_ledger (user_id, reason, ref_key)
      where reason = 'app_onboarding_step';
  end if;
end $$;

create index if not exists idx_app_onboarding_user on app_onboarding_progress (user_id);
