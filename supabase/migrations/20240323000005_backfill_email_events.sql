-- Backfill email_events from messages
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
WHERE NOT EXISTS (
  SELECT 1 FROM email_events e
  WHERE e.message_id = messages.id::text
  AND e.event_type = 'sent'
); 