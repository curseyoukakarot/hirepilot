-- Performance indexes for email attribution worker

-- Speed up "find unattributed" scans
CREATE INDEX IF NOT EXISTS idx_email_events_user_null_ts
  ON email_events (event_timestamp DESC) WHERE user_id IS NULL;

-- Common lookups for message linkage
-- Note: messages table uses 'message_id' column, not 'sg_message_id'
CREATE INDEX IF NOT EXISTS idx_messages_to_email_sent_at ON messages (to_email, sent_at DESC);

-- Useful for reading analytics quickly
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_event ON email_events (campaign_id, event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_user_campaign ON email_events (user_id, campaign_id);

-- Add environment variables for worker configuration
-- These should be set in your Railway/deployment environment:
-- WORKER_ATTRIB_BATCH_SIZE=500
-- WORKER_ATTRIB_MAX_RUNTIME_MS=240000
