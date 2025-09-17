-- Fix RLS policies for job_requisitions and team_settings
-- This migration ensures proper access control:
-- - Super admins see everything
-- - Users only see their own jobs
-- - Jobs are private unless explicitly shared with collaborators
-- - Team admins + members can manage only their own team's settings

-- Step 1: Drop existing policies on both tables
-- Job Reqs
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'job_requisitions') LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.job_requisitions';
  END LOOP;
END $$;

-- Team Settings
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'team_settings') LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.team_settings';
  END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.job_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_settings ENABLE ROW LEVEL SECURITY;

-- Step 2: Create new clean policies for job_requisitions

-- Super admin sees all jobs
CREATE POLICY jr_super_admin_all
  ON public.job_requisitions
  FOR ALL
  TO authenticated
  USING ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'super_admin')
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

-- Step 3: Create new clean policies for team_settings

-- Super admin full access
CREATE POLICY ts_super_admin_all
  ON public.team_settings
  FOR ALL
  TO authenticated
  USING ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'super_admin')
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

-- Log completion
INSERT INTO public.migration_log (migration_name, applied_at, description) 
VALUES (
  '20250124_fix_rls_policies', 
  NOW(), 
  'Fixed RLS policies for job_requisitions and team_settings tables'
) ON CONFLICT (migration_name) DO NOTHING;
