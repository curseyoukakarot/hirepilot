-- Create simple activity and collaborator tables for opportunities
create table if not exists public.opportunity_activity (
  id uuid primary key default uuid_generate_v4(),
  opportunity_id uuid not null,
  user_id uuid,
  message text not null,
  created_at timestamptz default now()
);

create index if not exists idx_opportunity_activity_opp on public.opportunity_activity(opportunity_id);

create table if not exists public.opportunity_collaborators (
  id uuid primary key default uuid_generate_v4(),
  opportunity_id uuid not null,
  email text not null,
  role text default 'collaborator',
  created_at timestamptz default now()
);

create index if not exists idx_opportunity_collab_opp on public.opportunity_collaborators(opportunity_id);

