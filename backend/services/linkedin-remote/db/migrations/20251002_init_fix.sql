-- Idempotent fix-up for existing installations where tables may exist without new columns

-- linkedin_sessions: ensure required columns exist
alter table if exists public.linkedin_sessions add column if not exists status text;
alter table if exists public.linkedin_sessions add column if not exists login_method text;
alter table if exists public.linkedin_sessions add column if not exists container_id text;
alter table if exists public.linkedin_sessions add column if not exists proxy_id uuid;
alter table if exists public.linkedin_sessions add column if not exists browser_fingerprint jsonb;
alter table if exists public.linkedin_sessions alter column browser_fingerprint set default '{}'::jsonb;
alter table if exists public.linkedin_sessions add column if not exists cookies_encrypted text;
alter table if exists public.linkedin_sessions add column if not exists localstorage_encrypted text;
alter table if exists public.linkedin_sessions add column if not exists snapshot_key text;
alter table if exists public.linkedin_sessions add column if not exists last_login_at timestamptz;
alter table if exists public.linkedin_sessions add column if not exists last_refresh_at timestamptz;
alter table if exists public.linkedin_sessions add column if not exists expires_at timestamptz;
alter table if exists public.linkedin_sessions add column if not exists failed_attempts int;
alter table if exists public.linkedin_sessions alter column failed_attempts set default 0;
alter table if exists public.linkedin_sessions add column if not exists created_at timestamptz;
alter table if exists public.linkedin_sessions alter column created_at set default now();
alter table if exists public.linkedin_sessions add column if not exists updated_at timestamptz;
alter table if exists public.linkedin_sessions alter column updated_at set default now();

-- Set sane defaults where null
update public.linkedin_sessions set login_method = 'streamed' where login_method is null;

-- Indexes
create index if not exists idx_linkedin_sessions_user on public.linkedin_sessions(user_id);
create index if not exists idx_linkedin_sessions_status on public.linkedin_sessions(status);

-- container_instances: ensure required columns exist
alter table if exists public.container_instances add column if not exists session_id uuid;
alter table if exists public.container_instances add column if not exists runtime text;
alter table if exists public.container_instances add column if not exists engine text;
alter table if exists public.container_instances add column if not exists remote_debug_url text;
alter table if exists public.container_instances add column if not exists stream_url text;
alter table if exists public.container_instances add column if not exists state text;
alter table if exists public.container_instances add column if not exists created_at timestamptz;
alter table if exists public.container_instances alter column created_at set default now();
alter table if exists public.container_instances add column if not exists updated_at timestamptz;
alter table if exists public.container_instances alter column updated_at set default now();

-- linkedin_jobs: ensure required columns exist
alter table if exists public.linkedin_jobs add column if not exists user_id uuid;
alter table if exists public.linkedin_jobs add column if not exists session_id uuid;
alter table if exists public.linkedin_jobs add column if not exists type text;
alter table if exists public.linkedin_jobs add column if not exists payload jsonb;
alter table if exists public.linkedin_jobs add column if not exists status text;
alter table if exists public.linkedin_jobs add column if not exists error text;
alter table if exists public.linkedin_jobs add column if not exists created_at timestamptz;
alter table if exists public.linkedin_jobs alter column created_at set default now();
alter table if exists public.linkedin_jobs add column if not exists updated_at timestamptz;
alter table if exists public.linkedin_jobs alter column updated_at set default now();


