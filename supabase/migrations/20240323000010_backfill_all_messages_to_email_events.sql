-- Backfill all messages to leads into email_events, even if campaign_id is NULL
INSERT INTO email_events (
  user_id,
  campaign_id,
  lead_id,
  provider,
  message_id,
  event_type,
  event_timestamp,
  created_at
)
SELECT
  user_id,
  campaign_id,
  lead_id,
  provider,
  id::text,
  'sent',
  created_at,
  created_at
FROM messages
WHERE lead_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM email_events e
    WHERE e.message_id = messages.id::text
      AND e.event_type = 'sent'
  ); 