-- Advanced Agent Mode V1: personas + schedules
-- Enable required extensions
create extension if not exists pgcrypto;

-- Personas table
create table if not exists public.personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  titles text[] default '{}',
  include_keywords text[] default '{}',
  exclude_keywords text[] default '{}',
  locations text[] default '{}',
  channels text[] default '{}',
  goal_total_leads int default 0,
  stats jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_personas_user_id on public.personas(user_id);
create index if not exists idx_personas_created_at on public.personas(created_at);

-- Schedules table
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  action_type text not null,
  persona_id uuid null references public.personas(id) on delete set null,
  campaign_id uuid null,
  payload jsonb not null default '{}',
  schedule_kind text not null,
  cron_expr text null,
  run_at timestamptz null,
  next_run_at timestamptz null,
  status text not null default 'active',
  last_run_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_schedules_user_id on public.schedules(user_id);
create index if not exists idx_schedules_status on public.schedules(status);
create index if not exists idx_schedules_next_run_at on public.schedules(next_run_at);

-- Updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

drop trigger if exists trg_personas_updated_at on public.personas;
create trigger trg_personas_updated_at
before update on public.personas
for each row execute function public.set_updated_at();

drop trigger if exists trg_schedules_updated_at on public.schedules;
create trigger trg_schedules_updated_at
before update on public.schedules
for each row execute function public.set_updated_at();

-- RLS
alter table public.personas enable row level security;
alter table public.schedules enable row level security;

-- Policies: users can CRUD their own rows
drop policy if exists personas_owner_crud on public.personas;
create policy personas_owner_crud on public.personas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists schedules_owner_crud on public.schedules;
create policy schedules_owner_crud on public.schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


