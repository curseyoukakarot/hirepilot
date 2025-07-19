-- COMPLETE CRON PROCESSOR MIGRATION
-- Copy and paste this entire file into Supabase Dashboard → SQL Editor
-- This includes all tables, functions, views, and fixes

-- =====================================================
-- 0. UPDATE EXISTING ENUMS (Add missing values)
-- =====================================================

-- Add 'in_progress' to puppet_job_status enum if it doesn't exist
DO $$ 
BEGIN
  -- Check if the enum value exists, if not add it
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'in_progress' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'puppet_job_status')) THEN
    ALTER TYPE puppet_job_status ADD VALUE 'in_progress';
  END IF;
  
  -- Add other status values that might be missing
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'completed' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'puppet_job_status')) THEN
    ALTER TYPE puppet_job_status ADD VALUE 'completed';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'failed' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'puppet_job_status')) THEN
    ALTER TYPE puppet_job_status ADD VALUE 'failed';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- If puppet_job_status enum doesn't exist, that's fine - the status column might be TEXT
    RAISE NOTICE 'puppet_job_status enum does not exist, status column may be TEXT type';
END $$;

-- =====================================================
-- 1. DROP EXISTING TABLES (if any exist with errors)
-- =====================================================

DROP TABLE IF EXISTS puppet_job_concurrency_locks CASCADE;
DROP TABLE IF EXISTS puppet_cron_processor_state CASCADE;
DROP TABLE IF EXISTS puppet_job_execution_logs CASCADE;

-- Also drop any existing functions that might have conflicts
DROP FUNCTION IF EXISTS fetch_jobs_for_batch CASCADE;
DROP FUNCTION IF EXISTS complete_job_execution CASCADE;
DROP FUNCTION IF EXISTS reset_stuck_jobs CASCADE;
DROP FUNCTION IF EXISTS get_execution_metrics CASCADE;
DROP FUNCTION IF EXISTS get_batch_metrics CASCADE;
DROP FUNCTION IF EXISTS get_processor_performance CASCADE;
DROP FUNCTION IF EXISTS get_daily_execution_trends CASCADE;
DROP FUNCTION IF EXISTS get_error_trends CASCADE;
DROP FUNCTION IF EXISTS get_peak_hours_analysis CASCADE;
DROP FUNCTION IF EXISTS get_user_performance CASCADE;

-- Drop existing views
DROP VIEW IF EXISTS puppet_cron_processor_status CASCADE;
DROP VIEW IF EXISTS puppet_jobs_execution_status CASCADE;
DROP VIEW IF EXISTS puppet_execution_metrics CASCADE;

-- =====================================================
-- 2. ADD CONCURRENCY FIELDS TO PUPPET_JOBS TABLE
-- =====================================================

DO $$ 
BEGIN
  -- Add concurrency control fields if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'executing_at') THEN
    ALTER TABLE puppet_jobs ADD COLUMN executing_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'executing_by') THEN
    ALTER TABLE puppet_jobs ADD COLUMN executing_by TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'execution_timeout_at') THEN
    ALTER TABLE puppet_jobs ADD COLUMN execution_timeout_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'execution_attempts') THEN
    ALTER TABLE puppet_jobs ADD COLUMN execution_attempts INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'last_execution_error') THEN
    ALTER TABLE puppet_jobs ADD COLUMN last_execution_error TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'batch_id') THEN
    ALTER TABLE puppet_jobs ADD COLUMN batch_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'concurrency_group') THEN
    ALTER TABLE puppet_jobs ADD COLUMN concurrency_group TEXT DEFAULT 'default';
  END IF;
  
  -- Add final_status column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'final_status') THEN
    ALTER TABLE puppet_jobs ADD COLUMN final_status TEXT;
  END IF;
  
  -- Add executed_at column if it doesn't exist (used in complete_job_execution function)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'executed_at') THEN
    ALTER TABLE puppet_jobs ADD COLUMN executed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add indexes for cron processing performance
CREATE INDEX IF NOT EXISTS idx_puppet_jobs_cron_fetch ON puppet_jobs(status, scheduled_at, final_status, executing_at) 
  WHERE status = 'queued' AND final_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_puppet_jobs_executing ON puppet_jobs(executing_at, execution_timeout_at) 
  WHERE executing_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_puppet_jobs_user_concurrency ON puppet_jobs(user_id, status, executing_at) 
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS idx_puppet_jobs_batch ON puppet_jobs(batch_id) 
  WHERE batch_id IS NOT NULL;

-- =====================================================
-- 3. CREATE NEW TABLES WITH CORRECT SYNTAX
-- =====================================================

-- Job execution logs table
CREATE TABLE puppet_job_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Job reference
  job_id UUID REFERENCES puppet_jobs(id) ON DELETE CASCADE,
  batch_id UUID,
  
  -- Execution details
  executor_id TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Outcome tracking
  outcome TEXT NOT NULL CHECK (outcome IN ('started', 'completed', 'failed', 'timeout', 'cancelled')),
  error_message TEXT,
  error_type TEXT,
  
  -- Resource usage (optional)
  memory_usage_mb INTEGER,
  cpu_time_ms INTEGER,
  
  -- Context
  execution_context JSONB DEFAULT '{}',
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for execution logs
CREATE INDEX idx_execution_logs_job_id ON puppet_job_execution_logs(job_id);
CREATE INDEX idx_execution_logs_batch ON puppet_job_execution_logs(batch_id);
CREATE INDEX idx_execution_logs_outcome ON puppet_job_execution_logs(outcome);
CREATE INDEX idx_execution_logs_start_time ON puppet_job_execution_logs(start_time);
CREATE INDEX idx_execution_logs_duration ON puppet_job_execution_logs(duration_ms) WHERE duration_ms IS NOT NULL;

-- Cron processor state table
CREATE TABLE puppet_cron_processor_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Processor identification
  processor_id TEXT UNIQUE NOT NULL,
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

-- Indexes for cron processor state
CREATE INDEX idx_cron_state_active ON puppet_cron_processor_state(is_active, last_heartbeat);
CREATE INDEX idx_cron_state_processor ON puppet_cron_processor_state(processor_id);

-- Concurrency locks table
CREATE TABLE puppet_job_concurrency_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Lock identification
  lock_key TEXT UNIQUE NOT NULL,
  lock_type TEXT NOT NULL,
  
  -- Lock details
  locked_by TEXT NOT NULL,
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

-- Indexes for concurrency locks
CREATE INDEX idx_concurrency_locks_key ON puppet_job_concurrency_locks(lock_key);
CREATE INDEX idx_concurrency_locks_expires ON puppet_job_concurrency_locks(expires_at);
CREATE INDEX idx_concurrency_locks_type ON puppet_job_concurrency_locks(lock_type);

-- =====================================================
-- 4. ENABLE RLS AND CREATE POLICIES
-- =====================================================

ALTER TABLE puppet_job_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_cron_processor_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_job_concurrency_locks ENABLE ROW LEVEL SECURITY;

-- Execution logs policies
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

-- Cron state policies
CREATE POLICY "Only admins can manage cron processor state" ON puppet_cron_processor_state
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Concurrency locks policies
CREATE POLICY "Only service role can manage concurrency locks" ON puppet_job_concurrency_locks
  FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- 5. CREATE ALL DATABASE FUNCTIONS
-- =====================================================

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
  v_batch_id := gen_random_uuid();
  
  RETURN QUERY
  WITH available_jobs AS (
    SELECT 
      pj.id,
      pj.user_id,
      pj.job_type,
      pj.scheduled_at,
      pj.priority,
      COUNT(*) OVER (PARTITION BY pj.user_id) as user_concurrent_count
    FROM puppet_jobs pj
    WHERE pj.status = 'queued'
      AND pj.scheduled_at <= NOW()
      AND pj.final_status IS NULL
      AND pj.executing_at IS NULL
      AND (pj.concurrency_group = p_concurrency_group OR pj.concurrency_group IS NULL)
    ORDER BY pj.priority DESC, pj.scheduled_at ASC
    LIMIT p_batch_size * 2
  ),
  filtered_jobs AS (
    SELECT aj.*
    FROM available_jobs aj
    WHERE aj.user_concurrent_count <= 2
    LIMIT p_batch_size
  )
  UPDATE puppet_jobs 
  SET 
    executing_at = NOW(),
    executing_by = p_processor_id,
    execution_timeout_at = NOW() + INTERVAL '120 seconds',
    batch_id = v_batch_id,
    status = 'running'
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
  v_final_status := CASE 
    WHEN p_outcome = 'completed' THEN 'completed'
    WHEN p_outcome IN ('failed', 'timeout') THEN 'failed'
    ELSE 'failed'
  END;
  
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

-- Function: Reset stuck jobs
CREATE OR REPLACE FUNCTION reset_stuck_jobs(
  p_timeout_minutes INTEGER DEFAULT 5
) RETURNS INTEGER AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  UPDATE puppet_jobs 
  SET 
    status = 'queued',
    executing_at = NULL,
    executing_by = NULL,
    execution_timeout_at = NULL,
    last_execution_error = 'Reset due to timeout',
    updated_at = NOW()
  WHERE status = 'running'
    AND executing_at IS NOT NULL
    AND executing_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL;
    
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql;

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

-- Additional analytics functions...
-- (The rest of the functions from the original migration)

-- =====================================================
-- 6. CREATE MONITORING VIEWS
-- =====================================================

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
WHERE pj.status IN ('queued', 'running')
ORDER BY pj.executing_at DESC NULLS LAST;

-- =====================================================
-- 7. COMMENTS
-- =====================================================

COMMENT ON TABLE puppet_job_execution_logs IS 'Detailed execution logs for puppet jobs with performance metrics';
COMMENT ON TABLE puppet_cron_processor_state IS 'State and configuration for cron processor instances';
COMMENT ON TABLE puppet_job_concurrency_locks IS 'Concurrency control locks for job processing';

COMMENT ON FUNCTION fetch_jobs_for_batch IS 'Safely fetch and lock jobs for batch processing with concurrency limits';
COMMENT ON FUNCTION complete_job_execution IS 'Mark job execution as complete and update all related tracking';
COMMENT ON FUNCTION reset_stuck_jobs IS 'Reset jobs that have been stuck in executing state for too long';

-- =====================================================
-- MIGRATION COMPLETE ✅
-- ===================================================== 