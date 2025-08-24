-- 20250821_add_reply_tokens.sql

-- Map short opaque tokens → (message_id, user_id, campaign_id)
CREATE TABLE IF NOT EXISTS reply_tokens (
  token TEXT PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reply_tokens_msg ON reply_tokens(message_id);


