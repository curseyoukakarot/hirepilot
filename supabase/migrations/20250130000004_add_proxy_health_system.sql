-- Proxy Health Monitor and Auto-Rotation System
-- Tracks proxy performance per user and automatically rotates failed proxies

-- Proxy status enum for health tracking
CREATE TYPE proxy_status AS ENUM (
  'active',         -- Proxy is working well
  'inactive',       -- Proxy has failed too many times  
  'maintenance',    -- Temporarily disabled for maintenance
  'banned',         -- Permanently banned/blocked
  'testing'         -- Being tested before activation
);

-- Proxy provider enum for different services
CREATE TYPE proxy_provider AS ENUM (
  'brightdata',     -- BrightData (formerly Luminati)
  'smartproxy',     -- SmartProxy
  'residential',    -- Generic residential
  'datacenter',     -- Datacenter proxies
  'mobile',         -- Mobile proxies
  'custom'          -- Custom proxy setup
);

-- Proxy Pool Table
-- Master list of all available proxies
CREATE TABLE proxy_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Proxy Details
  provider proxy_provider NOT NULL,
  endpoint TEXT NOT NULL, -- IP:PORT or hostname:port
  username TEXT,
  password TEXT,
  
  -- Location & Type
  country_code TEXT, -- US, UK, DE, etc.
  region TEXT,       -- State/region if applicable
  city TEXT,         -- City if available
  proxy_type TEXT,   -- residential, datacenter, mobile
  
  -- Configuration
  max_concurrent_users INTEGER DEFAULT 1 CHECK (max_concurrent_users >= 1),
  rotation_interval_minutes INTEGER DEFAULT 30,
  
  -- Status & Health
  status proxy_status DEFAULT 'testing' NOT NULL,
  global_success_count INTEGER DEFAULT 0,
  global_failure_count INTEGER DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  
  -- Administrative
  notes TEXT,
  added_by UUID, -- Admin who added this proxy
  cost_per_gb DECIMAL(10,4), -- Cost tracking
  monthly_limit_gb INTEGER,  -- Data limit if applicable
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint on endpoint
  UNIQUE(endpoint, username)
);

-- Proxy Health Table (per user per proxy)
-- Tracks how each proxy performs for each specific user
CREATE TABLE proxy_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proxy_id UUID REFERENCES proxy_pool(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Health Metrics
  success_count INTEGER DEFAULT 0 CHECK (success_count >= 0),
  failure_count INTEGER DEFAULT 0 CHECK (failure_count >= 0),
  
  -- Recent Performance (last 24 hours)
  recent_success_count INTEGER DEFAULT 0 CHECK (recent_success_count >= 0),
  recent_failure_count INTEGER DEFAULT 0 CHECK (recent_failure_count >= 0),
  
  -- Timing
  last_used_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  
  -- Status for this user
  status proxy_status DEFAULT 'active' NOT NULL,
  failure_reason TEXT, -- Last failure reason
  
  -- Performance Metrics
  avg_response_time_ms INTEGER,
  total_jobs_processed INTEGER DEFAULT 0,
  
  -- Automatic status management
  consecutive_failures INTEGER DEFAULT 0 CHECK (consecutive_failures >= 0),
  auto_disabled_at TIMESTAMPTZ,
  auto_disabled_reason TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one health record per user per proxy
  UNIQUE(proxy_id, user_id)
);

-- Proxy Assignment History
-- Tracks which proxy was assigned to which user for which job
CREATE TABLE proxy_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Assignment Details
  proxy_id UUID REFERENCES proxy_pool(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_id UUID, -- Reference to puppet_jobs or other job tables
  
  -- Assignment Context
  assignment_reason TEXT, -- 'initial', 'rotation', 'failure_recovery', 'manual'
  previous_proxy_id UUID REFERENCES proxy_pool(id) ON DELETE SET NULL,
  
  -- Outcome
  was_successful BOOLEAN,
  failure_reason TEXT,
  response_time_ms INTEGER,
  
  -- Timing
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  job_type TEXT, -- 'linkedin_connection', 'profile_scraping', etc.
  user_agent TEXT,
  ip_verified TEXT, -- The actual IP address used
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proxy Rotation Rules
-- Configurable rules for when and how to rotate proxies
CREATE TABLE proxy_rotation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Rule Configuration
  rule_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 5, -- Higher number = higher priority
  
  -- Trigger Conditions
  max_failures_24h INTEGER DEFAULT 3,
  max_consecutive_failures INTEGER DEFAULT 2,
  max_response_time_ms INTEGER DEFAULT 30000, -- 30 seconds
  min_success_rate_percent INTEGER DEFAULT 70,
  
  -- Rotation Behavior
  cooldown_hours INTEGER DEFAULT 24, -- How long to wait before retrying
  auto_retry_enabled BOOLEAN DEFAULT TRUE,
  escalate_to_admin BOOLEAN DEFAULT FALSE,
  
  -- Provider-Specific Rules
  applies_to_providers proxy_provider[],
  applies_to_proxy_types TEXT[],
  
  -- Audit
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_proxy_pool_status ON proxy_pool(status);
CREATE INDEX idx_proxy_pool_provider ON proxy_pool(provider);
CREATE INDEX idx_proxy_health_user_proxy ON proxy_health(user_id, proxy_id);
CREATE INDEX idx_proxy_health_status ON proxy_health(status);
CREATE INDEX idx_proxy_health_failures ON proxy_health(recent_failure_count, last_failure_at);
CREATE INDEX idx_proxy_assignments_user ON proxy_assignments(user_id);
CREATE INDEX idx_proxy_assignments_proxy ON proxy_assignments(proxy_id);
CREATE INDEX idx_proxy_assignments_job ON proxy_assignments(job_id);
CREATE INDEX idx_proxy_assignments_time ON proxy_assignments(assigned_at);

-- View: Active Proxy Pool
-- Shows only proxies that are currently active and available
CREATE VIEW active_proxy_pool AS
SELECT 
  p.*,
  COUNT(ph.user_id) as active_users,
  COALESCE(AVG(ph.avg_response_time_ms), 0) as avg_response_time,
  COALESCE(SUM(ph.success_count), 0) as total_successes,
  COALESCE(SUM(ph.failure_count), 0) as total_failures,
  CASE 
    WHEN COALESCE(SUM(ph.success_count), 0) + COALESCE(SUM(ph.failure_count), 0) = 0 THEN 100
    ELSE ROUND((COALESCE(SUM(ph.success_count), 0)::DECIMAL / (COALESCE(SUM(ph.success_count), 0) + COALESCE(SUM(ph.failure_count), 0))) * 100, 2)
  END as success_rate_percent
FROM proxy_pool p
LEFT JOIN proxy_health ph ON p.id = ph.proxy_id AND ph.status = 'active'
WHERE p.status = 'active'
GROUP BY p.id
ORDER BY success_rate_percent DESC, active_users ASC;

-- View: User Proxy Status
-- Shows current proxy assignments and health for each user
CREATE VIEW user_proxy_status AS
SELECT 
  u.id as user_id,
  u.email,
  
  -- Current proxy assignment (most recent)
  recent_assignment.proxy_id as current_proxy_id,
  p.endpoint as current_proxy_endpoint,
  p.provider as current_proxy_provider,
  p.country_code as current_proxy_country,
  
  -- Health metrics for current proxy
  ph.status as proxy_health_status,
  ph.success_count,
  ph.failure_count,
  ph.recent_failure_count,
  ph.consecutive_failures,
  ph.last_used_at,
  ph.last_failure_at,
  ph.avg_response_time_ms,
  
  -- Assignment info
  recent_assignment.assigned_at as proxy_assigned_at,
  recent_assignment.assignment_reason,
  
  -- Status flags
  CASE 
    WHEN ph.recent_failure_count >= 3 THEN TRUE
    ELSE FALSE
  END as needs_rotation,
  
  CASE 
    WHEN ph.status = 'inactive' THEN TRUE
    ELSE FALSE  
  END as proxy_disabled,
  
  CASE
    WHEN recent_assignment.proxy_id IS NULL THEN TRUE
    ELSE FALSE
  END as needs_assignment
  
FROM auth.users u
LEFT JOIN LATERAL (
  SELECT DISTINCT ON (user_id) *
  FROM proxy_assignments
  WHERE user_id = u.id
  ORDER BY user_id, assigned_at DESC
) recent_assignment ON TRUE
LEFT JOIN proxy_pool p ON recent_assignment.proxy_id = p.id
LEFT JOIN proxy_health ph ON recent_assignment.proxy_id = ph.proxy_id AND u.id = ph.user_id
WHERE u.deleted_at IS NULL;

-- Function: Update Proxy Health
-- Updates health metrics after job completion
CREATE OR REPLACE FUNCTION update_proxy_health(
  p_proxy_id UUID,
  p_user_id UUID,
  p_was_successful BOOLEAN,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  health_record RECORD;
  rotation_rule RECORD;
BEGIN
  -- Get or create health record
  INSERT INTO proxy_health (proxy_id, user_id)
  VALUES (p_proxy_id, p_user_id)
  ON CONFLICT (proxy_id, user_id) DO NOTHING;
  
  -- Update health metrics
  IF p_was_successful THEN
    UPDATE proxy_health 
    SET 
      success_count = success_count + 1,
      recent_success_count = recent_success_count + 1,
      consecutive_failures = 0,
      last_success_at = NOW(),
      last_used_at = NOW(),
      avg_response_time_ms = CASE 
        WHEN avg_response_time_ms IS NULL THEN p_response_time_ms
        WHEN p_response_time_ms IS NULL THEN avg_response_time_ms
        ELSE (avg_response_time_ms + p_response_time_ms) / 2
      END,
      total_jobs_processed = total_jobs_processed + 1,
      updated_at = NOW()
    WHERE proxy_id = p_proxy_id AND user_id = p_user_id;
    
    -- Also update global proxy pool stats
    UPDATE proxy_pool
    SET 
      global_success_count = global_success_count + 1,
      last_success_at = NOW(),
      updated_at = NOW()
    WHERE id = p_proxy_id;
    
  ELSE
    UPDATE proxy_health 
    SET 
      failure_count = failure_count + 1,
      recent_failure_count = recent_failure_count + 1,
      consecutive_failures = consecutive_failures + 1,
      last_failure_at = NOW(),
      last_used_at = NOW(),
      failure_reason = p_failure_reason,
      total_jobs_processed = total_jobs_processed + 1,
      updated_at = NOW()
    WHERE proxy_id = p_proxy_id AND user_id = p_user_id;
    
    -- Also update global proxy pool stats
    UPDATE proxy_pool
    SET 
      global_failure_count = global_failure_count + 1,
      last_failure_at = NOW(),
      updated_at = NOW()
    WHERE id = p_proxy_id;
  END IF;
  
  -- Get updated health record
  SELECT * INTO health_record 
  FROM proxy_health 
  WHERE proxy_id = p_proxy_id AND user_id = p_user_id;
  
  -- Check rotation rules and auto-disable if needed
  FOR rotation_rule IN 
    SELECT * FROM proxy_rotation_rules 
    WHERE is_active = TRUE 
    ORDER BY priority DESC
  LOOP
    -- Check if proxy should be disabled for this user
    IF (health_record.recent_failure_count >= rotation_rule.max_failures_24h OR
        health_record.consecutive_failures >= rotation_rule.max_consecutive_failures) THEN
      
      UPDATE proxy_health
      SET 
        status = 'inactive',
        auto_disabled_at = NOW(),
        auto_disabled_reason = format('Auto-disabled: %s recent failures (rule: %s)', 
                                     health_record.recent_failure_count, 
                                     rotation_rule.rule_name),
        updated_at = NOW()
      WHERE proxy_id = p_proxy_id AND user_id = p_user_id;
      
      -- Exit after first matching rule
      EXIT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function: Get Next Available Proxy
-- Returns the best available proxy for a user
CREATE OR REPLACE FUNCTION get_next_available_proxy(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  best_proxy_id UUID;
BEGIN
  -- Find the best available proxy for this user
  -- Priority: active status, low user count, high success rate, low response time
  SELECT p.id INTO best_proxy_id
  FROM active_proxy_pool p
  LEFT JOIN proxy_health ph ON (p.id = ph.proxy_id AND ph.user_id = p_user_id)
  WHERE 
    p.status = 'active' 
    AND p.active_users < p.max_concurrent_users
    AND (ph.status IS NULL OR ph.status = 'active')
    AND (ph.recent_failure_count IS NULL OR ph.recent_failure_count < 3)
  ORDER BY 
    COALESCE(ph.consecutive_failures, 0) ASC,  -- Prefer proxies with fewer recent failures
    p.success_rate_percent DESC,               -- Prefer higher success rates
    p.active_users ASC,                        -- Prefer less busy proxies
    p.avg_response_time ASC,                   -- Prefer faster proxies
    p.created_at ASC                           -- Prefer older (more tested) proxies
  LIMIT 1;
  
  RETURN best_proxy_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Reset Daily Proxy Health Stats
-- Resets the recent_* counters (should be run daily)
CREATE OR REPLACE FUNCTION reset_daily_proxy_health()
RETURNS VOID AS $$
BEGIN
  UPDATE proxy_health 
  SET 
    recent_success_count = 0,
    recent_failure_count = 0,
    updated_at = NOW()
  WHERE updated_at < NOW() - INTERVAL '24 hours';
  
  -- Re-activate proxies that were auto-disabled more than 24 hours ago
  UPDATE proxy_health
  SET 
    status = 'active',
    consecutive_failures = 0,
    auto_disabled_at = NULL,
    auto_disabled_reason = NULL,
    updated_at = NOW()
  WHERE 
    status = 'inactive' 
    AND auto_disabled_at IS NOT NULL 
    AND auto_disabled_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE proxy_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_rotation_rules ENABLE ROW LEVEL SECURITY;

-- Users can only see their own proxy health data
CREATE POLICY "Users can view own proxy health" ON proxy_health
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own proxy assignments" ON proxy_assignments
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all proxy data
CREATE POLICY "Service role can manage proxy pool" ON proxy_pool
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage proxy health" ON proxy_health
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage proxy assignments" ON proxy_assignments
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage rotation rules" ON proxy_rotation_rules
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON proxy_pool TO service_role;
GRANT ALL ON proxy_health TO service_role;
GRANT ALL ON proxy_assignments TO service_role;
GRANT ALL ON proxy_rotation_rules TO service_role;
GRANT SELECT ON active_proxy_pool TO service_role;
GRANT SELECT ON user_proxy_status TO service_role;

-- Insert default rotation rule
INSERT INTO proxy_rotation_rules (
  rule_name,
  is_active,
  priority,
  max_failures_24h,
  max_consecutive_failures,
  max_response_time_ms,
  min_success_rate_percent,
  cooldown_hours,
  auto_retry_enabled,
  escalate_to_admin
) VALUES (
  'Default Rotation Rule',
  TRUE,
  5,
  3,    -- 3 failures in 24h triggers rotation
  2,    -- 2 consecutive failures triggers rotation
  30000, -- 30 second timeout
  70,   -- 70% minimum success rate
  24,   -- 24 hour cooldown
  TRUE, -- Auto retry after cooldown
  FALSE -- Don't escalate to admin automatically
);

-- Comments
COMMENT ON TABLE proxy_pool IS 'Master list of all available proxies with global health metrics';
COMMENT ON TABLE proxy_health IS 'Per-user proxy health tracking with automatic status management';
COMMENT ON TABLE proxy_assignments IS 'Historical record of proxy assignments to users for jobs';
COMMENT ON TABLE proxy_rotation_rules IS 'Configurable rules for automatic proxy rotation';
COMMENT ON VIEW active_proxy_pool IS 'Active proxies with aggregated health metrics';
COMMENT ON VIEW user_proxy_status IS 'Current proxy status and health for each user';
COMMENT ON FUNCTION update_proxy_health IS 'Updates proxy health metrics and auto-disables failed proxies';
COMMENT ON FUNCTION get_next_available_proxy IS 'Returns the best available proxy for a user';
COMMENT ON FUNCTION reset_daily_proxy_health IS 'Resets daily counters and re-activates cooled-down proxies'; 