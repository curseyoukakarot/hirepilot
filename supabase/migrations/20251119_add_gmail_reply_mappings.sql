-- 20251119_add_gmail_reply_mappings.sql

-- Table to map unique reply tokens/addresses to outbound messages (messages.id)
CREATE TABLE IF NOT EXISTS gmail_reply_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_email_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  gmail_message_id TEXT,
  unique_reply_token TEXT NOT NULL UNIQUE,
  reply_to_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gmail_reply_mappings_token ON gmail_reply_mappings(unique_reply_token);
CREATE INDEX IF NOT EXISTS idx_gmail_reply_mappings_outbound ON gmail_reply_mappings(outbound_email_id);

-- Optional convenience: store the injected Reply-To on messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='messages' AND column_name='reply_to_override'
  ) THEN
    ALTER TABLE messages ADD COLUMN reply_to_override TEXT;
  END IF;
END$$;


