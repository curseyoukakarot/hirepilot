-- Fix infinite recursion in job_collaborators RLS policies
-- The issue was that the SELECT policy was querying job_collaborators table itself

-- Drop all existing policies
DROP POLICY IF EXISTS "job_collaborators_select_policy" ON public.job_collaborators;
DROP POLICY IF EXISTS "job_collaborators_insert_policy" ON public.job_collaborators;
DROP POLICY IF EXISTS "job_collaborators_update_policy" ON public.job_collaborators;
DROP POLICY IF EXISTS "job_collaborators_delete_policy" ON public.job_collaborators;

-- Create simplified, non-recursive policies

-- SELECT policy - users can see collaborators for jobs they own or are collaborating on
CREATE POLICY "job_collaborators_select_policy" ON public.job_collaborators
FOR SELECT TO authenticated USING (
  -- Job owner can see all collaborators
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr 
    WHERE jr.id = job_collaborators.job_id 
    AND jr.user_id = auth.uid()
  )
  OR
  -- Team members can see collaborators for jobs in their team
  EXISTS (
    SELECT 1
    FROM public.job_requisitions jr
    JOIN public.users job_owner ON job_owner.id = jr.user_id
    JOIN public.users cu ON cu.id = auth.uid()
    WHERE jr.id = job_collaborators.job_id
      AND job_owner.team_id = cu.team_id
      AND cu.team_id IS NOT NULL
  )
);

-- INSERT policy - job owners and team admins can add collaborators
CREATE POLICY "job_collaborators_insert_policy" ON public.job_collaborators
FOR INSERT TO authenticated WITH CHECK (
  -- Job owner can add collaborators
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr 
    WHERE jr.id = job_collaborators.job_id 
    AND jr.user_id = auth.uid()
  )
  OR
  -- Team admins can add team members as collaborators
  EXISTS (
    SELECT 1
    FROM public.job_requisitions jr
    JOIN public.users job_owner ON job_owner.id = jr.user_id
    JOIN public.users cu ON cu.id = auth.uid()
    JOIN public.users target_user ON target_user.id = job_collaborators.user_id
    WHERE jr.id = job_collaborators.job_id
      AND job_owner.team_id = cu.team_id
      AND cu.team_id IS NOT NULL
      AND target_user.team_id = cu.team_id
      AND cu.role IN ('admin', 'team_admin', 'super_admin')
  )
);

-- UPDATE policy - job owners and team admins can update collaborators
CREATE POLICY "job_collaborators_update_policy" ON public.job_collaborators
FOR UPDATE TO authenticated USING (
  -- Job owner can update collaborators
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr 
    WHERE jr.id = job_collaborators.job_id 
    AND jr.user_id = auth.uid()
  )
  OR
  -- Team admins can update collaborators
  EXISTS (
    SELECT 1
    FROM public.job_requisitions jr
    JOIN public.users job_owner ON job_owner.id = jr.user_id
    JOIN public.users cu ON cu.id = auth.uid()
    WHERE jr.id = job_collaborators.job_id
      AND job_owner.team_id = cu.team_id
      AND cu.team_id IS NOT NULL
      AND cu.role IN ('admin', 'team_admin', 'super_admin')
  )
);

-- DELETE policy - job owners and team admins can remove collaborators
CREATE POLICY "job_collaborators_delete_policy" ON public.job_collaborators
FOR DELETE TO authenticated USING (
  -- Job owner can remove collaborators
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr 
    WHERE jr.id = job_collaborators.job_id 
    AND jr.user_id = auth.uid()
  )
  OR
  -- Team admins can remove collaborators
  EXISTS (
    SELECT 1
    FROM public.job_requisitions jr
    JOIN public.users job_owner ON job_owner.id = jr.user_id
    JOIN public.users cu ON cu.id = auth.uid()
    WHERE jr.id = job_collaborators.job_id
      AND job_owner.team_id = cu.team_id
      AND cu.team_id IS NOT NULL
      AND cu.role IN ('admin', 'team_admin', 'super_admin')
  )
);
