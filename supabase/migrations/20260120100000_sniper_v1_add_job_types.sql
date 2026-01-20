-- Add new Sniper v1 job types: people_search, jobs_intent
-- Idempotent: safe to run multiple times.

do $$
begin
  -- Update sniper_jobs.job_type CHECK constraint (created by v1 migration).
  if exists (
    select 1
    from pg_constraint
    where conname = 'sniper_jobs_job_type_check'
      and conrelid = 'public.sniper_jobs'::regclass
  ) then
    execute 'alter table public.sniper_jobs drop constraint sniper_jobs_job_type_check';
  end if;
exception when others then
  -- ignore
end $$;

do $$
begin
  -- Re-add with expanded allowed values
  execute $sql$
    alter table public.sniper_jobs
    add constraint sniper_jobs_job_type_check
    check (job_type in (
      'prospect_post_engagers',
      'send_connect_requests',
      'send_messages',
      'people_search',
      'jobs_intent'
    ))
  $sql$;
exception when duplicate_object then
  -- already exists
end $$;

