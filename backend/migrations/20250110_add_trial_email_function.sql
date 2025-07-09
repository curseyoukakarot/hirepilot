-- Create the missing get_trial_email_status RPC function for trial email automation

CREATE OR REPLACE FUNCTION get_trial_email_status()
RETURNS TABLE (
  user_id UUID,
  created_at TIMESTAMPTZ,
  welcome_sent BOOLEAN,
  powerup_sent BOOLEAN,
  expiry_sent BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    te.user_id,
    te.created_at,
    te.welcome_sent,
    te.powerup_sent,
    te.expiry_sent
  FROM trial_emails te
  INNER JOIN users u ON te.user_id = u.id
  WHERE u.email_notifications IS NOT FALSE; -- Only send to users who haven't opted out
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 