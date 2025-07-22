-- REX Integration Migration
-- Add fields for REX Auto/Manual toggle and automation consent

-- Add REX-specific fields to puppet_user_settings
ALTER TABLE puppet_user_settings
ADD COLUMN IF NOT EXISTS automation_consent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS automation_consent_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rex_auto_mode_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_manual_review_at TIMESTAMPTZ;

-- Update the auto_mode_enabled to be rex_auto_mode_enabled for clarity
-- (Keep both for backward compatibility initially)
UPDATE puppet_user_settings 
SET rex_auto_mode_enabled = auto_mode_enabled 
WHERE rex_auto_mode_enabled IS NULL;

-- Add index for REX queries
CREATE INDEX IF NOT EXISTS idx_puppet_user_settings_rex_auto_mode 
ON puppet_user_settings(rex_auto_mode_enabled);

CREATE INDEX IF NOT EXISTS idx_puppet_user_settings_automation_consent 
ON puppet_user_settings(automation_consent);

-- Create REX activity log table for tracking manual reviews and auto actions
CREATE TABLE IF NOT EXISTS rex_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID, -- Reference to lead if applicable
  campaign_id UUID, -- Reference to campaign if applicable
  
  -- Activity Details
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'manual_review', 
    'auto_queue', 
    'consent_granted', 
    'consent_revoked',
    'auto_mode_enabled',
    'auto_mode_disabled',
    'manual_override'
  )),
  activity_description TEXT NOT NULL,
  
  -- LinkedIn Details
  linkedin_profile_url TEXT,
  message_content TEXT,
  
  -- Job Reference (if job was created)
  puppet_job_id UUID REFERENCES puppet_jobs(id) ON DELETE SET NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for REX activity log
CREATE INDEX idx_rex_activity_log_user_id ON rex_activity_log(user_id);
CREATE INDEX idx_rex_activity_log_activity_type ON rex_activity_log(activity_type);
CREATE INDEX idx_rex_activity_log_created_at ON rex_activity_log(created_at);
CREATE INDEX idx_rex_activity_log_user_type ON rex_activity_log(user_id, activity_type);

-- Enable RLS for REX activity log
ALTER TABLE rex_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for REX activity log
CREATE POLICY "Users can view own REX activity"
  ON rex_activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert REX activity"
  ON rex_activity_log FOR INSERT
  WITH CHECK (true);

-- Update comments
COMMENT ON COLUMN puppet_user_settings.automation_consent IS 'User consent for HirePilot to act on their behalf for LinkedIn automation';
COMMENT ON COLUMN puppet_user_settings.automation_consent_date IS 'Timestamp when user granted automation consent';
COMMENT ON COLUMN puppet_user_settings.rex_auto_mode_enabled IS 'REX Auto Mode toggle - when enabled, jobs are queued automatically';
COMMENT ON COLUMN puppet_user_settings.last_manual_review_at IS 'Last time user performed manual review of LinkedIn message';

COMMENT ON TABLE rex_activity_log IS 'Activity log for REX Auto/Manual mode actions and user interactions';

-- Add constraint to ensure consent date is set when consent is true
ALTER TABLE puppet_user_settings
ADD CONSTRAINT check_automation_consent_date 
CHECK (
  (automation_consent = FALSE) OR 
  (automation_consent = TRUE AND automation_consent_date IS NOT NULL)
); 