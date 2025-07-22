-- CAPTCHA Detection and Alert System Migration
-- Creates tables and functions for tracking CAPTCHA incidents

-- =====================================================
-- 1. CREATE CAPTCHA INCIDENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS puppet_captcha_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES puppet_jobs(id) ON DELETE SET NULL,
  proxy_id TEXT,
  
  -- Detection details
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  page_url TEXT NOT NULL,
  captcha_type TEXT NOT NULL DEFAULT 'linkedin_captcha', -- linkedin_captcha, checkpoint_challenge, warning_banner
  detection_method TEXT NOT NULL, -- element_selector, url_pattern, visual_detection
  
  -- Screenshot and evidence
  screenshot_url TEXT,
  screenshot_storage_path TEXT,
  page_html_snippet TEXT,
  
  -- Alert and response tracking
  slack_alert_sent BOOLEAN DEFAULT false,
  slack_alert_sent_at TIMESTAMPTZ,
  slack_message_ts TEXT, -- Slack message timestamp for threading
  
  -- Admin response
  admin_acknowledged BOOLEAN DEFAULT false,
  admin_acknowledged_at TIMESTAMPTZ,
  admin_acknowledged_by UUID REFERENCES auth.users(id),
  admin_notes TEXT,
  
  -- Resolution tracking
  incident_status TEXT NOT NULL DEFAULT 'detected', -- detected, acknowledged, investigating, resolved, false_positive
  resolved_at TIMESTAMPTZ,
  resolution_method TEXT, -- manual_review, proxy_rotation, user_action, false_positive
  
  -- System impact
  job_halted BOOLEAN DEFAULT true,
  proxy_disabled BOOLEAN DEFAULT false,
  cooldown_until TIMESTAMPTZ,
  
  -- Metadata
  user_agent TEXT,
  session_id TEXT,
  execution_context JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add indexes for performance
CREATE INDEX idx_captcha_incidents_user_id ON puppet_captcha_incidents(user_id);
CREATE INDEX idx_captcha_incidents_job_id ON puppet_captcha_incidents(job_id);
CREATE INDEX idx_captcha_incidents_detected_at ON puppet_captcha_incidents(detected_at);
CREATE INDEX idx_captcha_incidents_status ON puppet_captcha_incidents(incident_status);
CREATE INDEX idx_captcha_incidents_proxy_id ON puppet_captcha_incidents(proxy_id);
CREATE INDEX idx_captcha_incidents_unresolved ON puppet_captcha_incidents(incident_status, detected_at) 
  WHERE incident_status IN ('detected', 'acknowledged', 'investigating');

-- =====================================================
-- 2. CREATE CAPTCHA DETECTION SETTINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS puppet_captcha_detection_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert default CAPTCHA detection settings
INSERT INTO puppet_captcha_detection_settings (setting_key, setting_value, description) VALUES 
('linkedin_captcha_selectors', '["input[name=\"captcha\"]", "img[alt*=\"captcha\"]", ".captcha-container", "#captcha", ".challenge-form"]', 'CSS selectors for detecting LinkedIn CAPTCHA elements'),
('linkedin_warning_urls', '["/checkpoint/challenge", "/captcha", "/security/challenge", "/authwall"]', 'URL patterns that indicate LinkedIn security challenges'),
('linkedin_warning_text', '["Please complete this security check", "Verify you''re human", "Security verification", "Complete this challenge"]', 'Text content that indicates CAPTCHA or security warnings'),
('screenshot_settings', '{"quality": 90, "fullPage": true, "type": "png"}', 'Screenshot capture settings'),
('slack_webhook_url', '""', 'Slack webhook URL for CAPTCHA alerts'),
('alert_cooldown_minutes', '5', 'Minutes to wait before sending another alert for the same user'),
('auto_disable_proxy', 'true', 'Whether to automatically disable proxy when CAPTCHA is detected'),
('cooldown_hours', '24', 'Hours to disable proxy/user after CAPTCHA detection'),
('enable_slack_alerts', 'true', 'Whether to send Slack alerts for CAPTCHA incidents')
ON CONFLICT (setting_key) DO NOTHING;

-- =====================================================
-- 3. CREATE CAPTCHA DETECTION FUNCTIONS
-- =====================================================

-- Function to record a CAPTCHA incident
CREATE OR REPLACE FUNCTION record_captcha_incident(
  p_user_id UUID,
  p_job_id UUID,
  p_proxy_id TEXT,
  p_page_url TEXT,
  p_captcha_type TEXT DEFAULT 'linkedin_captcha',
  p_detection_method TEXT DEFAULT 'element_selector',
  p_screenshot_url TEXT DEFAULT NULL,
  p_page_html_snippet TEXT DEFAULT NULL,
  p_execution_context JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_incident_id UUID;
  v_cooldown_hours INTEGER;
BEGIN
  -- Get cooldown hours from settings
  SELECT (setting_value::text)::INTEGER INTO v_cooldown_hours
  FROM puppet_captcha_detection_settings 
  WHERE setting_key = 'cooldown_hours';
  
  IF v_cooldown_hours IS NULL THEN
    v_cooldown_hours := 24; -- Default 24 hours
  END IF;

  -- Insert the incident
  INSERT INTO puppet_captcha_incidents (
    user_id,
    job_id,
    proxy_id,
    page_url,
    captcha_type,
    detection_method,
    screenshot_url,
    page_html_snippet,
    execution_context,
    cooldown_until,
    incident_status
  ) VALUES (
    p_user_id,
    p_job_id,
    p_proxy_id,
    p_page_url,
    p_captcha_type,
    p_detection_method,
    p_screenshot_url,
    p_page_html_snippet,
    p_execution_context,
    NOW() + (v_cooldown_hours || ' hours')::INTERVAL,
    'detected'
  ) RETURNING id INTO v_incident_id;

  -- Mark the job as failed if provided
  IF p_job_id IS NOT NULL THEN
    UPDATE puppet_jobs 
    SET 
      final_status = 'failed',
      status = 'failed',
      last_execution_error = 'CAPTCHA detected - job halted for security',
      executing_at = NULL,
      executing_by = NULL,
      updated_at = NOW()
    WHERE id = p_job_id;
  END IF;

  RETURN v_incident_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent unresolved CAPTCHA incidents
CREATE OR REPLACE FUNCTION get_unresolved_captcha_incidents(
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  incident_id UUID,
  user_id UUID,
  user_email TEXT,
  job_id UUID,
  proxy_id TEXT,
  detected_at TIMESTAMPTZ,
  page_url TEXT,
  captcha_type TEXT,
  screenshot_url TEXT,
  incident_status TEXT,
  admin_acknowledged BOOLEAN,
  cooldown_until TIMESTAMPTZ,
  minutes_since_detected INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pci.id,
    pci.user_id,
    COALESCE(u.email, 'Unknown') as user_email,
    pci.job_id,
    pci.proxy_id,
    pci.detected_at,
    pci.page_url,
    pci.captcha_type,
    pci.screenshot_url,
    pci.incident_status,
    pci.admin_acknowledged,
    pci.cooldown_until,
    EXTRACT(EPOCH FROM (NOW() - pci.detected_at)) / 60 as minutes_since_detected
  FROM puppet_captcha_incidents pci
  LEFT JOIN auth.users u ON pci.user_id = u.id
  WHERE pci.incident_status IN ('detected', 'acknowledged', 'investigating')
  ORDER BY pci.detected_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to acknowledge CAPTCHA incident
CREATE OR REPLACE FUNCTION acknowledge_captcha_incident(
  p_incident_id UUID,
  p_admin_user_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE puppet_captcha_incidents 
  SET 
    admin_acknowledged = true,
    admin_acknowledged_at = NOW(),
    admin_acknowledged_by = p_admin_user_id,
    admin_notes = p_notes,
    incident_status = 'acknowledged',
    updated_at = NOW()
  WHERE id = p_incident_id
    AND admin_acknowledged = false;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to resolve CAPTCHA incident
CREATE OR REPLACE FUNCTION resolve_captcha_incident(
  p_incident_id UUID,
  p_resolution_method TEXT,
  p_admin_user_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE puppet_captcha_incidents 
  SET 
    incident_status = 'resolved',
    resolved_at = NOW(),
    resolution_method = p_resolution_method,
    updated_at = NOW()
  WHERE id = p_incident_id
    AND incident_status != 'resolved';

  -- If resolving as false positive, re-enable the proxy
  IF p_resolution_method = 'false_positive' THEN
    UPDATE puppet_captcha_incidents 
    SET 
      proxy_disabled = false,
      cooldown_until = NULL
    WHERE id = p_incident_id;
  END IF;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user/proxy is in cooldown
CREATE OR REPLACE FUNCTION is_user_in_captcha_cooldown(
  p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_cooldown_end TIMESTAMPTZ;
BEGIN
  SELECT MAX(cooldown_until) INTO v_cooldown_end
  FROM puppet_captcha_incidents
  WHERE user_id = p_user_id
    AND incident_status IN ('detected', 'acknowledged', 'investigating')
    AND cooldown_until > NOW();

  RETURN v_cooldown_end IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to get CAPTCHA statistics
CREATE OR REPLACE FUNCTION get_captcha_statistics(
  p_days_back INTEGER DEFAULT 7
) RETURNS TABLE (
  total_incidents INTEGER,
  incidents_last_24h INTEGER,
  unique_users_affected INTEGER,
  most_common_type TEXT,
  avg_resolution_time_hours NUMERIC,
  unresolved_count INTEGER,
  proxy_disable_count INTEGER
) AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  v_cutoff_date := NOW() - (p_days_back || ' days')::INTERVAL;

  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_incidents,
    COUNT(CASE WHEN detected_at >= NOW() - INTERVAL '24 hours' THEN 1 END)::INTEGER as incidents_last_24h,
    COUNT(DISTINCT user_id)::INTEGER as unique_users_affected,
    MODE() WITHIN GROUP (ORDER BY captcha_type) as most_common_type,
    AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at)) / 3600)::NUMERIC as avg_resolution_time_hours,
    COUNT(CASE WHEN incident_status IN ('detected', 'acknowledged', 'investigating') THEN 1 END)::INTEGER as unresolved_count,
    COUNT(CASE WHEN proxy_disabled = true THEN 1 END)::INTEGER as proxy_disable_count
  FROM puppet_captcha_incidents
  WHERE detected_at >= v_cutoff_date;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. CREATE TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
CREATE TRIGGER update_captcha_incidents_updated_at
  BEFORE UPDATE ON puppet_captcha_incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_captcha_settings_updated_at
  BEFORE UPDATE ON puppet_captcha_detection_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE puppet_captcha_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_captcha_detection_settings ENABLE ROW LEVEL SECURITY;

-- Policies for service role (backend access)
CREATE POLICY "Service role can manage captcha incidents" ON puppet_captcha_incidents
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage captcha settings" ON puppet_captcha_detection_settings
  FOR ALL USING (auth.role() = 'service_role');

-- Policies for users to view their own incidents
CREATE POLICY "Users can view their own captcha incidents" ON puppet_captcha_incidents
  FOR SELECT USING (auth.uid() = user_id);

-- Policies for admins to view all incidents
CREATE POLICY "Admins can view all captcha incidents" ON puppet_captcha_incidents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- =====================================================
-- CAPTCHA DETECTION SYSTEM COMPLETE ✅
-- ===================================================== 