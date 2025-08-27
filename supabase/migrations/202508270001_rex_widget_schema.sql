-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists vector;

-- Helper: read request headers (lowercased) safely
create or replace function public.rex_request_header(name text)
returns text
language sql
stable
as $$
  select coalesce((current_setting('request.headers', true))::json->>lower(name), '')
$$;

-- Sessions
create table if not exists public.rex_widget_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  anon_id text null,
  mode text not null check (mode in ('sales','support','rex')),
  rb2b jsonb null,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

-- Messages
create table if not exists public.rex_widget_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.rex_widget_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  text text not null,
  sources jsonb null,
  tutorial jsonb null,
  created_at timestamptz not null default now()
);
create index if not exists idx_rex_widget_messages_session_created
  on public.rex_widget_messages (session_id, created_at);

-- Leads
create table if not exists public.rex_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  work_email text not null,
  company text,
  interest text,
  notes text,
  source text not null default 'widget',
  rb2b jsonb null,
  created_at timestamptz not null default now()
);

-- Events
create table if not exists public.rex_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Knowledge base pages
create table if not exists public.rex_kb_pages (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text not null,
  html text not null,
  text tsvector,
  updated_at timestamptz not null default now()
);
create index if not exists idx_rex_kb_pages_text on public.rex_kb_pages using gin (text);

-- Knowledge base chunks
create table if not exists public.rex_kb_chunks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.rex_kb_pages(id) on delete cascade,
  ordinal int not null,
  content text not null,
  embedding vector(1536),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rex_kb_chunks_page_ordinal on public.rex_kb_chunks (page_id, ordinal);
-- IVFFlat index for embeddings (cosine distance)
create index if not exists idx_rex_kb_chunks_embedding_ivfflat
  on public.rex_kb_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- System settings (generic JSON store)
create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null
);

-- RLS Policies
alter table public.rex_widget_sessions enable row level security;
alter table public.rex_widget_messages enable row level security;
alter table public.rex_leads enable row level security;
alter table public.rex_events enable row level security;
alter table public.rex_kb_pages enable row level security;
alter table public.rex_kb_chunks enable row level security;

-- Sessions: select/insert/update only if owning user or matching anon header
drop policy if exists "sessions_select_own" on public.rex_widget_sessions;
create policy "sessions_select_own" on public.rex_widget_sessions
  for select
  using (
    (user_id is not distinct from auth.uid())
    or (coalesce(anon_id, '') <> '' and anon_id = rex_request_header('x-rex-anon-id'))
  );

drop policy if exists "sessions_insert_own" on public.rex_widget_sessions;
create policy "sessions_insert_own" on public.rex_widget_sessions
  for insert
  with check (
    (user_id is null or user_id is not distinct from auth.uid())
    and (anon_id is null or anon_id = rex_request_header('x-rex-anon-id'))
  );

drop policy if exists "sessions_update_own" on public.rex_widget_sessions;
create policy "sessions_update_own" on public.rex_widget_sessions
  for update
  using (
    (user_id is not distinct from auth.uid())
    or (coalesce(anon_id, '') <> '' and anon_id = rex_request_header('x-rex-anon-id'))
  )
  with check (
    (user_id is not distinct from auth.uid())
    or (coalesce(anon_id, '') <> '' and anon_id = rex_request_header('x-rex-anon-id'))
  );

-- Messages: same via parent session ownership
drop policy if exists "messages_select_via_session" on public.rex_widget_messages;
create policy "messages_select_via_session" on public.rex_widget_messages
  for select
  using (
    exists (
      select 1 from public.rex_widget_sessions s
      where s.id = rex_widget_messages.session_id
        and (
          s.user_id is not distinct from auth.uid()
          or (coalesce(s.anon_id, '') <> '' and s.anon_id = rex_request_header('x-rex-anon-id'))
        )
    )
  );

drop policy if exists "messages_insert_via_session" on public.rex_widget_messages;
create policy "messages_insert_via_session" on public.rex_widget_messages
  for insert
  with check (
    exists (
      select 1 from public.rex_widget_sessions s
      where s.id = rex_widget_messages.session_id
        and (
          s.user_id is not distinct from auth.uid()
          or (coalesce(s.anon_id, '') <> '' and s.anon_id = rex_request_header('x-rex-anon-id'))
        )
    )
  );

-- Leads, Events, KB: service role only
-- Note: service role bypasses RLS; these explicit policies document intent
drop policy if exists "leads_service_only" on public.rex_leads;
create policy "leads_service_only" on public.rex_leads
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "events_service_only" on public.rex_events;
create policy "events_service_only" on public.rex_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "kb_pages_service_only" on public.rex_kb_pages;
create policy "kb_pages_service_only" on public.rex_kb_pages
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "kb_chunks_service_only" on public.rex_kb_chunks;
create policy "kb_chunks_service_only" on public.rex_kb_chunks
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');


