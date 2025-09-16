-- Fix infinite recursion in job_collaborators RLS policies
-- The issue is that policies are self-referencing the job_collaborators table

-- Drop all existing policies for job_collaborators
DROP POLICY IF EXISTS "Users can view job collaborators" ON public.job_collaborators;
DROP POLICY IF EXISTS "Users can insert job collaborators" ON public.job_collaborators;
DROP POLICY IF EXISTS "Users can update job collaborators" ON public.job_collaborators;
DROP POLICY IF EXISTS "Users can delete job collaborators" ON public.job_collaborators;
DROP POLICY IF EXISTS "job_collaborators_select_policy" ON public.job_collaborators;
DROP POLICY IF EXISTS "job_collaborators_insert_policy" ON public.job_collaborators;
DROP POLICY IF EXISTS "job_collaborators_update_policy" ON public.job_collaborators;
DROP POLICY IF EXISTS "job_collaborators_delete_policy" ON public.job_collaborators;

-- Create new policies that don't self-reference job_collaborators
CREATE POLICY "job_collaborators_select_policy"
ON public.job_collaborators
FOR SELECT TO authenticated
USING (
  -- User can see collaborators for jobs they own
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr
    WHERE jr.id = job_collaborators.job_id
    AND jr.user_id = auth.uid()
  )
  OR
  -- User can see their own collaboration records
  user_id = auth.uid()
  OR
  -- Team members can see collaborators for jobs in their team
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr
    JOIN public.users u_owner ON u_owner.id = jr.user_id
    JOIN public.users u_current ON u_current.id = auth.uid()
    WHERE jr.id = job_collaborators.job_id
    AND u_owner.team_id = u_current.team_id
    AND u_current.team_id IS NOT NULL
  )
);

CREATE POLICY "job_collaborators_insert_policy"
ON public.job_collaborators
FOR INSERT TO authenticated
WITH CHECK (
  -- User can add collaborators to jobs they own
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr
    WHERE jr.id = job_collaborators.job_id
    AND jr.user_id = auth.uid()
  )
  OR
  -- Team members can add collaborators to jobs in their team
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr
    JOIN public.users u_owner ON u_owner.id = jr.user_id
    JOIN public.users u_current ON u_current.id = auth.uid()
    WHERE jr.id = job_collaborators.job_id
    AND u_owner.team_id = u_current.team_id
    AND u_current.team_id IS NOT NULL
    AND u_current.role IN ('admin', 'team_admin')
  )
);

CREATE POLICY "job_collaborators_update_policy"
ON public.job_collaborators
FOR UPDATE TO authenticated
USING (
  -- User can update their own collaboration records
  user_id = auth.uid()
  OR
  -- Job owner can update collaborators
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr
    WHERE jr.id = job_collaborators.job_id
    AND jr.user_id = auth.uid()
  )
  OR
  -- Team admins can update collaborators for jobs in their team
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr
    JOIN public.users u_owner ON u_owner.id = jr.user_id
    JOIN public.users u_current ON u_current.id = auth.uid()
    WHERE jr.id = job_collaborators.job_id
    AND u_owner.team_id = u_current.team_id
    AND u_current.team_id IS NOT NULL
    AND u_current.role IN ('admin', 'team_admin')
  )
);

CREATE POLICY "job_collaborators_delete_policy"
ON public.job_collaborators
FOR DELETE TO authenticated
USING (
  -- User can remove their own collaboration records
  user_id = auth.uid()
  OR
  -- Job owner can remove collaborators
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr
    WHERE jr.id = job_collaborators.job_id
    AND jr.user_id = auth.uid()
  )
  OR
  -- Team admins can remove collaborators for jobs in their team
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr
    JOIN public.users u_owner ON u_owner.id = jr.user_id
    JOIN public.users u_current ON u_current.id = auth.uid()
    WHERE jr.id = job_collaborators.job_id
    AND u_owner.team_id = u_current.team_id
    AND u_current.team_id IS NOT NULL
    AND u_current.role IN ('admin', 'team_admin')
  )
);

-- Ensure RLS is enabled
ALTER TABLE public.job_collaborators ENABLE ROW LEVEL SECURITY;
