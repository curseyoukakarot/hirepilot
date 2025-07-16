-- Update RLS policies for user_integrations table to match new role requirements
-- Only allow: Super Admin, Pro, Team Admin, RecruitPro

-- Drop existing policies
DROP POLICY IF EXISTS "Admin users can view their own integrations" ON user_integrations;
DROP POLICY IF EXISTS "Admin users can insert their own integrations" ON user_integrations;
DROP POLICY IF EXISTS "Admin users can update their own integrations" ON user_integrations;
DROP POLICY IF EXISTS "Admin users can delete their own integrations" ON user_integrations;

-- Create updated policies with new role restrictions
-- Users can view their own integration record if they have premium role
CREATE POLICY "Premium users can view their own integrations"
  ON user_integrations FOR SELECT
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'Pro', 'team_admin', 'RecruitPro')
    )
  );

-- Users can insert their own integration record if they have premium role
CREATE POLICY "Premium users can insert their own integrations"
  ON user_integrations FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'Pro', 'team_admin', 'RecruitPro')
    )
  );

-- Users can update their own integration record if they have premium role
CREATE POLICY "Premium users can update their own integrations"
  ON user_integrations FOR UPDATE
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'Pro', 'team_admin', 'RecruitPro')
    )
  );

-- Users can delete their own integration record if they have premium role
CREATE POLICY "Premium users can delete their own integrations"
  ON user_integrations FOR DELETE
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'Pro', 'team_admin', 'RecruitPro')
    )
  );

-- Add helpful comments
COMMENT ON POLICY "Premium users can view their own integrations" ON user_integrations IS 'Restricts Hunter/Skrapp access to premium users only: super_admin, Pro, team_admin, RecruitPro';
COMMENT ON POLICY "Premium users can insert their own integrations" ON user_integrations IS 'Restricts Hunter/Skrapp access to premium users only: super_admin, Pro, team_admin, RecruitPro';
COMMENT ON POLICY "Premium users can update their own integrations" ON user_integrations IS 'Restricts Hunter/Skrapp access to premium users only: super_admin, Pro, team_admin, RecruitPro';
COMMENT ON POLICY "Premium users can delete their own integrations" ON user_integrations IS 'Restricts Hunter/Skrapp access to premium users only: super_admin, Pro, team_admin, RecruitPro'; 