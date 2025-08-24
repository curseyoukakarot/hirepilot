-- 20250821_add_email_identities_and_msg_link.sql

-- Create sender identities table (idempotent)
CREATE TABLE IF NOT EXISTS email_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  forward_to TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link messages to sender identity and store threading headers (idempotent)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sender_identity_id UUID REFERENCES email_identities(id),
  ADD COLUMN IF NOT EXISTS from_email TEXT,
  ADD COLUMN IF NOT EXISTS message_id_header TEXT; -- store outbound Message-ID for threading

-- Helpful index for lookups by identity
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_messages_sender_identity_id ON messages(sender_identity_id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;


