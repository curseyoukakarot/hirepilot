-- Simple RLS policies using top-level role claim from Access Token Hook
-- This works with the access-token function that injects role into JWT claims

-- Step 1: Drop existing policies
DROP POLICY IF EXISTS jr_super_admin_all ON public.job_requisitions;
DROP POLICY IF EXISTS jr_super_admin_fallback ON public.job_requisitions;
DROP POLICY IF EXISTS jr_owner_full ON public.job_requisitions;
DROP POLICY IF EXISTS jr_collaborator_read ON public.job_requisitions;

DROP POLICY IF EXISTS ts_super_admin_all ON public.team_settings;
DROP POLICY IF EXISTS ts_super_admin_fallback ON public.team_settings;
DROP POLICY IF EXISTS ts_team_members_crud ON public.team_settings;

-- Step 2: Create clean policies using top-level role claim
-- Job requisitions policies

-- Super admin sees all jobs (using top-level role claim)
CREATE POLICY jr_super_admin_all
  ON public.job_requisitions
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role') = 'super_admin'
  )
  WITH CHECK (TRUE);

-- Job owner full access
CREATE POLICY jr_owner_full
  ON public.job_requisitions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Collaborators can view
CREATE POLICY jr_collaborator_read
  ON public.job_requisitions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_collaborators jc
      WHERE jc.job_id = job_requisitions.id
        AND jc.user_id = auth.uid()
    )
  );

-- Team settings policies

-- Super admin full access (using top-level role claim)
CREATE POLICY ts_super_admin_all
  ON public.team_settings
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role') = 'super_admin'
  )
  WITH CHECK (TRUE);

-- Team admins + members manage their own team's settings
CREATE POLICY ts_team_members_crud
  ON public.team_settings
  FOR ALL
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid()
    )
  );

-- Step 3: Add additional role-based policies for other roles
-- Team admins can see jobs from their team members
CREATE POLICY jr_team_admin_read
  ON public.job_requisitions
  FOR SELECT
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role') = 'team_admin'
    AND user_id IN (
      SELECT tm.user_id FROM public.team_members tm
      WHERE tm.team_id IN (
        SELECT team_id FROM public.team_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Log completion
INSERT INTO public.migration_log (migration_name, applied_at, description) 
VALUES (
  '20250124_simple_rls_with_role_claim', 
  NOW(), 
  'Simple RLS policies using top-level role claim from Access Token Hook'
) ON CONFLICT (migration_name) DO NOTHING;
