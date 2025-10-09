-- support_tickets table
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  issue_kind text,
  summary text,
  signals jsonb,
  repro_steps text,
  attempted_fixes jsonb,
  customer_impact text,
  status text default 'open',
  priority text default 'p2',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_support_tickets_updated on public.support_tickets;
create trigger trg_support_tickets_updated
before update on public.support_tickets
for each row execute function public.touch_updated_at();


