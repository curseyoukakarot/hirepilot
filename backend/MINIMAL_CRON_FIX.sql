-- MINIMAL CRON FIX - Handles missing columns gracefully
-- Run this in Supabase Dashboard → SQL Editor

-- =====================================================
-- 1. ADD ALL MISSING COLUMNS TO PUPPET_JOBS
-- =====================================================

DO $$ 
BEGIN
  -- Add all the columns we need for cron processing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'job_type') THEN
    ALTER TABLE puppet_jobs ADD COLUMN job_type TEXT DEFAULT 'unknown';
  END IF;
  
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
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'puppet_jobs' AND column_name = 'priority') THEN
    ALTER TABLE puppet_jobs ADD COLUMN priority INTEGER DEFAULT 0;
  END IF;
END $$;

-- =====================================================
-- 2. CREATE CORE TABLES ONLY
-- =====================================================

-- Drop existing tables if they have errors
DROP TABLE IF EXISTS puppet_job_concurrency_locks CASCADE;
DROP TABLE IF EXISTS puppet_cron_processor_state CASCADE;
DROP TABLE IF EXISTS puppet_job_execution_logs CASCADE;

-- Job execution logs - simplified
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
  execution_context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Basic indexes
CREATE INDEX idx_execution_logs_job_id ON puppet_job_execution_logs(job_id);
CREATE INDEX idx_execution_logs_batch ON puppet_job_execution_logs(batch_id);
CREATE INDEX idx_execution_logs_outcome ON puppet_job_execution_logs(outcome);

-- Cron processor state
CREATE TABLE puppet_cron_processor_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processor_id TEXT UNIQUE NOT NULL,
  hostname TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_batch_at TIMESTAMPTZ,
  last_batch_size INTEGER DEFAULT 0,
  max_concurrent_jobs INTEGER DEFAULT 10,
  batch_size INTEGER DEFAULT 20,
  timeout_seconds INTEGER DEFAULT 120,
  total_jobs_processed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_cron_state_active ON puppet_cron_processor_state(is_active, last_heartbeat);

-- Concurrency locks
CREATE TABLE puppet_job_concurrency_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_key TEXT UNIQUE NOT NULL,
  lock_type TEXT NOT NULL,
  locked_by TEXT NOT NULL,
  locked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  current_count INTEGER DEFAULT 1,
  max_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_concurrency_locks_key ON puppet_job_concurrency_locks(lock_key);
CREATE INDEX idx_concurrency_locks_expires ON puppet_job_concurrency_locks(expires_at);

-- =====================================================
-- 3. BASIC FUNCTIONS ONLY
-- =====================================================

-- Simple fetch function
CREATE OR REPLACE FUNCTION fetch_jobs_for_batch(
  p_batch_size INTEGER DEFAULT 20,
  p_processor_id TEXT DEFAULT 'unknown'
) RETURNS TABLE (
  job_id UUID,
  user_id UUID,
  scheduled_at TIMESTAMPTZ
) AS $$
DECLARE
  v_batch_id UUID;
BEGIN
  v_batch_id := gen_random_uuid();
  
  RETURN QUERY
  UPDATE puppet_jobs 
  SET 
    executing_at = NOW(),
    executing_by = p_processor_id,
    execution_timeout_at = NOW() + INTERVAL '120 seconds',
    batch_id = v_batch_id,
    status = 'running'
  WHERE id IN (
    SELECT id FROM puppet_jobs
    WHERE status = 'queued'
      AND scheduled_at <= NOW()
      AND final_status IS NULL
      AND executing_at IS NULL
    ORDER BY priority DESC, scheduled_at ASC
    LIMIT p_batch_size
  )
  RETURNING id, user_id, scheduled_at;
END;
$$ LANGUAGE plpgsql;

-- Simple complete function
CREATE OR REPLACE FUNCTION complete_job_execution(
  p_job_id UUID,
  p_outcome TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE puppet_jobs 
  SET 
    final_status = CASE 
      WHEN p_outcome = 'completed' THEN 'completed'
      ELSE 'failed'
    END,
    executed_at = NOW(),
    executing_at = NULL,
    executing_by = NULL,
    execution_timeout_at = NULL,
    last_execution_error = p_error_message,
    execution_attempts = execution_attempts + 1,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Simple reset function
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
    last_execution_error = 'Reset due to timeout'
  WHERE status = 'running'
    AND executing_at IS NOT NULL
    AND executing_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL;
    
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. ENABLE RLS 
-- =====================================================

ALTER TABLE puppet_job_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_cron_processor_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_job_concurrency_locks ENABLE ROW LEVEL SECURITY;

-- Basic policies
CREATE POLICY "Service role can manage execution logs" ON puppet_job_execution_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage cron state" ON puppet_cron_processor_state
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage locks" ON puppet_job_concurrency_locks
  FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- MINIMAL SETUP COMPLETE ✅
-- ===================================================== 