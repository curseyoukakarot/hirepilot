-- Retry & Backoff System Migration
-- Implements automatic retry logic with exponential backoff for failed puppet jobs

-- =====================================================
-- 1. ADD RETRY COLUMNS TO PUPPET_JOBS TABLE
-- =====================================================

DO $$ 
BEGIN
  -- Add retry tracking columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'retry_count') THEN
    ALTER TABLE puppet_jobs ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'last_attempt_at') THEN
    ALTER TABLE puppet_jobs ADD COLUMN last_attempt_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'next_retry_at') THEN
    ALTER TABLE puppet_jobs ADD COLUMN next_retry_at TIMESTAMPTZ;
  END IF;
  
  -- Update final_status to include permanently_failed if not already there
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'max_retries') THEN
    ALTER TABLE puppet_jobs ADD COLUMN max_retries INTEGER DEFAULT 5;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'retry_enabled') THEN
    ALTER TABLE puppet_jobs ADD COLUMN retry_enabled BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Add indexes for retry processing
CREATE INDEX IF NOT EXISTS idx_puppet_jobs_retry_ready ON puppet_jobs(final_status, next_retry_at, retry_count) 
  WHERE final_status = 'failed' AND retry_enabled = true;

CREATE INDEX IF NOT EXISTS idx_puppet_jobs_retry_count ON puppet_jobs(retry_count, final_status);
CREATE INDEX IF NOT EXISTS idx_puppet_jobs_last_attempt ON puppet_jobs(last_attempt_at) WHERE last_attempt_at IS NOT NULL;

-- =====================================================
-- 2. CREATE RETRY HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS puppet_job_retry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Job reference
  job_id UUID NOT NULL REFERENCES puppet_jobs(id) ON DELETE CASCADE,
  
  -- Retry attempt details
  attempt_number INTEGER NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Error and outcome
  error_message TEXT,
  error_type TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  
  -- Retry configuration used
  delay_seconds INTEGER NOT NULL,
  backoff_multiplier DECIMAL(3,2) DEFAULT 2.0,
  jitter_seconds INTEGER DEFAULT 0,
  
  -- Context and metadata
  retry_reason TEXT, -- 'automatic', 'manual', 'escalated'
  executor_id TEXT, -- Which processor handled the retry
  execution_context JSONB DEFAULT '{}',
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_attempt_number CHECK (attempt_number > 0),
  CONSTRAINT valid_delay CHECK (delay_seconds >= 0),
  CONSTRAINT valid_backoff_multiplier CHECK (backoff_multiplier > 0)
);

-- Indexes for retry history
CREATE INDEX idx_retry_history_job_id ON puppet_job_retry_history(job_id);
CREATE INDEX idx_retry_history_attempted_at ON puppet_job_retry_history(attempted_at);
CREATE INDEX idx_retry_history_success ON puppet_job_retry_history(success);
CREATE INDEX idx_retry_history_attempt_number ON puppet_job_retry_history(attempt_number);

-- =====================================================
-- 3. CREATE RETRY CONFIGURATION TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS puppet_job_retry_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Configuration scope
  job_type TEXT UNIQUE NOT NULL, -- 'default', 'linkedin_outreach', 'email_campaign', etc.
  
  -- Retry settings
  max_retries INTEGER NOT NULL DEFAULT 5,
  base_delay_seconds INTEGER NOT NULL DEFAULT 7200, -- 2 hours
  backoff_multiplier DECIMAL(3,2) NOT NULL DEFAULT 2.0,
  max_delay_seconds INTEGER NOT NULL DEFAULT 86400, -- 24 hours max
  
  -- Jitter settings (to avoid thundering herd)
  jitter_enabled BOOLEAN DEFAULT true,
  max_jitter_seconds INTEGER DEFAULT 300, -- 5 minutes max jitter
  
  -- Failure escalation
  escalation_enabled BOOLEAN DEFAULT true,
  escalation_threshold INTEGER DEFAULT 3, -- Escalate after 3 failed retries
  
  -- Advanced settings
  retry_on_error_types TEXT[] DEFAULT ARRAY['timeout', 'network', 'rate_limit', 'temporary_error'],
  do_not_retry_on TEXT[] DEFAULT ARRAY['authentication', 'permission', 'validation_error'],
  
  -- Status and metadata
  enabled BOOLEAN DEFAULT true,
  description TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_max_retries CHECK (max_retries >= 0 AND max_retries <= 20),
  CONSTRAINT valid_base_delay CHECK (base_delay_seconds > 0),
  CONSTRAINT valid_max_delay CHECK (max_delay_seconds >= base_delay_seconds),
  CONSTRAINT valid_backoff_multiplier CHECK (backoff_multiplier > 1.0 AND backoff_multiplier <= 5.0),
  CONSTRAINT valid_escalation_threshold CHECK (escalation_threshold > 0 AND escalation_threshold <= max_retries)
);

-- Create default retry configurations
INSERT INTO puppet_job_retry_config (job_type, description) VALUES 
('default', 'Default retry configuration for all job types'),
('linkedin_outreach', 'Retry configuration for LinkedIn connection requests'),
('email_campaign', 'Retry configuration for email campaigns'),
('data_enrichment', 'Retry configuration for lead enrichment jobs')
ON CONFLICT (job_type) DO NOTHING;

-- Index for retry config
CREATE INDEX idx_retry_config_job_type ON puppet_job_retry_config(job_type);
CREATE INDEX idx_retry_config_enabled ON puppet_job_retry_config(enabled) WHERE enabled = true;

-- =====================================================
-- 4. CREATE RETRY PROCESSING FUNCTIONS
-- =====================================================

-- Function: Get retry configuration for a job type
CREATE OR REPLACE FUNCTION get_retry_config(p_job_type TEXT)
RETURNS puppet_job_retry_config AS $$
DECLARE
  v_config puppet_job_retry_config;
BEGIN
  -- Try to get specific config for job type
  SELECT * INTO v_config
  FROM puppet_job_retry_config
  WHERE job_type = p_job_type AND enabled = true;
  
  -- Fall back to default if not found
  IF NOT FOUND THEN
    SELECT * INTO v_config
    FROM puppet_job_retry_config
    WHERE job_type = 'default' AND enabled = true;
  END IF;
  
  RETURN v_config;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate next retry delay with exponential backoff
CREATE OR REPLACE FUNCTION calculate_retry_delay(
  p_retry_count INTEGER,
  p_base_delay_seconds INTEGER DEFAULT 7200,
  p_backoff_multiplier DECIMAL DEFAULT 2.0,
  p_max_delay_seconds INTEGER DEFAULT 86400,
  p_jitter_enabled BOOLEAN DEFAULT true,
  p_max_jitter_seconds INTEGER DEFAULT 300
) RETURNS INTEGER AS $$
DECLARE
  v_delay INTEGER;
  v_jitter INTEGER;
BEGIN
  -- Calculate exponential backoff delay
  v_delay := p_base_delay_seconds * POWER(p_backoff_multiplier, p_retry_count);
  
  -- Cap at maximum delay
  v_delay := LEAST(v_delay, p_max_delay_seconds);
  
  -- Add jitter if enabled
  IF p_jitter_enabled THEN
    v_jitter := FLOOR(RANDOM() * p_max_jitter_seconds);
    v_delay := v_delay + v_jitter;
  END IF;
  
  RETURN v_delay;
END;
$$ LANGUAGE plpgsql;

-- Function: Schedule job for retry
CREATE OR REPLACE FUNCTION schedule_job_retry(
  p_job_id UUID,
  p_error_message TEXT,
  p_error_type TEXT DEFAULT 'execution_error',
  p_executor_id TEXT DEFAULT 'unknown'
) RETURNS BOOLEAN AS $$
DECLARE
  v_job_record puppet_jobs%ROWTYPE;
  v_config puppet_job_retry_config%ROWTYPE;
  v_delay_seconds INTEGER;
  v_next_retry_at TIMESTAMPTZ;
  v_should_retry BOOLEAN := false;
BEGIN
  -- Get job details
  SELECT * INTO v_job_record FROM puppet_jobs WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RAISE WARNING 'Job not found: %', p_job_id;
    RETURN false;
  END IF;
  
  -- Get retry configuration
  v_config := get_retry_config(v_job_record.job_type);
  
  IF v_config IS NULL THEN
    RAISE WARNING 'No retry configuration found for job type: %', v_job_record.job_type;
    RETURN false;
  END IF;
  
  -- Check if retry is enabled and we haven't exceeded max attempts
  IF v_job_record.retry_enabled 
     AND v_job_record.retry_count < COALESCE(v_job_record.max_retries, v_config.max_retries)
     AND v_config.enabled THEN
    
    -- Check if error type is retryable
    IF p_error_type = ANY(v_config.retry_on_error_types) 
       AND NOT (p_error_type = ANY(v_config.do_not_retry_on)) THEN
      v_should_retry := true;
    END IF;
  END IF;
  
  -- Log the retry attempt
  INSERT INTO puppet_job_retry_history (
    job_id,
    attempt_number,
    attempted_at,
    error_message,
    error_type,
    success,
    delay_seconds,
    backoff_multiplier,
    retry_reason,
    executor_id
  ) VALUES (
    p_job_id,
    v_job_record.retry_count + 1,
    NOW(),
    p_error_message,
    p_error_type,
    false,
    COALESCE(calculate_retry_delay(
      v_job_record.retry_count,
      v_config.base_delay_seconds,
      v_config.backoff_multiplier,
      v_config.max_delay_seconds,
      v_config.jitter_enabled,
      v_config.max_jitter_seconds
    ), 0),
    v_config.backoff_multiplier,
    'automatic',
    p_executor_id
  );
  
  IF v_should_retry THEN
    -- Calculate delay and schedule retry
    v_delay_seconds := calculate_retry_delay(
      v_job_record.retry_count,
      v_config.base_delay_seconds,
      v_config.backoff_multiplier,
      v_config.max_delay_seconds,
      v_config.jitter_enabled,
      v_config.max_jitter_seconds
    );
    
    v_next_retry_at := NOW() + (v_delay_seconds || ' seconds')::INTERVAL;
    
    -- Update job for retry
    UPDATE puppet_jobs 
    SET 
      retry_count = retry_count + 1,
      last_attempt_at = NOW(),
      next_retry_at = v_next_retry_at,
      final_status = 'failed',
      status = 'queued', -- Reset to queued for retry
      executing_at = NULL,
      executing_by = NULL,
      execution_timeout_at = NULL,
      updated_at = NOW()
    WHERE id = p_job_id;
    
    RETURN true;
  ELSE
    -- Mark as permanently failed
    UPDATE puppet_jobs 
    SET 
      retry_count = retry_count + 1,
      last_attempt_at = NOW(),
      final_status = 'permanently_failed',
      status = 'permanently_failed',
      executing_at = NULL,
      executing_by = NULL,
      execution_timeout_at = NULL,
      updated_at = NOW()
    WHERE id = p_job_id;
    
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Get jobs ready for retry
CREATE OR REPLACE FUNCTION get_jobs_ready_for_retry(
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  job_id UUID,
  user_id UUID,
  job_type TEXT,
  retry_count INTEGER,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pj.id,
    pj.user_id,
    pj.job_type,
    pj.retry_count,
    pj.next_retry_at,
    pj.last_execution_error
  FROM puppet_jobs pj
  WHERE pj.final_status = 'failed'
    AND pj.retry_enabled = true
    AND pj.next_retry_at IS NOT NULL
    AND pj.next_retry_at <= NOW()
    AND pj.status = 'queued'
  ORDER BY pj.next_retry_at ASC, pj.priority DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. CREATE RETRY MONITORING VIEWS
-- =====================================================

-- View: Retry statistics by job type
CREATE OR REPLACE VIEW puppet_retry_stats_by_type AS
SELECT 
  pj.job_type,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE pj.retry_count > 0) as jobs_with_retries,
  COUNT(*) FILTER (WHERE pj.final_status = 'permanently_failed') as permanently_failed,
  AVG(pj.retry_count) as avg_retry_count,
  MAX(pj.retry_count) as max_retry_count,
  COUNT(*) FILTER (WHERE pj.final_status = 'completed' AND pj.retry_count > 0) as successful_after_retry
FROM puppet_jobs pj
WHERE pj.created_at > NOW() - INTERVAL '30 days'
GROUP BY pj.job_type
ORDER BY total_jobs DESC;

-- View: Recent retry activity
CREATE OR REPLACE VIEW puppet_recent_retry_activity AS
SELECT 
  prh.job_id,
  pj.job_type,
  prh.attempt_number,
  prh.attempted_at,
  prh.success,
  prh.error_type,
  prh.delay_seconds,
  prh.retry_reason,
  pj.final_status as current_status
FROM puppet_job_retry_history prh
JOIN puppet_jobs pj ON prh.job_id = pj.id
WHERE prh.attempted_at > NOW() - INTERVAL '24 hours'
ORDER BY prh.attempted_at DESC;

-- View: Jobs pending retry
CREATE OR REPLACE VIEW puppet_jobs_pending_retry AS
SELECT 
  pj.id,
  pj.job_type,
  pj.retry_count,
  pj.max_retries,
  pj.next_retry_at,
  EXTRACT(EPOCH FROM (pj.next_retry_at - NOW())) / 60 as minutes_until_retry,
  pj.last_execution_error,
  pj.created_at
FROM puppet_jobs pj
WHERE pj.final_status = 'failed'
  AND pj.retry_enabled = true
  AND pj.next_retry_at IS NOT NULL
  AND pj.next_retry_at > NOW()
ORDER BY pj.next_retry_at ASC;

-- =====================================================
-- 6. ENABLE RLS AND CREATE POLICIES
-- =====================================================

ALTER TABLE puppet_job_retry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_job_retry_config ENABLE ROW LEVEL SECURITY;

-- Retry history policies
CREATE POLICY "Users can view retry history for their jobs" ON puppet_job_retry_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM puppet_jobs 
      WHERE puppet_jobs.id = puppet_job_retry_history.job_id 
      AND puppet_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all retry history" ON puppet_job_retry_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Retry config policies
CREATE POLICY "Users can view retry config" ON puppet_job_retry_config
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify retry config" ON puppet_job_retry_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- =====================================================
-- 7. COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE puppet_job_retry_history IS 'Tracks all retry attempts for puppet jobs with detailed logging';
COMMENT ON TABLE puppet_job_retry_config IS 'Configurable retry settings per job type with exponential backoff';

COMMENT ON FUNCTION get_retry_config IS 'Get retry configuration for a specific job type with fallback to default';
COMMENT ON FUNCTION calculate_retry_delay IS 'Calculate exponential backoff delay with jitter for retry attempts';
COMMENT ON FUNCTION schedule_job_retry IS 'Schedule a failed job for retry or mark as permanently failed';
COMMENT ON FUNCTION get_jobs_ready_for_retry IS 'Get jobs that are ready to be retried based on next_retry_at';

COMMENT ON VIEW puppet_retry_stats_by_type IS 'Retry statistics aggregated by job type for monitoring';
COMMENT ON VIEW puppet_recent_retry_activity IS 'Recent retry activity for debugging and monitoring';
COMMENT ON VIEW puppet_jobs_pending_retry IS 'Jobs currently waiting for their next retry attempt';

-- =====================================================
-- RETRY SYSTEM MIGRATION COMPLETE ✅
-- ===================================================== 