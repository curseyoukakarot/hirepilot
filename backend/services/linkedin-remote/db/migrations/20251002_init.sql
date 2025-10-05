-- linkedin_sessions
create table if not exists public.linkedin_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null check (status in ('pending','active','hibernated','expired','failed')),
  login_method text not null default 'streamed' check (login_method in ('streamed','extension')),
  container_id text,
  proxy_id uuid,
  browser_fingerprint jsonb not null default '{}'::jsonb,
  cookies_encrypted text,
  localstorage_encrypted text,
  snapshot_key text,
  last_login_at timestamptz,
  last_refresh_at timestamptz,
  expires_at timestamptz,
  failed_attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_linkedin_sessions_user on public.linkedin_sessions(user_id);
create index if not exists idx_linkedin_sessions_status on public.linkedin_sessions(status);

-- proxy_pool
create table if not exists public.proxy_pool (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  label text,
  endpoint text not null,
  auth text,
  geo text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- container_instances
create table if not exists public.container_instances (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  runtime text not null check (runtime in ('novnc','webrtc')),
  engine text not null check (engine in ('docker','k8s','browserless')),
  remote_debug_url text,
  stream_url text,
  state text not null check (state in ('starting','ready','hibernating','stopped','error')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- linkedin_jobs
create table if not exists public.linkedin_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid not null,
  type text not null,
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued','running','success','failed')),
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.linkedin_sessions enable row level security;
alter table public.container_instances enable row level security;
alter table public.linkedin_jobs enable row level security;

drop policy if exists p_linkedin_sessions on public.linkedin_sessions;
create policy p_linkedin_sessions on public.linkedin_sessions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists p_container_instances on public.container_instances;
create policy p_container_instances on public.container_instances
  for all to authenticated
  using (session_id in (select id from public.linkedin_sessions where user_id = auth.uid()))
  with check (session_id in (select id from public.linkedin_sessions where user_id = auth.uid()));

drop policy if exists p_linkedin_jobs on public.linkedin_jobs;
create policy p_linkedin_jobs on public.linkedin_jobs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


