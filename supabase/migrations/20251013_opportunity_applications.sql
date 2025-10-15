-- Candidate application and collaborator submission storage for Opportunities

create table if not exists public.candidate_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  candidate_id uuid null references public.candidates(id) on delete set null,
  full_name text,
  email text,
  linkedin_url text,
  resume_url text,
  cover_note text,
  form_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_candidate_applications_opp on public.candidate_applications(opportunity_id);

create table if not exists public.candidate_submissions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  candidate_id uuid null references public.candidates(id) on delete set null,
  collaborator_user_id uuid null references public.users(id) on delete set null,
  first_name text,
  last_name text,
  email text,
  phone text,
  linkedin_url text,
  title text,
  location text,
  years_experience text,
  expected_compensation text,
  resume_url text,
  notable_impact text,
  motivation text,
  additional_notes text,
  form_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_candidate_submissions_opp on public.candidate_submissions(opportunity_id);


