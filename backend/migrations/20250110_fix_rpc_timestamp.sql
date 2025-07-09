-- Fix timestamp type mismatch in get_trial_email_status function

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
    te.created_at::TIMESTAMPTZ, -- Explicit cast to timestamptz
    te.welcome_sent,
    te.powerup_sent,
    te.expiry_sent
  FROM trial_emails te
  INNER JOIN users u ON te.user_id = u.id
  WHERE COALESCE(u.email_notifications, true) = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 