-- Job Retry System - Part 1: Add Enum Values
-- This must be in a separate transaction from using the enum values

-- Update job status enum to include retry states
ALTER TYPE puppet_job_status ADD VALUE IF NOT EXISTS 'retry_pending';
ALTER TYPE puppet_job_status ADD VALUE IF NOT EXISTS 'permanently_failed';

-- Comments
COMMENT ON TYPE puppet_job_status IS 'Job status including retry states: pending, running, completed, failed, retry_pending, permanently_failed, cancelled'; 