-- Add persona auto-outreach metadata to schedules
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'schedules'
      and column_name = 'linked_persona_id'
  ) then
    alter table public.schedules
      add column linked_persona_id uuid references public.personas(id) on delete set null;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'schedules'
      and column_name = 'linked_campaign_id'
  ) then
    alter table public.schedules
      add column linked_campaign_id uuid;
  end if;
end$$;

alter table public.schedules
  add column if not exists auto_outreach_enabled boolean not null default false,
  add column if not exists leads_per_run integer not null default 50,
  add column if not exists send_delay_minutes integer default 0,
  add column if not exists daily_send_cap integer;

comment on column public.schedules.linked_persona_id is 'Persona used when sourcing + sending from a single schedule.';
comment on column public.schedules.linked_campaign_id is 'Sourcing campaign that receives new leads for auto-outreach.';
comment on column public.schedules.auto_outreach_enabled is 'True when schedule should auto-enroll leads into a campaign.';
comment on column public.schedules.leads_per_run is 'Number of leads this schedule attempts to source per execution.';
comment on column public.schedules.send_delay_minutes is 'Delay applied before sending Step 1 to newly sourced leads.';
comment on column public.schedules.daily_send_cap is 'Optional per-schedule send cap layered on top of global campaign throttles.';


