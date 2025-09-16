-- Fix job_requisitions RLS policy to allow collaborators and team members to see jobs
-- This ensures that when someone is added as a collaborator, they can see the job in their /jobs list

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own job requisitions" ON public.job_requisitions;
DROP POLICY IF EXISTS "Users can insert their own job requisitions" ON public.job_requisitions;
DROP POLICY IF EXISTS "Users can update their own job requisitions" ON public.job_requisitions;
DROP POLICY IF EXISTS "Users can delete their own job requisitions" ON public.job_requisitions;

-- Create new comprehensive policies for job_requisitions
CREATE POLICY "job_requisitions_select_policy"
ON public.job_requisitions
FOR SELECT TO authenticated
USING (
  -- Owner can see their own jobs
  user_id = auth.uid()
  OR
  -- Explicit collaborator can see jobs they're invited to
  EXISTS (
    SELECT 1 FROM public.job_collaborators jc
    WHERE jc.job_id = job_requisitions.id
    AND jc.user_id = auth.uid()
  )
  OR
  -- Team members can see jobs owned by users in the same team
  EXISTS (
    SELECT 1 FROM public.users u_owner
    JOIN public.users u_current ON u_current.id = auth.uid()
    WHERE u_owner.id = job_requisitions.user_id
    AND u_owner.team_id = u_current.team_id
    AND u_current.team_id IS NOT NULL
  )
);

CREATE POLICY "job_requisitions_insert_policy"
ON public.job_requisitions
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "job_requisitions_update_policy"
ON public.job_requisitions
FOR UPDATE TO authenticated
USING (
  -- Owner can update their own jobs
  user_id = auth.uid()
  OR
  -- Collaborators with Admin or Editor role can update jobs
  EXISTS (
    SELECT 1 FROM public.job_collaborators jc
    WHERE jc.job_id = job_requisitions.id
    AND jc.user_id = auth.uid()
    AND jc.role IN ('Admin', 'Editor')
  )
  OR
  -- Team admins can update jobs owned by team members
  EXISTS (
    SELECT 1 FROM public.users u_owner
    JOIN public.users u_current ON u_current.id = auth.uid()
    WHERE u_owner.id = job_requisitions.user_id
    AND u_owner.team_id = u_current.team_id
    AND u_current.team_id IS NOT NULL
    AND u_current.role IN ('admin', 'team_admin')
  )
);

CREATE POLICY "job_requisitions_delete_policy"
ON public.job_requisitions
FOR DELETE TO authenticated
USING (
  -- Only owner can delete their own jobs
  user_id = auth.uid()
  OR
  -- Team admins can delete jobs owned by team members
  EXISTS (
    SELECT 1 FROM public.users u_owner
    JOIN public.users u_current ON u_current.id = auth.uid()
    WHERE u_owner.id = job_requisitions.user_id
    AND u_owner.team_id = u_current.team_id
    AND u_current.team_id IS NOT NULL
    AND u_current.role IN ('admin', 'team_admin')
  )
);

-- Ensure RLS is enabled
ALTER TABLE public.job_requisitions ENABLE ROW LEVEL SECURITY;
