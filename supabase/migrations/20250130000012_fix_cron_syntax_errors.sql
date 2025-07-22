-- Fix syntax errors from previous cron concurrency migration
-- This migration corrects the inline INDEX definitions that caused syntax errors

-- Drop and recreate the tables with correct syntax (if they exist with errors)

-- First, drop tables if they exist with syntax errors
DROP TABLE IF EXISTS puppet_job_concurrency_locks CASCADE;
DROP TABLE IF EXISTS puppet_cron_processor_state CASCADE;
DROP TABLE IF EXISTS puppet_job_execution_logs CASCADE;

-- Create job execution logs table with correct syntax
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

-- Create indexes for execution logs
CREATE INDEX idx_execution_logs_job_id ON puppet_job_execution_logs(job_id);
CREATE INDEX idx_execution_logs_batch ON puppet_job_execution_logs(batch_id);
CREATE INDEX idx_execution_logs_outcome ON puppet_job_execution_logs(outcome);
CREATE INDEX idx_execution_logs_start_time ON puppet_job_execution_logs(start_time);
CREATE INDEX idx_execution_logs_duration ON puppet_job_execution_logs(duration_ms) WHERE duration_ms IS NOT NULL;

-- Create cron processor state table with correct syntax
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

-- Create indexes for cron processor state
CREATE INDEX idx_cron_state_active ON puppet_cron_processor_state(is_active, last_heartbeat);
CREATE INDEX idx_cron_state_processor ON puppet_cron_processor_state(processor_id);

-- Create concurrency locks table with correct syntax
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

-- Create indexes for concurrency locks
CREATE INDEX idx_concurrency_locks_key ON puppet_job_concurrency_locks(lock_key);
CREATE INDEX idx_concurrency_locks_expires ON puppet_job_concurrency_locks(expires_at);
CREATE INDEX idx_concurrency_locks_type ON puppet_job_concurrency_locks(lock_type);

-- Re-enable RLS and create policies
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

-- Concurrency locks: Only service role can manage
CREATE POLICY "Only service role can manage concurrency locks" ON puppet_job_concurrency_locks
  FOR ALL USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE puppet_job_execution_logs IS 'Detailed execution logs for puppet jobs with performance metrics';
COMMENT ON TABLE puppet_cron_processor_state IS 'State and configuration for cron processor instances';
COMMENT ON TABLE puppet_job_concurrency_locks IS 'Concurrency control locks for job processing'; 