-- Update the message trigger to set lead status to "Contacted" instead of "Messaged"
-- Only update leads that are currently in "New" status to avoid overwriting other statuses

CREATE OR REPLACE FUNCTION handle_message_insert()
RETURNS trigger AS $$
BEGIN
  -- Insert into email_events (existing functionality)
  INSERT INTO email_events (
    user_id,
    campaign_id,
    lead_id,
    provider,
    message_id,
    event_type,
    event_timestamp
  )
  VALUES (
    NEW.user_id,
    NEW.campaign_id,
    NEW.lead_id,
    NEW.provider,
    NEW.id::text,
    'sent',
    NEW.created_at
  );

  -- Update lead status from "New" to "Contacted" (only if currently "New")
  UPDATE leads
  SET status = 'Contacted',
      contacted_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.lead_id 
    AND (status = 'New' OR status = 'new'); -- Handle both cases for compatibility

  -- Emit Zapier event for message sent
  PERFORM emit_zap_event(
    NEW.user_id,
    'message_sent',
    jsonb_build_object(
      'id', NEW.id,
      'lead_id', NEW.lead_id,
      'campaign_id', NEW.campaign_id,
      'provider', NEW.provider,
      'subject', NEW.subject,
      'content', NEW.content,
      'status', NEW.status,
      'created_at', NEW.created_at
    ),
    'messages',
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger itself doesn't need to be recreated as it already exists
-- DROP TRIGGER IF EXISTS on_message_insert ON messages;
-- CREATE TRIGGER on_message_insert
--   AFTER INSERT ON messages
--   FOR EACH ROW
--   EXECUTE FUNCTION handle_message_insert(); 