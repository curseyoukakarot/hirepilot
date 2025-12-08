-- Add linkedin_engine_mode to user_settings and keep compatibility with legacy flag
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS linkedin_engine_mode text DEFAULT 'local_browser';

-- Backfill existing rows: anyone who previously enabled remote actions should default to cloud engine
UPDATE user_settings
SET linkedin_engine_mode = 'brightdata_cloud'
WHERE use_remote_linkedin_actions IS TRUE
  AND (linkedin_engine_mode IS NULL OR linkedin_engine_mode = '');

-- Ensure the column cannot be null going forward
ALTER TABLE user_settings
  ALTER COLUMN linkedin_engine_mode SET NOT NULL,
  ALTER COLUMN linkedin_engine_mode SET DEFAULT 'local_browser';


