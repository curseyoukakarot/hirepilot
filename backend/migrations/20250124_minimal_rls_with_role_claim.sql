-- Minimal RLS policies using top-level role claim from Access Token Hook
-- This only works with tables that actually exist in the database

-- Step 1: Drop existing policies (ignore errors if they don't exist)
DROP POLICY IF EXISTS jr_super_admin_all ON public.job_requisitions;
DROP POLICY IF EXISTS jr_super_admin_fallback ON public.job_requisitions;
DROP POLICY IF EXISTS jr_owner_full ON public.job_requisitions;
DROP POLICY IF EXISTS jr_collaborator_read ON public.job_requisitions;
DROP POLICY IF EXISTS jr_team_admin_read ON public.job_requisitions;

-- Only drop team_settings policies if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_settings' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS ts_super_admin_all ON public.team_settings;
    DROP POLICY IF EXISTS ts_super_admin_fallback ON public.team_settings;
    DROP POLICY IF EXISTS ts_team_members_crud ON public.team_settings;
  END IF;
END $$;

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

-- Collaborators can view (only if job_collaborators table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_collaborators' AND table_schema = 'public') THEN
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
  END IF;
END $$;

-- Step 3: Create team_settings policies only if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_settings' AND table_schema = 'public') THEN
    -- Super admin full access (using top-level role claim)
    CREATE POLICY ts_super_admin_all
      ON public.team_settings
      FOR ALL
      TO authenticated
      USING (
        (current_setting('request.jwt.claims', true)::json ->> 'role') = 'super_admin'
      )
      WITH CHECK (TRUE);

    -- Basic team settings access (simplified without team_members dependency)
    CREATE POLICY ts_basic_access
      ON public.team_settings
      FOR ALL
      TO authenticated
      USING (TRUE)  -- Allow all authenticated users for now
      WITH CHECK (TRUE);
  END IF;
END $$;

-- Step 4: Add additional role-based policies for other roles
-- Team admins and recruitpro users can see jobs (simplified)
CREATE POLICY jr_team_admin_read
  ON public.job_requisitions
  FOR SELECT
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role') IN ('team_admin', 'recruitpro', 'admin')
  );

-- Log completion
INSERT INTO public.migration_log (migration_name, applied_at, description) 
VALUES (
  '20250124_minimal_rls_with_role_claim', 
  NOW(), 
  'Minimal RLS policies using top-level role claim, only for existing tables'
) ON CONFLICT (migration_name) DO NOTHING;
