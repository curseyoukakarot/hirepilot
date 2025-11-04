-- HirePilot Custom Dashboard & Analytics
-- Schema objects for user dashboards, REX templates, event extensions,
-- and materialized views for analytics.
-- Safe to run multiple times.

-- 1) Tables ---------------------------------------------------------------

create table if not exists public.user_dashboards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  layout jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_dashboards_user on public.user_dashboards(user_id);

create table if not exists public.rex_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  widget_json jsonb not null,
  created_by_rex boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_rex_reports_user on public.rex_reports(user_id);

-- Lightweight LinkedIn events table if not present
create table if not exists public.linkedin_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('sent','accepted','replied')),
  lead_id uuid,
  timestamp timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_linkedin_events_user on public.linkedin_events(user_id);

-- Extend email_events with optional attribution/latency fields
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='email_events' and column_name='latency_ms'
  ) then
    alter table public.email_events add column latency_ms integer;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='email_events' and column_name='bounce_type'
  ) then
    alter table public.email_events add column bounce_type text;
  end if;
end $$;

-- 2) Materialized Views ---------------------------------------------------

-- Win rate per user based on opportunities.status
create materialized view if not exists public.win_rates_mv as
select
  o.owner_id as user_id,
  coalesce(100.0 * sum(case when o.status = 'Close Won' then 1 else 0 end)::numeric / nullif(count(*),0), 0) as win_rate
from public.opportunities o
group by o.owner_id;

create index if not exists idx_win_rates_mv_user on public.win_rates_mv(user_id);

-- Hires by source attribution (email/linkedin/other)
create materialized view if not exists public.source_attribution_mv as
select
  c.user_id,
  coalesce(l.source, case when exists (
    select 1 from public.email_events e where e.user_id=c.user_id and e.lead_id=c.lead_id
  ) then 'email' when exists (
    select 1 from public.linkedin_events le where le.user_id=c.user_id and le.lead_id=c.lead_id
  ) then 'linkedin' else 'other' end) as attr_source,
  count(*)::int as hires
from public.candidates c
left join public.leads l on l.id = c.lead_id
where c.status = 'hired'
group by c.user_id, attr_source;

create index if not exists idx_source_attr_user on public.source_attribution_mv(user_id);

-- Average reply latency (seconds) computed from email_events
create materialized view if not exists public.latencies_mv as
select
  user_id,
  avg(extract(epoch from (reply_timestamp - sent_timestamp))) as avg_reply_latency_seconds
from (
  select
    e.user_id,
    e.lead_id,
    min(case when e.event_type='sent' then e.event_timestamp end) over (partition by e.user_id, e.lead_id order by e.event_timestamp rows between unbounded preceding and unbounded following) as sent_timestamp,
    min(case when e.event_type='reply' then e.event_timestamp end) over (partition by e.user_id, e.lead_id order by e.event_timestamp rows between unbounded preceding and unbounded following) as reply_timestamp
  from public.email_events e
  where e.event_type in ('sent','reply')
) s
where reply_timestamp is not null and sent_timestamp is not null
group by user_id;

create index if not exists idx_latencies_mv_user on public.latencies_mv(user_id);

-- Optional: simple revenue summary by month (from invoices if available)
create materialized view if not exists public.revenue_monthly_mv as
select
  o.owner_id as user_id,
  date_trunc('month', coalesce(i.paid_at, i.sent_at, i.created_at))::date as month,
  sum(coalesce(i.amount, 0)) as revenue
from public.invoices i
left join public.opportunities o on o.id = i.opportunity_id
group by o.owner_id, date_trunc('month', coalesce(i.paid_at, i.sent_at, i.created_at));

create index if not exists idx_revenue_monthly_user on public.revenue_monthly_mv(user_id);

-- 3) RLS ------------------------------------------------------------------

alter table public.user_dashboards enable row level security;
alter table public.rex_reports enable row level security;
alter table public.linkedin_events enable row level security;

-- Basic CRUD policies per-user
do $$ begin
  -- user_dashboards
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_dashboards' and policyname='user_dashboards_select') then
    create policy "user_dashboards_select" on public.user_dashboards for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_dashboards' and policyname='user_dashboards_modify') then
    create policy "user_dashboards_modify" on public.user_dashboards for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  -- rex_reports
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='rex_reports' and policyname='rex_reports_select') then
    create policy "rex_reports_select" on public.rex_reports for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='rex_reports' and policyname='rex_reports_modify') then
    create policy "rex_reports_modify" on public.rex_reports for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  -- linkedin_events
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='linkedin_events' and policyname='linkedin_events_select') then
    create policy "linkedin_events_select" on public.linkedin_events for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='linkedin_events' and policyname='linkedin_events_modify') then
    create policy "linkedin_events_modify" on public.linkedin_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- 4) Helper secure views (filter MVs by auth.uid()) ----------------------

create or replace view public.win_rates as
  select * from public.win_rates_mv where user_id = auth.uid();

create or replace view public.source_attribution as
  select * from public.source_attribution_mv where user_id = auth.uid();

create or replace view public.latencies as
  select * from public.latencies_mv where user_id = auth.uid();

create or replace view public.revenue_monthly as
  select * from public.revenue_monthly_mv where user_id = auth.uid();

-- 5) Refresh helper function (call every 10 minutes via external scheduler)

create or replace function public.refresh_analytics_mvs()
returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view concurrently public.win_rates_mv;
  refresh materialized view concurrently public.source_attribution_mv;
  refresh materialized view concurrently public.latencies_mv;
  refresh materialized view concurrently public.revenue_monthly_mv;
end $$;

grant usage on schema public to anon, authenticated;
grant select on public.win_rates, public.source_attribution, public.latencies, public.revenue_monthly to anon, authenticated;
grant select, insert, update, delete on public.user_dashboards, public.rex_reports, public.linkedin_events to authenticated;


