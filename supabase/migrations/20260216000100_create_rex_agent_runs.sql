-- Recruiting REX v2 run storage (recruiting-only)
-- Intentionally separate from jobseeker_agent_* tables.

create extension if not exists pgcrypto;

create table if not exists public.rex_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  conversation_id uuid null references public.rex_conversations(id) on delete set null,
  campaign_id uuid null,
  status text not null check (status in ('queued','running','success','failure','cancelled')) default 'queued',
  plan_json jsonb not null default '{}'::jsonb,
  progress_json jsonb not null default '{}'::jsonb,
  artifacts_json jsonb not null default '{}'::jsonb,
  stats_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rex_agent_runs_user_created
  on public.rex_agent_runs(user_id, created_at desc);

create index if not exists idx_rex_agent_runs_workspace_created
  on public.rex_agent_runs(workspace_id, created_at desc);

create index if not exists idx_rex_agent_runs_status
  on public.rex_agent_runs(status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_rex_agent_runs_updated_at on public.rex_agent_runs;
create trigger trg_rex_agent_runs_updated_at
before update on public.rex_agent_runs
for each row execute procedure public.set_updated_at();

alter table public.rex_agent_runs enable row level security;

drop policy if exists rex_agent_runs_owner_select on public.rex_agent_runs;
create policy rex_agent_runs_owner_select
on public.rex_agent_runs
for select
using (user_id = auth.uid());

drop policy if exists rex_agent_runs_owner_insert on public.rex_agent_runs;
create policy rex_agent_runs_owner_insert
on public.rex_agent_runs
for insert
with check (user_id = auth.uid());

drop policy if exists rex_agent_runs_owner_update on public.rex_agent_runs;
create policy rex_agent_runs_owner_update
on public.rex_agent_runs
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists rex_agent_runs_owner_delete on public.rex_agent_runs;
create policy rex_agent_runs_owner_delete
on public.rex_agent_runs
for delete
using (user_id = auth.uid());
