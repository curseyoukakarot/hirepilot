-- Cron Processor & Concurrency Control System
-- Enables automated job processing with concurrency safety and execution tracking

-- Add concurrency control fields to puppet_jobs table
ALTER TABLE puppet_jobs 
  ADD COLUMN IF NOT EXISTS executing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS executing_by TEXT, -- Server/process identifier
  ADD COLUMN IF NOT EXISTS execution_timeout_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_execution_error TEXT,
  ADD COLUMN IF NOT EXISTS batch_id UUID, -- Groups jobs processed together
  ADD COLUMN IF NOT EXISTS concurrency_group TEXT DEFAULT 'default'; -- For grouping job types

-- Add indexes for cron processing performance
CREATE INDEX IF NOT EXISTS idx_puppet_jobs_cron_fetch ON puppet_jobs(status, scheduled_at, final_status, executing_at) 
  WHERE status = 'pending' AND final_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_puppet_jobs_executing ON puppet_jobs(executing_at, execution_timeout_at) 
  WHERE executing_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_puppet_jobs_user_concurrency ON puppet_jobs(user_id, status, executing_at) 
  WHERE status IN ('pending', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_puppet_jobs_batch ON puppet_jobs(batch_id) 
  WHERE batch_id IS NOT NULL;

-- Create job execution logs table for detailed tracking
CREATE TABLE IF NOT EXISTS puppet_job_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Job reference
  job_id UUID NOT NULL REFERENCES puppet_jobs(id) ON DELETE CASCADE,
  batch_id UUID, -- Links to batch processing
  
  -- Execution details
  executor_id TEXT NOT NULL, -- Server/process that executed
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_ms INTEGER, -- Calculated duration in milliseconds
  
  -- Outcome tracking
  outcome TEXT NOT NULL CHECK (outcome IN ('started', 'completed', 'failed', 'timeout', 'cancelled')),
  error_message TEXT,
  error_type TEXT, -- timeout, network, authentication, etc.
  
  -- Resource usage (optional)
  memory_usage_mb INTEGER,
  cpu_time_ms INTEGER,
  
  -- Context
  execution_context JSONB DEFAULT '{}', -- Additional metadata
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for execution logs table after table creation
CREATE INDEX IF NOT EXISTS idx_execution_logs_job_id ON puppet_job_execution_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_batch ON puppet_job_execution_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_outcome ON puppet_job_execution_logs(outcome);
CREATE INDEX IF NOT EXISTS idx_execution_logs_start_time ON puppet_job_execution_logs(start_time);
CREATE INDEX IF NOT EXISTS idx_execution_logs_duration ON puppet_job_execution_logs(duration_ms) WHERE duration_ms IS NOT NULL;

-- Create cron processor state table for coordination
CREATE TABLE IF NOT EXISTS puppet_cron_processor_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Processor identification
  processor_id TEXT UNIQUE NOT NULL, -- Unique ID for each cron instance
  hostname TEXT,
  process_id INTEGER,
  
  -- State tracking
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_batch_at TIMESTAMPTZ,
  last_batch_size INTEGER DEFAULT 0,
  
  -- Configuration
  max_concurrent_jobs INTEGER DEFAULT 10,
  batch_size INTEGER DEFAULT 20,
  timeout_seconds INTEGER DEFAULT 120,
  
  -- Performance metrics
  total_jobs_processed INTEGER DEFAULT 0,
  total_batches_processed INTEGER DEFAULT 0,
  success_rate_percent DECIMAL(5,2) DEFAULT 0.0,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_batch_size CHECK (batch_size > 0 AND batch_size <= 100),
  CONSTRAINT valid_timeout CHECK (timeout_seconds > 0 AND timeout_seconds <= 3600)
);

-- Create indexes for cron processor state table
CREATE INDEX IF NOT EXISTS idx_cron_state_active ON puppet_cron_processor_state(is_active, last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_cron_state_processor ON puppet_cron_processor_state(processor_id);

-- Create job concurrency locks table (alternative to Redis)
CREATE TABLE IF NOT EXISTS puppet_job_concurrency_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Lock identification
  lock_key TEXT UNIQUE NOT NULL, -- user_id, concurrency_group, etc.
  lock_type TEXT NOT NULL, -- 'user_limit', 'global_limit', 'resource_lock'
  
  -- Lock details
  locked_by TEXT NOT NULL, -- Processor/job ID holding the lock
  locked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Lock metadata
  current_count INTEGER DEFAULT 1,
  max_count INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_lock_count CHECK (current_count <= max_count)
);

-- Create indexes for concurrency locks table
CREATE INDEX IF NOT EXISTS idx_concurrency_locks_key ON puppet_job_concurrency_locks(lock_key);
CREATE INDEX IF NOT EXISTS idx_concurrency_locks_expires ON puppet_job_concurrency_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_concurrency_locks_type ON puppet_job_concurrency_locks(lock_type);

-- Add triggers for automatic cleanup of expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_concurrency_locks()
RETURNS TRIGGER AS $$
BEGIN
  -- Clean up expired locks
  DELETE FROM puppet_job_concurrency_locks 
  WHERE expires_at < NOW();
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to cleanup expired locks periodically
DROP TRIGGER IF EXISTS trigger_cleanup_expired_locks ON puppet_job_concurrency_locks;
CREATE TRIGGER trigger_cleanup_expired_locks
  AFTER INSERT OR UPDATE ON puppet_job_concurrency_locks
  EXECUTE FUNCTION cleanup_expired_concurrency_locks();

-- Add RLS policies for new tables
ALTER TABLE puppet_job_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_cron_processor_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_job_concurrency_locks ENABLE ROW LEVEL SECURITY;

-- Execution logs: Users can view logs for their jobs, admins can view all
CREATE POLICY "Users can view execution logs for their jobs" ON puppet_job_execution_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM puppet_jobs 
      WHERE puppet_jobs.id = puppet_job_execution_logs.job_id 
      AND puppet_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all execution logs" ON puppet_job_execution_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Cron state: Only admins can view/manage
CREATE POLICY "Only admins can manage cron processor state" ON puppet_cron_processor_state
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Concurrency locks: Only system can manage
CREATE POLICY "Only service role can manage concurrency locks" ON puppet_job_concurrency_locks
  FOR ALL USING (auth.role() = 'service_role');

-- Functions for cron processing

-- Function: Fetch jobs for batch processing
CREATE OR REPLACE FUNCTION fetch_jobs_for_batch(
  p_batch_size INTEGER DEFAULT 20,
  p_processor_id TEXT DEFAULT 'unknown',
  p_concurrency_group TEXT DEFAULT 'default'
) RETURNS TABLE (
  job_id UUID,
  user_id UUID,
  job_type TEXT,
  scheduled_at TIMESTAMPTZ,
  priority INTEGER
) AS $$
DECLARE
  v_batch_id UUID;
BEGIN
  -- Generate batch ID
  v_batch_id := gen_random_uuid();
  
  -- Select and lock jobs for processing
  RETURN QUERY
  WITH available_jobs AS (
    SELECT 
      pj.id,
      pj.user_id,
      pj.job_type,
      pj.scheduled_at,
      pj.priority,
      -- Count concurrent jobs per user
      COUNT(*) OVER (PARTITION BY pj.user_id) as user_concurrent_count
    FROM puppet_jobs pj
    WHERE pj.status = 'pending'
      AND pj.scheduled_at <= NOW()
      AND pj.final_status IS NULL
      AND pj.executing_at IS NULL
      AND (pj.concurrency_group = p_concurrency_group OR pj.concurrency_group IS NULL)
    ORDER BY pj.priority DESC, pj.scheduled_at ASC
    LIMIT p_batch_size * 2 -- Get more than needed for filtering
  ),
  filtered_jobs AS (
    SELECT aj.*
    FROM available_jobs aj
    WHERE aj.user_concurrent_count <= 2 -- Max 2 jobs per user
    LIMIT p_batch_size
  )
  UPDATE puppet_jobs 
  SET 
    executing_at = NOW(),
    executing_by = p_processor_id,
    execution_timeout_at = NOW() + INTERVAL '120 seconds',
    batch_id = v_batch_id,
    status = 'in_progress'
  FROM filtered_jobs fj
  WHERE puppet_jobs.id = fj.id
  RETURNING puppet_jobs.id, puppet_jobs.user_id, puppet_jobs.job_type, puppet_jobs.scheduled_at, puppet_jobs.priority;
END;
$$ LANGUAGE plpgsql;

-- Function: Complete job execution
CREATE OR REPLACE FUNCTION complete_job_execution(
  p_job_id UUID,
  p_outcome TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_final_status TEXT;
BEGIN
  -- Determine final status based on outcome
  v_final_status := CASE 
    WHEN p_outcome = 'completed' THEN 'completed'
    WHEN p_outcome IN ('failed', 'timeout') THEN 'failed'
    ELSE 'failed'
  END;
  
  -- Update job status
  UPDATE puppet_jobs 
  SET 
    final_status = v_final_status,
    executed_at = NOW(),
    executing_at = NULL,
    executing_by = NULL,
    execution_timeout_at = NULL,
    last_execution_error = p_error_message,
    execution_attempts = execution_attempts + 1,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- Update execution log
  UPDATE puppet_job_execution_logs
  SET 
    end_time = NOW(),
    duration_ms = p_duration_ms,
    outcome = p_outcome,
    error_message = p_error_message,
    updated_at = NOW()
  WHERE job_id = p_job_id 
    AND end_time IS NULL
    AND outcome = 'started';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function: Reset stuck jobs (for cleanup)
CREATE OR REPLACE FUNCTION reset_stuck_jobs(
  p_timeout_minutes INTEGER DEFAULT 5
) RETURNS INTEGER AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  -- Reset jobs that have been executing too long
  UPDATE puppet_jobs 
  SET 
    status = 'pending',
    executing_at = NULL,
    executing_by = NULL,
    execution_timeout_at = NULL,
    last_execution_error = 'Reset due to timeout',
    updated_at = NOW()
  WHERE status = 'in_progress'
    AND executing_at IS NOT NULL
    AND executing_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL;
    
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  
  RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql;

-- Views for monitoring

-- Active processor status view
CREATE OR REPLACE VIEW puppet_cron_processor_status AS
SELECT 
  processor_id,
  hostname,
  is_active,
  last_heartbeat,
  EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) as seconds_since_heartbeat,
  last_batch_at,
  last_batch_size,
  total_jobs_processed,
  total_batches_processed,
  success_rate_percent,
  max_concurrent_jobs,
  batch_size,
  timeout_seconds,
  CASE 
    WHEN last_heartbeat > NOW() - INTERVAL '2 minutes' THEN 'healthy'
    WHEN last_heartbeat > NOW() - INTERVAL '5 minutes' THEN 'stale'
    ELSE 'offline'
  END as health_status
FROM puppet_cron_processor_state
ORDER BY last_heartbeat DESC;

-- Current job execution status view
CREATE OR REPLACE VIEW puppet_jobs_execution_status AS
SELECT 
  pj.id,
  pj.user_id,
  pj.job_type,
  pj.status,
  pj.executing_at,
  pj.executing_by,
  pj.execution_timeout_at,
  pj.execution_attempts,
  EXTRACT(EPOCH FROM (NOW() - pj.executing_at)) as execution_duration_seconds,
  CASE 
    WHEN pj.executing_at IS NULL THEN 'idle'
    WHEN pj.execution_timeout_at < NOW() THEN 'timeout'
    WHEN pj.executing_at > NOW() - INTERVAL '2 minutes' THEN 'active'
    ELSE 'stale'
  END as execution_status,
  pj.last_execution_error
FROM puppet_jobs pj
WHERE pj.status IN ('pending', 'in_progress')
ORDER BY pj.executing_at DESC NULLS LAST;

-- Execution performance metrics view
CREATE OR REPLACE VIEW puppet_execution_metrics AS
SELECT 
  DATE_TRUNC('hour', pjel.start_time) as hour,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE pjel.outcome = 'completed') as successful_executions,
  COUNT(*) FILTER (WHERE pjel.outcome = 'failed') as failed_executions,
  COUNT(*) FILTER (WHERE pjel.outcome = 'timeout') as timeout_executions,
  ROUND(AVG(pjel.duration_ms)::numeric, 2) as avg_duration_ms,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pjel.duration_ms)::numeric, 2) as median_duration_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pjel.duration_ms)::numeric, 2) as p95_duration_ms
FROM puppet_job_execution_logs pjel
WHERE pjel.start_time > NOW() - INTERVAL '24 hours'
  AND pjel.duration_ms IS NOT NULL
GROUP BY DATE_TRUNC('hour', pjel.start_time)
ORDER BY hour DESC;

-- Additional SQL functions for analytics and metrics

-- Function: Get execution metrics
CREATE OR REPLACE FUNCTION get_execution_metrics(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_job_type TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
) RETURNS TABLE (
  total_executions BIGINT,
  successful_executions BIGINT,
  failed_executions BIGINT,
  timeout_executions BIGINT,
  avg_duration_ms NUMERIC,
  median_duration_ms NUMERIC,
  p95_duration_ms NUMERIC,
  success_rate_percent NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH execution_stats AS (
    SELECT 
      pjel.outcome,
      pjel.duration_ms
    FROM puppet_job_execution_logs pjel
    INNER JOIN puppet_jobs pj ON pjel.job_id = pj.id
    WHERE pjel.start_time >= p_start_date
      AND pjel.start_time <= p_end_date
      AND pjel.end_time IS NOT NULL
      AND (p_job_type IS NULL OR pj.job_type = p_job_type)
      AND (p_user_id IS NULL OR pj.user_id = p_user_id)
  )
  SELECT 
    COUNT(*) as total_executions,
    COUNT(*) FILTER (WHERE outcome = 'completed') as successful_executions,
    COUNT(*) FILTER (WHERE outcome = 'failed') as failed_executions,
    COUNT(*) FILTER (WHERE outcome = 'timeout') as timeout_executions,
    ROUND(AVG(duration_ms)::numeric, 2) as avg_duration_ms,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)::numeric, 2) as median_duration_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::numeric, 2) as p95_duration_ms,
    ROUND((COUNT(*) FILTER (WHERE outcome = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100), 2) as success_rate_percent
  FROM execution_stats;
END;
$$ LANGUAGE plpgsql;

-- Function: Get batch metrics
CREATE OR REPLACE FUNCTION get_batch_metrics(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
) RETURNS TABLE (
  total_batches BIGINT,
  avg_batch_size NUMERIC,
  avg_batch_duration_ms NUMERIC,
  batch_success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH batch_stats AS (
    SELECT 
      pjel.batch_id,
      COUNT(*) as batch_size,
      AVG(pjel.duration_ms) as avg_duration,
      COUNT(*) FILTER (WHERE pjel.outcome = 'completed') as successful_jobs
    FROM puppet_job_execution_logs pjel
    WHERE pjel.start_time >= p_start_date
      AND pjel.start_time <= p_end_date
      AND pjel.batch_id IS NOT NULL
      AND pjel.end_time IS NOT NULL
      AND pjel.job_id IS NOT NULL -- Exclude batch-level logs
    GROUP BY pjel.batch_id
  )
  SELECT 
    COUNT(*) as total_batches,
    ROUND(AVG(batch_size)::numeric, 2) as avg_batch_size,
    ROUND(AVG(avg_duration)::numeric, 2) as avg_batch_duration_ms,
    ROUND((SUM(successful_jobs)::numeric / NULLIF(SUM(batch_size), 0) * 100), 2) as batch_success_rate
  FROM batch_stats;
END;
$$ LANGUAGE plpgsql;

-- Function: Get processor performance
CREATE OR REPLACE FUNCTION get_processor_performance(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
) RETURNS TABLE (
  executor_id TEXT,
  batch_count BIGINT,
  job_count BIGINT,
  success_rate NUMERIC,
  avg_duration NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pjel.executor_id,
    COUNT(DISTINCT pjel.batch_id) as batch_count,
    COUNT(*) FILTER (WHERE pjel.job_id IS NOT NULL) as job_count,
    ROUND((COUNT(*) FILTER (WHERE pjel.outcome = 'completed' AND pjel.job_id IS NOT NULL)::numeric / 
           NULLIF(COUNT(*) FILTER (WHERE pjel.job_id IS NOT NULL), 0) * 100), 2) as success_rate,
    ROUND(AVG(pjel.duration_ms) FILTER (WHERE pjel.job_id IS NOT NULL)::numeric, 2) as avg_duration
  FROM puppet_job_execution_logs pjel
  WHERE pjel.start_time >= p_start_date
    AND pjel.start_time <= p_end_date
    AND pjel.end_time IS NOT NULL
  GROUP BY pjel.executor_id
  ORDER BY job_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: Get daily execution trends
CREATE OR REPLACE FUNCTION get_daily_execution_trends(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_job_type TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
) RETURNS TABLE (
  date TEXT,
  executions BIGINT,
  success_rate NUMERIC,
  average_duration NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('day', pjel.start_time)::date::text as date,
    COUNT(*) as executions,
    ROUND((COUNT(*) FILTER (WHERE pjel.outcome = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100), 2) as success_rate,
    ROUND(AVG(pjel.duration_ms)::numeric, 2) as average_duration
  FROM puppet_job_execution_logs pjel
  INNER JOIN puppet_jobs pj ON pjel.job_id = pj.id
  WHERE pjel.start_time >= p_start_date
    AND pjel.start_time <= p_end_date
    AND pjel.end_time IS NOT NULL
    AND pjel.job_id IS NOT NULL
    AND (p_job_type IS NULL OR pj.job_type = p_job_type)
    AND (p_user_id IS NULL OR pj.user_id = p_user_id)
  GROUP BY DATE_TRUNC('day', pjel.start_time)
  ORDER BY DATE_TRUNC('day', pjel.start_time) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: Get error trends
CREATE OR REPLACE FUNCTION get_error_trends(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_job_type TEXT DEFAULT NULL
) RETURNS TABLE (
  date TEXT,
  error_type TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('day', pjel.start_time)::date::text as date,
    pjel.error_type,
    COUNT(*) as count
  FROM puppet_job_execution_logs pjel
  INNER JOIN puppet_jobs pj ON pjel.job_id = pj.id
  WHERE pjel.start_time >= p_start_date
    AND pjel.start_time <= p_end_date
    AND pjel.outcome = 'failed'
    AND pjel.error_type IS NOT NULL
    AND (p_job_type IS NULL OR pj.job_type = p_job_type)
  GROUP BY DATE_TRUNC('day', pjel.start_time), pjel.error_type
  ORDER BY DATE_TRUNC('day', pjel.start_time) DESC, count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: Get peak hours analysis
CREATE OR REPLACE FUNCTION get_peak_hours_analysis(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
) RETURNS TABLE (
  hour INTEGER,
  avg_duration NUMERIC,
  job_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(HOUR FROM pjel.start_time)::integer as hour,
    ROUND(AVG(pjel.duration_ms)::numeric, 2) as avg_duration,
    COUNT(*) as job_count
  FROM puppet_job_execution_logs pjel
  WHERE pjel.start_time >= p_start_date
    AND pjel.start_time <= p_end_date
    AND pjel.end_time IS NOT NULL
    AND pjel.job_id IS NOT NULL
  GROUP BY EXTRACT(HOUR FROM pjel.start_time)
  ORDER BY hour;
END;
$$ LANGUAGE plpgsql;

-- Function: Get user performance
CREATE OR REPLACE FUNCTION get_user_performance(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
) RETURNS TABLE (
  user_id UUID,
  avg_duration NUMERIC,
  success_rate NUMERIC,
  job_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pj.user_id,
    ROUND(AVG(pjel.duration_ms)::numeric, 2) as avg_duration,
    ROUND((COUNT(*) FILTER (WHERE pjel.outcome = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100), 2) as success_rate,
    COUNT(*) as job_count
  FROM puppet_job_execution_logs pjel
  INNER JOIN puppet_jobs pj ON pjel.job_id = pj.id
  WHERE pjel.start_time >= p_start_date
    AND pjel.start_time <= p_end_date
    AND pjel.end_time IS NOT NULL
  GROUP BY pj.user_id
  HAVING COUNT(*) >= 5 -- Only users with at least 5 jobs
  ORDER BY job_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE puppet_job_execution_logs IS 'Detailed execution logs for puppet jobs with performance metrics';
COMMENT ON TABLE puppet_cron_processor_state IS 'State and configuration for cron processor instances';
COMMENT ON TABLE puppet_job_concurrency_locks IS 'Concurrency control locks for job processing';

COMMENT ON FUNCTION fetch_jobs_for_batch IS 'Safely fetch and lock jobs for batch processing with concurrency limits';
COMMENT ON FUNCTION complete_job_execution IS 'Mark job execution as complete and update all related tracking';
COMMENT ON FUNCTION reset_stuck_jobs IS 'Reset jobs that have been stuck in executing state for too long';
COMMENT ON FUNCTION get_execution_metrics IS 'Get comprehensive execution metrics for analysis';
COMMENT ON FUNCTION get_batch_metrics IS 'Get batch-level performance metrics';
COMMENT ON FUNCTION get_processor_performance IS 'Get performance metrics by processor/executor';
COMMENT ON FUNCTION get_daily_execution_trends IS 'Get daily execution trends for monitoring';
COMMENT ON FUNCTION get_error_trends IS 'Get error trends over time for analysis';
COMMENT ON FUNCTION get_peak_hours_analysis IS 'Analyze peak usage hours for load balancing';
COMMENT ON FUNCTION get_user_performance IS 'Get user-level performance metrics'; 