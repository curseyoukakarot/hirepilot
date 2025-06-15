-- Enable RLS on google_accounts table
ALTER TABLE google_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own google accounts" ON google_accounts;
DROP POLICY IF EXISTS "Users can insert their own google accounts" ON google_accounts;
DROP POLICY IF EXISTS "Users can update their own google accounts" ON google_accounts;
DROP POLICY IF EXISTS "Users can delete their own google accounts" ON google_accounts;

-- Create new policies
CREATE POLICY "Users can view their own google accounts"
  ON google_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own google accounts"
  ON google_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own google accounts"
  ON google_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own google accounts"
  ON google_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Create a policy for service role access (needed for backend)
CREATE POLICY "Service role has full access"
  ON google_accounts
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role'); 