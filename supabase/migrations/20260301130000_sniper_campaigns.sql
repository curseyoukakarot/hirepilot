-- ==========================================================================
-- Sniper Campaigns: multi-step LinkedIn outreach sequences
--
-- Three new tables:
--   sniper_campaigns           — campaign definition (name, status, settings)
--   sniper_campaign_steps      — ordered action steps within a campaign
--   sniper_campaign_enrollments — profiles enrolled + progression state
--
-- Reuses existing sniper_is_in_workspace(uuid) RLS helper and set_updated_at() trigger.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1) sniper_campaigns
-- --------------------------------------------------------------------------
create table if not exists public.sniper_campaigns (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  created_by    uuid not null references auth.users(id) on delete cascade,
  name          text not null default '',
  description   text,
  status        text not null default 'draft'
                  check (status in ('draft','active','paused','archived')),

  -- Stop advancing enrollments if the lead replies to a connect/message
  stop_on_reply boolean not null default true,

  -- Lead source configuration (type + params stored as JSON)
  -- e.g. { "type": "post_engagers", "post_url": "...", "limit": 200 }
  -- e.g. { "type": "people_search", "search_url": "..." }
  -- e.g. { "type": "manual" }
  lead_source_json jsonb not null default '{}'::jsonb,

  -- Campaign-level settings (override workspace defaults when present)
  settings_json jsonb not null default '{}'::jsonb,

  -- Stats cache updated by the ticker
  stats_json    jsonb not null default '{}'::jsonb,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_sniper_campaigns_workspace
  on public.sniper_campaigns(workspace_id, created_at desc);
create index if not exists idx_sniper_campaigns_status
  on public.sniper_campaigns(workspace_id, status);

drop trigger if exists trg_sniper_campaigns_updated_at on public.sniper_campaigns;
create trigger trg_sniper_campaigns_updated_at
  before update on public.sniper_campaigns
  for each row execute procedure public.set_updated_at();

-- --------------------------------------------------------------------------
-- 2) sniper_campaign_steps
-- --------------------------------------------------------------------------
create table if not exists public.sniper_campaign_steps (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.sniper_campaigns(id) on delete cascade,
  step_order    int not null,

  -- Action to perform at this step
  action_type   text not null
                  check (action_type in (
                    'wait',             -- delay only, no browser action
                    'connect',          -- send connection request
                    'message',          -- send LinkedIn message
                    'profile_visit',    -- visit profile (warm-up)
                    'like_post'         -- like a recent post
                  )),

  -- Delay before executing this step (from previous step completion)
  delay_days    int not null default 0,
  delay_hours   int not null default 0,

  -- Step-specific configuration stored as JSON:
  --   connect  → { "note": "Hi {{first_name}}..." }
  --   message  → { "body": "Hey {{first_name}}, ..." }
  --   wait     → {} (delay only)
  --   profile_visit → {}
  --   like_post → {}
  config_json   jsonb not null default '{}'::jsonb,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique(campaign_id, step_order)
);

create index if not exists idx_sniper_campaign_steps_campaign
  on public.sniper_campaign_steps(campaign_id, step_order);

drop trigger if exists trg_sniper_campaign_steps_updated_at on public.sniper_campaign_steps;
create trigger trg_sniper_campaign_steps_updated_at
  before update on public.sniper_campaign_steps
  for each row execute procedure public.set_updated_at();

-- --------------------------------------------------------------------------
-- 3) sniper_campaign_enrollments
-- --------------------------------------------------------------------------
create table if not exists public.sniper_campaign_enrollments (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.sniper_campaigns(id) on delete cascade,
  workspace_id    uuid not null,

  -- Profile being engaged
  profile_url     text not null,
  profile_name    text,
  profile_json    jsonb,          -- cached profile data for display

  -- Progression state
  status          text not null default 'active'
                    check (status in (
                      'active',       -- in-flight, waiting for next step
                      'completed',    -- all steps done
                      'paused',       -- manually paused
                      'replied',      -- lead replied → auto-paused
                      'bounced',      -- connection rejected / message undeliverable
                      'error'         -- unrecoverable failure
                    )),
  current_step_order int not null default 0,  -- 0 = not yet started
  next_step_at    timestamptz,                -- when the ticker should process this
  last_action_at  timestamptz,

  -- Who enrolled this profile
  enrolled_by     uuid not null references auth.users(id) on delete cascade,

  -- Optional FK to existing leads table
  lead_id         uuid,

  -- Last sniper_job_item that executed for this enrollment
  last_job_item_id uuid,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- A profile can only be enrolled once per campaign
  unique(campaign_id, profile_url)
);

-- Add lead_id FK only if leads table exists (defensive, like message_sequences pattern)
do $$
begin
  if to_regclass('public.leads') is not null then
    if not exists (
      select 1 from pg_constraint
      where conname = 'sniper_campaign_enrollments_lead_id_fkey'
    ) then
      alter table public.sniper_campaign_enrollments
        add constraint sniper_campaign_enrollments_lead_id_fkey
        foreign key (lead_id) references public.leads(id) on delete set null;
    end if;
  end if;
end$$;

-- Ticker query index: find enrollments ready to advance
create index if not exists idx_sniper_campaign_enrollments_ticker
  on public.sniper_campaign_enrollments(status, next_step_at)
  where status = 'active' and next_step_at is not null;

create index if not exists idx_sniper_campaign_enrollments_campaign
  on public.sniper_campaign_enrollments(campaign_id, status);

create index if not exists idx_sniper_campaign_enrollments_workspace
  on public.sniper_campaign_enrollments(workspace_id, created_at desc);

create index if not exists idx_sniper_campaign_enrollments_profile
  on public.sniper_campaign_enrollments(workspace_id, profile_url);

drop trigger if exists trg_sniper_campaign_enrollments_updated_at on public.sniper_campaign_enrollments;
create trigger trg_sniper_campaign_enrollments_updated_at
  before update on public.sniper_campaign_enrollments
  for each row execute procedure public.set_updated_at();

-- --------------------------------------------------------------------------
-- 4) RLS policies
-- --------------------------------------------------------------------------

-- sniper_campaigns — workspace-scoped via existing helper
alter table public.sniper_campaigns enable row level security;

drop policy if exists sniper_campaigns_select on public.sniper_campaigns;
create policy sniper_campaigns_select on public.sniper_campaigns
  for select using (public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_campaigns_insert on public.sniper_campaigns;
create policy sniper_campaigns_insert on public.sniper_campaigns
  for insert with check (created_by = auth.uid() and public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_campaigns_update on public.sniper_campaigns;
create policy sniper_campaigns_update on public.sniper_campaigns
  for update using (public.sniper_is_in_workspace(workspace_id))
  with check (public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_campaigns_delete on public.sniper_campaigns;
create policy sniper_campaigns_delete on public.sniper_campaigns
  for delete using (created_by = auth.uid() and public.sniper_is_in_workspace(workspace_id));

-- sniper_campaign_steps — access if user can see the parent campaign
alter table public.sniper_campaign_steps enable row level security;

drop policy if exists sniper_campaign_steps_select on public.sniper_campaign_steps;
create policy sniper_campaign_steps_select on public.sniper_campaign_steps
  for select using (
    exists (
      select 1 from public.sniper_campaigns c
      where c.id = sniper_campaign_steps.campaign_id
        and public.sniper_is_in_workspace(c.workspace_id)
    )
  );

drop policy if exists sniper_campaign_steps_insert on public.sniper_campaign_steps;
create policy sniper_campaign_steps_insert on public.sniper_campaign_steps
  for insert with check (
    exists (
      select 1 from public.sniper_campaigns c
      where c.id = sniper_campaign_steps.campaign_id
        and public.sniper_is_in_workspace(c.workspace_id)
    )
  );

drop policy if exists sniper_campaign_steps_update on public.sniper_campaign_steps;
create policy sniper_campaign_steps_update on public.sniper_campaign_steps
  for update using (
    exists (
      select 1 from public.sniper_campaigns c
      where c.id = sniper_campaign_steps.campaign_id
        and public.sniper_is_in_workspace(c.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.sniper_campaigns c
      where c.id = sniper_campaign_steps.campaign_id
        and public.sniper_is_in_workspace(c.workspace_id)
    )
  );

drop policy if exists sniper_campaign_steps_delete on public.sniper_campaign_steps;
create policy sniper_campaign_steps_delete on public.sniper_campaign_steps
  for delete using (
    exists (
      select 1 from public.sniper_campaigns c
      where c.id = sniper_campaign_steps.campaign_id
        and c.created_by = auth.uid()
        and public.sniper_is_in_workspace(c.workspace_id)
    )
  );

-- sniper_campaign_enrollments — workspace-scoped
alter table public.sniper_campaign_enrollments enable row level security;

drop policy if exists sniper_campaign_enrollments_select on public.sniper_campaign_enrollments;
create policy sniper_campaign_enrollments_select on public.sniper_campaign_enrollments
  for select using (public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_campaign_enrollments_insert on public.sniper_campaign_enrollments;
create policy sniper_campaign_enrollments_insert on public.sniper_campaign_enrollments
  for insert with check (enrolled_by = auth.uid() and public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_campaign_enrollments_update on public.sniper_campaign_enrollments;
create policy sniper_campaign_enrollments_update on public.sniper_campaign_enrollments
  for update using (public.sniper_is_in_workspace(workspace_id))
  with check (public.sniper_is_in_workspace(workspace_id));

drop policy if exists sniper_campaign_enrollments_delete on public.sniper_campaign_enrollments;
create policy sniper_campaign_enrollments_delete on public.sniper_campaign_enrollments
  for delete using (enrolled_by = auth.uid() and public.sniper_is_in_workspace(workspace_id));
