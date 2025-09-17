-- Fix RLS policies to use app_metadata for role claims
-- This ensures JWTs with role in app_metadata work correctly

-- Step 1: Drop existing policies
DROP POLICY IF EXISTS jr_super_admin_all ON public.job_requisitions;
DROP POLICY IF EXISTS jr_owner_full ON public.job_requisitions;
DROP POLICY IF EXISTS jr_collaborator_read ON public.job_requisitions;

DROP POLICY IF EXISTS ts_super_admin_all ON public.team_settings;
DROP POLICY IF EXISTS ts_team_members_crud ON public.team_settings;

-- Step 2: Create new policies that check app_metadata role
-- Job requisitions policies

-- Super admin sees all jobs (check app_metadata.role)
CREATE POLICY jr_super_admin_all
  ON public.job_requisitions
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'app_metadata')::json ->> 'role' = 'super_admin'
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

-- Super admin full access (check app_metadata.role)
CREATE POLICY ts_super_admin_all
  ON public.team_settings
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'app_metadata')::json ->> 'role' = 'super_admin'
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

-- Step 3: Add fallback policies that also check user_metadata (for backward compatibility)
-- This ensures both app_metadata and user_metadata roles work

-- Fallback super admin policy for job_requisitions
CREATE POLICY jr_super_admin_fallback
  ON public.job_requisitions
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'user_metadata')::json ->> 'role' = 'super_admin'
  )
  WITH CHECK (TRUE);

-- Fallback super admin policy for team_settings
CREATE POLICY ts_super_admin_fallback
  ON public.team_settings
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'user_metadata')::json ->> 'role' = 'super_admin'
  )
  WITH CHECK (TRUE);

-- Log completion
INSERT INTO public.migration_log (migration_name, applied_at, description) 
VALUES (
  '20250124_fix_rls_app_metadata', 
  NOW(), 
  'Updated RLS policies to use app_metadata for role claims with fallback to user_metadata'
) ON CONFLICT (migration_name) DO NOTHING;
