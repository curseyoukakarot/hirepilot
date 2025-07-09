-- Fix trial email system issues

-- 1. Add missing email_notifications column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;

-- 2. Fix the get_trial_email_status function to handle missing email_notifications
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
  WHERE COALESCE(u.email_notifications, true) = true; -- Default to true if column doesn't exist
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trial_emails records for users who don't have them yet
-- This will catch existing trial users like brandon@offr.ai
INSERT INTO trial_emails (user_id, welcome_sent, powerup_sent, expiry_sent, created_at)
SELECT 
  u.id,
  false,
  false, 
  false,
  u.created_at
FROM users u
WHERE u.id NOT IN (SELECT user_id FROM trial_emails)
  AND u.created_at >= NOW() - INTERVAL '30 days' -- Only for recent signups
ON CONFLICT (user_id) DO NOTHING; 