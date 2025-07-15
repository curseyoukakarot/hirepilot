-- Add 'processing' as a valid status for campaign_executions
-- This prevents race conditions where the same execution gets processed multiple times

-- Update the comment to reflect the new status
COMMENT ON COLUMN campaign_executions.status IS 'Execution status: pending, started, running, processing, completed, failed';

-- Note: If there's a CHECK constraint on status, we would need to update it here
-- But since the original migration doesn't show a constraint, we just update the comment 