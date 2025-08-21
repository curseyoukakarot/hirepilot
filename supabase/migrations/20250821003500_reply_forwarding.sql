-- Add reply forwarding functionality
-- Users need primary_email for forwarding destination
ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_email TEXT;

-- User preferences for reply forwarding
CREATE TABLE IF NOT EXISTS user_reply_forwarding_prefs (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  cc_recipients TEXT[] DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on forwarding prefs
ALTER TABLE user_reply_forwarding_prefs ENABLE ROW LEVEL SECURITY;

-- RLS policies for forwarding prefs
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can manage their own forwarding prefs" ON user_reply_forwarding_prefs;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "Users can manage their own forwarding prefs"
  ON user_reply_forwarding_prefs FOR ALL
  USING (auth.uid() = user_id);

-- System can read all forwarding prefs for reply processing
CREATE POLICY "System can read forwarding prefs"
  ON user_reply_forwarding_prefs FOR SELECT
  USING (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_reply_forwarding_prefs_user_id ON user_reply_forwarding_prefs(user_id);
