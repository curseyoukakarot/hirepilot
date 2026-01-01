-- Job Seeker Elite: Custom Domains for Landing Pages
-- Adds:
--  - landing_pages (public landing page content, served at /p/:slug)
--  - landing_page_domains (custom domain mappings + verification)
--
-- Notes:
--  - Domain verification uses DNS TXT record at: _hirepilot-verify.<domain> = <token>
--  - Public reads are allowed only for published landing pages / active domains.

-- ---------------------------------------------------------------------------
-- Landing pages
create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  html text not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landing_pages_user_id_idx on public.landing_pages(user_id);
create index if not exists landing_pages_published_idx on public.landing_pages(published);

-- Reuse shared updated_at trigger function if present
drop trigger if exists landing_pages_set_updated_at on public.landing_pages;
create trigger landing_pages_set_updated_at
before update on public.landing_pages
for each row execute function update_updated_at_column();

alter table public.landing_pages enable row level security;

-- Owners can manage their own landing pages
drop policy if exists "landing_pages_select_own" on public.landing_pages;
create policy "landing_pages_select_own"
on public.landing_pages
for select
using (auth.uid() = user_id or auth.role() = 'service_role');

drop policy if exists "landing_pages_insert_own" on public.landing_pages;
create policy "landing_pages_insert_own"
on public.landing_pages
for insert
with check (auth.uid() = user_id or auth.role() = 'service_role');

drop policy if exists "landing_pages_update_own" on public.landing_pages;
create policy "landing_pages_update_own"
on public.landing_pages
for update
using (auth.uid() = user_id or auth.role() = 'service_role')
with check (auth.uid() = user_id or auth.role() = 'service_role');

drop policy if exists "landing_pages_delete_own" on public.landing_pages;
create policy "landing_pages_delete_own"
on public.landing_pages
for delete
using (auth.uid() = user_id or auth.role() = 'service_role');

-- Public can read published landing pages (used by /p/:slug and custom domains)
drop policy if exists "landing_pages_public_read_published" on public.landing_pages;
create policy "landing_pages_public_read_published"
on public.landing_pages
for select
using (published = true or auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Custom domain mappings
create table if not exists public.landing_page_domains (
  id uuid primary key default gen_random_uuid(),
  landing_page_id uuid not null references public.landing_pages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  domain text not null unique,
  status text not null default 'pending', -- pending | verified | active | failed
  verification_token text not null,
  verification_method text not null default 'txt', -- txt | cname | http
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz null,
  last_checked_at timestamptz null
);

create index if not exists landing_page_domains_landing_page_id_idx on public.landing_page_domains(landing_page_id);
create index if not exists landing_page_domains_user_id_idx on public.landing_page_domains(user_id);
create index if not exists landing_page_domains_status_idx on public.landing_page_domains(status);

drop trigger if exists landing_page_domains_set_updated_at on public.landing_page_domains;
create trigger landing_page_domains_set_updated_at
before update on public.landing_page_domains
for each row execute function update_updated_at_column();

alter table public.landing_page_domains enable row level security;

-- Owners can manage their own domain mappings
drop policy if exists "landing_page_domains_select_own" on public.landing_page_domains;
create policy "landing_page_domains_select_own"
on public.landing_page_domains
for select
using (auth.uid() = user_id or auth.role() = 'service_role');

drop policy if exists "landing_page_domains_insert_own" on public.landing_page_domains;
create policy "landing_page_domains_insert_own"
on public.landing_page_domains
for insert
with check (auth.uid() = user_id or auth.role() = 'service_role');

drop policy if exists "landing_page_domains_update_own" on public.landing_page_domains;
create policy "landing_page_domains_update_own"
on public.landing_page_domains
for update
using (auth.uid() = user_id or auth.role() = 'service_role')
with check (auth.uid() = user_id or auth.role() = 'service_role');

drop policy if exists "landing_page_domains_delete_own" on public.landing_page_domains;
create policy "landing_page_domains_delete_own"
on public.landing_page_domains
for delete
using (auth.uid() = user_id or auth.role() = 'service_role');

-- Public can resolve active domains to published landing pages
drop policy if exists "landing_page_domains_public_resolve_active" on public.landing_page_domains;
create policy "landing_page_domains_public_resolve_active"
on public.landing_page_domains
for select
using (
  status = 'active'
  and exists (
    select 1
    from public.landing_pages lp
    where lp.id = landing_page_id
      and lp.published = true
  )
  or auth.role() = 'service_role'
);

-- Optional: enforce status values
alter table public.landing_page_domains
  drop constraint if exists landing_page_domains_status_check;
alter table public.landing_page_domains
  add constraint landing_page_domains_status_check
  check (status in ('pending','verified','active','failed'));


