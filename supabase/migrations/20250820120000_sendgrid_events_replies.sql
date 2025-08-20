-- Add idempotency fields to email_events and create email_replies table

-- email_events sg_event_id + sg_message_id for SendGrid idempotency and reference
ALTER TABLE email_events
  ADD COLUMN IF NOT EXISTS sg_event_id TEXT,
  ADD COLUMN IF NOT EXISTS sg_message_id TEXT;

-- Unique index for idempotency on sg_event_id
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_email_events_sg_event_id ON email_events (sg_event_id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- Replies table to capture inbound responses
CREATE TABLE IF NOT EXISTS email_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  message_id UUID,
  from_email TEXT NOT NULL,
  reply_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  subject TEXT,
  text_body TEXT,
  html_body TEXT,
  raw JSONB
);

CREATE INDEX IF NOT EXISTS idx_email_replies_user_id ON email_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_campaign_id ON email_replies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_message_id ON email_replies(message_id);

-- Enable RLS and basic policies
ALTER TABLE email_replies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own email replies" ON email_replies;
  DROP POLICY IF EXISTS "System can insert email replies" ON email_replies;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "Users can view their own email replies"
  ON email_replies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert email replies"
  ON email_replies FOR INSERT
  WITH CHECK (true);


