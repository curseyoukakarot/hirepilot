-- Add RLS policies for job_collaborators table
-- This allows team members to add each other to job requisitions

-- Enable RLS
ALTER TABLE public.job_collaborators ENABLE ROW LEVEL SECURITY;

-- SELECT policy
DROP POLICY IF EXISTS "job_collaborators_select_policy" ON public.job_collaborators;
CREATE POLICY "job_collaborators_select_policy" ON public.job_collaborators
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr 
    WHERE jr.id = job_collaborators.job_id 
    AND jr.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.job_collaborators jc 
    WHERE jc.job_id = job_collaborators.job_id 
    AND jc.user_id = auth.uid()
  )
  OR
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

-- INSERT policy
DROP POLICY IF EXISTS "job_collaborators_insert_policy" ON public.job_collaborators;
CREATE POLICY "job_collaborators_insert_policy" ON public.job_collaborators
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr 
    WHERE jr.id = job_collaborators.job_id 
    AND jr.user_id = auth.uid()
  )
  OR
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
  )
);

-- UPDATE policy
DROP POLICY IF EXISTS "job_collaborators_update_policy" ON public.job_collaborators;
CREATE POLICY "job_collaborators_update_policy" ON public.job_collaborators
FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr 
    WHERE jr.id = job_collaborators.job_id 
    AND jr.user_id = auth.uid()
  )
  OR user_id = auth.uid()
  OR
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

-- DELETE policy
DROP POLICY IF EXISTS "job_collaborators_delete_policy" ON public.job_collaborators;
CREATE POLICY "job_collaborators_delete_policy" ON public.job_collaborators
FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.job_requisitions jr 
    WHERE jr.id = job_collaborators.job_id 
    AND jr.user_id = auth.uid()
  )
  OR user_id = auth.uid()
  OR
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
