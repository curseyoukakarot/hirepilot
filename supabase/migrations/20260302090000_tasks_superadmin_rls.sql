-- Allow super admins to view tasks assigned to them across all workspaces,
-- even if they have no workspace_members row for that workspace.

begin;

-- Helper: true when the current user is a super admin in the users table
create or replace function public.tasks_is_super_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and lower(coalesce(u.role, '')) in ('super_admin', 'superadmin')
  );
$$;

-- Updated view function: existing workspace-member check OR super admin assigned to the task
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
    (
      public.tasks_is_workspace_member(p_workspace_id)
      and (
        p_assigned_to_user_id = auth.uid()
        or p_created_by_user_id = auth.uid()
        or public.tasks_can_view_all_team(p_workspace_id)
      )
    )
    or (
      public.tasks_is_super_admin()
      and (
        p_assigned_to_user_id = auth.uid()
        or p_created_by_user_id = auth.uid()
      )
    );
$$;

-- Updated mutate function: super admins can also update tasks assigned to / created by them
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
    (
      public.tasks_is_workspace_member(p_workspace_id)
      and (
        p_assigned_to_user_id = auth.uid()
        or p_created_by_user_id = auth.uid()
        or public.tasks_has_workspace_admin_role(p_workspace_id)
      )
    )
    or (
      public.tasks_is_super_admin()
      and (
        p_assigned_to_user_id = auth.uid()
        or p_created_by_user_id = auth.uid()
      )
    );
$$;

commit;
