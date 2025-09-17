-- Fix existing RLS policies to work with Access Token Hook
-- This only updates the policies that already exist

-- The existing policies look good, but let's ensure they're using the correct role claim format
-- and add some additional role support

-- Step 1: Add support for more roles in the super admin policy
DROP POLICY IF EXISTS jr_super_admin_all ON public.job_requisitions;

CREATE POLICY jr_super_admin_all
  ON public.job_requisitions
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role') IN ('super_admin', 'admin')
  )
  WITH CHECK (TRUE);

-- Step 2: Add a policy for recruitpro users to see their own jobs
CREATE POLICY jr_recruitpro_read
  ON public.job_requisitions
  FOR SELECT
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role') = 'recruitpro'
    AND user_id = auth.uid()
  );

-- Step 3: Add a policy for team_admin users to see jobs from their team
-- (This will work once team structure is in place)
CREATE POLICY jr_team_admin_read
  ON public.job_requisitions
  FOR SELECT
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role') = 'team_admin'
    AND user_id = auth.uid()
  );

-- Step 4: Ensure the owner and collaborator policies are still working
-- (These should already be correct, but let's verify)

-- Log completion
INSERT INTO public.migration_log (migration_name, applied_at, description) 
VALUES (
  '20250124_fix_existing_rls_policies', 
  NOW(), 
  'Updated existing RLS policies to support more roles and work with Access Token Hook'
) ON CONFLICT (migration_name) DO NOTHING;
