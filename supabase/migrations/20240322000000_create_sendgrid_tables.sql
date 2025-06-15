-- Create user_sendgrid_keys table
CREATE TABLE user_sendgrid_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key text NOT NULL,
  default_sender text NOT NULL,
  connected_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_sendgrid_keys ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own sendgrid keys"
  ON user_sendgrid_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sendgrid keys"
  ON user_sendgrid_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sendgrid keys"
  ON user_sendgrid_keys FOR UPDATE
  USING (auth.uid() = user_id);

-- Create user_sendgrid_senders table for storing verified senders
CREATE TABLE user_sendgrid_senders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, email)
);

-- Enable RLS
ALTER TABLE user_sendgrid_senders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own sendgrid senders"
  ON user_sendgrid_senders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sendgrid senders"
  ON user_sendgrid_senders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sendgrid senders"
  ON user_sendgrid_senders FOR UPDATE
  USING (auth.uid() = user_id); 