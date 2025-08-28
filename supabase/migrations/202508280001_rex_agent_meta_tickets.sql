-- Add meta JSONB to widget sessions for agent state
alter table if exists public.rex_widget_sessions
  add column if not exists meta jsonb default '{}'::jsonb;

-- Tickets table for support escalations
create table if not exists public.rex_tickets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.rex_widget_sessions(id) on delete set null,
  user_id uuid null,
  anon_id text null,
  summary text not null,
  details text null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists idx_rex_tickets_session on public.rex_tickets(session_id);

-- RLS: service-only for tickets by default (no anon access)
alter table public.rex_tickets enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rex_tickets' and policyname = 'service_only_tickets') then
    create policy service_only_tickets on public.rex_tickets for all to authenticated using (false) with check (false);
  end if;
end $$;


