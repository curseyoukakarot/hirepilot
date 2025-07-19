-- Quick fix for function return type conflict
-- Run this in Supabase Dashboard → SQL Editor

-- Drop existing functions that might conflict
DROP FUNCTION IF EXISTS get_jobs_ready_for_retry(integer);
DROP FUNCTION IF EXISTS get_jobs_ready_for_retry();
DROP FUNCTION IF EXISTS schedule_job_retry(uuid, text, text, text);
DROP FUNCTION IF EXISTS calculate_retry_delay(integer, integer, decimal, integer, boolean, integer);
DROP FUNCTION IF EXISTS get_retry_config(text);

-- Now recreate them with correct signatures
-- Simple function to calculate retry delay
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

-- Simple function to get retry config
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

-- Simple function to schedule retry
CREATE OR REPLACE FUNCTION schedule_job_retry(
  p_job_id UUID,
  p_error_message TEXT,
  p_error_type TEXT DEFAULT 'execution_error',
  p_executor_id TEXT DEFAULT 'unknown'
) RETURNS BOOLEAN AS $$
DECLARE
  v_job_record RECORD;
  v_config puppet_job_retry_config;
  v_delay_seconds INTEGER;
  v_next_retry_at TIMESTAMPTZ;
  v_should_retry BOOLEAN := false;
BEGIN
  -- Get job details
  SELECT * INTO v_job_record FROM puppet_jobs WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Get retry configuration
  v_config := get_retry_config(COALESCE(v_job_record.job_type, 'default'));
  
  IF v_config IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if retry is enabled and we haven't exceeded max attempts
  IF COALESCE(v_job_record.retry_enabled, true) 
     AND COALESCE(v_job_record.retry_count, 0) < COALESCE(v_job_record.max_retries, v_config.max_retries)
     AND v_config.enabled THEN
    
    -- Check if error type is retryable
    IF p_error_type = ANY(v_config.retry_on_error_types) 
       AND NOT (p_error_type = ANY(v_config.do_not_retry_on)) THEN
      v_should_retry := true;
    END IF;
  END IF;
  
  -- Calculate delay
  v_delay_seconds := calculate_retry_delay(
    COALESCE(v_job_record.retry_count, 0),
    v_config.base_delay_seconds,
    v_config.backoff_multiplier,
    v_config.max_delay_seconds,
    v_config.jitter_enabled,
    v_config.max_jitter_seconds
  );
  
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
    COALESCE(v_job_record.retry_count, 0) + 1,
    NOW(),
    p_error_message,
    p_error_type,
    false,
    v_delay_seconds,
    v_config.backoff_multiplier,
    'automatic',
    p_executor_id
  );
  
  IF v_should_retry THEN
    -- Calculate next retry time and schedule retry
    v_next_retry_at := NOW() + (v_delay_seconds || ' seconds')::INTERVAL;
    
    -- Update job for retry
    UPDATE puppet_jobs 
    SET 
      retry_count = COALESCE(retry_count, 0) + 1,
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
      retry_count = COALESCE(retry_count, 0) + 1,
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

-- Simple function to get jobs ready for retry
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
    COALESCE(pj.job_type, 'unknown') as job_type,
    COALESCE(pj.retry_count, 0) as retry_count,
    pj.next_retry_at,
    pj.last_execution_error
  FROM puppet_jobs pj
  WHERE pj.final_status = 'failed'
    AND COALESCE(pj.retry_enabled, true) = true
    AND pj.next_retry_at IS NOT NULL
    AND pj.next_retry_at <= NOW()
    AND pj.status = 'queued'
  ORDER BY pj.next_retry_at ASC, COALESCE(pj.priority, 0) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function fix complete ✅ 