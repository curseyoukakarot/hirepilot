-- Create support_tickets table for Support Agent
create table if not exists public.support_tickets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  query text not null,
  status text not null default 'open',
  created_at timestamp with time zone not null default now()
);

-- Helpful index for querying by user
create index if not exists idx_support_tickets_user on public.support_tickets(user_id);


