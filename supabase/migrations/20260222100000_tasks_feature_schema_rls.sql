-- Tasks feature: schema + workspace-scoped RLS
-- Recruiter-side only; additive/idempotent.

begin;

create extension if not exists pgcrypto;

-- Shared updated_at helper (safe to replace)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1) Tables
-- -----------------------------------------------------------------------------

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_to_user_id uuid null references auth.users(id) on delete set null,
  title text not null,
  description text null,
  status text not null default 'open',
  priority text not null default 'medium',
  due_at timestamptz null,
  completed_at timestamptz null,
  related_type text null,
  related_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_workspace_id on public.tasks(workspace_id);
create index if not exists idx_tasks_assigned_to_user_id on public.tasks(assigned_to_user_id);
create index if not exists idx_tasks_created_by_user_id on public.tasks(created_by_user_id);
create index if not exists idx_tasks_due_at on public.tasks(due_at);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_workspace_status on public.tasks(workspace_id, status);

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute procedure public.set_updated_at();

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_comments_workspace_id on public.task_comments(workspace_id);
create index if not exists idx_task_comments_task_id on public.task_comments(task_id);
create index if not exists idx_task_comments_user_id on public.task_comments(user_id);
create index if not exists idx_task_comments_created_at on public.task_comments(created_at);

create table if not exists public.task_statuses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key text not null,
  label text not null,
  sort_order int not null default 100,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key)
);

create index if not exists idx_task_statuses_workspace_id on public.task_statuses(workspace_id);
create index if not exists idx_task_statuses_workspace_sort on public.task_statuses(workspace_id, sort_order);

drop trigger if exists trg_task_statuses_updated_at on public.task_statuses;
create trigger trg_task_statuses_updated_at
before update on public.task_statuses
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2) Helper functions for workspace-scoped authorization
-- -----------------------------------------------------------------------------

create or replace function public.tasks_is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and coalesce(wm.status, 'active') = 'active'
  );
$$;

create or replace function public.tasks_has_workspace_admin_role(p_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and coalesce(wm.status, 'active') = 'active'
      and lower(coalesce(wm.role, '')) in ('owner', 'admin', 'team_admin', 'super_admin')
  )
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and lower(coalesce(u.role, '')) in ('admin', 'team_admin', 'super_admin')
  );
$$;

-- "All Team Tasks" visibility gate
create or replace function public.tasks_can_view_all_team(p_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select public.tasks_has_workspace_admin_role(p_workspace_id);
$$;

-- Task visibility for current user
create or replace function public.tasks_can_view_task_row(
  p_workspace_id uuid,
  p_assigned_to_user_id uuid,
  p_created_by_user_id uuid
)
returns boolean
language sql
stable
as $$
  select
    public.tasks_is_workspace_member(p_workspace_id)
    and (
      p_assigned_to_user_id = auth.uid()
      or p_created_by_user_id = auth.uid()
      or public.tasks_can_view_all_team(p_workspace_id)
    );
$$;

create or replace function public.tasks_can_mutate_task_row(
  p_workspace_id uuid,
  p_assigned_to_user_id uuid,
  p_created_by_user_id uuid
)
returns boolean
language sql
stable
as $$
  select
    public.tasks_is_workspace_member(p_workspace_id)
    and (
      p_assigned_to_user_id = auth.uid()
      or p_created_by_user_id = auth.uid()
      or public.tasks_has_workspace_admin_role(p_workspace_id)
    );
$$;

create or replace function public.tasks_can_delete_task_row(
  p_workspace_id uuid,
  p_created_by_user_id uuid
)
returns boolean
language sql
stable
as $$
  select
    public.tasks_is_workspace_member(p_workspace_id)
    and (
      p_created_by_user_id = auth.uid()
      or public.tasks_has_workspace_admin_role(p_workspace_id)
    );
$$;

-- -----------------------------------------------------------------------------
-- 3) Status default seeding (existing + future workspaces)
-- -----------------------------------------------------------------------------

create or replace function public.seed_task_statuses_for_workspace(p_workspace_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.task_statuses (workspace_id, key, label, sort_order, is_default)
  values
    (p_workspace_id, 'open', 'Open', 10, true),
    (p_workspace_id, 'in_progress', 'In Progress', 20, true),
    (p_workspace_id, 'waiting', 'Waiting', 30, true),
    (p_workspace_id, 'completed', 'Completed', 40, true)
  on conflict (workspace_id, key) do update
    set label = excluded.label,
        sort_order = excluded.sort_order,
        is_default = excluded.is_default,
        updated_at = now();
end;
$$;

create or replace function public.seed_task_statuses_for_new_workspace()
returns trigger
language plpgsql
as $$
begin
  perform public.seed_task_statuses_for_workspace(new.id);
  return new;
end;
$$;

drop trigger if exists trg_seed_task_statuses_on_workspace_insert on public.workspaces;
create trigger trg_seed_task_statuses_on_workspace_insert
after insert on public.workspaces
for each row execute function public.seed_task_statuses_for_new_workspace();

do $$
declare
  r record;
begin
  for r in select id from public.workspaces
  loop
    perform public.seed_task_statuses_for_workspace(r.id);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) RLS policies
-- -----------------------------------------------------------------------------

alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_statuses enable row level security;

-- tasks
drop policy if exists tasks_select on public.tasks;
create policy tasks_select
on public.tasks
for select
using (
  public.tasks_can_view_task_row(workspace_id, assigned_to_user_id, created_by_user_id)
);

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert
on public.tasks
for insert
with check (
  created_by_user_id = auth.uid()
  and public.tasks_is_workspace_member(workspace_id)
  and (
    assigned_to_user_id is null
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = assigned_to_user_id
        and coalesce(wm.status, 'active') = 'active'
    )
  )
);

drop policy if exists tasks_update on public.tasks;
create policy tasks_update
on public.tasks
for update
using (
  public.tasks_can_mutate_task_row(workspace_id, assigned_to_user_id, created_by_user_id)
)
with check (
  public.tasks_can_mutate_task_row(workspace_id, assigned_to_user_id, created_by_user_id)
  and public.tasks_is_workspace_member(workspace_id)
  and (
    assigned_to_user_id is null
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = assigned_to_user_id
        and coalesce(wm.status, 'active') = 'active'
    )
  )
);

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete
on public.tasks
for delete
using (
  public.tasks_can_delete_task_row(workspace_id, created_by_user_id)
);

-- task_comments
drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select
on public.task_comments
for select
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.workspace_id = workspace_id
      and public.tasks_can_view_task_row(t.workspace_id, t.assigned_to_user_id, t.created_by_user_id)
  )
);

drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert
on public.task_comments
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.workspace_id = workspace_id
      and public.tasks_can_view_task_row(t.workspace_id, t.assigned_to_user_id, t.created_by_user_id)
  )
);

drop policy if exists task_comments_update on public.task_comments;
create policy task_comments_update
on public.task_comments
for update
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.workspace_id = workspace_id
      and public.tasks_can_view_task_row(t.workspace_id, t.assigned_to_user_id, t.created_by_user_id)
      and (
        user_id = auth.uid()
        or public.tasks_has_workspace_admin_role(t.workspace_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.workspace_id = workspace_id
      and public.tasks_can_view_task_row(t.workspace_id, t.assigned_to_user_id, t.created_by_user_id)
      and (
        user_id = auth.uid()
        or public.tasks_has_workspace_admin_role(t.workspace_id)
      )
  )
);

drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete
on public.task_comments
for delete
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.workspace_id = workspace_id
      and public.tasks_can_view_task_row(t.workspace_id, t.assigned_to_user_id, t.created_by_user_id)
      and (
        user_id = auth.uid()
        or public.tasks_has_workspace_admin_role(t.workspace_id)
      )
  )
);

-- task_statuses (workspace-level customization)
drop policy if exists task_statuses_select on public.task_statuses;
create policy task_statuses_select
on public.task_statuses
for select
using (public.tasks_is_workspace_member(workspace_id));

drop policy if exists task_statuses_insert on public.task_statuses;
create policy task_statuses_insert
on public.task_statuses
for insert
with check (
  public.tasks_is_workspace_member(workspace_id)
  and public.tasks_has_workspace_admin_role(workspace_id)
);

drop policy if exists task_statuses_update on public.task_statuses;
create policy task_statuses_update
on public.task_statuses
for update
using (
  public.tasks_is_workspace_member(workspace_id)
  and public.tasks_has_workspace_admin_role(workspace_id)
)
with check (
  public.tasks_is_workspace_member(workspace_id)
  and public.tasks_has_workspace_admin_role(workspace_id)
);

drop policy if exists task_statuses_delete on public.task_statuses;
create policy task_statuses_delete
on public.task_statuses
for delete
using (
  public.tasks_is_workspace_member(workspace_id)
  and public.tasks_has_workspace_admin_role(workspace_id)
);

commit;
