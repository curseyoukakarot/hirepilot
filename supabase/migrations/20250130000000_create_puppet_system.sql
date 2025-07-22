-- Puppet LinkedIn Automation System
-- Production-grade LinkedIn connection request automation with safety controls

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Job status enum
CREATE TYPE puppet_job_status AS ENUM (
  'pending',
  'queued', 
  'running',
  'completed',
  'failed',
  'warning',   -- CAPTCHA or security checkpoint detected
  'cancelled',
  'rate_limited'
);

-- Detection types enum  
CREATE TYPE puppet_detection_type AS ENUM (
  'captcha',
  'phone_verification',
  'security_checkpoint',
  'account_restriction',
  'suspicious_activity',
  'login_challenge'
);

-- Proxy status enum
CREATE TYPE puppet_proxy_status AS ENUM (
  'active',
  'inactive', 
  'failed',
  'rate_limited',
  'banned'
);

-- 1. Puppet Jobs Table - Core job queue for LinkedIn automation
CREATE TABLE puppet_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID, -- Optional reference to campaigns
  
  -- Job Details
  linkedin_profile_url TEXT NOT NULL,
  message TEXT CHECK (char_length(message) <= 300), -- Optional message
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  
  -- Status & Timing
  status puppet_job_status DEFAULT 'pending' NOT NULL,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Results & Metadata
  result_data JSONB DEFAULT '{}',
  error_message TEXT,
  detection_type puppet_detection_type,
  screenshot_url TEXT, -- URL to screenshot if warning/error
  
  -- Safety & Rate Limiting
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 2,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Puppet Settings - Per-user automation configuration
CREATE TABLE puppet_user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- LinkedIn Cookie (encrypted)
  li_at_cookie TEXT, -- pgcrypto encrypted LinkedIn session cookie
  
  -- Automation Settings
  auto_mode_enabled BOOLEAN DEFAULT FALSE, -- REX Auto Mode toggle
  daily_connection_limit INTEGER DEFAULT 20 CHECK (daily_connection_limit BETWEEN 1 AND 50),
  min_delay_seconds INTEGER DEFAULT 60 CHECK (min_delay_seconds >= 30),
  max_delay_seconds INTEGER DEFAULT 180 CHECK (max_delay_seconds >= min_delay_seconds),
  
  -- Proxy Assignment
  proxy_id UUID, -- Reference to assigned proxy
  
  -- Safety Settings  
  captcha_detection_enabled BOOLEAN DEFAULT TRUE,
  auto_pause_on_warning BOOLEAN DEFAULT TRUE,
  
  -- Notifications
  slack_webhook_url TEXT,
  notification_events TEXT[] DEFAULT ARRAY['warning', 'daily_limit_reached', 'job_failed'],
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Puppet Proxies - Residential proxy pool management
CREATE TABLE puppet_proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Proxy Details
  proxy_provider TEXT NOT NULL, -- 'smartproxy', 'brightdata', etc.
  proxy_endpoint TEXT NOT NULL,
  proxy_port INTEGER NOT NULL,
  proxy_username TEXT NOT NULL,
  proxy_password TEXT NOT NULL, -- Consider encryption
  proxy_location TEXT, -- Country/region
  
  -- Status & Health
  status puppet_proxy_status DEFAULT 'active',
  last_health_check TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  
  -- Rate Limiting
  requests_today INTEGER DEFAULT 0,
  daily_limit INTEGER DEFAULT 100,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  
  -- Assignment (one proxy per user ideally)
  assigned_user_id UUID REFERENCES auth.users(id),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Puppet Job Logs - Detailed execution logs
CREATE TABLE puppet_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES puppet_jobs(id) ON DELETE CASCADE NOT NULL,
  
  -- Log Details
  log_level TEXT NOT NULL CHECK (log_level IN ('info', 'warn', 'error', 'debug')),
  message TEXT NOT NULL,
  step_name TEXT, -- 'navigate', 'click_connect', 'send_message', etc.
  
  -- Technical Details
  screenshot_url TEXT,
  page_url TEXT,
  user_agent TEXT,
  proxy_used TEXT,
  
  -- Timing
  execution_time_ms INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Puppet Daily Stats - Rate limiting and reporting
CREATE TABLE puppet_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Date
  stat_date DATE DEFAULT CURRENT_DATE,
  
  -- Counters
  connections_sent INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  jobs_completed INTEGER DEFAULT 0,
  jobs_failed INTEGER DEFAULT 0,
  jobs_warned INTEGER DEFAULT 0,
  
  -- Safety Events
  captcha_detections INTEGER DEFAULT 0,
  security_warnings INTEGER DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint for one record per user per day
  UNIQUE(user_id, stat_date)
);

-- 6. Puppet Screenshots - Store warning/error screenshots
CREATE TABLE puppet_screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES puppet_jobs(id) ON DELETE CASCADE,
  
  -- Screenshot Details
  detection_type puppet_detection_type,
  file_url TEXT NOT NULL, -- Supabase storage URL
  file_size INTEGER,
  
  -- Context
  page_url TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_puppet_jobs_user_id ON puppet_jobs(user_id);
CREATE INDEX idx_puppet_jobs_status ON puppet_jobs(status);
CREATE INDEX idx_puppet_jobs_scheduled_at ON puppet_jobs(scheduled_at);
CREATE INDEX idx_puppet_jobs_user_status ON puppet_jobs(user_id, status);

CREATE INDEX idx_puppet_user_settings_user_id ON puppet_user_settings(user_id);

CREATE INDEX idx_puppet_proxies_status ON puppet_proxies(status);
CREATE INDEX idx_puppet_proxies_assigned_user ON puppet_proxies(assigned_user_id);

CREATE INDEX idx_puppet_job_logs_job_id ON puppet_job_logs(job_id);
CREATE INDEX idx_puppet_job_logs_timestamp ON puppet_job_logs(timestamp);
CREATE INDEX idx_puppet_job_logs_level ON puppet_job_logs(log_level);

CREATE INDEX idx_puppet_daily_stats_user_date ON puppet_daily_stats(user_id, stat_date);
CREATE INDEX idx_puppet_daily_stats_date ON puppet_daily_stats(stat_date);

CREATE INDEX idx_puppet_screenshots_job_id ON puppet_screenshots(job_id);
CREATE INDEX idx_puppet_screenshots_detection_type ON puppet_screenshots(detection_type);

-- Enable RLS (Row Level Security)
ALTER TABLE puppet_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_proxies ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_screenshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own jobs
CREATE POLICY "Users can view own puppet jobs" ON puppet_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own puppet jobs" ON puppet_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own puppet jobs" ON puppet_jobs
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only see their own settings
CREATE POLICY "Users can view own puppet settings" ON puppet_user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own puppet settings" ON puppet_user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own puppet settings" ON puppet_user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Super admins can view all proxies, users can only see their assigned proxy
CREATE POLICY "Users can view assigned proxies" ON puppet_proxies
  FOR SELECT USING (
    auth.uid() = assigned_user_id OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
    )
  );

-- Only super admins can modify proxies
CREATE POLICY "Super admins can manage proxies" ON puppet_proxies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
    )
  );

-- Users can view logs for their own jobs
CREATE POLICY "Users can view own job logs" ON puppet_job_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM puppet_jobs 
      WHERE puppet_jobs.id = puppet_job_logs.job_id 
      AND puppet_jobs.user_id = auth.uid()
    )
  );

-- System can insert job logs for any job
CREATE POLICY "System can insert job logs" ON puppet_job_logs
  FOR INSERT WITH CHECK (true);

-- Users can view their own daily stats
CREATE POLICY "Users can view own daily stats" ON puppet_daily_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage daily stats" ON puppet_daily_stats
  FOR ALL WITH CHECK (true);

-- Users can view screenshots for their own jobs
CREATE POLICY "Users can view own job screenshots" ON puppet_screenshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM puppet_jobs 
      WHERE puppet_jobs.id = puppet_screenshots.job_id 
      AND puppet_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert screenshots" ON puppet_screenshots
  FOR INSERT WITH CHECK (true);

-- Helper functions for cookie encryption/decryption
-- (Using existing pgcrypto functions)
CREATE OR REPLACE FUNCTION encrypt_li_at_cookie(cookie_value TEXT, user_id UUID)
RETURNS TEXT AS $$
BEGIN
  -- Use user_id as part of the encryption key for additional security
  RETURN encode(
    pgp_sym_encrypt(
      cookie_value,
      CONCAT(current_setting('app.cookie_encryption_key', true), user_id::text)
    ),
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_li_at_cookie(encrypted_cookie TEXT, user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    decode(encrypted_cookie, 'base64'),
    CONCAT(current_setting('app.cookie_encryption_key', true), user_id::text)
  );
EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'Failed to decrypt LinkedIn cookie for user %', user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset daily stats at midnight
CREATE OR REPLACE FUNCTION reset_puppet_daily_counters()
RETURNS void AS $$
BEGIN
  -- Reset proxy daily counters
  UPDATE puppet_proxies 
  SET 
    requests_today = 0,
    last_reset_date = CURRENT_DATE
  WHERE last_reset_date < CURRENT_DATE;
  
  -- Create new daily stats records for active users if needed
  INSERT INTO puppet_daily_stats (user_id, stat_date)
  SELECT DISTINCT user_id, CURRENT_DATE
  FROM puppet_user_settings 
  WHERE auto_mode_enabled = true
  ON CONFLICT (user_id, stat_date) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE puppet_jobs IS 'Main job queue for LinkedIn connection automation via Puppeteer';
COMMENT ON TABLE puppet_user_settings IS 'Per-user configuration for Puppet automation system';
COMMENT ON TABLE puppet_proxies IS 'Residential proxy pool for LinkedIn automation';
COMMENT ON TABLE puppet_job_logs IS 'Detailed execution logs for debugging and monitoring';
COMMENT ON TABLE puppet_daily_stats IS 'Daily usage statistics and rate limiting counters';
COMMENT ON TABLE puppet_screenshots IS 'Screenshots captured during warnings/errors for debugging';

COMMENT ON COLUMN puppet_jobs.detection_type IS 'Type of security detection that caused a warning status';
COMMENT ON COLUMN puppet_user_settings.li_at_cookie IS 'Encrypted LinkedIn session cookie (li_at)';
COMMENT ON COLUMN puppet_user_settings.auto_mode_enabled IS 'REX Auto Mode toggle for this user';
COMMENT ON COLUMN puppet_proxies.assigned_user_id IS 'User assigned to this proxy (ideally 1:1 mapping)'; 