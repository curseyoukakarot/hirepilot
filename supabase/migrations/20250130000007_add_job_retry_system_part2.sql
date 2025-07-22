-- Job Retry System - Part 2: Tables, Functions, and Indexes
-- This runs after the enum values have been committed

-- Add retry-related columns to puppet_jobs table
ALTER TABLE puppet_jobs 
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0 CHECK (attempts >= 0),
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3 CHECK (max_attempts > 0),
ADD COLUMN IF NOT EXISTS run_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS failure_reason TEXT,
ADD COLUMN IF NOT EXISTS retry_strategy TEXT DEFAULT 'exponential' CHECK (retry_strategy IN ('exponential', 'linear', 'fixed')),
ADD COLUMN IF NOT EXISTS base_delay_minutes INTEGER DEFAULT 120 CHECK (base_delay_minutes > 0),
ADD COLUMN IF NOT EXISTS max_delay_hours INTEGER DEFAULT 24 CHECK (max_delay_hours > 0);

-- Job Retry History Table
-- Tracks all retry attempts and their outcomes
CREATE TABLE IF NOT EXISTS puppet_job_retry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Job Reference
  job_id UUID REFERENCES puppet_jobs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Attempt Details
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'timeout', 'cancelled')),
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Outcome
  was_successful BOOLEAN,
  failure_reason TEXT,
  error_details JSONB,
  
  -- Context
  proxy_used TEXT,
  user_agent TEXT,
  ip_address INET,
  
  -- Retry Logic
  retry_trigger TEXT, -- 'manual', 'cron', 'immediate'
  backoff_delay_minutes INTEGER,
  next_retry_scheduled_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint for attempt tracking
  UNIQUE(job_id, attempt_number)
);

-- Job Retry Configuration Table
-- Configurable retry policies for different job types and scenarios
CREATE TABLE IF NOT EXISTS puppet_job_retry_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Rule Configuration
  config_name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 5,
  
  -- Applicability Rules
  applies_to_job_types TEXT[], -- 'linkedin_connection', 'profile_scraping', etc.
  applies_to_error_types TEXT[], -- 'network_error', 'captcha', 'rate_limit', etc.
  applies_to_user_types TEXT[], -- 'free', 'premium', 'enterprise'
  
  -- Retry Policy
  max_attempts INTEGER DEFAULT 3 CHECK (max_attempts > 0),
  retry_strategy TEXT DEFAULT 'exponential' CHECK (retry_strategy IN ('exponential', 'linear', 'fixed')),
  base_delay_minutes INTEGER DEFAULT 120 CHECK (base_delay_minutes > 0),
  max_delay_hours INTEGER DEFAULT 24 CHECK (max_delay_hours > 0),
  jitter_enabled BOOLEAN DEFAULT TRUE,
  
  -- Failure Conditions
  retry_on_security_detection BOOLEAN DEFAULT FALSE,
  retry_on_captcha BOOLEAN DEFAULT TRUE,
  retry_on_network_error BOOLEAN DEFAULT TRUE,
  retry_on_rate_limit BOOLEAN DEFAULT TRUE,
  retry_on_proxy_error BOOLEAN DEFAULT TRUE,
  retry_on_unknown_error BOOLEAN DEFAULT TRUE,
  
  -- Escalation
  escalate_after_attempts INTEGER DEFAULT 2,
  escalate_to_admin BOOLEAN DEFAULT FALSE,
  send_user_notification BOOLEAN DEFAULT TRUE,
  
  -- Advanced Options
  increase_delay_on_repeated_failure BOOLEAN DEFAULT TRUE,
  reset_attempts_on_success BOOLEAN DEFAULT TRUE,
  preserve_job_context BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Failed Job Analysis Table
-- Tracks patterns in job failures for system optimization
CREATE TABLE IF NOT EXISTS puppet_job_failure_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Time Period
  analysis_date DATE DEFAULT CURRENT_DATE,
  analysis_period TEXT DEFAULT 'daily' CHECK (analysis_period IN ('hourly', 'daily', 'weekly', 'monthly')),
  
  -- Failure Metrics
  total_jobs INTEGER DEFAULT 0,
  failed_jobs INTEGER DEFAULT 0,
  permanently_failed_jobs INTEGER DEFAULT 0,
  retry_success_jobs INTEGER DEFAULT 0,
  failure_rate_percent DECIMAL(5,2),
  
  -- Error Analysis
  top_failure_reasons JSONB, -- {"captcha": 45, "network_error": 23, ...}
  top_failed_proxies JSONB,
  top_failed_user_agents JSONB,
  
  -- Timing Analysis
  avg_failure_time_ms INTEGER,
  peak_failure_hours INTEGER[], -- [14, 15, 16] for 2-4 PM
  
  -- Impact Analysis
  total_credits_wasted INTEGER DEFAULT 0,
  users_affected INTEGER DEFAULT 0,
  campaigns_affected INTEGER DEFAULT 0,
  
  -- Recommendations
  recommended_actions JSONB,
  system_health_score INTEGER CHECK (system_health_score BETWEEN 0 AND 100),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance (now safe to use new enum values)
CREATE INDEX IF NOT EXISTS idx_puppet_jobs_retry_status ON puppet_jobs(status) WHERE status IN ('retry_pending', 'permanently_failed');
CREATE INDEX IF NOT EXISTS idx_puppet_jobs_run_at ON puppet_jobs(run_at) WHERE status = 'retry_pending';
CREATE INDEX IF NOT EXISTS idx_puppet_jobs_attempts ON puppet_jobs(attempts, status);
CREATE INDEX IF NOT EXISTS idx_puppet_jobs_next_retry ON puppet_jobs(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_retry_history_job ON puppet_job_retry_history(job_id);
CREATE INDEX IF NOT EXISTS idx_retry_history_attempt ON puppet_job_retry_history(attempt_number, started_at);
CREATE INDEX IF NOT EXISTS idx_retry_history_status ON puppet_job_retry_history(status, was_successful);
CREATE INDEX IF NOT EXISTS idx_failure_analysis_date ON puppet_job_failure_analysis(analysis_date);

-- View: Jobs Ready for Retry
-- Shows jobs that are ready to be retried
CREATE VIEW jobs_ready_for_retry AS
SELECT 
  j.*,
  COALESCE(retry_stats.last_attempt_at, j.created_at) as last_attempt_at,
  (
    SELECT failure_reason 
    FROM puppet_job_retry_history 
    WHERE job_id = j.id 
    ORDER BY started_at DESC 
    LIMIT 1
  ) as last_failure_reason,
  COALESCE(retry_stats.total_retry_attempts, 0) as total_retry_attempts,
  
  -- Calculate next retry timing
  CASE 
    WHEN j.retry_strategy = 'exponential' THEN 
      j.base_delay_minutes * POWER(2, j.attempts)
    WHEN j.retry_strategy = 'linear' THEN 
      j.base_delay_minutes * (j.attempts + 1)
    ELSE 
      j.base_delay_minutes
  END as calculated_delay_minutes,
  
  -- Time since last failure
  EXTRACT(minutes FROM (NOW() - j.next_retry_at)) as minutes_since_scheduled,
  
  -- Retry eligibility
  CASE 
    WHEN j.attempts >= j.max_attempts THEN FALSE
    WHEN j.next_retry_at > NOW() THEN FALSE
    ELSE TRUE
  END as is_eligible_for_retry

FROM puppet_jobs j
LEFT JOIN (
  SELECT 
    job_id,
    MAX(started_at) as last_attempt_at,
    COUNT(*) as total_retry_attempts
  FROM puppet_job_retry_history 
  GROUP BY job_id
) retry_stats ON retry_stats.job_id = j.id
WHERE j.status = 'retry_pending'
ORDER BY j.next_retry_at ASC;

-- View: Job Failure Dashboard
-- Administrative dashboard for monitoring job health
CREATE VIEW job_failure_dashboard AS
SELECT 
  -- Time periods
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as failures_last_hour,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as failures_last_24h,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as failures_last_week,
  
  -- Status distribution
  COUNT(*) FILTER (WHERE status = 'failed') as currently_failed,
  COUNT(*) FILTER (WHERE status = 'retry_pending') as pending_retry,
  COUNT(*) FILTER (WHERE status = 'permanently_failed') as permanently_failed,
  
  -- Retry success rate
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'completed' AND attempts > 0)::DECIMAL / 
     NULLIF(COUNT(*) FILTER (WHERE attempts > 0), 0)) * 100, 2
  ) as retry_success_rate_percent,
  
  -- Average attempts before success/failure
  ROUND(AVG(attempts) FILTER (WHERE status = 'completed' AND attempts > 0), 2) as avg_attempts_to_success,
  ROUND(AVG(attempts) FILTER (WHERE status = 'permanently_failed'), 2) as avg_attempts_to_permanent_failure,
  
  -- Top failure reasons
  mode() WITHIN GROUP (ORDER BY failure_reason) as most_common_failure_reason,
  
  -- Timing insights
  ROUND(AVG(EXTRACT(minutes FROM (next_retry_at - updated_at))) FILTER (WHERE next_retry_at IS NOT NULL), 2) as avg_retry_delay_minutes,
  
  -- System health
  CASE 
    WHEN COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') < 5 THEN 'Healthy'
    WHEN COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') < 20 THEN 'Warning'
    ELSE 'Critical'
  END as system_health_status,
  
  -- Last updated
  NOW() as dashboard_updated_at

FROM puppet_jobs
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Function: Calculate Next Retry Time
-- Calculates when a job should be retried based on strategy and attempt count
CREATE OR REPLACE FUNCTION calculate_next_retry_time(
  p_attempts INTEGER,
  p_strategy TEXT DEFAULT 'exponential',
  p_base_delay_minutes INTEGER DEFAULT 120,
  p_max_delay_hours INTEGER DEFAULT 24,
  p_enable_jitter BOOLEAN DEFAULT TRUE
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  delay_minutes INTEGER;
  jitter_minutes INTEGER := 0;
  max_delay_minutes INTEGER := p_max_delay_hours * 60;
BEGIN
  -- Calculate base delay based on strategy
  CASE p_strategy
    WHEN 'exponential' THEN
      delay_minutes := p_base_delay_minutes * POWER(2, p_attempts);
    WHEN 'linear' THEN
      delay_minutes := p_base_delay_minutes * (p_attempts + 1);
    WHEN 'fixed' THEN
      delay_minutes := p_base_delay_minutes;
    ELSE
      delay_minutes := p_base_delay_minutes;
  END CASE;
  
  -- Apply maximum delay cap
  delay_minutes := LEAST(delay_minutes, max_delay_minutes);
  
  -- Add jitter to prevent thundering herd
  IF p_enable_jitter THEN
    jitter_minutes := FLOOR(RANDOM() * (delay_minutes * 0.1)); -- 10% jitter
    delay_minutes := delay_minutes + jitter_minutes;
  END IF;
  
  -- Return next retry time
  RETURN NOW() + (delay_minutes || ' minutes')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function: Mark Job for Retry
-- Handles the logic for marking a job for retry or permanent failure
CREATE OR REPLACE FUNCTION mark_job_for_retry(
  p_job_id UUID,
  p_failure_reason TEXT,
  p_error_details JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  job_record RECORD;
  retry_config RECORD;
  next_retry_time TIMESTAMPTZ;
  result JSONB;
BEGIN
  -- Get job details
  SELECT * INTO job_record 
  FROM puppet_jobs 
  WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;
  
  -- Get applicable retry configuration
  SELECT * INTO retry_config
  FROM puppet_job_retry_config
  WHERE is_active = TRUE
    AND (applies_to_job_types IS NULL OR 'linkedin_connection' = ANY(applies_to_job_types))
  ORDER BY priority DESC
  LIMIT 1;
  
  -- Use default config if none found
  IF NOT FOUND THEN
    retry_config.max_attempts := 3;
    retry_config.retry_strategy := 'exponential';
    retry_config.base_delay_minutes := 120;
    retry_config.max_delay_hours := 24;
  END IF;
  
  -- Increment attempts
  UPDATE puppet_jobs 
  SET attempts = attempts + 1,
      failure_reason = p_failure_reason,
      updated_at = NOW()
  WHERE id = p_job_id
  RETURNING * INTO job_record;
  
  -- Record retry attempt in history
  INSERT INTO puppet_job_retry_history (
    job_id, user_id, attempt_number, status, 
    started_at, completed_at, was_successful,
    failure_reason, error_details, retry_trigger
  ) VALUES (
    p_job_id, job_record.user_id, job_record.attempts, 'failed',
    job_record.updated_at, NOW(), FALSE,
    p_failure_reason, p_error_details, 'automatic'
  );
  
  -- Decide on retry vs permanent failure
  IF job_record.attempts >= retry_config.max_attempts THEN
    -- Mark as permanently failed
    UPDATE puppet_jobs 
    SET status = 'permanently_failed',
        updated_at = NOW()
    WHERE id = p_job_id;
    
    result := jsonb_build_object(
      'success', true,
      'action', 'permanently_failed',
      'attempts', job_record.attempts,
      'max_attempts', retry_config.max_attempts,
      'failure_reason', p_failure_reason
    );
  ELSE
    -- Schedule for retry
    next_retry_time := calculate_next_retry_time(
      job_record.attempts,
      retry_config.retry_strategy,
      retry_config.base_delay_minutes,
      retry_config.max_delay_hours,
      TRUE
    );
    
    UPDATE puppet_jobs 
    SET status = 'retry_pending',
        next_retry_at = next_retry_time,
        run_at = next_retry_time,
        updated_at = NOW()
    WHERE id = p_job_id;
    
    result := jsonb_build_object(
      'success', true,
      'action', 'scheduled_for_retry',
      'attempts', job_record.attempts,
      'max_attempts', retry_config.max_attempts,
      'next_retry_at', next_retry_time,
      'delay_minutes', EXTRACT(minutes FROM (next_retry_time - NOW())),
      'failure_reason', p_failure_reason
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function: Get Jobs Ready for Retry
-- Returns jobs that are ready to be processed by the retry cron
CREATE OR REPLACE FUNCTION get_jobs_ready_for_retry(p_limit INTEGER DEFAULT 10)
RETURNS TABLE(
  job_id UUID,
  user_id UUID,
  linkedin_profile_url TEXT,
  message TEXT,
  attempt_number INTEGER,
  failure_reason TEXT,
  scheduled_retry_time TIMESTAMPTZ,
  minutes_delayed INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id as job_id,
    j.user_id,
    j.linkedin_profile_url,
    j.message,
    j.attempts as attempt_number,
    j.failure_reason,
    j.next_retry_at as scheduled_retry_time,
    GREATEST(0, EXTRACT(minutes FROM (NOW() - j.next_retry_at))::INTEGER) as minutes_delayed
  FROM puppet_jobs j
  WHERE j.status = 'retry_pending'
    AND j.next_retry_at <= NOW()
    AND j.attempts < j.max_attempts
  ORDER BY j.next_retry_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies (inherit from puppet_jobs table policies)
ALTER TABLE puppet_job_retry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_job_retry_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_job_failure_analysis ENABLE ROW LEVEL SECURITY;

-- Users can view their own retry history
CREATE POLICY "Users can view own retry history" ON puppet_job_retry_history
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all retry data
CREATE POLICY "Service role can manage retry history" ON puppet_job_retry_history
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage retry config" ON puppet_job_retry_config
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage failure analysis" ON puppet_job_failure_analysis
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON puppet_job_retry_history TO service_role;
GRANT ALL ON puppet_job_retry_config TO service_role;
GRANT ALL ON puppet_job_failure_analysis TO service_role;
GRANT SELECT ON jobs_ready_for_retry TO service_role;
GRANT SELECT ON job_failure_dashboard TO service_role;

-- Insert default retry configuration
INSERT INTO puppet_job_retry_config (
  config_name,
  is_active,
  priority,
  applies_to_job_types,
  max_attempts,
  retry_strategy,
  base_delay_minutes,
  max_delay_hours,
  jitter_enabled,
  retry_on_captcha,
  retry_on_network_error,
  retry_on_rate_limit,
  retry_on_proxy_error,
  retry_on_unknown_error,
  escalate_after_attempts,
  send_user_notification
) VALUES (
  'Default LinkedIn Automation Retry Policy',
  TRUE,
  10,
  ARRAY['linkedin_connection', 'linkedin_message', 'profile_scraping'],
  3,      -- Max 3 attempts
  'exponential', -- Exponential backoff
  120,    -- 2 hours base delay
  24,     -- Max 24 hours delay
  TRUE,   -- Enable jitter
  TRUE,   -- Retry on CAPTCHA
  TRUE,   -- Retry on network errors
  TRUE,   -- Retry on rate limits
  TRUE,   -- Retry on proxy errors
  TRUE,   -- Retry on unknown errors
  2,      -- Escalate after 2 attempts
  TRUE    -- Send user notifications
) ON CONFLICT (config_name) DO NOTHING;

-- Comments
COMMENT ON TABLE puppet_job_retry_history IS 'Complete history of all job retry attempts and outcomes';
COMMENT ON TABLE puppet_job_retry_config IS 'Configurable retry policies for different job types and error scenarios';
COMMENT ON TABLE puppet_job_failure_analysis IS 'Aggregated failure analysis for system optimization and monitoring';
COMMENT ON VIEW jobs_ready_for_retry IS 'Jobs that are ready to be processed by the retry cron system';
COMMENT ON VIEW job_failure_dashboard IS 'Administrative dashboard for monitoring job health and retry metrics';
COMMENT ON FUNCTION calculate_next_retry_time IS 'Calculates optimal retry timing with exponential backoff and jitter';
COMMENT ON FUNCTION mark_job_for_retry IS 'Handles retry logic and permanent failure marking for jobs';
COMMENT ON FUNCTION get_jobs_ready_for_retry IS 'Returns jobs ready for retry processing by cron system'; 