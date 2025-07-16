-- Create user_integrations table for storing optional enrichment API keys
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hunter_api_key TEXT,
  skrapp_api_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint to ensure one record per user
CREATE UNIQUE INDEX idx_user_integrations_user_id ON user_integrations(user_id);

-- Enable Row Level Security
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for safe re-running of migration)
DROP POLICY IF EXISTS "Admin users can view their own integrations" ON user_integrations;
DROP POLICY IF EXISTS "Admin users can insert their own integrations" ON user_integrations;
DROP POLICY IF EXISTS "Admin users can update their own integrations" ON user_integrations;
DROP POLICY IF EXISTS "Admin users can delete their own integrations" ON user_integrations;
DROP POLICY IF EXISTS "Service role has full access" ON user_integrations;

-- Create policies for admin-level users only
-- Users can view their own integration record if they have admin role
CREATE POLICY "Admin users can view their own integrations"
  ON user_integrations FOR SELECT
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'team_admin', 'RecruitPro', 'super_admin')
    )
  );

-- Users can insert their own integration record if they have admin role
CREATE POLICY "Admin users can insert their own integrations"
  ON user_integrations FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'team_admin', 'RecruitPro', 'super_admin')
    )
  );

-- Users can update their own integration record if they have admin role
CREATE POLICY "Admin users can update their own integrations"
  ON user_integrations FOR UPDATE
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'team_admin', 'RecruitPro', 'super_admin')
    )
  );

-- Users can delete their own integration record if they have admin role
CREATE POLICY "Admin users can delete their own integrations"
  ON user_integrations FOR DELETE
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'team_admin', 'RecruitPro', 'super_admin')
    )
  );

-- Service role has full access (needed for backend operations)
CREATE POLICY "Service role has full access"
  ON user_integrations
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Add helpful comments
COMMENT ON TABLE user_integrations IS 'Stores optional enrichment API keys for admin-level users';
COMMENT ON COLUMN user_integrations.hunter_api_key IS 'Hunter.io API key for email enrichment';
COMMENT ON COLUMN user_integrations.skrapp_api_key IS 'Skrapp.io API key for email enrichment'; 