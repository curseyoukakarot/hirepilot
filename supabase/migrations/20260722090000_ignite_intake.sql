-- IgniteGTM contact-form submissions (contact.ignitegtm.com)
-- Written only by the backend service role via /api/ignite/intake.

create table if not exists public.ignite_intake (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  form text not null check (form in ('general', 'studio', 'advisory')),
  first_name text not null,
  last_name text,
  email text not null,
  company text,
  interests text[] not null default '{}',
  source text,
  user_agent text
);

alter table public.ignite_intake enable row level security;
-- no anon/authenticated policies on purpose: service-role only.

create index if not exists ignite_intake_created_at_idx
  on public.ignite_intake (created_at desc);

create index if not exists ignite_intake_form_idx
  on public.ignite_intake (form);
