-- Add slack_notifications column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_notifications BOOLEAN DEFAULT true;

-- Update notification preferences for existing users
UPDATE users SET slack_notifications = true WHERE slack_notifications IS NULL;

-- Add comment
COMMENT ON COLUMN users.slack_notifications IS 'Whether user wants to receive Slack notifications for campaigns'; 