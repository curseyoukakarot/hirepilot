-- Create google_accounts table
CREATE TABLE google_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  scopes text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'connected',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique index on user_id
CREATE UNIQUE INDEX idx_google_accounts_user_id ON google_accounts(user_id);

-- Enable RLS
ALTER TABLE google_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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