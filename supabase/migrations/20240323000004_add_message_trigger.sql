-- Create function to handle message insert
CREATE OR REPLACE FUNCTION handle_message_insert()
RETURNS trigger AS $$
BEGIN
  -- Insert into email_events
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

  -- Update lead status
  UPDATE leads
  SET status = 'Messaged',
      contacted_at = NEW.created_at
  WHERE id = NEW.lead_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on messages table
DROP TRIGGER IF EXISTS on_message_insert ON messages;
CREATE TRIGGER on_message_insert
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_message_insert(); 