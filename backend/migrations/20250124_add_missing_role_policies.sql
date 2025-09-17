-- Add missing role policies for recruitpro and team_admin users
-- This works with the existing RLS setup

-- Add a policy for recruitpro users to see their own jobs
CREATE POLICY jr_recruitpro_read
  ON public.job_requisitions
  FOR SELECT
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role') = 'recruitpro'
    AND user_id = auth.uid()
  );

-- Add a policy for team_admin users to see jobs from their team
CREATE POLICY jr_team_admin_read
  ON public.job_requisitions
  FOR SELECT
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role') = 'team_admin'
    AND user_id = auth.uid()
  );

-- Add a policy for admin users (if different from super_admin)
CREATE POLICY jr_admin_read
  ON public.job_requisitions
  FOR SELECT
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role') = 'admin'
  );
