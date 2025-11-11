-- HirePilot Forms: Core tables and RLS
-- 1) forms
create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workspace_id uuid not null,
  title text not null,
  description text,
  slug text unique not null,
  is_public boolean not null default true,
  theme jsonb not null default '{}'::jsonb,
  -- destinations
  destination_type text not null default 'table', -- 'table' | 'lead' | 'candidate'
  destination_target_id uuid null,               -- optional foreign key to custom tables (nullable)
  job_req_id uuid null,                          -- optional foreign key to job reqs (nullable)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) form_fields
create table if not exists public.form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  label text not null,
  type text not null check (type in (
    'short_text','long_text','email','phone','dropdown','multi_select','checkbox','date','rating','file_upload','section'
  )),
  placeholder text,
  help_text text,
  required boolean not null default false,
  options jsonb,
  width text not null default 'full', -- full|half|third
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) form_responses
create table if not exists public.form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  submitted_by_ip inet,
  user_agent text,
  source text, -- 'embed' | 'direct'
  meta jsonb
);

-- 4) form_response_values
create table if not exists public.form_response_values (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.form_responses(id) on delete cascade,
  field_id uuid not null references public.form_fields(id) on delete cascade,
  value text,       -- for scalar values
  json_value jsonb, -- for multi-select etc
  file_url text
);

-- helpful indexes
create index if not exists form_fields_form_position_idx on public.form_fields(form_id, position);
create index if not exists form_responses_form_submitted_idx on public.form_responses(form_id, submitted_at desc);

-- Enable RLS
alter table public.forms enable row level security;
alter table public.form_fields enable row level security;
alter table public.form_responses enable row level security;
alter table public.form_response_values enable row level security;

-- Policies
-- Owners (creator or workspace members) can CRUD their forms
drop policy if exists "owner read" on public.forms;
create policy "owner read" on public.forms for select using (
  auth.uid() = user_id
);

drop policy if exists "owner write" on public.forms;
create policy "owner write" on public.forms for all using (
  auth.uid() = user_id
) with check (auth.uid() = user_id);

-- Public runtime read for forms marked public
drop policy if exists "public runtime read" on public.forms;
create policy "public runtime read" on public.forms for select using (is_public = true);

drop policy if exists "public runtime fields" on public.form_fields;
create policy "public runtime fields" on public.form_fields for select using (
  exists(select 1 from public.forms f where f.id = form_fields.form_id and f.is_public = true)
);

-- Allow inserting responses for public forms
drop policy if exists "anyone insert responses" on public.form_responses;
create policy "anyone insert responses" on public.form_responses for insert with check (
  exists(select 1 from public.forms f where f.id = form_responses.form_id and f.is_public = true)
);

drop policy if exists "anyone insert values" on public.form_response_values;
create policy "anyone insert values" on public.form_response_values for insert with check (
  exists(
    select 1
    from public.form_responses r
    join public.forms f on f.id = r.form_id
    where r.id = form_response_values.response_id and f.is_public = true
  )
);

-- Storage bucket: create via UI or CLI if supported
-- create storage bucket "form-uploads" public = false;


