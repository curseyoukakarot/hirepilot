-- QUICK FIX: Use correct enum values for your system
-- Run this instead of the complete migration

-- Remove the enum update section since your enums are already correct
-- Just run the core parts with the right enum values

-- =====================================================
-- 1. DROP EXISTING TABLES (if any exist with errors)
-- =====================================================

DROP TABLE IF EXISTS puppet_job_concurrency_locks CASCADE;
DROP TABLE IF EXISTS puppet_cron_processor_state CASCADE;
DROP TABLE IF EXISTS puppet_job_execution_logs CASCADE;

-- =====================================================
-- 2. ADD MISSING COLUMNS TO PUPPET_JOBS TABLE
-- =====================================================

DO $$ 
BEGIN
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
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'final_status') THEN
    ALTER TABLE puppet_jobs ADD COLUMN final_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'executed_at') THEN
    ALTER TABLE puppet_jobs ADD COLUMN executed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add indexes using YOUR enum values
CREATE INDEX IF NOT EXISTS idx_puppet_jobs_cron_fetch ON puppet_jobs(status, scheduled_at, final_status, executing_at) 
  WHERE status = 'queued' AND final_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_puppet_jobs_executing ON puppet_jobs(executing_at, execution_timeout_at) 
  WHERE executing_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_puppet_jobs_user_concurrency ON puppet_jobs(user_id, status, executing_at) 
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS idx_puppet_jobs_batch ON puppet_jobs(batch_id) 
  WHERE batch_id IS NOT NULL;

-- =====================================================
-- 3. CREATE NEW TABLES
-- =====================================================

CREATE TABLE puppet_job_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES puppet_jobs(id) ON DELETE CASCADE,
  batch_id UUID,
  executor_id TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_ms INTEGER,
  outcome TEXT NOT NULL CHECK (outcome IN ('started', 'completed', 'failed', 'timeout', 'cancelled')),
  error_message TEXT,
  error_type TEXT,
  memory_usage_mb INTEGER,
  cpu_time_ms INTEGER,
  execution_context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_execution_logs_job_id ON puppet_job_execution_logs(job_id);
CREATE INDEX idx_execution_logs_batch ON puppet_job_execution_logs(batch_id);
CREATE INDEX idx_execution_logs_outcome ON puppet_job_execution_logs(outcome);
CREATE INDEX idx_execution_logs_start_time ON puppet_job_execution_logs(start_time);

CREATE TABLE puppet_cron_processor_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processor_id TEXT UNIQUE NOT NULL,
  hostname TEXT,
  process_id INTEGER,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_batch_at TIMESTAMPTZ,
  last_batch_size INTEGER DEFAULT 0,
  max_concurrent_jobs INTEGER DEFAULT 10,
  batch_size INTEGER DEFAULT 20,
  timeout_seconds INTEGER DEFAULT 120,
  total_jobs_processed INTEGER DEFAULT 0,
  total_batches_processed INTEGER DEFAULT 0,
  success_rate_percent DECIMAL(5,2) DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_batch_size CHECK (batch_size > 0 AND batch_size <= 100),
  CONSTRAINT valid_timeout CHECK (timeout_seconds > 0 AND timeout_seconds <= 3600)
);

CREATE INDEX idx_cron_state_active ON puppet_cron_processor_state(is_active, last_heartbeat);
CREATE INDEX idx_cron_state_processor ON puppet_cron_processor_state(processor_id);

CREATE TABLE puppet_job_concurrency_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_key TEXT UNIQUE NOT NULL,
  lock_type TEXT NOT NULL,
  locked_by TEXT NOT NULL,
  locked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  current_count INTEGER DEFAULT 1,
  max_count INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_lock_count CHECK (current_count <= max_count)
);

CREATE INDEX idx_concurrency_locks_key ON puppet_job_concurrency_locks(lock_key);
CREATE INDEX idx_concurrency_locks_expires ON puppet_job_concurrency_locks(expires_at);
CREATE INDEX idx_concurrency_locks_type ON puppet_job_concurrency_locks(lock_type);

-- =====================================================
-- 4. ENABLE RLS
-- =====================================================

ALTER TABLE puppet_job_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_cron_processor_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_job_concurrency_locks ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Only admins can manage cron processor state" ON puppet_cron_processor_state
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Only service role can manage concurrency locks" ON puppet_job_concurrency_locks
  FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- 5. CREATE FUNCTIONS (using correct enum values)
-- =====================================================

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
      pj.id, pj.user_id, pj.job_type, pj.scheduled_at, pj.priority,
      COUNT(*) OVER (PARTITION BY pj.user_id) as user_concurrent_count
    FROM puppet_jobs pj
    WHERE pj.status = 'queued'  -- Using YOUR enum value
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
    status = 'running'  -- Using YOUR enum value
  FROM filtered_jobs fj
  WHERE puppet_jobs.id = fj.id
  RETURNING puppet_jobs.id, puppet_jobs.user_id, puppet_jobs.job_type, puppet_jobs.scheduled_at, puppet_jobs.priority;
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE FUNCTION reset_stuck_jobs(
  p_timeout_minutes INTEGER DEFAULT 5
) RETURNS INTEGER AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  UPDATE puppet_jobs 
  SET 
    status = 'queued',  -- Using YOUR enum value
    executing_at = NULL,
    executing_by = NULL,
    execution_timeout_at = NULL,
    last_execution_error = 'Reset due to timeout',
    updated_at = NOW()
  WHERE status = 'running'  -- Using YOUR enum value
    AND executing_at IS NOT NULL
    AND executing_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL;
    
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. CREATE VIEWS (using correct enum values)
-- =====================================================

CREATE OR REPLACE VIEW puppet_jobs_execution_status AS
SELECT 
  pj.id, pj.user_id, pj.job_type, pj.status,
  pj.executing_at, pj.executing_by, pj.execution_timeout_at, pj.execution_attempts,
  EXTRACT(EPOCH FROM (NOW() - pj.executing_at)) as execution_duration_seconds,
  CASE 
    WHEN pj.executing_at IS NULL THEN 'idle'
    WHEN pj.execution_timeout_at < NOW() THEN 'timeout'
    WHEN pj.executing_at > NOW() - INTERVAL '2 minutes' THEN 'active'
    ELSE 'stale'
  END as execution_status,
  pj.last_execution_error
FROM puppet_jobs pj
WHERE pj.status IN ('queued', 'running')  -- Using YOUR enum values
ORDER BY pj.executing_at DESC NULLS LAST;

-- Comments
COMMENT ON TABLE puppet_job_execution_logs IS 'Detailed execution logs for puppet jobs with performance metrics';
COMMENT ON TABLE puppet_cron_processor_state IS 'State and configuration for cron processor instances';
COMMENT ON TABLE puppet_job_concurrency_locks IS 'Concurrency control locks for job processing'; 