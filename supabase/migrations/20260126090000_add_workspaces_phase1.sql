-- Phase 1: Workspaces (schema + nullable workspace_id + backfill helpers)
-- Additive, idempotent, recruiter-side only.

begin;

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------
-- A) New tables
-- -------------------------------------------------------------------

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'recruiter',
  plan text not null default 'free',
  seat_count int not null default 1,
  billing_exempt boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  status text not null default 'active',
  invited_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists idx_workspace_members_user_id on public.workspace_members(user_id);
create index if not exists idx_workspace_members_workspace_id on public.workspace_members(workspace_id);

-- -------------------------------------------------------------------
-- Helpers: safe column checks + default workspace creation
-- -------------------------------------------------------------------

create or replace function public.column_exists(p_table text, p_column text)
returns boolean
language sql
as $$
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = p_table
      and column_name = p_column
  );
$$;

create or replace function public.ensure_default_workspace_for_user(p_user_id uuid)
returns uuid
language plpgsql
as $$
declare
  existing_id uuid;
  ws_id uuid;
  ws_name text;
  plan_name text;
  seat_ct int;
begin
  select wm.workspace_id
    into existing_id
  from public.workspace_members wm
  where wm.user_id = p_user_id
  order by wm.created_at asc
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  select coalesce(u.full_name, 'My')
    into ws_name
  from public.users u
  where u.id = p_user_id;

  if ws_name is null or length(trim(ws_name)) = 0 then
    ws_name := 'My';
  end if;

  ws_name := ws_name || ' Workspace';

  select coalesce(u.plan, 'free')
    into plan_name
  from public.users u
  where u.id = p_user_id;

  seat_ct := case when lower(plan_name) = 'team' then 5 else 1 end;

  insert into public.workspaces (name, type, plan, seat_count, created_by)
  values (ws_name, 'recruiter', coalesce(plan_name, 'free'), seat_ct, p_user_id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role, status, created_at)
  values (ws_id, p_user_id, 'owner', 'active', now())
  on conflict (workspace_id, user_id) do nothing;

  return ws_id;
end;
$$;

-- -------------------------------------------------------------------
-- B) Add nullable workspace_id to recruiter-side tables (+ indexes)
-- -------------------------------------------------------------------

do $$
begin
  if to_regclass('public.leads') is not null then
    alter table public.leads add column if not exists workspace_id uuid;
    create index if not exists idx_leads_workspace_id on public.leads(workspace_id);
  end if;

  if to_regclass('public.candidates') is not null then
    alter table public.candidates add column if not exists workspace_id uuid;
    create index if not exists idx_candidates_workspace_id on public.candidates(workspace_id);
  end if;

  if to_regclass('public.candidate_jobs') is not null then
    alter table public.candidate_jobs add column if not exists workspace_id uuid;
    create index if not exists idx_candidate_jobs_workspace_id on public.candidate_jobs(workspace_id);
  end if;

  if to_regclass('public.candidate_activities') is not null then
    alter table public.candidate_activities add column if not exists workspace_id uuid;
    create index if not exists idx_candidate_activities_workspace_id on public.candidate_activities(workspace_id);
  end if;

  if to_regclass('public.job_requisitions') is not null then
    alter table public.job_requisitions add column if not exists workspace_id uuid;
    create index if not exists idx_job_requisitions_workspace_id on public.job_requisitions(workspace_id);
  end if;

  if to_regclass('public.pipelines') is not null then
    alter table public.pipelines add column if not exists workspace_id uuid;
    create index if not exists idx_pipelines_workspace_id on public.pipelines(workspace_id);
  end if;

  if to_regclass('public.pipeline_stages') is not null then
    alter table public.pipeline_stages add column if not exists workspace_id uuid;
    create index if not exists idx_pipeline_stages_workspace_id on public.pipeline_stages(workspace_id);
  end if;

  if to_regclass('public.campaigns') is not null then
    alter table public.campaigns add column if not exists workspace_id uuid;
    create index if not exists idx_campaigns_workspace_id on public.campaigns(workspace_id);
  end if;

  if to_regclass('public.messages') is not null then
    alter table public.messages add column if not exists workspace_id uuid;
    create index if not exists idx_messages_workspace_id on public.messages(workspace_id);
  end if;

  if to_regclass('public.email_events') is not null then
    alter table public.email_events add column if not exists workspace_id uuid;
    create index if not exists idx_email_events_workspace_id on public.email_events(workspace_id);
  end if;

  if to_regclass('public.sourcing_campaigns') is not null then
    alter table public.sourcing_campaigns add column if not exists workspace_id uuid;
    create index if not exists idx_sourcing_campaigns_workspace_id on public.sourcing_campaigns(workspace_id);
  end if;

  if to_regclass('public.sourcing_leads') is not null then
    alter table public.sourcing_leads add column if not exists workspace_id uuid;
    create index if not exists idx_sourcing_leads_workspace_id on public.sourcing_leads(workspace_id);
  end if;

  if to_regclass('public.sourcing_replies') is not null then
    alter table public.sourcing_replies add column if not exists workspace_id uuid;
    create index if not exists idx_sourcing_replies_workspace_id on public.sourcing_replies(workspace_id);
  end if;

  if to_regclass('public.clients') is not null then
    alter table public.clients add column if not exists workspace_id uuid;
    create index if not exists idx_clients_workspace_id on public.clients(workspace_id);
  end if;

  if to_regclass('public.contacts') is not null then
    alter table public.contacts add column if not exists workspace_id uuid;
    create index if not exists idx_contacts_workspace_id on public.contacts(workspace_id);
  end if;

  if to_regclass('public.opportunities') is not null then
    alter table public.opportunities add column if not exists workspace_id uuid;
    create index if not exists idx_opportunities_workspace_id on public.opportunities(workspace_id);
  end if;

  if to_regclass('public.opportunity_job_reqs') is not null then
    alter table public.opportunity_job_reqs add column if not exists workspace_id uuid;
    create index if not exists idx_opportunity_job_reqs_workspace_id on public.opportunity_job_reqs(workspace_id);
  end if;

  if to_regclass('public.opportunity_stages') is not null then
    alter table public.opportunity_stages add column if not exists workspace_id uuid;
    create index if not exists idx_opportunity_stages_workspace_id on public.opportunity_stages(workspace_id);
  end if;

  if to_regclass('public.opportunity_activity') is not null then
    alter table public.opportunity_activity add column if not exists workspace_id uuid;
    create index if not exists idx_opportunity_activity_workspace_id on public.opportunity_activity(workspace_id);
  end if;

  if to_regclass('public.opportunity_collaborators') is not null then
    alter table public.opportunity_collaborators add column if not exists workspace_id uuid;
    create index if not exists idx_opportunity_collaborators_workspace_id on public.opportunity_collaborators(workspace_id);
  end if;

  if to_regclass('public.deal_permissions') is not null then
    alter table public.deal_permissions add column if not exists workspace_id uuid;
    create index if not exists idx_deal_permissions_workspace_id on public.deal_permissions(workspace_id);
  end if;

  if to_regclass('public.custom_tables') is not null then
    alter table public.custom_tables add column if not exists workspace_id uuid;
    create index if not exists idx_custom_tables_workspace_id on public.custom_tables(workspace_id);
  end if;

  if to_regclass('public.table_guest_collaborators') is not null then
    alter table public.table_guest_collaborators add column if not exists workspace_id uuid;
    create index if not exists idx_table_guest_collaborators_workspace_id on public.table_guest_collaborators(workspace_id);
  end if;

  if to_regclass('public.user_dashboards') is not null then
    alter table public.user_dashboards add column if not exists workspace_id uuid;
    create index if not exists idx_user_dashboards_workspace_id on public.user_dashboards(workspace_id);
  end if;

  if to_regclass('public.rex_reports') is not null then
    alter table public.rex_reports add column if not exists workspace_id uuid;
    create index if not exists idx_rex_reports_workspace_id on public.rex_reports(workspace_id);
  end if;

  if to_regclass('public.linkedin_events') is not null then
    alter table public.linkedin_events add column if not exists workspace_id uuid;
    create index if not exists idx_linkedin_events_workspace_id on public.linkedin_events(workspace_id);
  end if;
end $$;

-- -------------------------------------------------------------------
-- C) Backfill
-- -------------------------------------------------------------------

create or replace function public.backfill_workspace_ids()
returns void
language plpgsql
as $$
declare
  r record;
begin
  -- Ensure default workspace for all recruiter-side users
  for r in
    select u.id
    from auth.users u
    left join public.users pu on pu.id = u.id
    where coalesce(pu.role, '') not ilike 'job_seeker%'
  loop
    perform public.ensure_default_workspace_for_user(r.id);
  end loop;

  -- Simple user_id ownership tables
  if to_regclass('public.leads') is not null and public.column_exists('leads','user_id') then
    update public.leads
      set workspace_id = public.ensure_default_workspace_for_user(user_id)
      where workspace_id is null and user_id is not null;
  end if;

  if to_regclass('public.candidates') is not null and public.column_exists('candidates','user_id') then
    update public.candidates
      set workspace_id = public.ensure_default_workspace_for_user(user_id)
      where workspace_id is null and user_id is not null;
  end if;

  if to_regclass('public.job_requisitions') is not null and public.column_exists('job_requisitions','user_id') then
    update public.job_requisitions
      set workspace_id = public.ensure_default_workspace_for_user(user_id)
      where workspace_id is null and user_id is not null;
  end if;

  if to_regclass('public.pipelines') is not null and public.column_exists('pipelines','user_id') then
    update public.pipelines
      set workspace_id = public.ensure_default_workspace_for_user(user_id)
      where workspace_id is null and user_id is not null;
  end if;

  if to_regclass('public.campaigns') is not null and public.column_exists('campaigns','user_id') then
    update public.campaigns
      set workspace_id = public.ensure_default_workspace_for_user(user_id)
      where workspace_id is null and user_id is not null;
  end if;

  if to_regclass('public.messages') is not null and public.column_exists('messages','user_id') then
    update public.messages
      set workspace_id = public.ensure_default_workspace_for_user(user_id)
      where workspace_id is null and user_id is not null;
  end if;

  if to_regclass('public.email_events') is not null and public.column_exists('email_events','user_id') then
    update public.email_events
      set workspace_id = public.ensure_default_workspace_for_user(user_id)
      where workspace_id is null and user_id is not null;
  end if;

  if to_regclass('public.sourcing_campaigns') is not null and public.column_exists('sourcing_campaigns','user_id') then
    update public.sourcing_campaigns
      set workspace_id = public.ensure_default_workspace_for_user(user_id)
      where workspace_id is null and user_id is not null;
  end if;

  if to_regclass('public.sourcing_leads') is not null and public.column_exists('sourcing_leads','user_id') then
    update public.sourcing_leads
      set workspace_id = public.ensure_default_workspace_for_user(user_id)
      where workspace_id is null and user_id is not null;
  end if;

  if to_regclass('public.sourcing_replies') is not null and public.column_exists('sourcing_replies','user_id') then
    update public.sourcing_replies
      set workspace_id = public.ensure_default_workspace_for_user(user_id)
      where workspace_id is null and user_id is not null;
  end if;

  if to_regclass('public.custom_tables') is not null and public.column_exists('custom_tables','user_id') then
    update public.custom_tables
      set workspace_id = public.ensure_default_workspace_for_user(user_id)
      where workspace_id is null and user_id is not null;
  end if;

  if to_regclass('public.user_dashboards') is not null and public.column_exists('user_dashboards','user_id') then
    update public.user_dashboards
      set workspace_id = public.ensure_default_workspace_for_user(user_id)
      where workspace_id is null and user_id is not null;
  end if;

  if to_regclass('public.rex_reports') is not null and public.column_exists('rex_reports','user_id') then
    update public.rex_reports
      set workspace_id = public.ensure_default_workspace_for_user(user_id)
      where workspace_id is null and user_id is not null;
  end if;

  if to_regclass('public.linkedin_events') is not null and public.column_exists('linkedin_events','user_id') then
    update public.linkedin_events
      set workspace_id = public.ensure_default_workspace_for_user(user_id)
      where workspace_id is null and user_id is not null;
  end if;

  if to_regclass('public.deal_permissions') is not null and public.column_exists('deal_permissions','user_id') then
    update public.deal_permissions
      set workspace_id = public.ensure_default_workspace_for_user(user_id)
      where workspace_id is null and user_id is not null;
  end if;

  -- owner_id ownership tables
  if to_regclass('public.clients') is not null and public.column_exists('clients','owner_id') then
    update public.clients
      set workspace_id = public.ensure_default_workspace_for_user(owner_id)
      where workspace_id is null and owner_id is not null;
  end if;

  if to_regclass('public.contacts') is not null and public.column_exists('contacts','owner_id') then
    update public.contacts
      set workspace_id = public.ensure_default_workspace_for_user(owner_id)
      where workspace_id is null and owner_id is not null;
  end if;

  if to_regclass('public.opportunities') is not null and public.column_exists('opportunities','owner_id') then
    update public.opportunities
      set workspace_id = public.ensure_default_workspace_for_user(owner_id)
      where workspace_id is null and owner_id is not null;
  end if;

  -- Child/join tables from parent workspace_id
  if to_regclass('public.candidate_jobs') is not null and public.column_exists('candidate_jobs','candidate_id') then
    update public.candidate_jobs cj
      set workspace_id = c.workspace_id
      from public.candidates c
      where cj.workspace_id is null and cj.candidate_id = c.id and c.workspace_id is not null;

    update public.candidate_jobs cj
      set workspace_id = public.ensure_default_workspace_for_user(c.user_id)
      from public.candidates c
      where cj.workspace_id is null and cj.candidate_id = c.id and c.user_id is not null;
  end if;

  if to_regclass('public.candidate_activities') is not null and public.column_exists('candidate_activities','candidate_id') then
    update public.candidate_activities ca
      set workspace_id = c.workspace_id
      from public.candidates c
      where ca.workspace_id is null and ca.candidate_id = c.id and c.workspace_id is not null;

    update public.candidate_activities ca
      set workspace_id = public.ensure_default_workspace_for_user(c.user_id)
      from public.candidates c
      where ca.workspace_id is null and ca.candidate_id = c.id and c.user_id is not null;
  end if;

  if to_regclass('public.pipeline_stages') is not null and public.column_exists('pipeline_stages','job_id') then
    update public.pipeline_stages ps
      set workspace_id = jr.workspace_id
      from public.job_requisitions jr
      where ps.workspace_id is null and ps.job_id = jr.id and jr.workspace_id is not null;

    update public.pipeline_stages ps
      set workspace_id = public.ensure_default_workspace_for_user(jr.user_id)
      from public.job_requisitions jr
      where ps.workspace_id is null and ps.job_id = jr.id and jr.user_id is not null;
  end if;

  if to_regclass('public.opportunity_job_reqs') is not null and public.column_exists('opportunity_job_reqs','opportunity_id') then
    update public.opportunity_job_reqs ojr
      set workspace_id = o.workspace_id
      from public.opportunities o
      where ojr.workspace_id is null and ojr.opportunity_id = o.id and o.workspace_id is not null;

    update public.opportunity_job_reqs ojr
      set workspace_id = public.ensure_default_workspace_for_user(o.owner_id)
      from public.opportunities o
      where ojr.workspace_id is null and ojr.opportunity_id = o.id and o.owner_id is not null;
  end if;

  if to_regclass('public.opportunity_activity') is not null and public.column_exists('opportunity_activity','opportunity_id') then
    update public.opportunity_activity oa
      set workspace_id = o.workspace_id
      from public.opportunities o
      where oa.workspace_id is null and oa.opportunity_id = o.id and o.workspace_id is not null;

    update public.opportunity_activity oa
      set workspace_id = public.ensure_default_workspace_for_user(o.owner_id)
      from public.opportunities o
      where oa.workspace_id is null and oa.opportunity_id = o.id and o.owner_id is not null;
  end if;

  if to_regclass('public.opportunity_collaborators') is not null and public.column_exists('opportunity_collaborators','opportunity_id') then
    update public.opportunity_collaborators oc
      set workspace_id = o.workspace_id
      from public.opportunities o
      where oc.workspace_id is null and oc.opportunity_id = o.id and o.workspace_id is not null;

    update public.opportunity_collaborators oc
      set workspace_id = public.ensure_default_workspace_for_user(o.owner_id)
      from public.opportunities o
      where oc.workspace_id is null and oc.opportunity_id = o.id and o.owner_id is not null;
  end if;
end;
$$;

-- -------------------------------------------------------------------
-- D) Triggers for new rows (bridge mode)
-- -------------------------------------------------------------------

create or replace function public.set_workspace_id_from_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.workspace_id is null and new.user_id is not null then
    new.workspace_id := public.ensure_default_workspace_for_user(new.user_id);
  end if;
  return new;
end;
$$;

create or replace function public.set_workspace_id_from_owner_id()
returns trigger
language plpgsql
as $$
begin
  if new.workspace_id is null and new.owner_id is not null then
    new.workspace_id := public.ensure_default_workspace_for_user(new.owner_id);
  end if;
  return new;
end;
$$;

do $$
begin
  -- user_id tables
  if to_regclass('public.leads') is not null and public.column_exists('leads','user_id') then
    execute 'drop trigger if exists trg_leads_workspace_id on public.leads';
    execute 'create trigger trg_leads_workspace_id before insert on public.leads for each row execute function public.set_workspace_id_from_user_id()';
  end if;

  if to_regclass('public.candidates') is not null and public.column_exists('candidates','user_id') then
    execute 'drop trigger if exists trg_candidates_workspace_id on public.candidates';
    execute 'create trigger trg_candidates_workspace_id before insert on public.candidates for each row execute function public.set_workspace_id_from_user_id()';
  end if;

  if to_regclass('public.job_requisitions') is not null and public.column_exists('job_requisitions','user_id') then
    execute 'drop trigger if exists trg_job_requisitions_workspace_id on public.job_requisitions';
    execute 'create trigger trg_job_requisitions_workspace_id before insert on public.job_requisitions for each row execute function public.set_workspace_id_from_user_id()';
  end if;

  if to_regclass('public.pipelines') is not null and public.column_exists('pipelines','user_id') then
    execute 'drop trigger if exists trg_pipelines_workspace_id on public.pipelines';
    execute 'create trigger trg_pipelines_workspace_id before insert on public.pipelines for each row execute function public.set_workspace_id_from_user_id()';
  end if;

  if to_regclass('public.campaigns') is not null and public.column_exists('campaigns','user_id') then
    execute 'drop trigger if exists trg_campaigns_workspace_id on public.campaigns';
    execute 'create trigger trg_campaigns_workspace_id before insert on public.campaigns for each row execute function public.set_workspace_id_from_user_id()';
  end if;

  if to_regclass('public.messages') is not null and public.column_exists('messages','user_id') then
    execute 'drop trigger if exists trg_messages_workspace_id on public.messages';
    execute 'create trigger trg_messages_workspace_id before insert on public.messages for each row execute function public.set_workspace_id_from_user_id()';
  end if;

  if to_regclass('public.email_events') is not null and public.column_exists('email_events','user_id') then
    execute 'drop trigger if exists trg_email_events_workspace_id on public.email_events';
    execute 'create trigger trg_email_events_workspace_id before insert on public.email_events for each row execute function public.set_workspace_id_from_user_id()';
  end if;

  if to_regclass('public.sourcing_campaigns') is not null and public.column_exists('sourcing_campaigns','user_id') then
    execute 'drop trigger if exists trg_sourcing_campaigns_workspace_id on public.sourcing_campaigns';
    execute 'create trigger trg_sourcing_campaigns_workspace_id before insert on public.sourcing_campaigns for each row execute function public.set_workspace_id_from_user_id()';
  end if;

  if to_regclass('public.sourcing_leads') is not null and public.column_exists('sourcing_leads','user_id') then
    execute 'drop trigger if exists trg_sourcing_leads_workspace_id on public.sourcing_leads';
    execute 'create trigger trg_sourcing_leads_workspace_id before insert on public.sourcing_leads for each row execute function public.set_workspace_id_from_user_id()';
  end if;

  if to_regclass('public.sourcing_replies') is not null and public.column_exists('sourcing_replies','user_id') then
    execute 'drop trigger if exists trg_sourcing_replies_workspace_id on public.sourcing_replies';
    execute 'create trigger trg_sourcing_replies_workspace_id before insert on public.sourcing_replies for each row execute function public.set_workspace_id_from_user_id()';
  end if;

  if to_regclass('public.custom_tables') is not null and public.column_exists('custom_tables','user_id') then
    execute 'drop trigger if exists trg_custom_tables_workspace_id on public.custom_tables';
    execute 'create trigger trg_custom_tables_workspace_id before insert on public.custom_tables for each row execute function public.set_workspace_id_from_user_id()';
  end if;

  if to_regclass('public.user_dashboards') is not null and public.column_exists('user_dashboards','user_id') then
    execute 'drop trigger if exists trg_user_dashboards_workspace_id on public.user_dashboards';
    execute 'create trigger trg_user_dashboards_workspace_id before insert on public.user_dashboards for each row execute function public.set_workspace_id_from_user_id()';
  end if;

  if to_regclass('public.rex_reports') is not null and public.column_exists('rex_reports','user_id') then
    execute 'drop trigger if exists trg_rex_reports_workspace_id on public.rex_reports';
    execute 'create trigger trg_rex_reports_workspace_id before insert on public.rex_reports for each row execute function public.set_workspace_id_from_user_id()';
  end if;

  if to_regclass('public.linkedin_events') is not null and public.column_exists('linkedin_events','user_id') then
    execute 'drop trigger if exists trg_linkedin_events_workspace_id on public.linkedin_events';
    execute 'create trigger trg_linkedin_events_workspace_id before insert on public.linkedin_events for each row execute function public.set_workspace_id_from_user_id()';
  end if;

  if to_regclass('public.deal_permissions') is not null and public.column_exists('deal_permissions','user_id') then
    execute 'drop trigger if exists trg_deal_permissions_workspace_id on public.deal_permissions';
    execute 'create trigger trg_deal_permissions_workspace_id before insert on public.deal_permissions for each row execute function public.set_workspace_id_from_user_id()';
  end if;

  -- owner_id tables
  if to_regclass('public.clients') is not null and public.column_exists('clients','owner_id') then
    execute 'drop trigger if exists trg_clients_workspace_id on public.clients';
    execute 'create trigger trg_clients_workspace_id before insert on public.clients for each row execute function public.set_workspace_id_from_owner_id()';
  end if;

  if to_regclass('public.contacts') is not null and public.column_exists('contacts','owner_id') then
    execute 'drop trigger if exists trg_contacts_workspace_id on public.contacts';
    execute 'create trigger trg_contacts_workspace_id before insert on public.contacts for each row execute function public.set_workspace_id_from_owner_id()';
  end if;

  if to_regclass('public.opportunities') is not null and public.column_exists('opportunities','owner_id') then
    execute 'drop trigger if exists trg_opportunities_workspace_id on public.opportunities';
    execute 'create trigger trg_opportunities_workspace_id before insert on public.opportunities for each row execute function public.set_workspace_id_from_owner_id()';
  end if;
end $$;

commit;
